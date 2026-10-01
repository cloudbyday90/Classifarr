/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { runQueueVacuumMaintenance } from '../services/queueVacuumMaintenance.mjs';
import { queueVacuumRow, queueVacuumState } from './helpers/queueVacuumFixture.mjs';

function fixture({ row = queueVacuumRow(), state = queueVacuumState(), readiness = 'ready' } = {}) {
  const client = Object.assign(new EventEmitter(), { release: jest.fn() });
  client.query = jest.fn(async sql => {
    if (sql.includes('pg_try_advisory')) return { rows: [{ acquired: true }] };
    if (sql.startsWith('SELECT gate_state')) return { rows: [{ gate_state: 'ready' }] };
    if (sql.includes('FROM pg_catalog.pg_class c')) return { rows: row ? [{ ...row }] : [] };
    if (sql.startsWith('SELECT * FROM public.queue_vacuum_recovery_state')) return { rows: state ? [state] : [] };
    if (sql.startsWith('WITH active_libraries')) return { rows: [{ readiness }] };
    if (sql.startsWith('VACUUM')) {
      row.vacuum_count = String(Number(row.vacuum_count) + 1);
      row.analyze_count = String(Number(row.analyze_count) + 1);
      return { command: 'VACUUM', rows: [] };
    }
    if (sql.includes('RETURNING attempts')) return { rows: [{ attempts: 1 }] };
    return { rows: [], rowCount: 1 };
  });
  const database = { pool: { connect: jest.fn(async () => client) } };
  return { client, database, row, run: options => runQueueVacuumMaintenance({ database, ...options }),
    sql: () => client.query.mock.calls.map(([sql]) => sql) };
}

test.each([false, true])('bounded execution verifies completion and discards session (automatic %s)', async automatic => {
  const f = fixture(), report = jest.fn();
  await expect(f.run({ automatic, report })).resolves.toMatchObject({ status: 'complete' });
  expect(f.sql().filter(sql => sql.startsWith('VACUUM'))).toEqual([
    "VACUUM (ANALYZE, SKIP_LOCKED, TRUNCATE FALSE, PARALLEL 0, BUFFER_USAGE_LIMIT '2MB') ONLY public.task_queue",
  ]);
  expect(f.sql()).toContain("SET maintenance_work_mem = '64MB'");
  expect(f.client.release.mock.calls).toEqual([[true]]);
  expect(f.client.listenerCount('notice')).toBe(0);
  expect(f.client.listenerCount('error')).toBe(0);
  if (automatic) {
    expect(f.sql().findIndex(sql => sql.includes('RETURNING attempts')))
      .toBeLessThan(f.sql().findIndex(sql => sql.startsWith('VACUUM')));
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ status: 'started' }));
  } else expect(report).not.toHaveBeenCalled();
});
test.each([2024, 2027, 2012])('lock %i contention stops before physical work', async key => {
  const f = fixture(), real = f.client.query.getMockImplementation();
  f.client.query.mockImplementation((sql, params) => params?.[0] === key ? { rows: [] } : real(sql, params));
  await expect(f.run()).resolves.toMatchObject({ status: 'deferred' });
  expect(f.sql().some(sql => sql.startsWith('VACUUM'))).toBe(false);
});
test('quarantine does not touch recovery state', async () => {
  const f = fixture(), real = f.client.query.getMockImplementation();
  f.client.query.mockImplementation(sql => sql.startsWith('SELECT gate_state') ? { rows: [] } : real(sql));
  await expect(f.run()).resolves.toMatchObject({ reason: 'restore_verification_required' });
  expect(f.sql().some(sql => sql.includes('queue_vacuum_recovery_state'))).toBe(false);
});
test.each([[{ can_maintain: false }, 'maintenance_privilege_required'], [{ track_counts: false }, 'statistics_required'],
  [{ statistics_available: false }, 'statistics_required'], [{ vacuum_running: true }, 'vacuum_active']])('manual %j defers', async (row, reason) => {
  const f = fixture({ row: queueVacuumRow(row) });
  await expect(f.run()).resolves.toMatchObject({ status: 'deferred', reason });
  expect(f.sql().some(sql => sql.startsWith('VACUUM'))).toBe(false);
});
test.each([null, { relation_supported: false }])('unsupported relation %j fails', async row => {
  const f = fixture({ row: row ? queueVacuumRow(row) : null });
  await expect(f.run()).rejects.toThrow('relation_unsupported');
});
test.each(['warning', 'localized-warning', 'wrong-command', 'no-progress', 'changed-oid', 'reset', 'missing', 'invalid-count'])('%s cannot report completion', async scenario => {
  const f = fixture(), real = f.client.query.getMockImplementation();
  f.client.query.mockImplementation(async (sql, params) => {
    if (sql.startsWith('VACUUM')) {
      if (scenario === 'no-progress') return { command: 'VACUUM' };
      if (scenario === 'warning') f.client.emit('notice', { severity: 'WARNING', message: 'private' });
      if (scenario === 'localized-warning') f.client.emit('notice', { code: '01007', message: 'private' });
      const result = await real(sql, params);
      if (scenario === 'wrong-command') result.command = 'SELECT';
      if (scenario === 'changed-oid') f.row.relation_oid = '124';
      if (scenario === 'reset') f.row.stats_reset = new Date();
      if (scenario === 'missing') f.row.relation_supported = false;
      if (scenario === 'invalid-count') f.row.analyze_count = null;
      return result;
    }
    return real(sql, params);
  });
  await expect(f.run({ automatic: true })).rejects.toThrow('not_confirmed');
  expect(f.client.query).toHaveBeenCalledWith(expect.stringContaining('SET last_result = $1'), ['unverified']);
  expect(f.client.release.mock.calls).toEqual([[true]]);
});
test.each(['ingesting', 'backfilling', 'waiting_for_inventory', 'waiting_for_libraries', 'unavailable'])('automatic waits for %s without consuming attempt', async readiness => {
  const f = fixture({ readiness });
  await expect(f.run({ automatic: true })).resolves.toMatchObject({ reason: 'waiting_for_platform_idle' });
  expect(f.sql().some(sql => sql.includes('RETURNING attempts') || sql.startsWith('VACUUM'))).toBe(false);
});
test('healthy steady state does not mutate ledger or inspect inventory', async () => {
  const f = fixture({ row: queueVacuumRow({ n_dead_tup: '0' }), state: queueVacuumState({ pressure_since: null, last_result: 'healthy' }) });
  await expect(f.run({ automatic: true })).resolves.toMatchObject({ status: 'idle', log: false });
  expect(f.sql().some(sql => sql.startsWith('UPDATE') || sql.startsWith('WITH active_libraries'))).toBe(false);
});
test('missing durable state fails before attempt', async () => {
  const f = fixture({ state: null });
  await expect(f.run({ automatic: true })).rejects.toThrow('state_missing');
});
test.each(['readiness', 'reservation', 'completion', 'failure-record'])('%s failure never produces success', async stage => {
  const f = fixture(), real = f.client.query.getMockImplementation();
  f.client.query.mockImplementation((sql, params) => {
    if (stage === 'readiness' && sql.startsWith('WITH active_libraries')) throw new Error('readiness_failed');
    if (stage === 'reservation' && sql.includes('RETURNING attempts')) return { rows: [] };
    if (stage === 'completion' && sql.includes('SET last_result = $1')) throw new Error('completion_failed');
    if (stage === 'failure-record' && (sql.startsWith('VACUUM') || sql.includes('SET last_result = $1'))) throw new Error('failed');
    return real(sql, params);
  });
  await expect(f.run({ automatic: true })).rejects.toThrow();
  if (stage === 'readiness') expect(f.sql()).toContain('ROLLBACK');
});
test('disconnect during vacuum does not reconnect or acknowledge', async () => {
  const f = fixture(), real = f.client.query.getMockImplementation();
  f.client.query.mockImplementation(async (sql, params) => {
    if (sql.startsWith('VACUUM')) f.client.emit('error', new Error('connection_lost'));
    return real(sql, params);
  });
  await expect(f.run({ automatic: true })).rejects.toThrow('connection_lost');
  expect(f.database.pool.connect).toHaveBeenCalledTimes(1);
  expect(f.sql().some(sql => sql.includes('SET last_result = $1'))).toBe(false);
});
test('watchdog destroys a stalled session and clears all listeners/timers', async () => {
  jest.useFakeTimers();
  try {
    const f = fixture(); let unblock;
    f.client.query.mockImplementationOnce(() => new Promise(resolve => { unblock = resolve; }));
    const work = expect(f.run()).rejects.toThrow('queue_vacuum_deadline');
    await jest.advanceTimersByTimeAsync(60_000);
    expect(f.client.release.mock.calls).toEqual([[true]]);
    unblock({ rows: [] }); await work;
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
test('non-boolean mode is rejected before acquiring credentials', async () => {
  const f = fixture();
  await expect(f.run({ automatic: 'yes' })).rejects.toThrow('Invalid queue vacuum mode');
  expect(f.database.pool.connect).not.toHaveBeenCalled();
});
