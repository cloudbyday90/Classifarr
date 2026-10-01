/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';
import { inspectImageIndexes } from './imageIndexMaintenanceCatalog.mjs';
import { IMAGE_INDEXES } from './imageIndexMaintenanceContract.mjs';
import { readImageIndexDemand, readImageIndexReadiness } from './imageIndexReadiness.mjs';
import { buildImageIndexProgress } from './imageIndexProgress.mjs';

async function observe(query) {
  const demand = await readImageIndexDemand(query);
  const evidence = { demand, observedAt: new Date().toISOString(), gate: null,
    indexes: null, phase: null, state: null, task: null, readiness: 'unavailable' };
  if (demand !== 'needed') return buildImageIndexProgress(evidence);
  evidence.gate = (await query('SELECT gate_state FROM public.policy_native_intent_reconciliation_restore_gates WHERE gate_id = 1')).rows[0]?.gate_state;
  if (evidence.gate !== 'ready') return buildImageIndexProgress(evidence);
  try {
    evidence.indexes = (await inspectImageIndexes(query)).map(({ index, action }) => ({
      key: index.name, status: { preserve: 'verified', create: 'missing', repair: 'invalid' }[action],
    }));
  } catch (error) {
    if (error.message !== 'image_index_definition_mismatch') throw error;
    return buildImageIndexProgress(evidence);
  }
  evidence.phase = (await query(`SELECT CASE
      WHEN p.phase LIKE 'waiting for%' THEN 'waiting_for_database'
      WHEN p.phase LIKE 'index validation:%' THEN 'validating'
      ELSE 'building' END AS phase
    FROM pg_stat_progress_create_index p JOIN pg_class c ON c.oid = p.index_relid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.datid = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND p.relid = to_regclass('public.classification_embeddings')
      AND p.phase IS NOT NULL
      AND n.nspname = 'public' AND c.relname = ANY($1::text[])
    ORDER BY c.relname LIMIT 1`, [IMAGE_INDEXES.map(index => index.name)])).rows[0]?.phase;
  evidence.state = (await query(`SELECT task_id, attempts, next_attempt_at
    FROM public.image_index_reconciliation_state WHERE singleton`)).rows[0];
  evidence.task = (await query(`SELECT id, status, source, next_retry_at,
      claim_token IS NOT NULL AND visible_at > clock_timestamp() AS live_claim
    FROM public.task_queue WHERE task_type = 'rebuild_hnsw_index'
      AND (status IN ('pending', 'processing') OR id = $1)
    ORDER BY (status IN ('pending', 'processing')) DESC, id LIMIT 1`,
  [evidence.state?.task_id ?? null])).rows[0];
  if (!evidence.phase && evidence.indexes.some(index => index.status !== 'verified')) {
    evidence.readiness = await readImageIndexReadiness(query, evidence.task?.id ?? null);
  }
  return buildImageIndexProgress(evidence);
}

async function readReport(database) {
  const client = await database.pool.connect();
  const lease = createDatabaseClientLease(client, { operation: 'image_index_progress' });
  let expired = false;
  const timer = setTimeout(() => { expired = true; lease.release(true); }, 10_000);
  timer.unref();
  const query = async (sql, params) => {
    lease.assertHealthy();
    if (expired) throw new Error('observation_deadline');
    const result = await client.query(sql, params);
    lease.assertHealthy();
    if (expired) throw new Error('observation_deadline');
    return result;
  };
  try {
    await query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await query("SET LOCAL statement_timeout = '3s'");
    await query("SET LOCAL lock_timeout = '1s'");
    await query("SET LOCAL transaction_timeout = '8s'");
    await query('SET LOCAL search_path = pg_catalog, public, pg_temp');
    const report = await observe(query);
    await query('COMMIT');
    return report;
  } finally { clearTimeout(timer); lease.release(true); }
}

/** Per-router coalescing, no cache, no provider calls or maintenance imports. */
export function createImageIndexProgressService({ database }) {
  let active = null;
  return { getReport() {
    active ??= readReport(database).catch(() => ({ status: 'unavailable', reason: 'observation_failed',
      observedAt: new Date().toISOString(), indexes: null, automatic: null,
    })).finally(() => { active = null; });
    return active;
  } };
}
