/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, afterEach } from '@jest/globals';
import { createWebSearchRetryInspector, canReadWebSearchCandidateCache } from '../services/webSearchRetryReadiness.mjs';
import { buildWebSearchProviderCacheIdentity } from '../services/webSearchProviderCachePolicy.mjs';
import { buildImdbLookupRequest } from '../services/webSearchEnrichmentRequests.mjs';
import { EnrichmentRetryService } from '../services/enrichmentRetryService.mjs';

const item = { queue_id: 1, title: 'Fixture', media_type: 'movie', imdb_id: 'tt1234567' };
const config = { providerKey: 'brave', config: { country: 'US' },
  credentialContext: { source: 'web_search', id: 1, generation: '00000000-0000-4000-8000-000000000001' } };
const identity = value => buildWebSearchProviderCacheIdentity({ providerKey: 'brave', request: buildImdbLookupRequest(item), config: value });
function router(overrides = {}) {
  return { getRouteCandidates: jest.fn(async () => [{ status: 'available', providerKey: 'brave', config, quota: {}, ...overrides }]),
    executor: { cacheStore: { getFreshKeys: jest.fn(async () => []) } },
    storage: { db: { query: jest.fn(async () => ({ rows: [{ wait: 120 }] })) } } };
}

test('health and routing telemetry do not invalidate results; generation and search settings do', () => {
  expect(identity({ ...config, lastSuccessAt: '2026-09-29', updatedAt: 'now', priority: 2, softDailyLimit: 50 }).cacheKey).toBe(identity(config).cacheKey);
  expect(identity({ ...config, config: { country: 'FR' } }).cacheKey).not.toBe(identity(config).cacheKey);
  expect(identity({ ...config, credentialContext: { ...config.credentialContext, generation: 'replacement' } }).cacheKey).not.toBe(identity(config).cacheKey);
});
test.each(['disabled', 'unconfigured', 'credentials_rejected', 'adapter_unavailable'])('%s cannot use the cache as a bypass', skipReason => {
  expect(canReadWebSearchCandidateCache({ status: 'skipped', skipReason })).toBe(false);
});
test('cache hits bypass pacing preview; repeated blocked misses share a bounded read', async () => {
  const route = router();
  route.executor.cacheStore.getFreshKeys.mockResolvedValue([identity(config).cacheKey]);
  const inspect = await createWebSearchRetryInspector(route, [item, { ...item, queue_id: 2, title: 'Other', imdb_id: 'tt0000002' }]);
  expect(await inspect(item)).toEqual({ ready: true, cached: true });
  expect(route.storage.db.query).not.toHaveBeenCalled();
  expect(await inspect({ queue_id: 2 })).toEqual({ ready: false, delayMs: 120000 });
  expect((await inspect({ queue_id: 2 })).delayMs).toBeGreaterThan(119000);
  expect(route.storage.db.query).toHaveBeenCalledTimes(1);
});
test('an available alternative can proceed; exhausted quota cannot authorize network', async () => {
  const route = router(); route.storage.db.query.mockResolvedValue({ rows: [{ wait: 0 }] });
  expect(await (await createWebSearchRetryInspector(route, [item]))(item)).toEqual({ ready: true, cached: false });
  route.getRouteCandidates.mockResolvedValue([{ status: 'skipped', skipReason: 'monthly_quota_exhausted',
    providerKey: 'brave', config, quota: { monthlyRemaining: 0 } }]);
  expect(await (await createWebSearchRetryInspector(route, [item]))(item)).toMatchObject({ ready: false, delayMs: expect.any(Number) });
});
test('empty provider setup waits without querying pacing or claiming work', async () => {
  const route = router(); route.getRouteCandidates.mockResolvedValue([]);
  expect(await (await createWebSearchRetryInspector(route, [item]))(item)).toEqual({ ready: false, delayMs: 300000 });
  expect(route.storage.db.query).not.toHaveBeenCalled();
});
test('oversized pages fail before reads', async () => {
  const route = router();
  await expect(createWebSearchRetryInspector(route, Array(51).fill(item))).rejects.toThrow('invalid_retry_page');
  expect(route.getRouteCandidates).not.toHaveBeenCalled();
});
test('nullable years are omitted and malformed work does not block valid cache keys', async () => {
  const route = router(); route.executor.cacheStore.getFreshKeys.mockResolvedValue([identity(config).cacheKey]);
  const malformed = { ...item, queue_id: 2, year: 'invalid' };
  const inspect = await createWebSearchRetryInspector(route, [{ ...item, year: null }, malformed]);
  expect(await inspect(item)).toEqual({ ready: true, cached: true });
  expect(await inspect(malformed)).toEqual({ ready: true, cached: false });
});

afterEach(() => jest.useRealTimers());
test('wake-ups coalesce, shorten, cancel and bound long waits', async () => {
  jest.useFakeTimers();
  const service = new EnrichmentRetryService(); service.triggerProcessing = jest.fn(async () => {});
  service.scheduleProcessing(30 * 86400000);
  expect(jest.getTimerCount()).toBe(1);
  service.scheduleProcessing(600000); expect(jest.getTimerCount()).toBe(1);
  service.scheduleProcessing(1000); await jest.advanceTimersByTimeAsync(1000);
  expect(service.triggerProcessing).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
  service.processingInProgress = true;
  service.scheduleProcessing(10000); service.scheduleProcessing(2000);
  expect(service.pendingWakeDelay).toBe(2000); expect(jest.getTimerCount()).toBe(0);
  service.cancelScheduledProcessing(); expect(service.pendingWakeDelay).toBeNull();
  service.processingInProgress = false; service.scheduleProcessing(-1);
  service.resetState(); await jest.advanceTimersByTimeAsync(5000);
  expect(service.triggerProcessing).toHaveBeenCalledTimes(1);
});
