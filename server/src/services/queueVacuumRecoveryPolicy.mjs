/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const HOUR = 3_600_000;
const millis = value => value == null ? NaN : new Date(value).getTime();
const count = value => (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)))
  && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : NaN;

/** Conservative product defaults; statistics are estimates, not measured disk bloat. */
export function evaluateQueueVacuumRecovery(row, state) {
  const now = millis(row.sampled_at);
  if (!Number.isFinite(now)) throw new Error('queue_vacuum_clock_unavailable');
  const epoch = `${row.relation_oid}:${row.stats_reset == null ? 'initial' : new Date(row.stats_reset).toISOString()}`;
  const progress = `${row.vacuum_count}:${row.autovacuum_count}`;
  const sameEpoch = state.statistics_epoch === epoch;
  const live = count(row.n_live_tup), dead = count(row.n_dead_tup);
  const valid = Number.isFinite(live) && Number.isFinite(dead) && Number.isSafeInteger(live + dead);
  const reliable = valid && row.track_counts === true && row.statistics_available === true;
  const pressure = valid && dead >= 10000 && dead / (live + dead) >= 0.2;
  const continuous = sameEpoch && state.vacuum_progress === progress
    && now >= millis(state.observed_at) && now - millis(state.observed_at) <= HOUR / 2
    && now >= millis(state.pressure_since);
  const pressureSince = reliable && pressure && row.autovacuum === true && row.table_enabled === true
    ? (continuous ? state.pressure_since : row.sampled_at) : null;
  // Only healthy pressure or a different statistics epoch resets the intervention budget.
  const attempts = sameEpoch && (!reliable || pressure) ? state.attempts : 0;
  let reason = 'healthy';
  if (!valid || row.track_counts !== true || row.statistics_available !== true) reason = 'statistics_required';
  else if (row.autovacuum !== true || row.table_enabled !== true) reason = 'autovacuum_disabled';
  else if (!pressure) reason = 'healthy';
  else if (attempts >= 3) reason = 'attempt_limit';
  else if (now < millis(state.next_attempt_at)) reason = 'cooldown';
  else if (row.vacuum_running !== false) reason = 'vacuum_active';
  else if (now - millis(pressureSince) < HOUR) reason = 'observing_pressure';
  else if (row.can_maintain !== true) reason = 'maintenance_privilege_required';
  else reason = 'sustained_pressure';
  return { reason, run: reason === 'sustained_pressure', epoch, progress, pressureSince,
    sampledAt: row.sampled_at, attempts, estimatedDeadRows: valid ? dead : null };
}
