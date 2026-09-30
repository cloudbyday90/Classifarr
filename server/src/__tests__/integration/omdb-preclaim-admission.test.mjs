/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { seedOmdbQuotaFixture } from '../helpers/omdbQuotaFixture.mjs';
import { EnrichmentRetryService } from '../../services/enrichmentRetryService.mjs';
import { reserveOmdbQuota } from '../../services/omdbQuotaStore.mjs';
import { OMDbLimitReachedError } from '../../services/omdbQuota.mjs';

const db = createIntegrationDatabaseModuleMock();
let serverId, libraryId, service, provider, http, logger;
const instances = [];
const rows = async () => (await db.query('SELECT * FROM enrichment_retry_queue ORDER BY id')).rows;
const config = async () => (await db.query('SELECT * FROM omdb_config ORDER BY id')).rows;
const inventory = async () => (await db.query('SELECT * FROM media_server_items WHERE library_id=$1 ORDER BY id', [libraryId])).rows;
function createService(database = db) {
  const instance = new EnrichmentRetryService({ db: database, logger, omdbService: provider });
  jest.spyOn(instance, 'scheduleProcessing').mockImplementation(() => {});
  instances.push(instance);
  return instance;
}
beforeEach(async () => {
  await seedOmdbQuotaFixture(db);
  await db.query('TRUNCATE enrichment_retry_cooldowns');
  serverId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('jellyfin',$1,'http://fixture.invalid','synthetic') RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = (await db.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ('Fixture','fixture','movie',$1,true) RETURNING id", [serverId])).rows[0].id;
  logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, jest.fn()]));
  http = jest.fn(async () => ({ Title: 'Synthetic evidence', Type: 'movie' }));
  const lookup = async (...args) => {
    if ((await reserveOmdbQuota(db)).status !== 'reserved') throw new OMDbLimitReachedError('synthetic quota unavailable');
    return http(...args);
  };
  provider = { getByIMDBId: jest.fn(lookup), getByTitle: jest.fn(lookup) };
  service = createService();
});
afterEach(async () => {
  instances.splice(0).forEach(instance => instance.cancelScheduledProcessing());
  await db.query('DELETE FROM media_server_items WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [serverId]);
});
async function items(count = 1) {
  await db.query(`WITH items AS (INSERT INTO media_server_items
    (media_server_id,external_id,library_id,media_type,title,imdb_id)
    SELECT $1,'item-'||n,$2,'movie','Fixture '||n,'tt'||lpad(n::text,7,'0') FROM generate_series(1,$3::integer) n RETURNING id)
    INSERT INTO enrichment_retry_queue(media_item_id,enrichment_type,next_attempt_at)
    SELECT id,'omdb',clock_timestamp() FROM items`, [serverId, libraryId, count]);
}

test.each([
  ['fresh', 'TRUNCATE omdb_config'],
  ['disabled', 'UPDATE omdb_config SET is_active=false'],
  ['missing key', "UPDATE omdb_config SET api_key=''"],
  ['invalid limit', 'UPDATE omdb_config SET daily_limit=0'],
  ['exhausted', 'UPDATE omdb_config SET requests_today=daily_limit'],
  ['undated exhausted', 'UPDATE omdb_config SET requests_today=daily_limit,last_reset_date=NULL'],
  ['future date', "UPDATE omdb_config SET last_reset_date=(clock_timestamp() AT TIME ZONE 'UTC')::date+1"],
  ['rejected credentials', 'UPDATE omdb_config SET credential_rejected_at=clock_timestamp()'],
])('%s setup leaves work and quota untouched across restart; settings repair resumes dispatch', async (_label, sql) => {
  await items(2); await db.query(sql);
  const before = await rows(), beforeConfig = await config(), beforeInventory = await inventory();
  expect(await service.processRetryQueue(50, 'omdb')).toMatchObject({ processed: 0, failed: 0 });
  service = createService(); await service.triggerProcessing();
  expect(await rows()).toEqual(before); expect(await config()).toEqual(beforeConfig);
  expect(await inventory()).toEqual(beforeInventory); expect(http).not.toHaveBeenCalled();
  expect(provider.getByIMDBId).not.toHaveBeenCalled(); expect(service.scheduleProcessing).not.toHaveBeenCalled();
  expect((await db.query('SELECT * FROM enrichment_retry_cooldowns')).rows).toEqual([]);
  await seedOmdbQuotaFixture(db);
  await service.triggerProcessing();
  expect((await rows()).every(row => row.status === 'completed' && row.attempts === 0)).toBe(true);
  expect(http).toHaveBeenCalledTimes(2); expect((await config())[0].requests_today).toBe(2);
});

test('previous-day quota resumes on the next normal dispatch, without a reset job', async () => {
  await items(); await db.query('UPDATE omdb_config SET requests_today=daily_limit');
  await service.triggerProcessing(); expect(http).not.toHaveBeenCalled();
  await db.query("UPDATE omdb_config SET last_reset_date=(clock_timestamp() AT TIME ZONE 'UTC')::date-1");
  await createService().triggerProcessing();
  expect((await rows())[0]).toMatchObject({ status: 'completed', attempts: 0 });
  expect((await config())[0].requests_today).toBe(1);
});

test('last credit completes one item and leaves the next row byte-for-byte unchanged', async () => {
  await items(2); await db.query('UPDATE omdb_config SET daily_limit=1');
  const before = await rows();
  expect(await service.processRetryQueue(50, 'omdb')).toMatchObject({ processed: 1, success: 1, skipped: true });
  const after = await rows();
  expect(after[0]).toMatchObject({ status: 'completed', attempts: 0 }); expect(after[1]).toEqual(before[1]);
  expect(http).toHaveBeenCalledTimes(1); expect((await config())[0].requests_today).toBe(1);
  expect(service.scheduleProcessing).not.toHaveBeenCalled();
});

test('two workers admitted before the last credit is spent still reserve only one HTTP request', async () => {
  await items(2); await db.query('UPDATE omdb_config SET daily_limit=1');
  let arrived = 0, release;
  const bothAdmitted = new Promise(resolve => { release = resolve; });
  const lookup = provider.getByIMDBId.getMockImplementation();
  provider.getByIMDBId.mockImplementation(async (...args) => {
    // Hold the first claimed worker before reservation until a second claim exists.
    if (++arrived === 2) release();
    await bothAdmitted;
    return lookup(...args);
  });
  const results = await Promise.all([
    createService().processRetryQueue(50, 'omdb'),
    createService().processRetryQueue(50, 'omdb'),
  ]);
  expect(results.reduce((sum, result) => sum + result.processed, 0)).toBe(2);
  expect(results.reduce((sum, result) => sum + result.success, 0)).toBe(1);
  expect(http).toHaveBeenCalledTimes(1); expect((await config())[0].requests_today).toBe(1);
  const pending = (await rows()).filter(row => row.status === 'pending');
  expect(pending).toHaveLength(1);
  expect(pending[0]).toMatchObject({ attempts: 0, error_message: 'daily_quota' });
});

test('an IMDb miss cannot spend a second unreserved request or trigger premature fallback', async () => {
  await items(); await db.query('UPDATE omdb_config SET daily_limit=1');
  http.mockResolvedValueOnce(null);
  expect(await service.processRetryQueue(50, 'omdb')).toMatchObject({ processed: 1, skipped: true, failed: 0 });
  expect(http).toHaveBeenCalledTimes(1); expect(provider.getByTitle).toHaveBeenCalledTimes(1);
  expect(await rows()).toEqual([expect.objectContaining({ enrichment_type: 'omdb', status: 'pending', attempts: 0, error_message: 'daily_quota' })]);
  expect((await config())[0].requests_today).toBe(1);
  // Advance durable waits as if the next UTC day has arrived; do not reset attempts.
  await db.query("UPDATE omdb_config SET last_reset_date=(clock_timestamp() AT TIME ZONE 'UTC')::date-1");
  await db.query("UPDATE enrichment_retry_queue SET next_attempt_at=clock_timestamp()-interval '1 second'");
  await db.query("UPDATE enrichment_retry_cooldowns SET next_attempt_at=clock_timestamp()-interval '1 second'");
  await createService().triggerProcessing();
  expect((await rows())[0]).toMatchObject({ status: 'completed', attempts: 0 });
});

test('claim rechecks library eligibility if it changes after the read-only plan', async () => {
  await items(); const before = await rows();
  const changedDb = { ...db, query: async (...args) => {
    const result = await db.query(...args);
    if (String(args[0]).includes('FROM omdb_config')) await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
    return result;
  } };
  expect(await createService(changedDb).processRetryQueue(50, 'omdb')).toMatchObject({ processed: 0 });
  expect(await rows()).toEqual(before); expect(http).not.toHaveBeenCalled();
});

test('quota read failure preserves work and the normal next dispatch recovers', async () => {
  await items(); const before = await rows();
  const failingDb = { ...db, query: async (...args) => {
    if (String(args[0]).includes('FROM omdb_config')) throw new Error('private diagnostic');
    return db.query(...args);
  } };
  expect(await createService(failingDb).processRetryQueue(50, 'omdb')).toMatchObject({ processed: 0, skipped: true });
  expect(await rows()).toEqual(before); expect(http).not.toHaveBeenCalled();
  expect(JSON.stringify(logger.debug.mock.calls)).not.toContain('private diagnostic');
  await service.triggerProcessing(); expect((await rows())[0].status).toBe('completed');
});

test('an OMDb wait does not pause independent web-search work in the same dispatch', async () => {
  await items(); await db.query('UPDATE omdb_config SET requests_today=daily_limit');
  const [before] = await rows();
  await db.query(`INSERT INTO enrichment_retry_queue(media_item_id,enrichment_type,next_attempt_at)
    VALUES ($1,'web_search',clock_timestamp())`, [before.media_item_id]);
  service._webSearchEnrichmentService = { hasAvailableProvider: async () => true };
  const search = jest.spyOn(service, 'enrichWithWebSearch').mockResolvedValue({ success: true, data: { imdb_rating: 7 } });
  await service.triggerProcessing();
  const after = await rows();
  expect(after[0]).toEqual(before);
  expect(after[1]).toMatchObject({ enrichment_type: 'web_search', status: 'completed' });
  expect(search).toHaveBeenCalledTimes(1); expect(http).not.toHaveBeenCalled();
});

test('unconfigured quota does not prevent completion/exhaustion maintenance', async () => {
  await items(3); await db.query('TRUNCATE omdb_config');
  const before = await rows();
  await db.query(`UPDATE media_server_items SET metadata='{"omdb":{"data":{"Title":"Existing evidence"}}}'::jsonb WHERE id=$1`, [before[0].media_item_id]);
  await db.query('UPDATE enrichment_retry_queue SET attempts=max_attempts WHERE id=$1', [before[1].id]);
  expect(await service.processRetryQueue(50, 'omdb')).toMatchObject({ processed: 0, autoFailed: 1, skipped: true });
  const after = await rows();
  expect(after[0].status).toBe('completed'); expect(after[1].status).toBe('failed'); expect(after[2]).toEqual(before[2]);
  expect(http).not.toHaveBeenCalled();
});

test('large batches stop at 50 and continue without a persisted cursor', async () => {
  await items(51);
  expect(await service.processRetryQueue(100, 'omdb')).toMatchObject({ processed: 50, success: 50 });
  expect((await rows()).filter(row => row.status === 'pending')).toHaveLength(1);
  expect(service.scheduleProcessing).toHaveBeenCalledTimes(1); expect(service.scheduleProcessing).toHaveBeenCalledWith(1000);
  expect(await createService().processRetryQueue(100, 'omdb')).toMatchObject({ processed: 1, success: 1 });
  expect((await config())[0].requests_today).toBe(51);
});
