/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { adjudicationDigest, readAdjudicationBatch } from './cachedAdjudicationContract.mjs';
import { isTrustedLocalOllamaEndpoint } from './ollamaLocalEndpointTrust.mjs';

export function projectAdjudicationConfig(config) {
  if (config?.primary_provider !== 'ollama' || typeof config.ollama_model !== 'string' || !config.ollama_model.trim()) return null;
  return { fingerprint: adjudicationDigest(config), promptConfig: { primary_provider: 'ollama',
    ollama_host: isTrustedLocalOllamaEndpoint(config.ollama_host) ? 'http://localhost' : null } };
}
export const PRUNE_ADJUDICATION_SQL = `DELETE FROM cached_adjudication_batch
  WHERE captured_at > statement_timestamp() OR expires_at <= statement_timestamp()`;

export async function readCachedAdjudication(client, configuration) {
  const { rows } = await client.query(`SELECT batch FROM cached_adjudication_batch
    WHERE captured_at <= transaction_timestamp() AND expires_at > transaction_timestamp()`);
  return readAdjudicationBatch(rows[0]?.batch, configuration);
}

/** Only an explicitly requested private capture calls this writer. Atomic replacement, no partial batch. */
export function createCachedAdjudicationWriter({ withTransaction }) {
  return async (batch, signal) => {
    if (!readAdjudicationBatch(batch, batch?.configuration) || Buffer.byteLength(JSON.stringify(batch)) > 1048576) {
      throw new Error('adjudication_batch_invalid');
    }
    return withTransaction(async client => {
      signal?.throwIfAborted();
      await client.query("SET LOCAL statement_timeout = '15s'");
      await client.query("SET LOCAL lock_timeout = '1s'");
      await client.query(`INSERT INTO cached_adjudication_batch(singleton,batch,captured_at,expires_at)
        VALUES(true,$1::jsonb,statement_timestamp(),statement_timestamp()+interval '7 days')
        ON CONFLICT(singleton) DO UPDATE SET batch=EXCLUDED.batch,
          (captured_at,expires_at)=(SELECT
            CASE WHEN retain THEN cached_adjudication_batch.captured_at ELSE EXCLUDED.captured_at END,
            CASE WHEN retain THEN cached_adjudication_batch.expires_at ELSE EXCLUDED.expires_at END
            FROM (SELECT cached_adjudication_batch.captured_at <= statement_timestamp()
              AND cached_adjudication_batch.expires_at > statement_timestamp()
              AND cached_adjudication_batch.batch->'identity'=EXCLUDED.batch->'identity'
              AND cached_adjudication_batch.batch->'configuration'=EXCLUDED.batch->'configuration' AS retain) retention)`,
      [JSON.stringify(batch)]);
      signal?.throwIfAborted();
    });
  };
}
