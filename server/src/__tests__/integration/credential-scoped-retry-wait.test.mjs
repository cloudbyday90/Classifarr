/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { seedOmdbQuotaFixture } from '../helpers/omdbQuotaFixture.mjs';

const db = createIntegrationDatabaseModuleMock(), http = jest.fn();
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../utils/httpClient.mjs', () => ({ httpGet: http, httpPost: jest.fn(), httpPut: jest.fn(),
  httpDelete: jest.fn(), httpGetBinary: jest.fn(), httpStream: jest.fn(), defaultHttpClient: { get: http, post: jest.fn() } }));
const { createHandoffFixture } = await import('../helpers/sourceRecoveryHandoffFixture.mjs');
const { readEnrichmentRetryPage } = await import('../../services/enrichmentRetryCandidates.mjs');
const { readRetryReadinessPage } = await import('../../services/retryReadinessRepository.mjs');
const { claimEnrichmentRetry, createEnrichmentRetryWriteGuard } = await import('../../services/enrichmentRetryClaimService.mjs');
const { persistEnrichmentRetryResult } = await import('../../services/enrichmentRetryResultPersistence.mjs');
const { rememberProviderRequest } = await import('../../services/providerRequestEvidence.mjs');
const { providerCredentialContext } = await import('../../services/providerCredentialRejection.mjs');
const { WebSearchProviderStorage } = await import('../../services/webSearchProviderStorage.mjs');
const { WebSearchProviderUsageCache } = await import('../../services/webSearchProviderUsageCache.mjs');
const { WebSearchProviderCachedSearchExecutor } = await import('../../services/webSearchProviderCachedSearch.mjs');
const { WebSearchProviderRouter } = await import('../../services/webSearchProviderRouter.mjs');
const { WebSearchEnrichmentService } = await import('../../services/webSearchEnrichmentService.mjs');
const { WebSearchProviderError } = await import('../../services/webSearchProviderErrorTaxonomy.mjs');
const { createProviderRecoveryProbeRepository } = await import('../../services/providerRecoveryProbeRepository.mjs');
const { deferWebSearchPacing, webSearchPacingWait } = await import('../../services/webSearchPacingStore.mjs');
const { EnrichmentRetryService } = await import('../../services/enrichmentRetryService.mjs');
const { omdbService } = await import('../../services/omdb.mjs');
const { summarizeOmdbRetryReadiness } = await import('../../services/omdbRetryReadiness.mjs');
const storage = new WebSearchProviderStorage({ db, healthHistory: null });
const cache = new WebSearchProviderUsageCache({ db });
const services = [];
let fixture, item;
const config = async () => (await db.query('SELECT * FROM omdb_config ORDER BY id DESC LIMIT 1')).rows[0];
const row = async () => (await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1 ORDER BY id', [item.id])).rows[0];
const expireFloor = () => db.query("UPDATE omdb_request_pacing SET next_admission_at=clock_timestamp()-interval '1 second'");
function service(router) {
  const instance = new EnrichmentRetryService({ db, omdbService, logger: fixture.log,
    ...(router ? { webSearchEnrichmentService: new WebSearchEnrichmentService({ router }) } : {}) });
  jest.spyOn(instance, 'scheduleProcessing').mockImplementation(() => {}); services.push(instance); return instance;
}
beforeEach(async () => {
  http.mockReset();
  await seedOmdbQuotaFixture(db);
  await db.query('TRUNCATE provider_credential_probes,enrichment_retry_cooldowns,web_search_provider_config,web_search_provider_cache,web_search_provider_usage,web_search_provider_pacing,tavily_config');
  fixture = await createHandoffFixture(db, 'movie');
  await fixture.scan([{ external_id: 'scoped', title: 'Synthetic', imdb_id: 'tt0000001', tmdb_id: 42, media_type: 'movie' }]);
  item = (await fixture.inventory())[0];
});
afterEach(async () => { services.splice(0).forEach(instance => instance.cancelScheduledProcessing()); await fixture.cleanup(); });
async function failOmdb() {
  await service().queueForRetry(item.id, 'omdb');
  http.mockRejectedValueOnce({ response: { status: 503, headers: { 'Retry-After': '3600' } } });
  expect(await service().processRetryQueue(1, 'omdb')).toMatchObject({ processed: 1, failed: 1 });
  expect(fixture.log.error).not.toHaveBeenCalled();
}
const success = () => http.mockResolvedValue({ status: 200, data: { Response: 'True', Title: 'Synthetic', imdbID: 'tt0000001', Type: 'movie', Ratings: [] } });

test('repair releases the item deadline and provider cooldown after restart, without resetting attempts', async () => {
  await failOmdb(); const before = await row();
  expect(before.retry_wait_context).toHaveLength(1);
  expect(before.retry_wait_until).toEqual(before.next_attempt_at);
  expect((await db.query('SELECT * FROM enrichment_retry_cooldowns')).rows).toEqual([]);
  expect(await service().processRetryQueue(1, 'omdb')).toMatchObject({ processed: 0 });
  await db.query("UPDATE omdb_config SET api_key='replacement-synthetic'"); await expireFloor(); success();
  expect((await readEnrichmentRetryPage(db, 'omdb', null, 50))).toHaveLength(1);
  await db.withTransaction(async client => {
    await client.query('SET TRANSACTION READ ONLY');
    const page = await readRetryReadinessPage(client, 'omdb');
    const summary = await summarizeOmdbRetryReadiness(client, page, Date.now());
    expect(summary.counts.provider_ready).toBe(1);
    expect(JSON.stringify(summary)).not.toMatch(/generation|replacement|Synthetic/);
  });
  expect((await service().getStats()).omdb).toMatchObject({ pending: 1, deferred: 0 });
  expect(await row()).toEqual(before); // Observation does not rewrite historical state.
  await service().triggerProcessing();
  expect(await row()).toMatchObject({ status: 'completed', attempts: 1, retry_wait_context: null, retry_wait_until: null });
  expect(http).toHaveBeenCalledTimes(2);
});

test.each(['same-key save', 'disabled', 'unconfigured', 'rejected replacement', 'changed item deadline', 'legacy cooldown'])('%s cannot release protected work', async scenario => {
  await failOmdb(); await expireFloor();
  if (scenario !== 'same-key save') await db.query("UPDATE omdb_config SET api_key='replacement-synthetic'");
  else await db.query('UPDATE omdb_config SET api_key=api_key,daily_limit=daily_limit');
  if (scenario === 'disabled') await db.query('UPDATE omdb_config SET is_active=false');
  if (scenario === 'unconfigured') await db.query("UPDATE omdb_config SET api_key=''");
  if (scenario === 'rejected replacement') await db.query('UPDATE omdb_config SET credential_rejected_at=clock_timestamp()');
  if (scenario === 'changed item deadline') await db.query("UPDATE enrichment_retry_queue SET next_attempt_at=next_attempt_at+interval '1 hour'");
  if (scenario === 'legacy cooldown') await db.query("INSERT INTO enrichment_retry_cooldowns VALUES ('omdb',clock_timestamp()+interval '1 day','legacy_unknown')");
  const before = await row();
  expect(await service().processRetryQueue(1, 'omdb')).toMatchObject({ processed: 0 });
  expect(await row()).toEqual(before); expect(http).toHaveBeenCalledTimes(1);
});

test('missing provenance retains both existing legacy waits', async () => {
  await service().queueForRetry(item.id, 'omdb');
  const received = await claimEnrichmentRetry(db, 'omdb');
  await createEnrichmentRetryWriteGuard(db, received, 'omdb')((client, claim, current) =>
    persistEnrichmentRetryResult(client, claim, current, received, 'omdb', { transient: true, error: 'fixture' },
      { enrichmentItemStateService: service().enrichmentItemStateService }));
  await db.query("UPDATE omdb_config SET api_key='replacement-synthetic'");
  expect((await row()).retry_wait_context).toBeNull();
  expect((await db.query('SELECT * FROM enrichment_retry_cooldowns')).rows).toHaveLength(1);
  expect(await claimEnrichmentRetry(db, 'omdb')).toBeNull();
});

test('late failure from old credentials cannot establish a cooldown against replacement credentials', async () => {
  await service().queueForRetry(item.id, 'omdb');
  http.mockImplementationOnce(async () => {
    await db.query("UPDATE omdb_config SET api_key='replacement-synthetic'");
    throw { response: { status: 503, headers: { 'Retry-After': '3600' } } };
  });
  await service().processRetryQueue(1, 'omdb'); await expireFloor();
  expect((await config()).requests_today).toBe(1);
  expect((await db.query('SELECT blocked_until FROM omdb_request_pacing')).rows[0].blocked_until).toBeNull();
  expect(await readEnrichmentRetryPage(db, 'omdb', null, 50)).toHaveLength(1);
  success(); expect(await service().processRetryQueue(1, 'omdb')).toMatchObject({ success: 1 });
});

test('rotation never refunds daily quota or bypasses disabled libraries or music exclusion', async () => {
  await failOmdb(); await db.query("UPDATE omdb_config SET api_key='replacement-synthetic',requests_today=daily_limit"); await expireFloor();
  expect(await service().processRetryQueue(1, 'omdb')).toMatchObject({ processed: 0 });
  await db.query('UPDATE omdb_config SET requests_today=0');
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [item.library_id]);
  expect(await claimEnrichmentRetry(db, 'omdb')).toBeNull();
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [item.library_id]);
  await db.query("UPDATE media_server_items SET media_type='track' WHERE id=$1", [item.id]);
  expect(await claimEnrichmentRetry(db, 'omdb')).toBeNull(); expect(http).toHaveBeenCalledTimes(1);
});

test('daily reset schedules remain unscoped even with known provenance', async () => {
  await service().queueForRetry(item.id, 'omdb');
  const received = await claimEnrichmentRetry(db, 'omdb');
  const result = rememberProviderRequest({ deferUntilDailyReset: true }, [{ ...providerCredentialContext('omdb', await config()), providerKey: 'omdb' }]);
  await createEnrichmentRetryWriteGuard(db, received, 'omdb')((client, claim, current) =>
    persistEnrichmentRetryResult(client, claim, current, received, 'omdb', result,
      { enrichmentItemStateService: service().enrichmentItemStateService }));
  await db.query("UPDATE omdb_config SET api_key='replacement-synthetic'");
  expect((await row()).retry_wait_context).toBeNull(); expect(await claimEnrichmentRetry(db, 'omdb')).toBeNull();
});

function webRouter(searches) {
  return new WebSearchProviderRouter({ storage, registry: { getAdapter: key => ({ providerKey: key, displayName: key,
    capabilities: {}, search: searches[key], testConnection: async () => ({ success: true }) }) },
  executor: new WebSearchProviderCachedSearchExecutor({ usageStorage: storage, cacheStore: cache }), routeHistory: null, qualityCalibrationService: null });
}
test('repairing one web provider does not reopen another provider; fallback uses the repaired provider', async () => {
  for (const providerKey of ['brave', 'serper']) await storage.upsertProviderConfig({ providerKey, apiKey: 'synthetic', isEnabled: true });
  const searches = Object.fromEntries(['brave', 'serper'].map(provider => [provider, jest.fn(async () => {
    throw new WebSearchProviderError({ provider, operation: 'search', errorCode: 'timeout', safeMessage: 'Synthetic timeout', retryable: true });
  })]));
  const router = webRouter(searches);
  await service(router).queueForRetry(item.id, 'web_search');
  expect(await service(router).processRetryQueue(1)).toMatchObject({ processed: 1, failed: 1 });
  expect((await row()).retry_wait_context).toHaveLength(2);
  const before = (await db.query("SELECT * FROM web_search_provider_pacing WHERE provider_key='brave'")).rows[0];
  await storage.upsertProviderConfig({ providerKey: 'serper', apiKey: 'repaired-synthetic', isEnabled: true });
  await db.query("UPDATE web_search_provider_pacing SET next_admission_at=clock_timestamp()-interval '1 second'");
  searches.serper.mockResolvedValue({ provider: 'serper', providerRequestId: null, query: 'synthetic', answer: 'IMDb 8/10',
    results: [{ url: 'https://www.imdb.com/title/tt0000001/', title: 'Synthetic', snippet: 'IMDb 8/10', rank: 1, score: null,
      publishedAt: null, sourceDomain: 'imdb.com', providerMetadata: {} }], usage: { costUnits: 1, quotaBucket: null }, warnings: [] });
  expect(await service(router).processRetryQueue(1)).toMatchObject({ success: 1 });
  expect(searches.brave).toHaveBeenCalledTimes(1); expect(searches.serper).toHaveBeenCalledTimes(2);
  expect((await db.query("SELECT blocked_until FROM web_search_provider_pacing WHERE provider_key='brave'")).rows[0].blocked_until).toEqual(before.blocked_until);
  expect((await db.query("SELECT sum(cost_units)::integer AS used FROM web_search_provider_usage WHERE provider_key='brave'")).rows[0].used).toBe(1);
});

test('verified web recovery transfers same-key transport wait even without a new Retry-After', async () => {
  await service().queueForRetry(item.id, 'web_search');
  await storage.upsertProviderConfig({ providerKey: 'brave', apiKey: 'synthetic', isEnabled: true });
  const saved = (await db.query("UPDATE web_search_provider_config SET credential_rejected_at=clock_timestamp()-interval '16 minutes' RETURNING *")).rows[0];
  const repository = createProviderRecoveryProbeRepository(db, { random: () => 0 });
  const claim = await repository.claim((await repository.candidates())[0]); expect(claim).not.toBeNull();
  const context = providerCredentialContext('web_search', saved);
  await deferWebSearchPacing(db, 'brave', context, 3600);
  expect(await repository.finish(claim, { category: 'verified' })).toBe(true);
  const current = providerCredentialContext('web_search', (await db.query('SELECT * FROM web_search_provider_config')).rows[0]);
  expect(current.generation).not.toBe(context.generation);
  expect(await webSearchPacingWait(db, 'brave', current)).toBeGreaterThan(3500);
});
