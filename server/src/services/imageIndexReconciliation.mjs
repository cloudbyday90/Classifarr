/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../utils/backupRestoreSessionContract.mjs';
import { IMAGE_INDEX_LOCK_KEY } from './imageIndexMaintenanceContract.mjs';
import { inspectImageIndexes } from './imageIndexMaintenanceCatalog.mjs';
import { readImageIndexDemand, readImageIndexReadiness } from './imageIndexReadiness.mjs';

async function reconcile(query) {
  const admission = await query('SELECT pg_try_advisory_xact_lock_shared($1) AS acquired', [RUNTIME_MAINTENANCE_LOCK_KEY]);
  if (admission.rows[0]?.acquired !== true) return { status: 'deferred', reason: 'runtime_or_restore_active' };
  const gate = (await query('SELECT gate_state FROM public.policy_native_intent_reconciliation_restore_gates WHERE gate_id = 1')).rows[0];
  if (gate?.gate_state !== 'ready') return { status: 'deferred', reason: 'restore_verification_required' };
  const demand = await readImageIndexDemand(query);
  if (demand !== 'needed') return { status: 'idle', reason: demand };
  const lock = await query('SELECT pg_try_advisory_xact_lock($1) AS acquired', [IMAGE_INDEX_LOCK_KEY]);
  if (lock.rows[0]?.acquired !== true) return { status: 'deferred', reason: 'maintenance_busy' };
  // Shared with the executor: a catalogue observation is never a DDL authorization.
  let plan;
  try { plan = await inspectImageIndexes(query); }
  catch (error) {
    if (error.message !== 'image_index_definition_mismatch') throw error;
    return { status: 'review', reason: 'definition_mismatch' };
  }
  const active = (await query(`SELECT id FROM public.task_queue WHERE task_type = 'rebuild_hnsw_index'
    AND status IN ('pending', 'processing') ORDER BY id LIMIT 1`)).rows[0];
  if (active) return { status: 'queued', reason: 'existing_task', taskId: active.id };
  const state = (await query('SELECT * FROM public.image_index_reconciliation_state WHERE singleton')).rows[0];
  if (plan.every(value => value.action === 'preserve')) {
    if (state?.task_id != null || state?.attempts > 0) {
      await query(`UPDATE public.image_index_reconciliation_state SET task_id = NULL, attempts = 0,
        last_result = 'healthy' WHERE singleton`);
    }
    return { status: 'idle', reason: 'healthy' };
  }
  // A missing/pruned/failed job is not permission to start a new episode.
  if (state?.task_id != null) return { status: 'review', reason: 'repair_unverified', taskId: state.task_id };
  const readiness = await readImageIndexReadiness(query);
  if (readiness !== 'ready') return { status: 'deferred', reason: readiness };
  const task = (await query(`INSERT INTO public.task_queue (task_type, payload, source, priority, max_attempts)
    VALUES ('rebuild_hnsw_index', '{}', 'image_index_reconciliation', 1, 3) RETURNING id`)).rows[0];
  await query(`INSERT INTO public.image_index_reconciliation_state (singleton, task_id, last_result)
    VALUES (true, $1, 'queued') ON CONFLICT (singleton) DO UPDATE
    SET task_id = EXCLUDED.task_id, last_result = 'queued'`, [task.id]);
  return { status: 'queued', reason: 'repair_needed', taskId: task.id,
    missing: plan.filter(value => value.action === 'create').length,
    invalid: plan.filter(value => value.action === 'repair').length };
}

/** Short, bounded admission transaction. Never performs DDL or calls a model. */
export async function reconcileImageIndexes({ database }) {
  const client = await database.pool.connect();
  const lease = createDatabaseClientLease(client, { operation: 'image_index_reconciliation' });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; lease.release(true); }, 10_000); timer.unref();
  const query = async (sql, params) => {
    lease.assertHealthy();
    if (timedOut) throw new Error('image_index_reconciliation_deadline');
    const result = await client.query(sql, params);
    lease.assertHealthy();
    if (timedOut) throw new Error('image_index_reconciliation_deadline');
    return result;
  };
  try {
    await query('BEGIN');
    await query("SET LOCAL statement_timeout = '3s'");
    await query("SET LOCAL lock_timeout = '1s'");
    await query("SET LOCAL transaction_timeout = '8s'");
    await query('SET LOCAL search_path = pg_catalog, public, pg_temp');
    const result = await reconcile(query);
    await query('COMMIT');
    return result;
  } finally { clearTimeout(timer); lease.release(true); }
}
