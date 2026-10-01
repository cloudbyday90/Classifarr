/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateQueueVacuumRecovery } from './queueVacuumRecoveryPolicy.mjs';
import { readInventoryBackgroundReadiness } from './inventoryBackgroundReadiness.mjs';

/** Caller holds shared runtime admission and the exclusive queue-vacuum session lock. */
export async function prepareQueueVacuumRecovery(query, row) {
  let state = (await query('SELECT * FROM public.queue_vacuum_recovery_state WHERE singleton')).rows[0];
  // Fresh schema snapshots retain structure, not operational rows; initialize under our session lock.
  state ??= (await query(`INSERT INTO public.queue_vacuum_recovery_state (singleton) VALUES (true)
    ON CONFLICT (singleton) DO NOTHING RETURNING *`)).rows[0];
  if (!state) throw new Error('queue_vacuum_recovery_state_missing');
  const decision = evaluateQueueVacuumRecovery(row, state);
  if (decision.run) {
    // Reuse the platform's authoritative ingestion/backfill readiness contract on this session.
    const readiness = await readInventoryBackgroundReadiness({ withTransaction: async callback => {
      await query('BEGIN');
      try {
        const value = await callback({ query: (sql, params) => query(sql, params, 3000) });
        await query('COMMIT');
        return value;
      } catch (error) { await query('ROLLBACK'); throw error; }
    } }, { requireRag: false });
    if (readiness !== 'ready') {
      decision.run = false;
      decision.reason = 'waiting_for_platform_idle';
    }
  }
  const changed = state.last_result !== decision.reason;
  // A healthy steady state performs no writes. Pressure observations remain restart-safe.
  if (changed || decision.pressureSince || state.pressure_since || state.attempts !== decision.attempts) {
    await query(`UPDATE public.queue_vacuum_recovery_state SET statistics_epoch = $1,
      vacuum_progress = $2, pressure_since = $3, observed_at = $4, attempts = $5, last_result = $6
      WHERE singleton`, [decision.epoch, decision.progress, decision.pressureSince,
      decision.sampledAt, decision.attempts, decision.reason]);
  }
  return { status: decision.run ? 'admitted' : decision.reason === 'healthy' ? 'idle' : 'deferred',
    reason: decision.reason, log: changed, estimatedDeadRows: decision.estimatedDeadRows,
    diagnosisTrigger: !decision.run && decision.reason !== 'healthy' && state.attempts > 0
      ? (changed && decision.reason === 'attempt_limit' ? 'attempt_limit'
        : state.last_result === 'running' ? 'interrupted' : null) : null };
}

export async function reserveQueueVacuumAttempt(query) {
  const result = await query(`UPDATE public.queue_vacuum_recovery_state
    SET attempts = attempts + 1, next_attempt_at = clock_timestamp() + INTERVAL '6 hours',
      last_result = 'running'
    WHERE singleton AND attempts < 3 AND (next_attempt_at IS NULL OR next_attempt_at <= clock_timestamp())
    RETURNING attempts`);
  if (result.rows.length !== 1) throw new Error('queue_vacuum_attempt_not_reserved');
}

export async function finishQueueVacuumAttempt(query, completed) {
  await query(`UPDATE public.queue_vacuum_recovery_state SET last_result = $1 WHERE singleton`,
    [completed ? 'completed' : 'unverified']);
}
