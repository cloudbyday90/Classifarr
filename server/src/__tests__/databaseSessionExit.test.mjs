/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { trackDatabaseSessions, waitForDatabaseSessionsExit } from './integration/helpers/databaseSessionExit.mjs';

test('session observer parameterizes exact identities and restricts reads to its database', async () => {
  const pool = { query: jest.fn().mockResolvedValue({ rows: [{ active: false }] }) };
  const sessions = [{ pid: 123, startedAt: '2026-10-08 12:00:00.123456+00' }];
  await waitForDatabaseSessionsExit(pool, sessions);
  expect(pool.query).toHaveBeenCalledTimes(1);
  const [query] = pool.query.mock.calls[0];
  expect(query.values).toEqual([[123], ['2026-10-08 12:00:00.123456+00']]);
  expect(query.text).toContain('activity.backend_start = owned.started_at');
  expect(query.text).toContain('activity.datname = current_database()');
  expect(query.text).not.toMatch(/pg_terminate_backend|pg_advisory_unlock/i);
  expect(query.query_timeout).toBeGreaterThan(0);
  expect(query.query_timeout).toBeLessThanOrEqual(5_000);
});

test('observer waits for a later observation of exit, not just one pool release', async () => {
  const pool = { query: jest.fn()
    .mockResolvedValueOnce({ rows: [{ active: true }] })
    .mockResolvedValueOnce({ rows: [{ active: false }] }) };
  await waitForDatabaseSessionsExit(pool, [{ pid: 123, startedAt: '2026-10-08' }]);
  expect(pool.query).toHaveBeenCalledTimes(2);
});

test('unknown observation and database errors fail closed', async () => {
  await expect(waitForDatabaseSessionsExit({ query: async () => ({ rows: [] }) }, []))
    .rejects.toThrow('fixture_database_session_observation_invalid');
  const failure = new Error('connection_lost');
  await expect(waitForDatabaseSessionsExit({ query: async () => { throw failure; } }, []))
    .rejects.toBe(failure);
});

test.each([0, -1, Infinity, NaN, 5_001])('invalid deadline %s cannot become an unbounded wait', async timeout => {
  const pool = { query: jest.fn() };
  await expect(waitForDatabaseSessionsExit(pool, [], timeout))
    .rejects.toThrow('fixture_database_session_deadline_invalid');
  expect(pool.query).not.toHaveBeenCalled();
});

test('session tracking rejects non-fixture databases before connecting', () => {
  const pool = { options: { database: 'classifarr' }, connect: jest.fn() };
  expect(() => trackDatabaseSessions(pool)).toThrow('isolated_admission_fixture_required');
  expect(pool.connect).not.toHaveBeenCalled();
});

test.each(['classifarr_suite_012345abcdef', 'cf_schema_0123456789abcdef0123456789abcdef'])
('session tracking accepts the existing disposable database family %s', database => {
  const pool = { options: { database }, connect: jest.fn() };
  expect(trackDatabaseSessions(pool).database.pool.options).toBe(pool.options);
  expect(pool.connect).not.toHaveBeenCalled();
});
