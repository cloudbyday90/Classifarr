/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';
import { loadQueueVacuumState } from './queueVacuumObservation.mjs';
import { evaluateQueueVacuumRecovery } from './queueVacuumRecoveryPolicy.mjs';

/** Read-only hint, never repair admission. The trusted worker reobserves all conditions. */
export async function assessQueueVacuumHandoff({ database }) {
  const client = await database.pool.connect();
  const lease = createDatabaseClientLease(client, { operation: 'queue_vacuum_handoff_observation' });
  const timer = setTimeout(() => lease.release(true), 5000); timer.unref();
  const query = async (sql, params) => { lease.assertHealthy(); const value = await client.query(sql, params); lease.assertHealthy(); return value; };
  try {
    await query('BEGIN READ ONLY');
    await query("SET LOCAL statement_timeout = '3s'");
    const row = await loadQueueVacuumState(query);
    if (row?.relation_supported !== true) throw new Error('queue_handoff_observation_unavailable');
    const state = (await query('SELECT * FROM public.queue_vacuum_recovery_state WHERE singleton')).rows[0];
    const decision = evaluateQueueVacuumRecovery(row, state ?? { attempts: 0 });
    await query('COMMIT');
    const changed = state?.last_result !== decision.reason;
    const request = decision.reason === 'healthy'
      ? Boolean(state && (changed || state.attempts > 0 || state.pressure_since))
      : !(['cooldown', 'attempt_limit', 'statistics_required', 'autovacuum_disabled'].includes(decision.reason) && !changed);
    return { request, status: decision.reason === 'healthy' ? 'idle' : 'deferred', reason: decision.reason };
  } finally { clearTimeout(timer); lease.release(true); }
}
