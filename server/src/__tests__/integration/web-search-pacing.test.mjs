/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { WebSearchProviderStorage } from '../../services/webSearchProviderStorage.mjs';
import { WebSearchProviderCachedSearchExecutor } from '../../services/webSearchProviderCachedSearch.mjs';
import { createBraveWebSearchProvider } from '../../services/braveWebSearchProvider.mjs';
import { BraveProviderClient } from '../../services/braveProviderClient.mjs';
import { reserveProviderProbeQuota } from '../../services/providerRecoveryProbeQuota.mjs';

const db = createIntegrationDatabaseModuleMock();
const storage = () => new WebSearchProviderStorage({ db, healthHistory: null });
const reserve = config => storage().reserveSearch({ providerKey: config.providerKey, config });
const setup = providerKey => storage().upsertProviderConfig({ providerKey, apiKey: 'fixture', isEnabled: true }, { maskSecrets: false });
const expire = () => db.query("UPDATE web_search_provider_pacing SET next_admission_at=clock_timestamp()-interval '1 second'");
beforeEach(async () => { await db.query('TRUNCATE web_search_provider_pacing,web_search_provider_usage,web_search_provider_config,tavily_config'); });

test.each(['brave', 'tavily', 'serper'])('%s concurrent callers cannot consume the same pacing slot', async provider => {
  const config = await setup(provider);
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => reserve(config)));
  const { rows } = await db.query('SELECT searched_at FROM web_search_provider_usage ORDER BY searched_at');
  expect(rows.length).toBeGreaterThan(0);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(rows.length);
  for (let index = 1; index < rows.length; index += 1) {
    expect(new Date(rows[index].searched_at) - new Date(rows[index - 1].searched_at)).toBeGreaterThanOrEqual(1000);
  }
  await db.query("UPDATE web_search_provider_pacing SET next_admission_at=clock_timestamp()+interval '10 seconds'");
  await expect(reserve(config)).rejects.toMatchObject({ code: 'admission_deferred' });
  expect((await db.query('SELECT count(*)::integer AS count FROM web_search_provider_usage')).rows[0].count).toBe(rows.length);
  await expire(); expect((await reserve(config)).allowed).toBe(true);
});
test('provider waits are durable, monotonic and cannot be reset by an ordinary settings save', async () => {
  const config = await setup('brave'); await reserve(config); await expire();
  await storage().deferPacing('brave', config.credentialContext, 120);
  await storage().deferPacing('brave', config.credentialContext, 1);
  const saved = await setup('brave');
  await expect(reserve(saved)).rejects.toMatchObject({ retryAfterSeconds: expect.any(Number) });
  const result = await reserve(saved).catch(error => error);
  expect(result.retryAfterSeconds).toBeGreaterThan(100);
  await db.query("UPDATE web_search_provider_pacing SET blocked_until=clock_timestamp()-interval '1 second'");
  expect((await reserve(saved)).allowed).toBe(true);
});
test('rotated credentials ignore prior waits and stale failures cannot change pacing or health', async () => {
  const config = await setup('brave'); await reserve(config); await expire();
  await storage().deferPacing('brave', config.credentialContext, 3600);
  const current = await storage().upsertProviderConfig({ providerKey: 'brave', apiKey: 'replacement', isEnabled: true }, { maskSecrets: false });
  await storage().deferPacing('brave', config.credentialContext, 7200);
  await storage().updateProviderAfterUsage('brave', { credentialContext: config.credentialContext,
    error: { code: 'rate_limited', httpStatus: 429, message: 'stale', retryAfterSeconds: 7200 } });
  expect((await reserve(current)).allowed).toBe(true);
  expect((await storage().getProviderConfig('brave')).lastErrorCode).toBeNull();
});
test('probe admission shares ordinary pacing and legacy Tavily stores generation-scoped waits', async () => {
  const config = await setup('brave'); await reserve(config);
  await db.query("UPDATE web_search_provider_pacing SET next_admission_at=clock_timestamp()+interval '10 seconds'");
  expect(await db.withTransaction(async client => {
    const { rows: [row] } = await client.query('SELECT * FROM web_search_provider_config WHERE id=$1 FOR UPDATE', [config.id]);
    return reserveProviderProbeQuota(client, { source: 'web_search', provider_key: 'brave' }, row, Date.now());
  })).toBe(false);
  await db.query("INSERT INTO tavily_config(api_key,is_active) VALUES ('fixture',true)");
  const legacy = await storage().getProviderConfig('tavily', { maskSecrets: false });
  await reserve(legacy); await expire(); await storage().deferPacing('tavily', legacy.credentialContext, 120);
  await expect(reserve(legacy)).rejects.toMatchObject({ code: 'admission_deferred' });
});
test('real adapter feedback persists exhausted-window waits; cached success bypasses pacing', async () => {
  const config = await setup('brave');
  const http = jest.fn(async () => ({ status: 200, data: { web: { results: [] } }, headers: {
    'x-ratelimit-limit': '1,15000', 'x-ratelimit-remaining': '1,0', 'x-ratelimit-reset': '1,3600' } }));
  const provider = createBraveWebSearchProvider({ braveClient: new BraveProviderClient({ httpGetFn: http }) });
  const cacheStore = { getFreshResponse: jest.fn(async () => null), recordHit: jest.fn(), storeResponse: jest.fn() };
  const executor = new WebSearchProviderCachedSearchExecutor({ usageStorage: storage(), cacheStore });
  const first = await executor.search({ provider, config, request: { query: 'fixture' } });
  await expire(); await expect(reserve(config)).rejects.toMatchObject({ code: 'admission_deferred' });
  cacheStore.getFreshResponse.mockResolvedValue({ response: first.response });
  expect((await executor.search({ provider, config, request: { query: 'fixture' } })).cache.hit).toBe(true);
  expect(http).toHaveBeenCalledTimes(1);
});
