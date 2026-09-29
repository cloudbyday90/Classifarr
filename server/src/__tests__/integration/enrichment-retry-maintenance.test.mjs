/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { EnrichmentRetryService } from '../../services/enrichmentRetryService.mjs';
import { claimEnrichmentRetry } from '../../services/enrichmentRetryClaimService.mjs';
import { TAVILY_MONTHLY_DEFERRED_REASON } from '../../utils/enrichmentState.mjs';

const db = createIntegrationDatabaseModuleMock();
let serverId, libraryId, service, logger, http;
const instances = [];
const rows = async () => (await db.query('SELECT * FROM enrichment_retry_queue ORDER BY id')).rows;
const media = async () => (await db.query('SELECT * FROM media_server_items WHERE library_id=$1 ORDER BY id', [libraryId])).rows;
function createService(database = db) {
  const instance = new EnrichmentRetryService({ db: database, logger,
    omdbService: { getByIMDBId: http, getByTitle: http },
    webSearchEnrichmentService: { hasAvailableProvider: async () => false, search: http } });
  jest.spyOn(instance, 'scheduleProcessing').mockImplementation(() => {});
  instances.push(instance); return instance;
}
beforeEach(async () => {
  await db.query('TRUNCATE omdb_config, enrichment_retry_cooldowns');
  serverId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('jellyfin',$1,'http://fixture.invalid','synthetic') RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = (await db.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ('Fixture','fixture','movie',$1,true) RETURNING id", [serverId])).rows[0].id;
  logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, jest.fn()]));
  http = jest.fn(() => { throw new Error('maintenance must not call HTTP'); });
  service = createService();
});
afterEach(async () => {
  instances.splice(0).forEach(instance => instance.cancelScheduledProcessing());
  await db.query('DELETE FROM media_server_items WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [serverId]);
});
async function seed({ count = 1, type = 'omdb', status = 'pending', attempts = 0, metadata = {}, reason = null, error = null } = {}) {
  await db.query(`WITH items AS (INSERT INTO media_server_items
    (media_server_id,external_id,library_id,media_type,title,imdb_id,metadata)
    SELECT $1,$10||n,$2,'movie','Fixture '||n,'tt'||lpad(n::text,7,'0'),$4::jsonb
      FROM generate_series(1,$3::integer) n RETURNING id)
    INSERT INTO enrichment_retry_queue(media_item_id,enrichment_type,status,attempts,reason,error_message,next_attempt_at)
    SELECT id,$5,$6,$7,$8,$9,clock_timestamp() FROM items`,
  [serverId, libraryId, count, JSON.stringify(metadata), type, status, attempts, reason, error, randomUUID()]);
  return (await rows()).slice(-count);
}
const cases = [
  ['completed', 'resolveRetriesWithExistingMetadata', { metadata: { omdb: { data: { Title: 'Existing' } } }, attempts: 2 }, 'completed'],
  ['exhausted', 'failExhaustedPendingRetries', { attempts: 3 }, 'failed'],
  ['monthly', 'normalizeTavilyMonthlyDeferredRows', { type: 'tavily', status: 'failed', attempts: 3, error: 'monthly quota' }, 'deferred'],
];

test.each(cases)('%s processes 121 rows in bounded idempotent batches with matching item state', async (operation, method, setup, expectedState) => {
  await seed({ ...setup, count: 121 });
  const started = performance.now(), heapBefore = process.memoryUsage().heapUsed;
  const counts = [];
  for (let n = 0; n < 4; n++) counts.push(await service[method]());
  expect(counts).toEqual([50, 50, 21, 0]);
  expect((await media()).every(item => item.enrichment_status === expectedState)).toBe(true);
  expect((await rows()).every(row => row.attempts === (operation === 'monthly' ? 0 : setup.attempts))).toBe(true);
  expect(http).not.toHaveBeenCalled();
  if (process.env.INTEGRATION_TEST_VERBOSE === 'true') process.stdout.write(`${JSON.stringify({
    operation, rows: 121, batches: counts, durationMs: Math.round(performance.now() - started),
    heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
  })}\n`);
});

test.each(cases)('%s rolls back retry and partial item writes when state sync fails, then recovers', async (_operation, method, setup) => {
  await seed({ ...setup, count: 3 }); const before = await rows(), beforeMedia = await media();
  const state = service.enrichmentItemStateService, sync = state.syncItemState.bind(state);
  let calls = 0;
  jest.spyOn(state, 'syncItemState').mockImplementation(async (...args) => {
    const value = await sync(...args);
    if (++calls === 2) throw new Error('synthetic state failure');
    return value;
  });
  await expect(service[method]()).rejects.toThrow('synthetic state failure');
  expect(await rows()).toEqual(before); expect(await media()).toEqual(beforeMedia);
  expect(logger.info).not.toHaveBeenCalled();
  expect(await createService()[method]()).toBe(3);
});

test.each(['retry', 'media'])('a locked %s row is untouched and revisited after other work progresses', async target => {
  const seeded = await seed({ ...cases[0][2], count: 3 }), first = seeded[0];
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(target === 'retry' ? 'SELECT id FROM enrichment_retry_queue WHERE id=$1 FOR UPDATE'
      : 'SELECT id FROM media_server_items WHERE id=$1 FOR UPDATE', [target === 'retry' ? first.id : first.media_item_id]);
    expect(await service.resolveRetriesWithExistingMetadata()).toBe(2);
    expect((await rows())[0]).toEqual(first);
  } finally { await client.query('ROLLBACK'); client.release(); }
  expect(await createService().resolveRetriesWithExistingMetadata()).toBe(1);
});

test('concurrent maintenance consumes disjoint batches without resetting budgets', async () => {
  await seed({ count: 121, attempts: 3 });
  const counts = await Promise.all(Array.from({ length: 3 }, () => createService().failExhaustedPendingRetries()));
  expect(counts.reduce((sum, n) => sum + n, 0)).toBe(121);
  expect(counts.every(n => n <= 50)).toBe(true);
  expect((await rows()).every(row => row.status === 'failed' && row.attempts === 3)).toBe(true);
  expect((await media()).every(item => item.enrichment_status === 'failed')).toBe(true);
});

test('existing evidence on later pages is never failed ahead of completion', async () => {
  await seed({ ...cases[0][2], attempts: 3, count: 121 });
  for (let n = 0; n < 3; n++) {
    service = createService(); await service.triggerProcessing();
    expect((await rows()).some(row => row.status === 'failed')).toBe(false);
  }
  expect((await rows()).every(row => row.status === 'completed' && row.attempts === 3)).toBe(true);
  expect(http).not.toHaveBeenCalled();
});

test('legacy monthly recovery on later pages is not failed or dependent on a stats read', async () => {
  await seed({ ...cases[2][2], status: 'pending', count: 121 });
  for (let n = 0; n < 3; n++) { service = createService(); await service.triggerProcessing(); }
  expect((await rows()).every(row => row.status === 'pending' && row.attempts === 0 && row.reason === TAVILY_MONTHLY_DEFERRED_REASON)).toBe(true);
  expect((await media()).every(item => item.enrichment_status === 'deferred')).toBe(true);
  expect(http).not.toHaveBeenCalled();
  expect(service.scheduleProcessing).not.toHaveBeenCalled(); // final partial batch
});

test('fresh setup and read-only statistics neither mutate work nor invoke providers', async () => {
  await service.triggerProcessing(); expect(service.scheduleProcessing).not.toHaveBeenCalled();
  await seed({ attempts: 3 }); const before = await rows(), beforeMedia = await media();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN READ ONLY');
    const observer = createService({ query: (...args) => client.query(...args) });
    expect((await observer.getStats()).omdb.pending).toBe(1);
  } finally { await client.query('ROLLBACK'); client.release(); }
  expect(await rows()).toEqual(before); expect(await media()).toEqual(beforeMedia);
  expect(http).not.toHaveBeenCalled();
  await createService().triggerProcessing(); expect((await rows())[0].status).toBe('failed');
});

test('metadata removed between queue selection and media locking cannot complete a retry', async () => {
  await seed(cases[0][2]); const before = await rows();
  const changingDb = { ...db, withTransaction: work => db.withTransaction(client => work({ query: async (...args) => {
    const result = await client.query(...args);
    if (String(args[0]).includes('SELECT erq.id, erq.media_item_id')) {
      await db.query("UPDATE media_server_items SET metadata='{}' WHERE library_id=$1", [libraryId]);
    }
    return result;
  } })) };
  expect(await createService(changingDb).resolveRetriesWithExistingMetadata()).toBe(0);
  expect(await rows()).toEqual(before);
});

test('active, unknown legacy and partial claims are never adopted by maintenance', async () => {
  const seeded = await seed({ ...cases[0][2], attempts: 3, count: 4 });
  await db.query("UPDATE enrichment_retry_queue SET status='processing' WHERE id=$1", [seeded[0].id]);
  await db.query("UPDATE enrichment_retry_queue SET status='processing',claim_token=$2,claim_until=clock_timestamp()+interval '1 hour' WHERE id=$1", [seeded[1].id, randomUUID()]);
  await db.query('UPDATE enrichment_retry_queue SET claim_token=$2 WHERE id=$1', [seeded[2].id, randomUUID()]);
  await db.query('UPDATE enrichment_retry_queue SET claim_until=clock_timestamp() WHERE id=$1', [seeded[3].id]);
  const before = await rows(), beforeMedia = await media();
  await service.triggerProcessing();
  expect(await rows()).toEqual(before); expect(await media()).toEqual(beforeMedia);
});

test('an ordinary exhausted Tavily row with null reason is failed, not stranded by SQL null logic', async () => {
  await seed({ type: 'tavily', attempts: 3 });
  expect(await service.failExhaustedPendingRetries()).toBe(1);
  expect((await rows())[0]).toMatchObject({ status: 'failed', attempts: 3, reason: null });
});

test('undated monthly rows do not poison healthy work; canonical zero-limit rows are a fixed point', async () => {
  const seeded = await seed({ ...cases[2][2], count: 2 });
  await db.query('UPDATE enrichment_retry_queue SET created_at=NULL,last_attempt_at=NULL WHERE id=$1', [seeded[0].id]);
  await db.query('UPDATE enrichment_retry_queue SET max_attempts=0 WHERE id=$1', [seeded[1].id]);
  const before = await rows();
  expect(await service.normalizeTavilyMonthlyDeferredRows()).toBe(1);
  const after = await rows(); expect(after[0]).toEqual(before[0]);
  expect(await service.normalizeTavilyMonthlyDeferredRows()).toBe(0);
  expect(await service.failExhaustedPendingRetries()).toBe(0); expect(await rows()).toEqual(after);
});

test('a currently claimed row is not completed by maintenance even when evidence appears', async () => {
  await seed(); const claim = await claimEnrichmentRetry(db, 'omdb'); expect(claim).not.toBeNull();
  await db.query(`UPDATE media_server_items SET metadata='{"omdb":{}}' WHERE library_id=$1`, [libraryId]);
  const before = await rows(); expect(await service.resolveRetriesWithExistingMetadata()).toBe(0);
  expect(await rows()).toEqual(before);
});

test.each(['omdb', 'web_search', 'tavily', 'tmdb'])('future-due %s bookkeeping progresses without a configured provider or stats observer', async type => {
  await seed({ type, attempts: 2, metadata: { omdb: {}, tmdb: {} } });
  await db.query("UPDATE enrichment_retry_queue SET next_attempt_at=clock_timestamp()+interval '1 year'");
  await service.triggerProcessing();
  expect((await rows())[0]).toMatchObject({ status: 'completed', attempts: 2 });
  expect((await media())[0].enrichment_status).toBe('completed');
  expect(http).not.toHaveBeenCalled();
});

test('a missing state receipt rolls back retry changes', async () => {
  await seed(cases[0][2]); const before = await rows(), beforeMedia = await media();
  jest.spyOn(service.enrichmentItemStateService, 'syncItemState').mockResolvedValue(null);
  await expect(service.resolveRetriesWithExistingMetadata()).rejects.toThrow('retry_maintenance_state_missing');
  expect(await rows()).toEqual(before); expect(await media()).toEqual(beforeMedia);
});

test('legacy monthly due dates use UTC boundaries even in a different session time zone', async () => {
  await seed(cases[2][2]);
  await db.query("UPDATE enrichment_retry_queue SET last_attempt_at='2026-08-31T23:59:59Z'");
  const zonedDb = { ...db, withTransaction: work => db.withTransaction(async client => {
    await client.query("SET LOCAL TIME ZONE 'Pacific/Auckland'"); return work(client);
  }) };
  expect(await createService(zonedDb).normalizeTavilyMonthlyDeferredRows()).toBe(1);
  expect((await rows())[0].next_attempt_at.toISOString()).toBe('2026-09-01T00:00:00.000Z');
});
