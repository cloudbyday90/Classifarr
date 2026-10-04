/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { readDatabaseProfilingStatus } from '../services/databaseProfilingStatus.mjs';
import { runDatabaseProfilingMaintenance } from '../services/databaseProfilingMaintenance.mjs';

const catalog = { available: true, installed: false, libraries: 'pg_stat_statements' };
function fixture({ state = catalog, lock = true, gate = null, gateState = 'ready', permitted = true,
  fail = null, refuseVerification = false } = {}) {
  let installed = state?.installed;
  const client = Object.assign(new EventEmitter(), { release: jest.fn(), query: jest.fn(async sql => {
    if (fail && sql.includes(fail)) throw new Error('private password and host');
    if (sql.includes('pg_try_advisory')) return { rows: [{ acquired: lock }] };
    if (sql.includes('to_regclass')) return { rows: [{ gate_table: gate }] };
    if (sql.includes('SELECT gate_state')) return { rows: [{ gate_state: gateState }] };
    if (sql.includes('pg_available_extensions')) return { rows: [{ ...state, installed }] };
    if (sql.includes('AS permitted')) return { rows: [{ permitted }] };
    if (sql.startsWith('CREATE EXTENSION') && !refuseVerification) installed = true;
    return { rows: [] };
  }) });
  const database = { pool: { connect: jest.fn(async () => client) } };
  return { client, database, run: () => runDatabaseProfilingMaintenance({ database }),
    sql: () => client.query.mock.calls.map(([sql]) => sql).join('\n') };
}

test.each([
  [catalog, { active: false, reason: 'extension_missing' }],
  [{ ...catalog, installed: true }, { active: true }],
  [{ ...catalog, available: false }, { active: false, reason: 'runtime_files_unavailable' }],
  [{ ...catalog, libraries: null }, { active: false, reason: 'observation_unknown' }],
  [{ ...catalog, available: 'true' }, { active: false, reason: 'observation_unknown' }],
  [undefined, { active: false, reason: 'observation_unknown' }],
])('catalog observation is typed and read-only: %j', async (state, expected) => {
  const query = jest.fn(async () => ({ rows: [state] }));
  expect(await readDatabaseProfilingStatus({ query })).toEqual(expected);
  expect(query).toHaveBeenCalledTimes(1);
  expect(query.mock.calls[0][0]).not.toMatch(/CREATE|ALTER|DROP/);
});
test.each(['pg_stat_statements_extra', 'not_pg_stat_statements', '"pg_stat_statements', 'pg_stat_statements"', '/tmp/pg_stat_statements', ''])('rejects imprecise preload %s', async libraries => {
  const f = fixture({ state: { ...catalog, libraries } });
  expect(await f.run()).toEqual({ status: 'deferred', reason: 'not_preloaded' });
  expect(f.sql()).not.toContain('CREATE EXTENSION');
});
test.each(['pg_stat_statements', ' other, "pg_stat_statements" '])('installs only a known missing, exactly preloaded extension: %s', async libraries => {
  const f = fixture({ state: { ...catalog, libraries } });
  expect(await f.run()).toEqual({ status: 'installed' });
  expect(f.sql()).toContain('CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public');
  expect(f.sql()).toContain('COMMIT');
  expect(f.client.release).toHaveBeenCalledWith(true);
  expect(f.client.listenerCount('error')).toBe(0);
});
test.each([
  [{ lock: false }, 'runtime_or_restore_active'],
  [{ gate: 'gate', gateState: 'blocked' }, 'restore_verification_required'],
  [{ gate: 'gate', gateState: null }, 'restore_verification_required'],
  [{ gate: 42 }, 'observation_unknown'],
  [{ permitted: false }, 'maintenance_authority_required'],
  [{ state: { ...catalog, available: false } }, 'runtime_files_unavailable'],
  [{ fail: 'pg_available_extensions' }, 'observation_unknown'],
  [{ fail: 'to_regclass' }, 'database_operation_unconfirmed'],
])('ineligible observations never reach DDL: %j', async (options, reason) => {
  const f = fixture(options);
  expect(await f.run()).toEqual({ status: 'deferred', reason });
  expect(f.sql()).not.toContain('CREATE EXTENSION');
  expect(f.client.release).toHaveBeenCalledWith(true);
});
test('already active does not check privileges or write', async () => {
  const f = fixture({ state: { ...catalog, installed: true } });
  expect(await f.run()).toEqual({ status: 'already_active' });
  expect(f.sql()).not.toMatch(/CREATE EXTENSION|AS permitted|COMMIT/);
});
test.each(['CREATE EXTENSION', 'COMMIT', 'BEGIN'])('SQL failure at %s is sanitized and never reported installed', async fail => {
  const f = fixture({ fail });
  expect(await f.run()).toEqual({ status: 'deferred', reason: 'database_operation_unconfirmed' });
  expect(f.client.release).toHaveBeenCalledWith(true);
});
test('unconfirmed verification is rolled back by disconnect', async () => {
  const f = fixture({ refuseVerification: true });
  expect(await f.run()).toEqual({ status: 'deferred', reason: 'verification_failed' });
  expect(f.sql()).not.toContain('COMMIT');
  expect(f.client.release).toHaveBeenCalledWith(true);
});
test('connection failure cannot trigger a fallback write', async () => {
  const database = { pool: { connect: jest.fn().mockRejectedValue(new Error('secret')) } };
  expect(await runDatabaseProfilingMaintenance({ database })).toEqual({ status: 'deferred', reason: 'database_operation_unconfirmed' });
  expect(database.pool.connect).toHaveBeenCalledTimes(1);
});
test('catalog error text never escapes observation', async () => {
  const query = jest.fn().mockRejectedValue(new Error('password=private internal-host'));
  expect(await readDatabaseProfilingStatus({ query })).toEqual({ active: false, reason: 'observation_unknown' });
});
test('missing restore observation defers without DDL', async () => {
  const f = fixture();
  const query = f.client.query.getMockImplementation();
  f.client.query.mockImplementation(sql => sql.includes('to_regclass') ? { rows: [] } : query(sql));
  expect(await f.run()).toEqual({ status: 'deferred', reason: 'observation_unknown' });
  expect(f.sql()).not.toContain('CREATE EXTENSION');
});
test('lost pinned client cannot resume on a replacement connection', async () => {
  const f = fixture();
  const query = f.client.query.getMockImplementation();
  f.client.query.mockImplementation(sql => {
    if (sql.includes('AS permitted')) f.client.emit('error', new Error('secret'));
    return query(sql);
  });
  expect(await f.run()).toEqual({ status: 'deferred', reason: 'database_operation_unconfirmed' });
  expect(f.sql()).not.toContain('CREATE EXTENSION');
  expect(f.database.pool.connect).toHaveBeenCalledTimes(1);
});
