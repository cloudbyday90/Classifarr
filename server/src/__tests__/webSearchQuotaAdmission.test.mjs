/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { admitWebSearch } from '../services/webSearchQuotaAdmission.mjs';
import { webSearchRequestCost, completeWebSearchQuotaReservation } from '../services/webSearchQuotaReservation.mjs';
import { WebSearchProviderCachedSearchExecutor } from '../services/webSearchProviderCachedSearch.mjs';

test.each([['advanced', 2], [' ADVANCED ', 2], ['basic', 1], ['fast', 1], ['ultra-fast', 1], ['bad', 1]])(
  'Tavily %s uses the dispatched cost', (searchDepth, cost) => {
    expect(webSearchRequestCost('tavily', { config: { searchDepth } })).toBe(cost);
    expect(webSearchRequestCost('brave', { searchDepth })).toBe(1);
    expect(webSearchRequestCost('serper', { searchDepth })).toBe(1);
  });
test('invalid provider and reservation IDs fail before querying', async () => {
  expect(() => webSearchRequestCost('unknown')).toThrow();
  const db = { query: jest.fn() };
  await expect(completeWebSearchQuotaReservation(db, { reservationId: '0; DROP' }, [])).rejects.toThrow();
  expect(db.query).not.toHaveBeenCalled();
});
test('database failure is a sanitized provider wait', async () => {
  const db = { withTransaction: async () => { throw new Error('secret database details'); } };
  const failure = await admitWebSearch(db, { providerKey: 'brave', config: { credentialContext: {
    source: 'web_search', id: 1, generation: '879a6b9f-f343-402d-834b-040739c6411b' } } }).catch(error => error);
  expect(failure.code).toBe('admission_deferred'); expect(failure.retryAfterSeconds).toBe(60);
  expect(JSON.stringify(failure)).not.toContain('secret');
});
test('a denied cache miss sends no HTTP or usage completion and does not affect provider health', async () => {
  const denied = new Error('denied');
  const usageStorage = { reserveSearch: jest.fn().mockRejectedValue(denied), recordUsage: jest.fn(), updateProviderAfterUsage: jest.fn() };
  const provider = { providerKey: 'brave', displayName: 'Brave', capabilities: {}, testConnection: jest.fn(), search: jest.fn() };
  const executor = new WebSearchProviderCachedSearchExecutor({ usageStorage, cacheStore: { getFreshResponse: async () => null } });
  await expect(executor.search({ provider, request: { query: 'fixture' }, cacheTtlMs: 0 })).rejects.toBe(denied);
  expect(provider.search).not.toHaveBeenCalled(); expect(usageStorage.recordUsage).not.toHaveBeenCalled();
  expect(usageStorage.updateProviderAfterUsage).not.toHaveBeenCalled();
});
