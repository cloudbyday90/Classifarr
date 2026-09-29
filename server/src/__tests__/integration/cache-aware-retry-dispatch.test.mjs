/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { EnrichmentRetryService } from '../../services/enrichmentRetryService.mjs';
import { WebSearchEnrichmentService } from '../../services/webSearchEnrichmentService.mjs';
import { WebSearchProviderStorage } from '../../services/webSearchProviderStorage.mjs';
import { WebSearchProviderUsageCache } from '../../services/webSearchProviderUsageCache.mjs';
import { WebSearchProviderCachedSearchExecutor } from '../../services/webSearchProviderCachedSearch.mjs';
import { WebSearchProviderRouter } from '../../services/webSearchProviderRouter.mjs';
import { buildImdbLookupRequest } from '../../services/webSearchEnrichmentRequests.mjs';
import { buildWebSearchProviderCacheIdentity } from '../../services/webSearchProviderCachePolicy.mjs';
import { readEnrichmentRetryPage } from '../../services/enrichmentRetryCandidates.mjs';

const db = createIntegrationDatabaseModuleMock();
const storage = new WebSearchProviderStorage({ db, healthHistory: null });
const cache = new WebSearchProviderUsageCache({ db });
let serverId, libraryId, service, router, search;
const services = [];
const response = { provider: 'brave', providerRequestId: null, query: 'fixture', answer: '',
  results: [{ url: 'https://www.imdb.com/title/tt1234567/', title: 'Fixture', snippet: 'Drama 8/10',
    rank: 1, score: null, publishedAt: null, sourceDomain: 'imdb.com', providerMetadata: {} }],
  usage: { costUnits: 1, quotaBucket: null }, warnings: [] };
const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, jest.fn()]));
function instance() {
  const result = new EnrichmentRetryService({ db, logger,
    webSearchEnrichmentService: new WebSearchEnrichmentService({ router }) });
  jest.spyOn(result, 'scheduleProcessing').mockImplementation(() => {});
  services.push(result); return result;
}
async function items(count = 2) {
  const { rows } = await db.query(`INSERT INTO media_server_items
    (media_server_id,external_id,library_id,media_type,title,imdb_id)
    SELECT $1,'item-'||n,$2,'movie','Fixture '||n,'tt'||lpad(n::text,7,'0') FROM generate_series(1,$3::integer) n RETURNING *`,
  [serverId, libraryId, count]);
  for (const item of rows) await service.queueForRetry(item.id, 'web_search');
  return rows;
}
async function cached(item) {
  const config = await storage.getProviderConfig('brave', { maskSecrets: false });
  const identity = buildWebSearchProviderCacheIdentity({ providerKey: 'brave', config, request: buildImdbLookupRequest(item) });
  await cache.storeResponse({ ...identity, response, ttlMs: 3600000 });
}
const rows = async () => (await db.query('SELECT * FROM enrichment_retry_queue ORDER BY id')).rows;
async function block() {
  await db.query(`INSERT INTO web_search_provider_pacing(provider_key,next_admission_at)
    VALUES ('brave',clock_timestamp()+interval '1 hour') ON CONFLICT(provider_key)
    DO UPDATE SET next_admission_at=EXCLUDED.next_admission_at`);
}
beforeEach(async () => {
  await db.query('TRUNCATE web_search_provider_config,web_search_provider_cache,web_search_provider_usage,web_search_provider_pacing,tavily_config,enrichment_retry_cooldowns');
  serverId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,'http://fixture.invalid','fixture') RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = (await db.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ('Fixture','fixture','movie',$1,true) RETURNING id", [serverId])).rows[0].id;
  await storage.upsertProviderConfig({ providerKey: 'brave', apiKey: 'fixture', isEnabled: true });
  search = jest.fn(async () => response);
  const adapter = { providerKey: 'brave', displayName: 'Fixture', capabilities: {}, search, testConnection: async () => ({ success: true }) };
  router = new WebSearchProviderRouter({ storage, registry: { getAdapter: () => adapter },
    executor: new WebSearchProviderCachedSearchExecutor({ usageStorage: storage, cacheStore: cache }),
    routeHistory: null, qualityCalibrationService: null });
  service = instance();
});
afterEach(async () => {
  services.splice(0).forEach(current => current.cancelScheduledProcessing());
  await db.query('DELETE FROM media_server_items WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [serverId]);
});

test('blocked head remains byte-for-byte unchanged while a later cache hit completes', async () => {
  const all = await items(); await cached(all[1]); await block(); const before = await rows();
  expect(await service.processRetryQueue()).toMatchObject({ processed: 1, success: 1 });
  const after = await rows(); expect(after[0]).toEqual(before[0]);
  expect(after[1]).toMatchObject({ status: 'completed', attempts: 0, claim_token: null });
  expect(search).not.toHaveBeenCalled();
  expect((await db.query('SELECT cost_units,operation FROM web_search_provider_usage')).rows)
    .toEqual([{ cost_units: 0, operation: 'cache_hit' }]);
});
test('full waiting pages advance without writes; reconstructed services safely rescan', async () => {
  const all = await items(51); await cached(all[50]); await block();
  // Legacy nullable timestamps still have a total cursor order.
  await db.query('UPDATE enrichment_retry_queue SET created_at=NULL');
  const before = await rows();
  expect(await service.processRetryQueue()).toMatchObject({ processed: 0 }); expect(await rows()).toEqual(before);
  expect(await instance().processRetryQueue()).toMatchObject({ processed: 0 });
  expect(await service.processRetryQueue()).toMatchObject({ processed: 1, success: 1 });
  expect(search).not.toHaveBeenCalled(); expect((await rows()).slice(0, 50)).toEqual(before.slice(0, 50));
});
test('network success and a health update preserve cache identity across fresh configuration reads', async () => {
  const [item] = await items(1);
  expect((await router.search(buildImdbLookupRequest(item), { cacheTtlMs: 3600000 })).cache.hit).toBe(false);
  await block(); expect(await service.processRetryQueue()).toMatchObject({ success: 1 });
  expect(search).toHaveBeenCalledTimes(1);
  expect((await db.query('SELECT sum(cost_units)::integer AS credits FROM web_search_provider_usage')).rows[0].credits).toBe(1);
});
test('expired cache and replaced credentials cannot turn a cache preview into network authorization', async () => {
  const [item] = await items(1); await cached(item); await block();
  const create = service.webSearchEnrichmentService.createRetryInspector.bind(service.webSearchEnrichmentService);
  jest.spyOn(service.webSearchEnrichmentService, 'createRetryInspector').mockImplementation(async page => {
    const inspect = await create(page);
    await db.query("UPDATE web_search_provider_cache SET expires_at=clock_timestamp()-interval '1 second'");
    await db.query("UPDATE web_search_provider_config SET api_key='replacement'");
    return inspect;
  });
  expect(await service.processRetryQueue()).toMatchObject({ processed: 1, skipped: true });
  expect((await rows())[0]).toMatchObject({ attempts: 0, status: 'pending' });
  expect(search).not.toHaveBeenCalled();
  expect((await db.query('SELECT * FROM web_search_provider_usage')).rows).toHaveLength(0);
});
test('competing cache planners still produce only one authoritative completion', async () => {
  const [item] = await items(1); await cached(item); await block();
  const results = await Promise.all([service.processRetryQueue(), instance().processRetryQueue()]);
  expect(results.reduce((sum, result) => sum + result.success, 0)).toBe(1);
  expect((await rows())[0].status).toBe('completed'); expect(search).not.toHaveBeenCalled();
});
test('read-only planning excludes disabled libraries, music, future due times and rejected credentials', async () => {
  await items(1); const before = await rows();
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  expect(await readEnrichmentRetryPage(db, 'web_search', null, 50)).toEqual([]);
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId]);
  await db.query("UPDATE media_server_items SET media_type='track' WHERE library_id=$1", [libraryId]);
  expect(await readEnrichmentRetryPage(db, 'web_search', null, 50)).toEqual([]);
  await db.query("UPDATE media_server_items SET media_type='movie' WHERE library_id=$1", [libraryId]);
  await db.query("UPDATE web_search_provider_config SET credential_rejected_at=clock_timestamp()");
  expect(await readEnrichmentRetryPage(db, 'web_search', null, 50)).toEqual([]);
  expect(await rows()).toEqual(before);
  await db.query('UPDATE web_search_provider_config SET credential_rejected_at=NULL');
  await db.query("UPDATE enrichment_retry_queue SET next_attempt_at=clock_timestamp()+interval '1 day'");
  expect(await readEnrichmentRetryPage(db, 'web_search', null, 50)).toEqual([]);
});
test('fresh setup waits without mutations or outbound work and resumes after configuration', async () => {
  await items(1); await db.query('DELETE FROM web_search_provider_config'); const before = await rows();
  expect(await service.processRetryQueue()).toMatchObject({ processed: 0 }); expect(await rows()).toEqual(before);
  await storage.upsertProviderConfig({ providerKey: 'brave', apiKey: 'fixture', isEnabled: true });
  expect(await service.processRetryQueue()).toMatchObject({ success: 1 }); expect(search).toHaveBeenCalledTimes(1);
});
test('usage accepts both preserved UUID history and bounded retry trace identifiers', async () => {
  const trace = randomUUID();
  await storage.recordUsage({ providerKey: 'brave', operation: 'cache_hit', status: 'success', costUnits: 0, correlationId: trace });
  await storage.recordUsage({ providerKey: 'brave', operation: 'cache_hit', status: 'success', costUnits: 0, correlationId: 'enrichment-retry:123' });
  expect((await db.query('SELECT correlation_id FROM web_search_provider_usage ORDER BY id')).rows)
    .toEqual([{ correlation_id: trace }, { correlation_id: 'enrichment-retry:123' }]);
});
