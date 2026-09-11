/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_DESCRIPTION_CORPUS_SQL, prepareInventoryDescriptionCorpus } from './inventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from './sourceConflictAuthorityGuard.mjs';

export const INVENTORY_DESCRIPTION_REFRESH_STATE_SQL = `
  SELECT rag_enabled, embedding_provider_mode, primary_provider, embedding_model,
    embedding_ollama_host, embedding_ollama_port, embedding_ollama_model,
    ollama_host, ollama_port,
    (EXISTS (SELECT 1 FROM task_queue
       WHERE status='processing' OR (status='pending' AND next_retry_at <= now()))
     OR EXISTS (
       SELECT 1 FROM (
         SELECT DISTINCT ON (library_id) status FROM media_server_sync_status
         WHERE library_id IS NOT NULL ORDER BY library_id, created_at DESC, id DESC
       ) latest_sync WHERE status='running'
     )) AS busy
  FROM ai_provider_config WHERE id=1
`;

export function createInventoryDescriptionRefreshRepository({ withTransaction }) {
  // SET LOCAL never changes settings for other pooled connections or request paths.
  const query = (sql, parameters = []) => withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    return client.query(sql, parameters);
  });
  return {
    query,
    async readState() {
      const { rows } = await query(INVENTORY_DESCRIPTION_REFRESH_STATE_SQL);
      return rows[0] ?? null;
    },
    async readCorpus() {
      // A single statement snapshot; no historic comparison sampler or inference.
      const { rows } = await query(INVENTORY_DESCRIPTION_CORPUS_SQL, [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
      return prepareInventoryDescriptionCorpus(rows);
    },
  };
}
