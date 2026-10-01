/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateQueueVacuumRecovery } from '../services/queueVacuumRecoveryPolicy.mjs';
import { queueVacuumRow, queueVacuumState } from './helpers/queueVacuumFixture.mjs';

test('sustained one-hour pressure admits exactly at threshold', () => {
  expect(evaluateQueueVacuumRecovery(queueVacuumRow({ n_live_tup: '40000' }), queueVacuumState()))
    .toMatchObject({ run: true, reason: 'sustained_pressure', attempts: 0 });
});
test.each([
  [{ n_dead_tup: '9999' }, {}, 'healthy'], [{ n_live_tup: '40001' }, {}, 'healthy'],
  [{ n_dead_tup: 0, n_live_tup: 0 }, {}, 'healthy'],
  [{ n_dead_tup: null }, {}, 'statistics_required'], [{ n_dead_tup: -1 }, {}, 'statistics_required'],
  [{ n_dead_tup: 'NaN' }, {}, 'statistics_required'], [{ track_counts: false }, {}, 'statistics_required'],
  [{ statistics_available: false }, {}, 'statistics_required'],
  [{ autovacuum: false }, {}, 'autovacuum_disabled'], [{ table_enabled: false }, {}, 'autovacuum_disabled'],
  [{ vacuum_running: true }, {}, 'vacuum_active'], [{ vacuum_running: null }, {}, 'vacuum_active'],
  [{ can_maintain: false }, {}, 'maintenance_privilege_required'],
  [{}, { next_attempt_at: '2026-10-01T13:00:00Z' }, 'cooldown'],
  [{}, { attempts: 3 }, 'attempt_limit'], [{ vacuum_count: '2' }, {}, 'observing_pressure'],
  [{}, { pressure_since: null }, 'observing_pressure'],
  [{}, { observed_at: '2026-10-01T11:29:59Z' }, 'observing_pressure'],
  [{}, { observed_at: '2026-10-01T12:01:00Z' }, 'observing_pressure'],
  [{}, { pressure_since: '2026-10-01T12:01:00Z' }, 'observing_pressure'],
  [{}, { pressure_since: '2026-10-01T11:00:01Z' }, 'observing_pressure'],
])('row %j state %j => %s', (row, state, reason) => {
  expect(evaluateQueueVacuumRecovery(queueVacuumRow(row), queueVacuumState(state)))
    .toMatchObject({ run: false, reason });
});
test('vacuum progress resets observation, not intervention budget; health resets attempts', () => {
  const state = queueVacuumState({ attempts: 2 });
  expect(evaluateQueueVacuumRecovery(queueVacuumRow({ vacuum_count: '2' }), state).attempts).toBe(2);
  expect(evaluateQueueVacuumRecovery(queueVacuumRow({ n_dead_tup: 0 }), state).attempts).toBe(0);
  expect(evaluateQueueVacuumRecovery(queueVacuumRow({ track_counts: false }), state).attempts).toBe(2);
});
test('database epoch reset starts a new observation and budget, preserving external cooldown check', () => {
  expect(evaluateQueueVacuumRecovery(queueVacuumRow({ stats_reset: new Date('2026-10-01T11:00:00Z') }),
    queueVacuumState({ attempts: 3 }))).toMatchObject({ attempts: 0, reason: 'observing_pressure' });
});
test('missing server clock fails closed', () => {
  expect(() => evaluateQueueVacuumRecovery(queueVacuumRow({ sampled_at: null }), queueVacuumState())).toThrow('clock_unavailable');
});
