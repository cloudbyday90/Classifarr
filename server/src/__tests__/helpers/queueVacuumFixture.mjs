/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function queueVacuumRow(overrides = {}) {
  return { relation_oid: '123', relation_supported: true, sampled_at: new Date('2026-10-01T12:00:00Z'),
    autovacuum: true, track_counts: true, table_enabled: true, statistics_available: true,
    vacuum_threshold: 50, vacuum_scale_factor: 0.01, analyze_scale_factor: 0.05,
    n_live_tup: '20000', n_dead_tup: '10000', n_ins_since_vacuum: '0', n_mod_since_analyze: '10000',
    vacuum_count: '1', analyze_count: '1', autovacuum_count: '1', can_maintain: true,
    stats_reset: null, vacuum_running: false, last_autovacuum: null, ...overrides };
}
export function queueVacuumState(overrides = {}) {
  return { statistics_epoch: '123:initial', vacuum_progress: '1:1',
    observed_at: new Date('2026-10-01T11:45:00Z'), pressure_since: new Date('2026-10-01T11:00:00Z'),
    attempts: 0, next_attempt_at: null, last_result: 'observing_pressure', ...overrides };
}
