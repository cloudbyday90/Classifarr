/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { advanceOmdbPacing, boundOmdbAdmissionTransaction, deferOmdbPacing, omdbPacingWait,
  readOmdbPacingReadiness, recordOmdbPacingDelay, transferOmdbPacingGeneration } from '../services/omdbPacingStore.mjs';
import { reserveOmdbQuota } from '../services/omdbQuotaStore.mjs';
import { availableOmdbQuotaFixture } from './helpers/omdbQuotaFixture.mjs';
const config = availableOmdbQuotaFixture();
const context = { source: 'omdb', id: config.id, generation: config.credential_generation };
function database(rows = []) {
  const query = jest.fn().mockResolvedValue({ rows });
  const db = { query, withTransaction: jest.fn(work => work({ query })) };
  return db;
}
test('wait reads and floor writes use fixed SQL, database clocks and short transaction deadlines', async () => {
  const db = database();
  await boundOmdbAdmissionTransaction(db);
  expect(db.query.mock.calls.map(([sql]) => sql)).toEqual([
    "SET LOCAL lock_timeout='1s'", "SET LOCAL statement_timeout='5s'",
    "SET LOCAL idle_in_transaction_session_timeout='10s'", "SET LOCAL transaction_timeout='15s'",
  ]);
  expect(await omdbPacingWait(db, context)).toBe(0);
  db.query.mockResolvedValue({ rows: [{ wait: 12 }] });
  expect(await omdbPacingWait(db, context)).toBe(12);
  await expect(omdbPacingWait(db, null)).rejects.toThrow('context_missing');
  await advanceOmdbPacing(db);
  expect(db.query.mock.lastCall[0]).toContain('ON CONFLICT (singleton)');
  await transferOmdbPacingGeneration(db, 1, context.generation, context.generation);
  expect(db.query.mock.lastCall[1]).toEqual([1, context.generation, context.generation]);
});
test('wait observations reject invalid contexts and fence current active generation before updating', async () => {
  const db = database([config]);
  await deferOmdbPacing(db, null, 10);
  await deferOmdbPacing(db, { ...context, source: 'web_search' }, 10);
  expect(db.withTransaction).not.toHaveBeenCalled();
  await deferOmdbPacing(db, context, 12);
  expect(db.query.mock.lastCall[1]).toEqual([1, context.generation, 12]);
  for (const row of [null, { ...config, id: 2 }, { ...config, credential_generation: 'changed' }]) {
    db.query.mockClear().mockResolvedValue({ rows: row ? [row] : [] });
    await deferOmdbPacing(db, context, 12);
    expect(db.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
  }
});
test.each([0, -1, 0.5, '12', NaN, Infinity, 30 * 86400 + 1])('rejects invalid delay %j without a write', async delay => {
  const db = database(); await recordOmdbPacingDelay(db, context, delay); expect(db.query).not.toHaveBeenCalled();
});
test('readiness projects only timing with no transaction or writes', async () => {
  const db = database(); expect(await readOmdbPacingReadiness(db)).toEqual({ wait: 0, retryAt: null });
  db.query.mockResolvedValue({ rows: [{ wait: 1, retry_at: '2026-09-29T00:00:01Z' }] });
  expect(await readOmdbPacingReadiness(db)).toEqual({ wait: 1, retryAt: '2026-09-29T00:00:01.000Z' });
  expect(db.withTransaction).not.toHaveBeenCalled();
  expect(db.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
});
test('composed admission charges only when pacing and continuation generation both permit it', async () => {
  const db = database();
  let wait = 12;
  db.query.mockImplementation(async sql => ({ rows: sql.includes('FROM omdb_request_pacing')
    ? [{ wait }] : [config] }));
  expect(await reserveOmdbQuota(db, { pacing: true })).toMatchObject({ status: 'paced', retryAfterSeconds: 12 });
  expect(db.query.mock.calls.some(([sql]) => /^(UPDATE|INSERT)/.test(sql))).toBe(false);
  wait = 0;
  expect(await reserveOmdbQuota(db, { pacing: true })).toMatchObject({ status: 'reserved', credentialContext: context });
  db.query.mockClear();
  expect(await reserveOmdbQuota(db, { pacing: true, expectedContext: { ...context, generation: 'changed' } }))
    .toEqual({ status: 'lookup_restart' });
  expect(db.query.mock.calls.some(([sql]) => /^(UPDATE|INSERT)/.test(sql))).toBe(false);
});
