/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { seedOmdbQuotaFixture } from '../helpers/omdbQuotaFixture.mjs';

const db = createIntegrationDatabaseModuleMock(), http = jest.fn();
jest.unstable_mockModule('../../utils/httpClient.mjs', () => ({ httpGet: http, httpPost: jest.fn(), httpPut: jest.fn(),
  httpDelete: jest.fn(), httpGetBinary: jest.fn(), httpStream: jest.fn(), defaultHttpClient: { get: http, post: jest.fn() } }));
const { createHandoffFixture } = await import('../helpers/sourceRecoveryHandoffFixture.mjs');
const { readRefillCandidatePage } = await import('../../services/queueRefillCandidates.mjs');
const { QueueOmdbEnrichmentService } = await import('../../services/queueOmdbEnrichmentService.mjs');
const { EnrichmentRetryService, enrichmentRetryService } = await import('../../services/enrichmentRetryService.mjs');
const { omdbService } = await import('../../services/omdb.mjs');
const { readInventoryBackgroundReadiness } = await import('../../services/inventoryBackgroundReadiness.mjs');
let fixture, queue, item, retries, runtime;
const savedRetries = async () => (await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1 ORDER BY id', [item.id])).rows;
const response = (type = 'movie') => ({ status: 200, data: {
  Response: 'True', Title: 'Synthetic', imdbID: 'tt0000001', Type: type, Rated: 'PG', Ratings: [],
} });

beforeEach(async () => {
  http.mockReset();
  await seedOmdbQuotaFixture(db);
  fixture = await createHandoffFixture(db, 'movie');
  await fixture.scan([{ external_id: 'outcome', title: 'Synthetic', imdb_id: 'tt0000001', tmdb_id: 22, media_type: 'movie' }]);
  item = (await fixture.inventory())[0];
  queue = fixture.queue();
  runtime = { omdbLimitHit: false };
  queue.queueTaskProcessorService.queueOmdbEnrichmentService = new QueueOmdbEnrichmentService({
    db, logger: fixture.log, omdbService, getRuntimeState: () => runtime,
    setRuntimeState: patch => Object.assign(runtime, patch),
  });
  retries = new EnrichmentRetryService({ db, omdbService, logger: fixture.log });
  jest.spyOn(retries, 'scheduleProcessing').mockImplementation(() => {});
  jest.spyOn(enrichmentRetryService, 'scheduleProcessing').mockImplementation(() => {});
});
afterEach(async () => {
  retries?.cancelScheduledProcessing(); enrichmentRetryService.cancelScheduledProcessing();
  await fixture?.cleanup(); jest.restoreAllMocks();
});

async function runInitial() {
  expect((await queue.refillQueue()).queued).toBe(1);
  await queue.queueTaskProcessorService.processMetadataEnrichmentTask(await fixture.claim(queue));
}
async function expectSettled() {
  const before = await savedRetries();
  for (let n = 0; n < 3; n++) expect((await queue.refillQueue()).queued).toBe(0);
  expect(await savedRetries()).toEqual(before);
  expect(await fixture.tasks()).toHaveLength(1);
  expect((await fixture.tasks())[0].status).toBe('completed');
  expect((await fixture.inventory())[0].metadata.content_analysis.source).toBe('metadata_enrichment');
  expect(await readInventoryBackgroundReadiness(db, { requireRag: false })).toBe('ready');
}

test('a cached daily limit still hands each item to durable OMDb recovery without HTTP', async () => {
  runtime.omdbLimitHit = true;
  await db.query('UPDATE omdb_config SET requests_today=daily_limit');
  await runInitial();
  expect(await savedRetries()).toMatchObject([{ enrichment_type: 'omdb', status: 'pending', attempts: 0 }]);
  expect(http).not.toHaveBeenCalled();
  await expectSettled();
});

test('an active missing credential is durably waiting and does not burn attempts', async () => {
  await db.query("UPDATE omdb_config SET api_key=''");
  await runInitial();
  expect(await savedRetries()).toMatchObject([{ enrichment_type: 'omdb', status: 'pending', attempts: 0,
    reason: 'OMDb credentials not configured' }]);
  for (let n = 0; n < 3; n++) expect(await retries.processRetryQueue(1, 'omdb')).toMatchObject({ processed: 0 });
  expect(http).not.toHaveBeenCalled();
  await expectSettled();
});

test('a provider type mismatch records fallback without accepting cross-media evidence', async () => {
  http.mockResolvedValue(response('series'));
  await runInitial();
  expect(await savedRetries()).toMatchObject([{ enrichment_type: 'web_search', status: 'pending',
    reason: 'OMDb provider type mismatch' }]);
  expect((await fixture.inventory())[0].metadata.omdb).toBeUndefined();
  expect((await fixture.inventory())[0].content_rating).toBeNull();
  const before = await savedRetries();
  for (let n = 0; n < 3; n++) expect(await retries.processRetryQueue(1, 'web_search')).toMatchObject({ processed: 0 });
  expect(await savedRetries()).toEqual(before);
  await expectSettled();
  expect(http).toHaveBeenCalledTimes(1);
});

test('an analyzed legacy item without credentials does not generate refill demand', async () => {
  await db.query("UPDATE omdb_config SET api_key='   '");
  await db.query(`UPDATE media_server_items SET metadata=jsonb_build_object('content_analysis',
    jsonb_build_object('source','metadata_enrichment')),inventory_tmdb_attempted_at=statement_timestamp()
    WHERE id=$1`, [item.id]);
  expect((await readRefillCandidatePage(db, null, null, { libraryId: fixture.libraryId })).rows).toEqual([]);
  expect(await savedRetries()).toEqual([]);
  expect(http).not.toHaveBeenCalled();
});

test('recovery cannot accept a mismatched provider result through the retry path', async () => {
  await retries.queueForRetry(item.id, 'omdb', 'OMDb credentials not configured', 6);
  http.mockResolvedValue(response('series'));
  expect(await retries.processRetryQueue(1, 'omdb')).toMatchObject({ processed: 1, success: 0 });
  expect(await savedRetries()).toMatchObject([
    { enrichment_type: 'omdb', status: 'skipped', error_message: 'OMDb provider type mismatch' },
    { enrichment_type: 'web_search', status: 'pending', reason: 'OMDb provider type mismatch' },
  ]);
  expect((await fixture.inventory())[0].metadata.omdb).toBeUndefined();
  expect(http).toHaveBeenCalledTimes(1);
});

test.each(['movie', 'tv'])('a quota wait survives restart and recovers %s after the local day reset', async type => {
  await db.query('UPDATE media_server_items SET media_type=$2 WHERE id=$1', [item.id, type]);
  await db.query('UPDATE libraries SET media_type=$2 WHERE id=$1', [fixture.libraryId, type]);
  await db.query('UPDATE omdb_config SET requests_today=daily_limit');
  await runInitial();
  const before = await savedRetries();
  expect(before).toMatchObject([{ enrichment_type: 'omdb', status: 'pending', attempts: 0 }]);
  expect(runtime.omdbLimitHit).toBe(true);
  // New service instance, same durable database; no process-local state is recovered.
  retries = new EnrichmentRetryService({ db, omdbService, logger: fixture.log });
  jest.spyOn(retries, 'scheduleProcessing').mockImplementation(() => {});
  for (let n = 0; n < 3; n++) expect(await retries.processRetryQueue(1, 'omdb')).toMatchObject({ processed: 0 });
  expect(await savedRetries()).toEqual(before);
  expect(http).not.toHaveBeenCalled();
  await db.query("UPDATE omdb_config SET last_reset_date=(statement_timestamp() AT TIME ZONE 'UTC')::date-1");
  http.mockResolvedValue(response(type === 'tv' ? 'series' : 'movie'));
  expect(await retries.processRetryQueue(1, 'omdb')).toMatchObject({ processed: 1, success: 1 });
  expect(await savedRetries()).toMatchObject([{ id: before[0].id, status: 'completed', attempts: 0 }]);
  expect(http).toHaveBeenCalledTimes(1);
  expect((await db.query('SELECT requests_today FROM omdb_config')).rows[0].requests_today).toBe(1);
  await expectSettled();
});

test('repairing an active empty credential resumes the same pending item without refill', async () => {
  await db.query("UPDATE omdb_config SET api_key='   '");
  await runInitial();
  const before = await savedRetries();
  expect(before).toHaveLength(1);
  await db.query("UPDATE omdb_config SET api_key='synthetic-repaired'");
  http.mockResolvedValue(response());
  expect(await retries.processRetryQueue(1, 'omdb')).toMatchObject({ processed: 1, success: 1 });
  expect(await savedRetries()).toMatchObject([{ id: before[0].id, status: 'completed', attempts: 0 }]);
  await expectSettled();
  expect(http).toHaveBeenCalledTimes(1);
});

test.each(['disabled', 'absent'])('%s provider stays idle and later configuration enables legacy refill', async state => {
  if (state === 'disabled') await db.query('UPDATE omdb_config SET is_active=false');
  else await db.query('TRUNCATE omdb_config');
  runtime.omdbLimitHit = true;
  await runInitial();
  expect(await savedRetries()).toEqual([]);
  expect(http).not.toHaveBeenCalled();
  await expectSettled();
  await seedOmdbQuotaFixture(db);
  http.mockResolvedValue(response());
  await runInitial();
  expect(http).toHaveBeenCalledTimes(1);
  expect((await fixture.inventory())[0].metadata.omdb.data.type).toBe('movie');
  expect((await queue.refillQueue()).queued).toBe(0);
  expect(await savedRetries()).toEqual([]);
});

test('multiple items retain individual quota waits after the first sets the warning latch', async () => {
  await db.query(`INSERT INTO media_server_items(library_id,external_id,title,media_type)
    VALUES ($1,'second','Synthetic second','movie')`, [fixture.libraryId]);
  await db.query('UPDATE omdb_config SET requests_today=daily_limit');
  expect((await queue.refillQueue()).queued).toBe(2);
  for (let n = 0; n < 2; n++) await queue.queueTaskProcessorService.processMetadataEnrichmentTask(await fixture.claim(queue));
  const rows = (await db.query(`SELECT erq.* FROM enrichment_retry_queue erq JOIN media_server_items msi
    ON msi.id=erq.media_item_id WHERE msi.library_id=$1`, [fixture.libraryId])).rows;
  expect(rows).toHaveLength(2);
  expect(new Set(rows.map(row => row.media_item_id)).size).toBe(2);
  expect(rows.every(row => row.enrichment_type === 'omdb' && row.status === 'pending' && row.attempts === 0)).toBe(true);
  for (let n = 0; n < 3; n++) expect((await queue.refillQueue()).queued).toBe(0);
  expect(http).not.toHaveBeenCalled();
});

test('failed durable handoff cannot acknowledge the metadata task as completed', async () => {
  await db.query("UPDATE omdb_config SET api_key=''");
  expect((await queue.refillQueue()).queued).toBe(1);
  const task = await fixture.claim(queue);
  jest.spyOn(enrichmentRetryService, 'queueForRetry').mockRejectedValue(new Error('synthetic database failure'));
  await expect(queue.queueTaskProcessorService.processMetadataEnrichmentTask(task))
    .rejects.toMatchObject({ reason: 'queue_claim_write_failed' });
  expect((await fixture.tasks())[0]).toMatchObject({ status: 'processing', claim_token: task.claim_token });
  expect(await savedRetries()).toEqual([]);
  expect((await fixture.inventory())[0].metadata.content_analysis).toBeUndefined();
  expect(http).not.toHaveBeenCalled();
});

test('type-mismatch fallback and terminal outcome roll back together on state persistence failure', async () => {
  await retries.queueForRetry(item.id, 'omdb');
  http.mockResolvedValue(response('series'));
  jest.spyOn(retries.enrichmentItemStateService, 'syncItemState').mockRejectedValue(new Error('synthetic failure'));
  await expect(retries.processRetryQueue(1, 'omdb', { maintenance: false }))
    .rejects.toMatchObject({ reason: 'queue_claim_write_failed' });
  expect(await savedRetries()).toMatchObject([{ enrichment_type: 'omdb', status: 'processing', attempts: 0 }]);
  expect(await savedRetries()).toHaveLength(1);
  expect((await fixture.inventory())[0].metadata.omdb).toBeUndefined();
});
