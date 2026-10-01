/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../utils/backupRestoreSessionContract.mjs';
import { loadQueueVacuumState } from './queueVacuumObservation.mjs';
import { prepareQueueVacuumRecovery, reserveQueueVacuumAttempt,
  finishQueueVacuumAttempt } from './queueVacuumRecoveryRepository.mjs';

const BUDGET_MS = 60_000;
const VACUUM_SQL = "VACUUM (ANALYZE, SKIP_LOCKED, TRUNCATE FALSE, PARALLEL 0, BUFFER_USAGE_LIMIT '2MB') ONLY public.task_queue";
const counter = value => /^\d+$/.test(String(value)) ? BigInt(value) : null;

function verifyCompletion(before, after) {
  if (!after || after.relation_oid !== before.relation_oid || after.relation_supported !== true
    || String(after.stats_reset) !== String(before.stats_reset)) return false;
  return ['vacuum_count', 'analyze_count'].every(key => {
    const initial = counter(before[key]), final = counter(after[key]);
    return initial !== null && final !== null && final > initial;
  });
}

/** Fixed bounded executor; automatic callers must pass durable pressure/readiness admission. */
export async function runQueueVacuumMaintenance({ database, automatic = false, report = () => {} }) {
  if (typeof automatic !== 'boolean') throw new TypeError('Invalid queue vacuum mode');
  const client = await database.pool.connect();
  const lease = createDatabaseClientLease(client, { operation: 'queue_vacuum_maintenance' });
  const deadline = performance.now() + BUDGET_MS;
  let timedOut = false, warning = false, reserved = false;
  const timer = setTimeout(() => { timedOut = true; lease.release(true); }, BUDGET_MS);
  timer.unref();
  // PostgreSQL can resolve VACUUM even when a permission check skips the relation.
  const onNotice = notice => {
    if (notice.severity === 'WARNING' || notice.code?.startsWith('01')) warning = true;
  };
  client.on('notice', onNotice);
  const query = async (sql, params = [], timeout = 5000) => {
    lease.assertHealthy();
    const remaining = Math.floor(deadline - performance.now());
    if (timedOut || remaining <= 0) throw new Error('queue_vacuum_deadline');
    await client.query("SELECT set_config('statement_timeout', $1, false)", [`${Math.min(timeout, remaining)}ms`]);
    lease.assertHealthy();
    if (timedOut) throw new Error('queue_vacuum_deadline');
    const result = await client.query(sql, params);
    lease.assertHealthy();
    if (timedOut) throw new Error('queue_vacuum_deadline');
    return result;
  };
  try {
    await query("SET lock_timeout = '2s'");
    await query('SET search_path = pg_catalog, public, pg_temp');
    const admission = await query(automatic ? 'SELECT pg_try_advisory_lock_shared($1) AS acquired'
      : 'SELECT pg_try_advisory_lock($1) AS acquired', [RUNTIME_MAINTENANCE_LOCK_KEY]);
    if (admission.rows[0]?.acquired !== true) return { status: 'deferred', reason: 'runtime_or_restore_active' };
    const gate = await query('SELECT gate_state FROM public.policy_native_intent_reconciliation_restore_gates WHERE gate_id = 1');
    if (gate.rows[0]?.gate_state !== 'ready') return { status: 'deferred', reason: 'restore_verification_required' };
    const lock = await query('SELECT pg_try_advisory_lock($1) AS acquired', [2027]);
    if (lock.rows[0]?.acquired !== true) return { status: 'deferred', reason: 'queue_vacuum_busy' };
    // Also exclude the existing retention drain; do not add I/O while it deletes batches.
    const cleanupLock = await query('SELECT pg_try_advisory_lock($1) AS acquired', [2012]);
    if (cleanupLock.rows[0]?.acquired !== true) return { status: 'deferred', reason: 'queue_cleanup_active' };
    const before = await loadQueueVacuumState(query);
    if (before?.relation_supported !== true) throw new Error('queue_vacuum_relation_unsupported');
    if (automatic) {
      const decision = await prepareQueueVacuumRecovery(query, before);
      if (decision.status !== 'admitted') return decision;
    }
    if (before.can_maintain !== true) return { status: 'deferred', reason: 'maintenance_privilege_required' };
    if (before.track_counts !== true || before.statistics_available !== true) {
      return { status: 'deferred', reason: 'statistics_required' };
    }
    if (before.vacuum_running !== false) return { status: 'deferred', reason: 'vacuum_active' };
    await query("SET maintenance_work_mem = '64MB'");
    await query('SET max_parallel_maintenance_workers = 0');
    await query("SET vacuum_cost_delay = '2ms'");
    await query('SET vacuum_cost_limit = 200');
    await query('SET client_min_messages = warning');
    if (automatic) {
      // Committed before VACUUM: disconnects and restarts cannot bypass cooldown/attempt limits.
      await reserveQueueVacuumAttempt(query);
      reserved = true;
      report({ status: 'started', reason: 'sustained_pressure', estimatedDeadRows: Number(before.n_dead_tup) });
    }
    const result = await query(VACUUM_SQL, [], BUDGET_MS);
    if (warning || result.command !== 'VACUUM') throw new Error('queue_vacuum_not_confirmed');
    await query('SELECT pg_stat_clear_snapshot()');
    if (!verifyCompletion(before, await loadQueueVacuumState(query))) throw new Error('queue_vacuum_not_confirmed');
    if (automatic) await finishQueueVacuumAttempt(query, true);
    return { status: 'complete', relation: 'task_queue', vacuum: true, analyze: true };
  } catch (error) {
    if (reserved && !timedOut && !lease.failed) {
      try { await finishQueueVacuumAttempt(query, false); }
      catch { /* The durable reservation still prevents immediate retry. */ }
    }
    throw error;
  } finally {
    clearTimeout(timer);
    client.removeListener('notice', onNotice);
    lease.release(true);
  }
}
