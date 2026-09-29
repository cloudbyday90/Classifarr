/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { retryDelayMs, retryDependency, retrySchedule, persistRetrySchedule } from '../services/enrichmentRetrySchedulePolicy.mjs';
import { dispatchEnrichmentRetries } from '../services/enrichmentRetryDispatch.mjs';
import { enrichWithWebSearch } from '../services/enrichmentRetryWebSearch.mjs';
import { enrichWithOmdb } from '../services/enrichmentRetryOmdb.mjs';
import { WebSearchProviderRoutingError } from '../services/webSearchProviderRouter.mjs';
import { OMDbLimitReachedError } from '../services/omdbQuota.mjs';

test.each([0, 1, 2, 6, 100, -1, NaN, undefined])('backoff is bounded and nonzero for %s', attempts => {
  expect(retryDelayMs(attempts, () => 0)).toBeGreaterThanOrEqual(30_000);
  expect(retryDelayMs(attempts, () => 1)).toBeLessThanOrEqual(3_600_000);
  expect(retryDelayMs(attempts, () => NaN)).toBe(retryDelayMs(attempts, () => 1));
});
test('backoff grows without exponential overflow', () => {
  expect([0, 1, 2].map(n => retryDelayMs(n, () => 0))).toEqual([30_000, 60_000, 120_000]);
  expect(retryDelayMs(100000, () => 2)).toBe(3_600_000);
  expect(retryDelayMs(0, () => -1)).toBe(30_000);
});
test('provider waits preserve attempts and retry-after cannot create an unbounded delay', () => {
  expect(retrySchedule({ waitForProvider: true }, 2)).toMatchObject({ chargeAttempt: false, cooldown: true, delayMs: 60_000 });
  expect(retrySchedule({ deferUntilDailyReset: true }, 2)).toMatchObject({ chargeAttempt: false, reset: 'day' });
  expect(retrySchedule({ deferUntilMonthlyReset: true }, 2)).toMatchObject({ chargeAttempt: false, reset: 'month' });
  expect(retrySchedule({ transient: true, retryAfterSeconds: 900 }, 0)).toMatchObject({ delayMs: 900000, cooldown: true });
  expect(retrySchedule({ retryAfterSeconds: 1e30 }, 0).delayMs).toBe(86_400_000);
  expect(retrySchedule({ retryAfterSeconds: -1 }, 0).delayMs).toBeLessThanOrEqual(60_000);
  expect(retryDependency('tavily')).toBe(retryDependency('web_search'));
});
test('missing persisted due time fails closed before writing a cooldown', async () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  await expect(persistRetrySchedule(client, 1, 'omdb', retrySchedule({ waitForProvider: true }, 0))).rejects.toThrow('retry_schedule_missing');
  expect(client.query).toHaveBeenCalledTimes(1);
});
test('dispatch is bounded and a fresh empty setup never invokes providers', async () => {
  const service = { db: { query: jest.fn().mockResolvedValue({ rows: [] }) },
    recoverStaleProcessingRetries: jest.fn(), processRetryQueue: jest.fn().mockResolvedValue({ processed: 1 }),
    logger: { info: jest.fn() } };
  await dispatchEnrichmentRetries(service);
  expect(service.processRetryQueue).not.toHaveBeenCalled();
  service.db.query.mockResolvedValue({ rows: [{ id: 1 }] });
  await dispatchEnrichmentRetries(service);
  expect(service.processRetryQueue.mock.calls).toEqual([[50, 'omdb'], [50, 'web_search'], [50, 'tavily']]);
});
test('router quota errorCode preserves monthly deferral', async () => {
  const error = new WebSearchProviderRoutingError('quota', [{ providerKey: 'tavily', status: 'available' }],
    { lastError: { provider: 'tavily', code: 'quota_exhausted' } });
  const result = await enrichWithWebSearch({ webSearchEnrichmentService: { search: async () => { throw error; } },
    logger: { info: jest.fn(), warn: jest.fn() } }, { queue_id: 1, title: 'Fixture' }, { enrichmentType: 'tavily' });
  expect(result.deferUntilMonthlyReset).toBe(true);
});
test('OMDb quota race is a wait, not an item failure or fallback', async () => {
  const result = await enrichWithOmdb({ omdbService: { getByIMDBId: async () => { throw new OMDbLimitReachedError('quota'); } } },
    { imdb_id: 'tt123' });
  expect(result).toMatchObject({ success: false, deferUntilDailyReset: true });
});

test('generic web-search quota failure waits for the router, not a guessed billing reset', async () => {
  const result = await enrichWithWebSearch({ webSearchEnrichmentService: { search: async () => {
    throw Object.assign(new Error('quota'), { code: 'quota_exhausted' });
  } }, logger: { warn: jest.fn() } }, { queue_id: 2, title: 'Fixture' });
  expect(result.waitForProvider).toBe(true);
  expect(result.deferUntilMonthlyReset).toBeUndefined();
});
