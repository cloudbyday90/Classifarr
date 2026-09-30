/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { prepareOmdbRetryBatch } from '../services/omdbRetryBatchPlan.mjs';
import { availableOmdbQuotaFixture } from './helpers/omdbQuotaFixture.mjs';

function fixture(count = 2, config = availableOmdbQuotaFixture()) {
  const quota = jest.fn(async () => ({ rows: config ? [config] : [] }));
  const db = { query: jest.fn(async sql => String(sql).includes('FROM omdb_request_pacing') ? { rows: [] }
    : String(sql).includes('FROM omdb_config')
    ? quota() : { rows: Array.from({ length: count }, (_, i) => ({ queue_id: i + 1 })) }) };
  const deps = { db, logger: { debug: jest.fn() }, scheduleProcessing: jest.fn(), isRetryWakeCurrent: jest.fn(() => true) };
  return { ...deps, deps, quota };
}

test('caps the candidate snapshot at 50, offers each once and coalesces continuation', async () => {
  const f = fixture(50), plan = await prepareOmdbRetryBatch(f.deps, 100);
  expect(f.db.query.mock.calls[0][1]).toEqual(['omdb', [], expect.any(String), expect.any(Number), null, null, null, 50]);
  for (let id = 1; id <= 50; id++) expect(await plan.next()).toBe(id);
  expect(await plan.next()).toBeNull();
  expect(f.quota).toHaveBeenCalledTimes(50);
  plan.finish(); plan.finish();
  expect(f.scheduleProcessing).toHaveBeenCalledTimes(1);
  expect(f.scheduleProcessing).toHaveBeenCalledWith(1000);
  expect(await plan.next()).toBeNull();
  expect(f.db.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
});

test('a shared pacing wait withholds claims and coalesces one bounded wake', async () => {
  const f = fixture();
  const query = f.db.query.getMockImplementation();
  f.db.query.mockImplementation(sql => sql.includes('FROM omdb_request_pacing')
    ? Promise.resolve({ rows: [{ wait: 12, retry_at: new Date(Date.now() + 12000) }] }) : query(sql));
  const plan = await prepareOmdbRetryBatch(f.deps, 50);
  expect(await plan.next()).toBeNull(); expect(plan.waiting).toBe(true);
  plan.finish(); plan.finish();
  expect(f.scheduleProcessing).toHaveBeenCalledTimes(1); expect(f.scheduleProcessing).toHaveBeenCalledWith(12000);
});

test.each([0, -1, 1.5, NaN, Infinity, '1'])('rejects invalid batch limit %s before reading', async limit => {
  const f = fixture();
  await expect(prepareOmdbRetryBatch(f.deps, limit)).rejects.toThrow('invalid_retry_limit');
  expect(f.db.query).not.toHaveBeenCalled();
});

test('empty/ineligible queue neither observes quota nor creates a wakeup', async () => {
  const f = fixture(0), plan = await prepareOmdbRetryBatch(f.deps, 50);
  expect(await plan.next()).toBeNull(); plan.finish();
  expect(f.quota).not.toHaveBeenCalled(); expect(f.scheduleProcessing).not.toHaveBeenCalled();
});

test.each([
  [null, 'not_configured'],
  [{ api_key: '  ' }, 'not_configured'],
  [{ credential_rejected_at: '2026-09-29' }, 'credentials_rejected'],
  [{ daily_limit: 0 }, 'invalid_configuration'],
  [{ requests_today: 1000 }, 'limit_reached'],
  [{ requests_today: 1000, last_reset_date: null }, 'limit_reached'],
  [{ last_reset_date: '2026-09-30' }, 'invalid_configuration'],
])('unavailable quota %j stops before offering an item', async (overrides, reason) => {
  const f = fixture(1, overrides === null ? null : { ...availableOmdbQuotaFixture(), ...overrides });
  const plan = await prepareOmdbRetryBatch(f.deps, 1);
  expect(await plan.next()).toBeNull(); expect(await plan.next()).toBeNull(); plan.finish();
  expect(plan.waiting).toBe(true); expect(f.quota).toHaveBeenCalledTimes(1);
  expect(f.logger.debug).toHaveBeenCalledWith('OMDb retries waiting before claim', { reason });
  expect(f.scheduleProcessing).not.toHaveBeenCalled();
});

test('a fresh quota read before each item stops the batch when another request uses the last credit', async () => {
  const f = fixture(), plan = await prepareOmdbRetryBatch(f.deps, 2);
  expect(await plan.next()).toBe(1);
  f.quota.mockResolvedValue({ rows: [{ ...availableOmdbQuotaFixture(), requests_today: 1000 }] });
  expect(await plan.next()).toBeNull(); plan.finish();
  expect(plan.waiting).toBe(true); expect(f.scheduleProcessing).not.toHaveBeenCalled();
});

test('quota observation failure withholds admission without logging credentials or error contents', async () => {
  const f = fixture(), plan = await prepareOmdbRetryBatch(f.deps, 2);
  f.quota.mockRejectedValue(new Error('private-key https://upstream.invalid/?apikey=secret'));
  expect(await plan.next()).toBeNull(); plan.finish();
  expect(f.logger.debug).toHaveBeenCalledWith('OMDb retries waiting before claim', { reason: 'quota_observation_unavailable' });
  expect(f.scheduleProcessing).not.toHaveBeenCalled();
});

test('page read failure propagates without observing quota or offering work', async () => {
  const f = fixture(); f.db.query.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(prepareOmdbRetryBatch(f.deps, 50)).rejects.toThrow('database unavailable');
  expect(f.quota).not.toHaveBeenCalled(); expect(f.scheduleProcessing).not.toHaveBeenCalled();
});

test('cancellation during a quota read withholds its candidate and continuation', async () => {
  const f = fixture(1), plan = await prepareOmdbRetryBatch(f.deps, 1);
  f.quota.mockImplementation(async () => {
    f.isRetryWakeCurrent.mockReturnValue(false);
    return { rows: [availableOmdbQuotaFixture()] };
  });
  expect(await plan.next()).toBeNull(); plan.finish();
  expect(f.scheduleProcessing).not.toHaveBeenCalled();
});

test('already cancelled and partially visited plans do not schedule continuation', async () => {
  const f = fixture(2), plan = await prepareOmdbRetryBatch(f.deps, 2);
  expect(await plan.next()).toBe(1); plan.finish();
  expect(await plan.next()).toBeNull(); expect(f.scheduleProcessing).not.toHaveBeenCalled();
  const cancelled = await prepareOmdbRetryBatch(f.deps, 2);
  f.isRetryWakeCurrent.mockReturnValue(false);
  expect(await cancelled.next()).toBeNull(); cancelled.finish();
  expect(f.quota).toHaveBeenCalledTimes(1); expect(f.scheduleProcessing).not.toHaveBeenCalled();
});

test('completed previous-day usage is only a read-only admission hint', async () => {
  const f = fixture(1, { ...availableOmdbQuotaFixture(), requests_today: 1000, last_reset_date: '2026-09-28' });
  const plan = await prepareOmdbRetryBatch(f.deps, 50);
  expect(await plan.next()).toBe(1); plan.finish();
  expect(f.db.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
  expect(f.scheduleProcessing).not.toHaveBeenCalled();
});
