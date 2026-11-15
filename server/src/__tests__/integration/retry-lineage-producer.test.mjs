/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, afterEach, beforeAll, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createMockLogger } from '../helpers/mockFactory.mjs';

let database;
const query = (...args) => database.query(...args), withTransaction = (...args) => database.withTransaction(...args);
jest.unstable_mockModule('../../config/database.mjs', () => ({ query, withTransaction, default: { query, withTransaction } }));
const { ClassificationRetryService } = await import('../../services/classificationRetryService.mjs');
const { rebindRetryLineage } = await import('../../services/classificationPersistenceRetryLineage.mjs');
const { createClassificationRouter } = await import('../../routes/classificationRouteShared.mjs');
const { requireReadWrite } = await import('../../middleware/apiKeyAuth.mjs');
const { errorHandler } = await import('../../middleware/errorHandler.mjs');
const stale = { original_classification_id: 42, media_request_ids: [301], webhook_log_ids: [401], inherited_marker: 'owned fixture' };
const history = [41, 42, 43], requestIds = [-301, 301, 302], webhookIds = [-401, 401, 402], tmdbId = 889980;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

beforeAll(() => { database = createReadinessDatabase({ max: 4 }); });
afterEach(async () => {
  jest.restoreAllMocks();
  await query("DELETE FROM task_queue WHERE payload->>'tmdb_id'=$1", [String(tmdbId)]);
  await query('DELETE FROM media_requests WHERE id=ANY($1::integer[])', [requestIds]);
  await query('DELETE FROM webhook_log WHERE id=ANY($1::integer[])', [webhookIds]);
  await query('DELETE FROM classification_history WHERE id=ANY($1::bigint[])', [history]);
});
afterAll(async () => { await database.pool.end(); });

async function seed(metadata = { retry_lineage: stale }) {
  for (const id of history) {
    await query(`INSERT INTO classification_history(id,tmdb_id,media_type,title,method,status,metadata)
      VALUES($1,$2,'movie',$3,'fallback','awaiting_decision',$4::jsonb)`,
    [id, tmdbId + id - 41, `Owned lineage ${id}`, JSON.stringify(id === 41 ? metadata : {})]);
  }
  await query('INSERT INTO media_requests(id,classification_id,title) VALUES(301,42,$1)', ['Owned unrelated request']);
  await query('INSERT INTO webhook_log(id,classification_id,media_title) VALUES(401,42,$1)', ['Owned unrelated webhook']);
}
function services(db = database) {
  const followup = { enqueueMetadataEnrichmentTask: jest.fn().mockResolvedValue({ metadataEnrichmentQueued: false }) };
  return { retry: new ClassificationRetryService({ db, logger: createMockLogger(), followupService: followup }), followup };
}
function app(retry) {
  const logger = createMockLogger(), application = express(); application.use(express.json());
  application.use((req, _res, next) => { req.user = { id: 1, role: 'admin', username: 'owned' };
    req.apiKey = { permissions: 'read_write' }; next(); });
  application.use('/api/classification', createClassificationRouter({ express, db: database, classificationService: {},
    classificationRetryService: retry, clarificationService: {}, createLogger: () => logger, requireReadWrite, reclassificationService: {} }));
  application.use(errorHandler); return application;
}
async function snapshot() {
  return { history: (await query('SELECT id,status,metadata FROM classification_history WHERE id=ANY($1::bigint[]) ORDER BY id', [history])).rows,
    tasks: (await query("SELECT id,payload,status FROM task_queue WHERE payload->>'tmdb_id'=$1 ORDER BY id", [String(tmdbId)])).rows,
    requests: (await query('SELECT id,classification_id FROM media_requests WHERE id=ANY($1::integer[]) ORDER BY id', [requestIds])).rows,
    webhooks: (await query('SELECT id,classification_id FROM webhook_log WHERE id=ANY($1::integer[]) ORDER BY id', [webhookIds])).rows };
}
test.each([{ name: 'stale reference object', value: stale },
  { name: 'stale original-only object', value: { original_classification_id: 42, media_request_ids: [], webhook_log_ids: [] } },
  { name: 'array', value: [stale] }, { name: 'primitive', value: 'legacy' }, { name: 'null', value: null }, { name: 'absent' }])(
  'new retry payload omits $name and cannot reassign unrelated fixtures', async entry => {
    const metadata = 'value' in entry ? { retry_lineage: entry.value } : {};
    await seed(metadata); const before = await snapshot(), { retry } = services();
    const response = await request(app(retry)).post('/api/classification/retry').send({ classificationIds: ['41'] });
    expect(response.status).toBe(200); expect(response.body).toMatchObject({ requested: 1, queued: 1, failed: 0 });
    const saved = await snapshot(); expect(saved.tasks).toHaveLength(1);
    expect(saved.tasks[0].payload).not.toHaveProperty('retry_lineage');
    await rebindRetryLineage(43, saved.tasks[0].payload);
    const consumed = await snapshot(); expect(consumed.requests).toEqual(before.requests); expect(consumed.webhooks).toEqual(before.webhooks);
    expect(consumed.history[1]).toEqual(before.history[1]); expect(consumed.history[2]).toEqual(before.history[2]);
    expect(consumed.history[0].metadata).toMatchObject(metadata);
    expect(consumed.history[0].metadata.classification_details.outcome_link).not.toHaveProperty('replacement_classification_id');
  });
test.each([41, '41'])('fresh capture for %p replaces inherited fields and keeps existing rebinding behavior', async id => {
  await seed();
  await query('INSERT INTO media_requests(id,classification_id,title) VALUES(302,41,$1)', ['Owned current request']);
  await query('INSERT INTO webhook_log(id,classification_id,media_title) VALUES(402,41,$1)', ['Owned current webhook']);
  expect(await services().retry.retrySingle({ classificationId: id, actor: 'owned' })).toMatchObject({ queued: true });
  const saved = await snapshot(), payload = saved.tasks[0].payload;
  expect(payload.retry_lineage).toEqual({ original_classification_id: id, media_request_ids: [302], webhook_log_ids: [402] });
  expect(saved.history[0].metadata.retry_lineage).toEqual(stale);
  await rebindRetryLineage(43, payload); const consumed = await snapshot();
  expect(consumed.requests).toEqual([{ id: 301, classification_id: 42 }, { id: 302, classification_id: 43 }]);
  expect(consumed.webhooks).toEqual([{ id: 401, classification_id: 42 }, { id: 402, classification_id: 43 }]);
  expect(consumed.history[0].metadata.classification_details.outcome_link.replacement_classification_id).toBe(43);
  expect(consumed.history[1].metadata).toEqual({});
});
test('filtered-empty capture still omits lineage without redefining collector admission', async () => {
  await seed();
  await query('INSERT INTO media_requests(id,classification_id) VALUES(-301,41)');
  await query('INSERT INTO webhook_log(id,classification_id) VALUES(-401,41)');
  expect(await services().retry.retrySingle({ classificationId: 41, actor: 'owned' })).toMatchObject({ queued: true });
  const saved = await snapshot(); expect(saved.tasks[0].payload).not.toHaveProperty('retry_lineage');
  expect(saved.requests).toEqual([{ id: -301, classification_id: null }, { id: 301, classification_id: 42 }]);
  expect(saved.webhooks).toEqual([{ id: -401, classification_id: null }, { id: 401, classification_id: 42 }]);
});
test.each(['media_requests', 'webhook_log'])('genuine capture timeout in %s rolls back callback DML and never treats failure as absence', async table => {
  await seed(); const before = await snapshot(), holder = await database.pool.connect();
  const { retry, followup } = services(), recorder = jest.fn(), cleanup = jest.spyOn(retry, 'cleanupClassificationArtifacts');
  const originalCapture = retry.captureRetryLineage.bind(retry), queries = [], rejections = [];
  const capture = jest.spyOn(retry, 'captureRetryLineage').mockImplementation((client, id) => originalCapture({ query: async (sql, values) => {
    const source = sql.includes('FROM media_requests') ? 'media_requests' : sql.includes('FROM webhook_log') ? 'webhook_log' : 'unknown';
    queries.push(source);
    try { return await client.query(sql, values); } catch (error) { rejections.push({ source, code: error.code }); throw error; }
  } }, id));
  let result;
  try {
    await holder.query('BEGIN'); await holder.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
    result = await retry.retrySingle({ classificationId: 41, actor: 'owned', retryReceiptRecorder: recorder,
      retryEligibilityCheck: async ({ client }) => {
        await client.query("SET LOCAL statement_timeout = '150ms'");
        await client.query("UPDATE classification_history SET metadata=metadata||'{\"owned_probe\":true}'::jsonb WHERE id=41");
        return { eligible: true };
      } });
  } finally { await holder.query('ROLLBACK'); holder.release(); }
  expect(result).toMatchObject({ failed: true, reasonCode: 'retry_failed' }); expect(await snapshot()).toEqual(before);
  expect(capture).toHaveBeenCalledTimes(1);
  expect(queries).toEqual(table === 'media_requests' ? ['media_requests'] : ['media_requests', 'webhook_log']);
  expect(rejections).toEqual([{ source: table, code: '57014' }]);
  expect(cleanup).not.toHaveBeenCalled(); expect(recorder).not.toHaveBeenCalled(); expect(followup.enqueueMetadataEnrichmentTask).not.toHaveBeenCalled();
});
test('receipt refusal after observing the new task rolls back its omission and ordinary retry writes', async () => {
  await seed(); const before = await snapshot(), { retry, followup } = services();
  let observedPayload; const errorCodes = [];
  const recorder = jest.fn(async ({ client, retryTaskId }) => {
    const task = (await client.query('SELECT payload FROM task_queue WHERE id=$1', [retryTaskId])).rows[0];
    observedPayload = task.payload;
    try { await client.query('SELECT 1/0'); } catch (error) { errorCodes.push(error.code); throw error; }
  });
  expect(await retry.retrySingle({ classificationId: 41, actor: 'owned', retryReceiptRecorder: recorder })).toMatchObject({ failed: true });
  expect(observedPayload).toBeDefined(); expect(observedPayload).not.toHaveProperty('retry_lineage'); expect(errorCodes).toEqual(['22012']);
  expect(recorder).toHaveBeenCalledTimes(1); expect(await snapshot()).toEqual(before); expect(followup.enqueueMetadataEnrichmentTask).not.toHaveBeenCalled();
});
test('concurrent retries serialize one freshly lineage-free task and one receipt callback', async () => {
  await seed(); const recorder = jest.fn(), runs = [services(), services()];
  const results = await Promise.all(runs.map(({ retry }) => retry.retrySingle({ classificationId: 41, actor: 'owned', retryReceiptRecorder: recorder })));
  expect(results.filter(r => r.queued)).toHaveLength(1); expect(results.filter(r => r.skipped)).toHaveLength(1);
  expect(results.some(r => r.failed)).toBe(false); expect(recorder).toHaveBeenCalledTimes(1);
  const saved = await snapshot(); expect(saved.tasks).toHaveLength(1); expect(saved.tasks[0].payload).not.toHaveProperty('retry_lineage');
  expect(saved.history[0].metadata.retry_lineage).toEqual(stale);
});
test.each(['delayed', 'lost'])('native COMMIT with %s acknowledgement preserves a lineage-free durable task without replay', async mode => {
  await seed(); const owner = createReadinessDatabase({ max: 1 }), committed = deferred(), release = deferred();
  const { retry, followup } = services(owner), recorder = jest.fn(); let execution, spy;
  try {
    const client = await owner.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0] === 'COMMIT') { committed.resolve(); await release.promise; if (mode === 'lost') throw new Error('Owned lost acknowledgement'); }
      return result;
    }); client.release();
    execution = retry.retrySingle({ classificationId: 41, actor: 'owned', retryReceiptRecorder: recorder });
    await Promise.race([committed.promise, execution.then(() => { throw new Error('Owned COMMIT not reached'); })]);
    const durable = await snapshot(); expect(durable.tasks).toHaveLength(1); expect(durable.tasks[0].payload).not.toHaveProperty('retry_lineage');
    expect(followup.enqueueMetadataEnrichmentTask).not.toHaveBeenCalled(); release.resolve(); const result = await execution;
    expect(result).toMatchObject(mode === 'lost' ? { failed: true, queued: false } : { queued: true, failed: false });
    expect(recorder).toHaveBeenCalledTimes(1); expect(spy.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
    expect(await snapshot()).toEqual(durable); expect(followup.enqueueMetadataEnrichmentTask).toHaveBeenCalledTimes(mode === 'lost' ? 0 : 1);
  } finally { release.resolve(); await execution; spy?.mockRestore(); await owner.pool.end(); }
});
