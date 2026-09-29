/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { WebSearchProviderStorage } from '../../services/webSearchProviderStorage.mjs';
import { WebSearchProviderCachedSearchExecutor } from '../../services/webSearchProviderCachedSearch.mjs';
import { WebSearchProviderRouter } from '../../services/webSearchProviderRouter.mjs';
import { reserveProviderProbeQuota } from '../../services/providerRecoveryProbeQuota.mjs';
import { WebSearchProviderRetentionService } from '../../services/webSearchProviderRetentionService.mjs';
import { EnrichmentRetryService } from '../../services/enrichmentRetryService.mjs';
import { createHandoffFixture } from '../helpers/sourceRecoveryHandoffFixture.mjs';
import { webSearchAdmissionDeferred } from '../../services/webSearchQuotaAdmission.mjs';

const db = createIntegrationDatabaseModuleMock();
const storage = () => new WebSearchProviderStorage({ db, healthHistory: null });
const usage = async () => (await db.query('SELECT * FROM web_search_provider_usage ORDER BY id')).rows;
const getConfig = (provider = 'tavily') => storage().getProviderConfig(provider, { maskSecrets: false });
async function setup(provider = 'tavily', limit = 1, options = {}) {
  return storage().upsertProviderConfig({ providerKey: provider, apiKey: 'fixture-only', isEnabled: true,
    softDailyLimit: limit, config: options }, { maskSecrets: false });
}
const reserve = config => storage().reserveSearch({ providerKey: config.providerKey, config, purpose: 'metadata_enrichment' });
const response = { provider: 'tavily', providerRequestId: null, query: 'fixture', answer: '', results: [],
  usage: { costUnits: 1, quotaBucket: null }, warnings: [] };
const adapter = search => ({ providerKey: 'tavily', displayName: 'Tavily', capabilities: {}, testConnection: jest.fn(), search });
const cache = cached => ({ getFreshResponse: jest.fn(async () => cached), recordHit: jest.fn(), storeResponse: jest.fn() });
beforeEach(async () => {
  await db.query('TRUNCATE web_search_provider_config,tavily_config,web_search_provider_usage,enrichment_retry_cooldowns');
});

test.each(['tavily', 'brave', 'serper'])('%s serializes last-credit contention across independent stores', async provider => {
  const config = await setup(provider, 3);
  const attempts = await Promise.allSettled(Array.from({ length: 12 }, () => reserve(config)));
  expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(3);
  expect(attempts.filter(result => result.status === 'rejected').every(result => result.reason.code === 'admission_deferred')).toBe(true);
  expect((await usage()).reduce((sum, row) => sum + row.cost_units, 0)).toBe(3);
});

test('advanced Tavily reserves two credits; completion is idempotent and does not double count', async () => {
  const config = await setup('tavily', 3, { searchDepth: 'advanced' });
  const reservation = await reserve(config);
  expect(reservation.costUnits).toBe(2);
  await expect(reserve(config)).rejects.toMatchObject({ code: 'admission_deferred' });
  await storage().recordUsage({ providerKey: 'tavily', reservationId: reservation.id, status: 'success', costUnits: 1 });
  expect(await storage().recordUsage({ providerKey: 'tavily', reservationId: reservation.id, status: 'failed' })).toBeNull();
  expect(await usage()).toEqual([expect.objectContaining({ cost_units: 2, status: 'success' })]);
});

test('a probe and an ordinary search share the same last credit', async () => {
  const config = await setup();
  const probe = () => db.withTransaction(async client => {
    const { rows: [row] } = await client.query('SELECT * FROM web_search_provider_config WHERE id=$1 FOR UPDATE', [config.id]);
    return reserveProviderProbeQuota(client, { source: 'web_search', provider_key: 'tavily' }, row, Date.now());
  });
  const results = await Promise.allSettled([reserve(config), probe()]);
  const admitted = results.filter(result => result.status === 'fulfilled' && result.value);
  expect(admitted).toHaveLength(1); expect(await usage()).toHaveLength(1);
});

test.each(['rotate', 'disable', 'delete', 'reject', 'options', 'cooldown'])('%s invalidates a stale configuration before spend', async change => {
  const config = await setup();
  const statements = {
    rotate: "UPDATE web_search_provider_config SET api_key='changed'",
    disable: 'UPDATE web_search_provider_config SET is_enabled=false',
    delete: 'DELETE FROM web_search_provider_config',
    reject: 'UPDATE web_search_provider_config SET credential_rejected_at=clock_timestamp()',
    options: `UPDATE web_search_provider_config SET config='{"searchDepth":"advanced"}'::jsonb`,
    cooldown: "UPDATE web_search_provider_config SET cooldown_until=clock_timestamp()+interval '1 hour'",
  };
  await db.query(statements[change]);
  await expect(reserve(config)).rejects.toMatchObject({ code: 'admission_deferred' });
  expect(await usage()).toHaveLength(0);
});

test('crash reservations survive restart, rotation and zero-day retention without replenishing quota', async () => {
  const config = await setup(); await reserve(config);
  await db.query("UPDATE web_search_provider_config SET api_key='changed'");
  await new WebSearchProviderRetentionService({ db }).deleteOldUsageRows({ retentionDays: 1 });
  await expect(reserve(await getConfig())).rejects.toMatchObject({ code: 'admission_deferred' });
  expect(await usage()).toEqual([expect.objectContaining({ status: 'skipped', cost_units: 1 })]);
});

test('UTC day and month budgets expire independently, including after an interrupted request', async () => {
  let config = await setup(); await reserve(config);
  await db.query("UPDATE web_search_provider_usage SET searched_at=date_trunc('day',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-interval '1 second'");
  // Day reset grants another reservation; monthly usage remains charged.
  await reserve(config);
  await db.query('UPDATE web_search_provider_config SET soft_daily_limit=10,soft_monthly_limit=1');
  config = await getConfig();
  await expect(reserve(config)).rejects.toMatchObject({ code: 'admission_deferred' });
  await db.query("UPDATE web_search_provider_usage SET searched_at=date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-interval '1 second'");
  expect((await reserve(config)).allowed).toBe(true);
});

test('legacy Tavily has atomic accounting and yields to an explicit disabled provider', async () => {
  await db.query("INSERT INTO tavily_config(api_key,is_active,search_depth) VALUES ('fixture-only',true,'advanced')");
  const legacy = await getConfig(); expect((await reserve(legacy)).costUnits).toBe(2);
  await storage().upsertProviderConfig({ providerKey: 'tavily', isEnabled: false });
  await expect(reserve(legacy)).rejects.toMatchObject({ code: 'admission_deferred' });
  expect(await usage()).toHaveLength(1);
});

test('retention and summaries preserve the UTC month even in a non-UTC session', async () => {
  await db.query(`INSERT INTO web_search_provider_usage (provider_key,purpose,status,cost_units,searched_at)
    VALUES ('brave','classification','skipped',1,'2026-10-01T00:30:00Z')`);
  await db.withTransaction(async client => {
    await client.query("SET LOCAL TIME ZONE 'Pacific/Honolulu'");
    const now = new Date('2026-10-03T12:00:00Z');
    expect(await new WebSearchProviderRetentionService({ db: client }).deleteOldUsageRows({ retentionDays: 1, now })).toBe(0);
    const summary = await new WebSearchProviderStorage({ db: client }).getProviderUsageSummaries(['brave'], { now });
    expect(summary.get('brave').monthlyCostUnits).toBe(1);
  });
});

test('fresh setup cannot manufacture credential context or spend quota', async () => {
  await expect(reserve({ providerKey: 'tavily', apiKey: 'fixture-only' })).rejects.toMatchObject({ code: 'admission_deferred' });
  expect(await usage()).toHaveLength(0);
});

test('router serves free cached results at exhausted quota but a miss cannot dispatch', async () => {
  const config = await setup(); await reserve(config);
  const search = jest.fn(async () => response), cacheStore = cache({ response });
  const executor = new WebSearchProviderCachedSearchExecutor({ usageStorage: storage(), cacheStore });
  const router = new WebSearchProviderRouter({ storage: storage(), executor, registry: { getAdapter: () => adapter(search) },
    routeHistory: null, qualityCalibrationService: null });
  expect((await router.search({ query: 'fixture' })).cache.hit).toBe(true);
  cacheStore.getFreshResponse.mockResolvedValue(null);
  await expect(router.search({ query: 'fixture' })).rejects.toMatchObject({ lastError: { errorCode: 'admission_deferred' } });
  expect(search).not.toHaveBeenCalled();
  expect((await usage()).filter(row => row.cost_units > 0)).toHaveLength(1);
});

test('successful and failed executor dispatches complete their reservation without a duplicate charge', async () => {
  const config = await setup('tavily', 4, { searchDepth: 'advanced' });
  const search = jest.fn(async () => response);
  const executor = new WebSearchProviderCachedSearchExecutor({ usageStorage: storage(), cacheStore: cache(null) });
  expect((await executor.search({ provider: adapter(search), config, request: { query: 'fixture' }, cacheTtlMs: 0 })).response.usage.costUnits).toBe(2);
  search.mockRejectedValue(new Error('fixture timeout'));
  await expect(executor.search({ provider: adapter(search), config, request: { query: 'fixture' }, cacheTtlMs: 0 })).rejects.toThrow('fixture timeout');
  expect(await usage()).toEqual([expect.objectContaining({ cost_units: 2, status: 'success' }),
    expect.objectContaining({ cost_units: 2, status: 'failed' })]);
});

test('local admission waits preserve legacy Tavily retry attempts without assuming a monthly failure', async () => {
  const fixture = await createHandoffFixture(db, 'movie');
  let service;
  try {
    await fixture.scan(); const item = (await fixture.inventory())[0];
    service = new EnrichmentRetryService({ db, logger: fixture.log,
      webSearchEnrichmentService: { hasAvailableProvider: async () => true,
        search: async () => { throw webSearchAdmissionDeferred('tavily', 120); } } });
    jest.spyOn(service, 'scheduleProcessing').mockImplementation(() => {});
    await setup(); await service.queueForRetry(item.id, 'tavily');
    expect(await service.processRetryQueue(1, 'tavily')).toMatchObject({ processed: 1 });
    const { rows: [retry] } = await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1', [item.id]);
    expect(retry).toMatchObject({ status: 'pending', attempts: 0 });
    expect(new Date(retry.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
    expect(retry.reason).not.toBe('tavily_monthly_quota_deferred');
  } finally { service?.cancelScheduledProcessing(); await fixture.cleanup(); }
});
