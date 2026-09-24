/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildInventoryDescriptionCorpusSql } from './inventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS,
  sourceConflictAuthorityPredicateForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';

export const LIBRARY_EVIDENCE_COVERAGE_ROW_LIMIT = 10000;

const SOURCE_SQL = `SELECT l.id, l.media_type, l.is_active,
    s.revision AS inventory_revision, transaction_timestamp() AS observed_at,
    COUNT(msi.id)::integer AS item_count,
    COUNT(msi.id) FILTER (WHERE msi.media_type IS DISTINCT FROM l.media_type)::integer AS type_mismatch_count,
    COUNT(msi.id) FILTER (WHERE msi.media_type=l.media_type AND
      (msi.tmdb_id IS NULL OR msi.tmdb_id<=0))::integer AS missing_identity_count,
    COUNT(msi.id) FILTER (WHERE msi.media_type=l.media_type AND msi.tmdb_id>0 AND
      ${sourceConflictAuthorityPredicateForMediaServerItem('$2')})::integer AS source_conflict_count
  FROM libraries l
  LEFT JOIN library_profile_inventory_state s ON s.library_id=l.id
  LEFT JOIN media_server_items msi ON msi.library_id=l.id
  WHERE l.id=$1::integer
  GROUP BY l.id,s.revision`;

const CORPUS_SQL = buildInventoryDescriptionCorpusSql({ libraryScoped: true,
  limit: LIBRARY_EVIDENCE_COVERAGE_ROW_LIMIT + 1 });

const CONFIG_SQL = `SELECT rag_enabled, embedding_provider_mode, primary_provider,
  embedding_model, embedding_ollama_host, embedding_ollama_port, embedding_ollama_model,
  ollama_host, ollama_port FROM ai_provider_config WHERE id=1`;

/** One bounded repeatable-read window; private descriptions never leave the service. */
export async function withLibraryEvidenceCoverageSnapshot(db, libraryId, project) {
  return db.withTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '20s'");
    await client.query("SET LOCAL transaction_timeout = '30s'");
    const source = (await client.query(SOURCE_SQL,
      [libraryId, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS])).rows[0] ?? null;
    if (!source || !source.is_active || !['movie', 'tv'].includes(source.media_type) ||
        Number(source.item_count) === 0) return project({ source, rows: null, config: null,
      query: (sql, values) => client.query(sql, values) });
    const rows = (await client.query(CORPUS_SQL,
      [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, libraryId])).rows;
    const config = rows.length <= LIBRARY_EVIDENCE_COVERAGE_ROW_LIMIT
      ? (await client.query(CONFIG_SQL)).rows[0] ?? null : null;
    return project({ source, rows, config, query: (sql, values) => client.query(sql, values) });
  });
}
