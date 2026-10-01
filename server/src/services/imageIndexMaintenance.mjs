/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../utils/backupRestoreSessionContract.mjs';
import { IMAGE_INDEX_LOCK_KEY, IMAGE_INDEX_BUDGET_MS } from './imageIndexMaintenanceContract.mjs';
import { inspectImageIndexes } from './imageIndexMaintenanceCatalog.mjs';
import { admitAutomaticImageIndexAttempt } from './imageIndexAutomaticAdmission.mjs';
import { admitImageIndexCapacity } from './imageIndexCapacityAdmission.mjs';
import { captureImageIndexClaim, claimNextImageIndexTask, imageIndexClaimRemaining,
  finishImageIndexClaim } from './imageIndexMaintenanceClaims.mjs';

/** task supplied: legacy online queue path. No task: exclusive one-shot maintenance. */
export async function runImageIndexMaintenance({ database, task = null, readMemory = null, monitorClientDisconnect = false }) {
  let claim = task === null ? null : captureImageIndexClaim(task);
  const online = task !== null;
  const client = await database.pool.connect();
  const lease = createDatabaseClientLease(client, { operation: 'image_index_maintenance' });
  const deadline = performance.now() + IMAGE_INDEX_BUDGET_MS;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; lease.release(true); }, IMAGE_INDEX_BUDGET_MS);
  timer.unref();
  const query = async (sql, params = [], timeout = 5000) => {
    lease.assertHealthy();
    const remaining = Math.floor(deadline - performance.now());
    if (timedOut || remaining <= 0) throw new Error('image_index_maintenance_deadline');
    await client.query("SELECT set_config('statement_timeout', $1, false)", [`${Math.min(timeout, remaining)}ms`]);
    lease.assertHealthy();
    if (timedOut) throw new Error('image_index_maintenance_deadline');
    const result = await client.query(sql, params);
    lease.assertHealthy();
    if (timedOut) throw new Error('image_index_maintenance_deadline');
    return result;
  };
  const defer = async reason => {
    if (claim) await finishImageIndexClaim(query, claim, { status: 'deferred' });
    return { status: 'deferred', reason };
  };
  try {
    await query("SET lock_timeout = '2s'");
    // Only the validated colocated Linux worker enables socket liveness polling.
    // Worker exit otherwise need not interrupt a CPU-bound PostgreSQL statement.
    if (monitorClientDisconnect === true) await query("SET client_connection_check_interval = '1s'");
    await query('SET search_path = pg_catalog, public, pg_temp');
    const admission = await query(online
      ? 'SELECT pg_try_advisory_lock_shared($1) AS acquired'
      : 'SELECT pg_try_advisory_lock($1) AS acquired', [RUNTIME_MAINTENANCE_LOCK_KEY]);
    // Do not mutate a queue being restored when admission is unavailable.
    if (admission.rows[0]?.acquired !== true) return { status: 'deferred', reason: 'runtime_or_restore_active' };
    const gate = await query('SELECT gate_state FROM public.policy_native_intent_reconciliation_restore_gates WHERE gate_id = 1');
    if (gate.rows[0]?.gate_state !== 'ready') return { status: 'deferred', reason: 'restore_verification_required' };
    const lock = await query('SELECT pg_try_advisory_lock($1) AS acquired', [IMAGE_INDEX_LOCK_KEY]);
    if (lock.rows[0]?.acquired !== true) return await defer('image_index_maintenance_busy');
    if (!online) claim = await claimNextImageIndexTask(query);
    if (!claim) return { status: 'no_work' };
    await imageIndexClaimRemaining(query, claim);
    const plan = await inspectImageIndexes(query);
    const capacity = await admitImageIndexCapacity(query, claim, plan, readMemory);
    if (capacity.status === 'deferred') {
      await finishImageIndexClaim(query, claim, { status: 'deferred', retrySeconds: 900 });
      return capacity;
    }
    await query(capacity.workMemMiB === 512 ? "SET maintenance_work_mem = '512MB'" : "SET maintenance_work_mem = '64MB'");
    await query('SET max_parallel_maintenance_workers = 0');
    if (plan.some(value => value.action !== 'preserve')) {
      const admission = await admitAutomaticImageIndexAttempt(query, claim);
      if (admission.status === 'review') {
        await finishImageIndexClaim(query, claim, { status: 'review' });
        return admission;
      }
      if (admission.status === 'deferred') {
        await finishImageIndexClaim(query, claim, { status: 'deferred', retrySeconds: 900 });
        return admission;
      }
    }
    const execute = async sql => {
      const remaining = await imageIndexClaimRemaining(query, claim);
      await query(sql, [], remaining);
    };
    for (const { index, action } of plan) {
      if (action === 'preserve') continue;
      // Reinspect all names before destructive recovery, guarding cooperative retries.
      const current = await inspectImageIndexes(query);
      const state = current.find(value => value.index.name === index.name);
      if (state.action === 'preserve') continue;
      if (state.action === 'repair') await execute(index.drop);
      await execute(index.create);
    }
    if ((await inspectImageIndexes(query)).some(value => value.action !== 'preserve')) {
      throw new Error('image_index_verification_failed');
    }
    const result = { rebuilt: true, workMemMiB: capacity.workMemMiB, indexes: plan.map(value => value.index.name),
      created: plan.filter(value => value.action === 'create').length,
      repaired: plan.filter(value => value.action === 'repair').length };
    await finishImageIndexClaim(query, claim, { status: 'complete', result });
    return { status: 'complete', ...result };
  } catch (error) {
    // Online queue processor owns its normal failure policy. One-shot mode has no worker.
    if (!online && claim && !lease.failed && !timedOut) {
      try { await finishImageIndexClaim(query, claim, { status: 'failed' }); }
      catch { /* Expired/lost claims remain recoverable by the normal queue lease. */ }
    }
    if (timedOut) throw new Error('image_index_maintenance_deadline');
    throw error;
  } finally {
    clearTimeout(timer);
    // Never return session locks, changed resource settings or a broken client to the pool.
    lease.release(true);
  }
}
