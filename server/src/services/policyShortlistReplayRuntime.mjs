/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import pg from 'pg';
import { createLiveInventoryDescriptionRepository } from './liveInventoryDescriptionRepository.mjs';
import { createLiveInventoryDescriptionRetriever } from './liveInventoryDescriptionRetriever.mjs';
import { createCurrentLibraryCandidateRetriever } from './currentLibraryCandidateRetriever.mjs';
import { readLibraryProfileObservation } from './libraryProfileQueries.mjs';
import { createLocalDescriptionBenchmarkClient } from './localDescriptionBenchmarkClient.mjs';
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const POLICY_SHORTLIST_REPLAY_SOURCE_SQL = `WITH latest AS (SELECT DISTINCT ON (media_type, tmdb_id)
  media_type, tmdb_id, title, year, metadata
  FROM classification_history WHERE media_type IN ('movie','tv') AND tmdb_id > 0
    AND jsonb_typeof(metadata->'policyResult')='object' AND octet_length(metadata::text) <= 262144
  ORDER BY media_type, tmdb_id, created_at DESC, id DESC)
  SELECT *, count(*) OVER ()::integer AS retained_identities FROM latest
  ORDER BY md5($1 || media_type || ':' || tmdb_id::text), media_type, tmdb_id LIMIT 300`;

/** Separate read-only snapshots; no transaction is held open during generation. */
export function createPolicyShortlistReplayRepository({ withTransaction }) {
  return { async read(seed = 'policy-shortlist-replay') {
    return withTransaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL statement_timeout = '15s'");
      await client.query("SET LOCAL lock_timeout = '1s'");
      const config = (await client.query(`SELECT rag_enabled, primary_provider, ollama_host, ollama_port,
        ollama_model, configuration_revision FROM ai_provider_config WHERE id=1`)).rows[0];
      const libraries = (await client.query(`SELECT * FROM libraries WHERE is_active=true
        AND media_type IN ('movie','tv') ORDER BY id LIMIT 65`)).rows;
      const rows = (await client.query(POLICY_SHORTLIST_REPLAY_SOURCE_SQL, [seed])).rows;
      if (rows.length > 300 || libraries.length > 64) throw new Error('policy_replay_source_budget');
      const cases = rows.flatMap(row => {
        const projection = projectInventoryDescription({ metadata: row.metadata });
        const policyResult = row.metadata?.policyResult;
        if (!projection || !Array.isArray(policyResult?.ranked) || policyResult.ranked.length > 64 ||
            !Number.isInteger(row.tmdb_id) || typeof row.title !== 'string' || !row.title.trim()) return [];
        // Preserve the fields consumed by production prompt and learned-profile readers.
        const fields = ['genres', 'keywords', 'certification', 'studio', 'content_rating'];
        const metadata = { ...Object.fromEntries(fields.map(key => [key, row.metadata[key]])),
          tmdb_id: row.tmdb_id, media_type: row.media_type, title: row.title.slice(0, 500), year: row.year,
          overview: projection.text };
        const bestMatch = row.metadata.contentAnalysis?.bestMatch;
        if (bestMatch) metadata.contentAnalysis = { bestMatch: { type: bestMatch.type, confidence: bestMatch.confidence } };
        return [{ metadata, policyResult }];
      });
      return { config, libraries, cases, retainedIdentities: rows[0]?.retained_identities ?? 0, skippedMetadata: rows.length - cases.length,
        fingerprint: hash({ config, libraries, rows }) };
    });
  } };
}

/** The dedicated pool enforces read-only even for injected production readers. */
export async function loadPolicyShortlistReplayRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  const db = await import('../config/database.mjs');
  const pool = new pg.Pool({ ...db.pool.options, max: 2, min: 0,
    options: '-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000',
    application_name: 'classifarr-shortlist-replay' });
  const withTransaction = async callback => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  const query = (sql, parameters) => pool.query(sql, parameters);
  const repository = createLiveInventoryDescriptionRepository({ withTransaction });
  const current = createCurrentLibraryCandidateRetriever({ query,
    logger: Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, () => {}])) });
  return { repository: createPolicyShortlistReplayRepository({ withTransaction }),
    retrieve: createLiveInventoryDescriptionRetriever({ repository, maxCandidates: 64 }).retrieve,
    readProfile: async id => (await readLibraryProfileObservation({ query }, id)).stats,
    retrieveCurrent: current.retrieve,
    createClient: config => createLocalDescriptionBenchmarkClient(config),
    close: async () => { await pool.end(); await db.pool.end(); } };
}
