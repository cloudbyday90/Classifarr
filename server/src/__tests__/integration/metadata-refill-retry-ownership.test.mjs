/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { seedOmdbQuotaFixture } from '../helpers/omdbQuotaFixture.mjs';

const db = createIntegrationDatabaseModuleMock(), http = jest.fn();
jest.unstable_mockModule('../../utils/httpClient.mjs', () => ({ httpGet: http, httpPost: jest.fn(), httpPut: jest.fn(),
  httpDelete: jest.fn(), httpGetBinary: jest.fn(), httpStream: jest.fn(), defaultHttpClient: { get: http, post: jest.fn() } }));
const { createHandoffFixture } = await import('../helpers/sourceRecoveryHandoffFixture.mjs');
const { readRefillCandidatePage } = await import('../../services/queueRefillCandidates.mjs');
const { QueueRefillService } = await import('../../services/queueRefillService.mjs');
const { EnrichmentRetryService } = await import('../../services/enrichmentRetryService.mjs');
const { omdbService } = await import('../../services/omdb.mjs');
const { readEnrichmentRetryPage } = await import('../../services/enrichmentRetryCandidatePage.mjs');
const { readInventoryBackgroundReadiness } = await import('../../services/inventoryBackgroundReadiness.mjs');
let fixture, queue, item, retries;
const savedRetry = async () => (await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1', [item.id])).rows[0];

beforeEach(async () => {
  http.mockReset();
  await seedOmdbQuotaFixture(db);
  fixture = await createHandoffFixture(db, 'movie');
  await fixture.scan([{ external_id: 'retry-owned', title: 'Synthetic', imdb_id: 'tt0000001', tmdb_id: 22, media_type: 'movie' }]);
  queue = fixture.queue();
  await queue.refillQueue();
  await queue.queueTaskProcessorService.processMetadataEnrichmentTask(await fixture.claim(queue));
  item = (await fixture.inventory())[0];
  retries = new EnrichmentRetryService({ db, omdbService, logger: fixture.log });
  jest.spyOn(retries, 'scheduleProcessing').mockImplementation(() => {});
});
afterEach(async () => { retries?.cancelScheduledProcessing(); await fixture?.cleanup(); });

async function providerWait() {
  await retries.queueForRetry(item.id, 'omdb');
  http.mockRejectedValueOnce({ response: { status: 503, headers: { 'Retry-After': '3600' } } });
  expect(await retries.processRetryQueue(1, 'omdb')).toMatchObject({ processed: 1, failed: 1 });
  const wait = await savedRetry();
  expect(wait.retry_wait_context).toHaveLength(1);
  expect(wait.retry_wait_until).toEqual(wait.next_attempt_at);
  expect(wait.next_attempt_at.getTime()).toBeGreaterThan(Date.now());
  return wait;
}

test('real provider Retry-After survives repeated refill sweeps without redundant metadata tasks', async () => {
  const before = await providerWait();
  for (let n = 0; n < 5; n++) expect((await readRefillCandidatePage(db, null)).rows).toEqual([]);
  for (let n = 0; n < 5; n++) expect((await queue.refillQueue()).queued).toBe(0);
  expect(await fixture.tasks()).toHaveLength(1);
  expect(await readInventoryBackgroundReadiness(db, { requireRag: false })).toBe('ready');
  expect(await savedRetry()).toEqual(before);
  expect(http).toHaveBeenCalledTimes(1);
});

test('a task queued before the wait rechecks retry ownership before calling optional providers', async () => {
  const payload = new QueueRefillService().buildMetadataEnrichmentPayload(item);
  await queue.enqueue('metadata_enrichment', payload);
  const before = await providerWait();
  const processor = queue.queueTaskProcessorService;
  processor.queueOmdbEnrichmentService.enrich = jest.fn();
  processor.queueWebSearchEnrichmentService.enrich = jest.fn();
  await processor.processMetadataEnrichmentTask(await fixture.claim(queue));
  expect(processor.queueOmdbEnrichmentService.enrich).not.toHaveBeenCalled();
  expect(processor.queueWebSearchEnrichmentService.enrich).not.toHaveBeenCalled();
  expect(await savedRetry()).toEqual(before);
  expect((await fixture.tasks()).every(task => task.status === 'completed')).toBe(true);
});

test.each(['omdb', 'web_search', 'tavily'].flatMap(type =>
  ['pending', 'processing', 'completed', 'failed', 'skipped'].map(status => [type, status])))
('%s / %s stays managed by the retry controller, including due and terminal records', async (type, status) => {
  await retries.queueForRetry(item.id, type);
  await db.query(`UPDATE enrichment_retry_queue SET status=$2::text,
    next_attempt_at=statement_timestamp()-interval '1 second',
    attempts=CASE WHEN $2::text='failed' THEN max_attempts ELSE attempts END WHERE media_item_id=$1`, [item.id, status]);
  const before = await savedRetry();
  expect((await readRefillCandidatePage(db, null)).rows).toEqual([]);
  expect((await readRefillCandidatePage(db, null, null, { libraryId: fixture.libraryId })).rows).toEqual([]);
  expect(await savedRetry()).toEqual(before);
  expect(http).not.toHaveBeenCalled();
});

test.each(['movie', 'tv'])('waiting optional metadata does not block independent %s TMDb work', async type => {
  const before = await providerWait();
  await db.query('UPDATE libraries SET media_type=$2 WHERE id=$1', [fixture.libraryId, type]);
  await db.query(`UPDATE media_server_items SET media_type=$2, metadata=metadata-'inventory_tmdb',
    inventory_tmdb_attempted_at=statement_timestamp()-interval '7 hours',inventory_tmdb_fetched_at=NULL
    WHERE id=$1`, [item.id, type]);
  const candidate = (await readRefillCandidatePage(db, null)).rows[0];
  expect(candidate).toMatchObject({ id: item.id, needs_standard_enrichment: false });
  const payload = new QueueRefillService().buildMetadataEnrichmentPayload(candidate);
  expect(payload.inventory_tmdb_only).toBe(true);
  await queue.enqueue('metadata_enrichment', payload);
  const processor = queue.queueTaskProcessorService;
  processor.queueOmdbEnrichmentService.enrich = jest.fn();
  processor.queueWebSearchEnrichmentService.enrich = jest.fn();
  await processor.processMetadataEnrichmentTask(await fixture.claim(queue));
  expect((await fixture.inventory())[0].metadata.inventory_tmdb.media_type).toBe(type);
  expect(await fixture.history()).toHaveLength(1);
  expect(processor.queueOmdbEnrichmentService.enrich).not.toHaveBeenCalled();
  expect(processor.queueWebSearchEnrichmentService.enrich).not.toHaveBeenCalled();
  expect(await savedRetry()).toEqual(before);
  expect((await readRefillCandidatePage(db, null)).rows).toEqual([]);
});

test('missing local analysis can finish while optional providers remain waiting', async () => {
  const before = await providerWait();
  await db.query("UPDATE media_server_items SET metadata=metadata-'content_analysis' WHERE id=$1", [item.id]);
  const candidate = (await readRefillCandidatePage(db, null)).rows[0];
  expect(candidate.needs_standard_enrichment).toBe(true);
  await queue.enqueue('metadata_enrichment', new QueueRefillService().buildMetadataEnrichmentPayload(candidate));
  const processor = queue.queueTaskProcessorService;
  processor.queueOmdbEnrichmentService.enrich = jest.fn();
  processor.queueWebSearchEnrichmentService.enrich = jest.fn();
  await processor.processMetadataEnrichmentTask(await fixture.claim(queue));
  expect((await fixture.inventory())[0].metadata.content_analysis.source).toBe('metadata_enrichment');
  expect(processor.queueOmdbEnrichmentService.enrich).not.toHaveBeenCalled();
  expect(processor.queueWebSearchEnrichmentService.enrich).not.toHaveBeenCalled();
  expect(await savedRetry()).toEqual(before);
  expect((await readRefillCandidatePage(db, null)).rows).toEqual([]);
});

test.each(['due time', 'credential replacement'])('existing retry processor recovers on %s without a new metadata task', async scenario => {
  const before = await providerWait();
  expect(await readEnrichmentRetryPage(db, 'omdb', null, 50)).toEqual([]);
  if (scenario === 'credential replacement') {
    await db.query("UPDATE omdb_config SET api_key='replacement-synthetic'");
  } else {
    await db.query("UPDATE enrichment_retry_queue SET next_attempt_at=statement_timestamp()-interval '1 second' WHERE media_item_id=$1", [item.id]);
    await db.query("UPDATE omdb_request_pacing SET blocked_until=statement_timestamp()-interval '1 second'");
  }
  await db.query("UPDATE omdb_request_pacing SET next_admission_at=statement_timestamp()-interval '1 second'");
  expect((await readRefillCandidatePage(db, null)).rows).toEqual([]);
  expect(await readEnrichmentRetryPage(db, 'omdb', null, 50)).toHaveLength(1);
  http.mockResolvedValue({ status: 200, data: { Response: 'True', Title: 'Synthetic', imdbID: 'tt0000001', Type: 'movie', Ratings: [] } });
  expect(await retries.processRetryQueue(1, 'omdb')).toMatchObject({ processed: 1, success: 1 });
  expect(await savedRetry()).toMatchObject({ status: 'completed', attempts: before.attempts });
  expect((await fixture.inventory())[0].metadata.omdb).toBeDefined();
  expect(http).toHaveBeenCalledTimes(2);
  expect(await fixture.tasks()).toHaveLength(1);
});

test('retry ownership is item-scoped and an empty filtered page still advances the cursor', async () => {
  await providerWait();
  const other = (await db.query(`INSERT INTO media_server_items(library_id,external_id,title,media_type,metadata)
    VALUES ($1,'unattempted','Synthetic other','tv','{}') RETURNING id`, [fixture.libraryId])).rows[0];
  const first = await readRefillCandidatePage(db, null, null, { batchLimit: 1 });
  expect(first.rows).toEqual([]); expect(first.cursor).toEqual({ afterId: item.id, throughId: other.id });
  const second = await readRefillCandidatePage(db, first.cursor, null, { batchLimit: 1 });
  expect(second.rows.map(row => row.id)).toEqual([other.id]); expect(second.cursor).toBeNull();
});

test('an unrelated legacy TMDb retry does not claim optional-provider enrichment', async () => {
  await retries.queueForRetry(item.id, 'tmdb');
  expect((await readRefillCandidatePage(db, null)).rows.map(row => row.id)).toEqual([item.id]);
});

test('a one-item refill page does not scan an unrelated 10000-row retry backlog', async () => {
  await retries.queueForRetry(item.id, 'omdb');
  await db.query(`INSERT INTO media_server_items(library_id,external_id,title,media_type)
    SELECT $1,'backlog-'||n,'Synthetic backlog','movie' FROM generate_series(1,10000) n`, [fixture.libraryId]);
  await db.query(`INSERT INTO enrichment_retry_queue(media_item_id,enrichment_type,next_attempt_at)
    SELECT id,'omdb',statement_timestamp()+interval '1 day' FROM media_server_items
    WHERE library_id=$1 AND id<>$2`, [fixture.libraryId, item.id]);
  await db.query('ANALYZE media_server_items; ANALYZE enrichment_retry_queue');
  let statement;
  await readRefillCandidatePage({ query: async (...args) => { statement = args; return { rows: [] }; } }, null, null, { batchLimit: 1 });
  const result = await db.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement[0]}`, statement[1]);
  const nodes = [];
  const visit = node => { nodes.push(node); for (const child of node.Plans || []) visit(child); };
  visit(result.rows[0]['QUERY PLAN'][0].Plan);
  const retryNodes = nodes.filter(node => node['Relation Name'] === 'enrichment_retry_queue');
  expect(retryNodes.length).toBeGreaterThan(0);
  expect(retryNodes.every(node => node['Actual Loops'] === 0 || (
    ['Index Scan', 'Index Only Scan', 'Bitmap Heap Scan'].includes(node['Node Type']) &&
    (node['Actual Rows'] + (node['Rows Removed by Filter'] || 0)) * node['Actual Loops'] <= 3
  ))).toBe(true);
});
