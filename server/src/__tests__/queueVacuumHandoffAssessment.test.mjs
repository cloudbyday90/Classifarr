/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { assessQueueVacuumHandoff } from '../services/queueVacuumHandoffAssessment.mjs';
import { queueVacuumRow, queueVacuumState } from './helpers/queueVacuumFixture.mjs';
import { assertQueueMaintenanceHandoffBoundary } from '../services/queueMaintenanceHandoffBoundary.mjs';

function fixture(row, state) {
  const client = Object.assign(new EventEmitter(), { release: jest.fn(), query: jest.fn(async sql => ({ rows:
    sql.includes('FROM pg_catalog.pg_class') ? [row] : sql.includes('SELECT *') ? (state ? [state] : []) : [] })) });
  return { client, database: { pool: { connect: jest.fn(async () => client) } } };
}
test.each([
  [queueVacuumRow({ n_dead_tup: '0' }), undefined, false],
  [queueVacuumRow({ n_dead_tup: '0' }), queueVacuumState({ last_result: 'healthy' }), true],
  [queueVacuumRow(), undefined, true],
  [queueVacuumRow(), queueVacuumState({ attempts: 3, last_result: 'attempt_limit' }), false],
  [queueVacuumRow(), queueVacuumState({ attempts: 3, last_result: 'completed' }), true],
  [queueVacuumRow(), queueVacuumState({ attempts: 1, last_result: 'cooldown', next_attempt_at: '2026-10-01T13:00:00Z' }), false],
  [queueVacuumRow(), queueVacuumState({ attempts: 1, last_result: 'running', next_attempt_at: '2026-10-01T13:00:00Z' }), true],
])('read-only hint never reserves attempts: %j %j', async (row, state, request) => {
  const f = fixture(row, state);
  expect((await assessQueueVacuumHandoff(f)).request).toBe(request);
  expect(f.client.query).toHaveBeenCalledWith('BEGIN READ ONLY', undefined);
  expect(f.client.query.mock.calls.some(([sql]) => /\b(?:UPDATE|INSERT|DELETE|VACUUM)\b/.test(sql))).toBe(false);
  expect(f.client.release.mock.calls).toEqual([[true]]);
});
test('healthy settled state needs no child; missing relation fails closed', async () => {
  const f = fixture(queueVacuumRow({ n_dead_tup: '0' }), queueVacuumState({ last_result: 'healthy', pressure_since: null }));
  expect((await assessQueueVacuumHandoff(f)).request).toBe(false);
  const missing = fixture(null);
  await expect(assessQueueVacuumHandoff(missing)).rejects.toThrow('unavailable');
  expect(missing.client.release).toHaveBeenCalledWith(true);
});
test.each([true, false, undefined])('boundary requires affirmative safe=%s; fixed role/ledger, no grant', async safe => {
  const client = { query: jest.fn(async () => ({ rows: safe === undefined ? [] : [{ safe }] })), release: jest.fn() };
  const database = { pool: { connect: async () => client } };
  if (safe) await expect(assertQueueMaintenanceHandoffBoundary(database)).resolves.toBeUndefined();
  else await expect(assertQueueMaintenanceHandoffBoundary(database)).rejects.toThrow('boundary_unavailable');
  expect(client.query.mock.calls[1][0]).toContain("r.rolname = 'cf_runtime'");
  expect(client.query.mock.calls[1][0]).not.toMatch(/\bGRANT\b/);
  expect(client.release).toHaveBeenCalledWith(true);
});
