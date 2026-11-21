/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, afterEach, beforeAll, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createMockLogger } from '../helpers/mockFactory.mjs';

let database;
const query = (...args) => database.query(...args), withTransaction = (...args) => database.withTransaction(...args);
jest.unstable_mockModule('../../config/database.mjs', () => ({ query, withTransaction, default: { query, withTransaction } }));
const { ClassificationRetryService } = await import('../../services/classificationRetryService.mjs');
const { classificationService } = await import('../../services/classification.mjs');
const { QueueAdminService } = await import('../../services/queueAdminService.mjs');
const { QueueMutationService } = await import('../../services/queueMutationService.mjs');
const { QueueTaskProcessorService } = await import('../../services/queueTaskProcessorService.mjs');
const { QueueTaskAcknowledgementService } = await import('../../services/queueTaskAcknowledgementService.mjs');
const { RetryLineageRefusal } = await import('../../services/classificationRetryLineageContract.mjs');
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
  await query('DELETE FROM classification_history WHERE tmdb_id=$1', [tmdbId]);
  await query("DELETE FROM libraries WHERE external_id='owned-retry'");
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
    const consumed = await snapshot(); expect(consumed.requests).toEqual(before.requests); expect(consumed.webhooks).toEqual(before.webhooks);
    expect(consumed.history[1]).toEqual(before.history[1]); expect(consumed.history[2]).toEqual(before.history[2]);
    expect(consumed.history[0].metadata).toMatchObject(metadata);
    expect(consumed.history[0].metadata.classification_details.outcome_link).not.toHaveProperty('replacement_classification_id');
  });
async function seedProtected(metadata = { overview: 'Owned overview', genres: ['Drama'], retry_lineage: stale }) {
  await seed(metadata);
  await query('INSERT INTO media_requests(id,classification_id,media_type,tmdb_id) VALUES(302,41,\'movie\',$1)', [tmdbId]);
  await query('INSERT INTO webhook_log(id,classification_id,media_type,tmdb_id) VALUES(402,41,\'movie\',$1)', [tmdbId]);
}

async function claimRetry() {
  return (await query(`UPDATE task_queue SET status='processing',claim_token=$2,visible_at=NOW()+INTERVAL '2 minutes'
    WHERE payload->>'tmdb_id'=$1 RETURNING *`, [String(tmdbId), randomUUID()])).rows[0];
}

function mockReview() {
  jest.spyOn(classificationService.classificationProgressStageService, 'updateStage').mockResolvedValue();
  jest.spyOn(classificationService.classificationProgressStageService, 'completeTracking').mockResolvedValue();
  jest.spyOn(classificationService.clarificationService, 'isRequireAllConfirmationsEnabled').mockResolvedValue(false);
  jest.spyOn(classificationService, 'runDecisionTree').mockResolvedValue({
    method: 'fallback', library: null, confidence: 50, reason: 'Owned pending review', needs_clarification: true,
  });
  return jest.spyOn(classificationService, 'routeClassificationResult').mockResolvedValue(null);
}

const processRetry = task => classificationService.classifyQueueTask(task, { ...task.payload, taskId: task.id });

const historyCount = async () => Number((await query('SELECT count(*) FROM classification_history WHERE tmdb_id=$1', [tmdbId])).rows[0].count);

function acknowledgement() {
  const logger = createMockLogger();
  return new QueueTaskAcknowledgementService({ db: database, logger, receiptService: { recordTerminal: jest.fn() } });
}

function worker() {
  const ack = acknowledgement();
  return new QueueTaskProcessorService({
    db: database, logger: createMockLogger(), classificationService,
    completeTask: (...args) => ack.complete(...args),
    failTask: (id, reason, _attempts, _max, token, failure) => ack.fail(id, reason, token, failure),
  });
}

test.each([41, '41'])('fresh capture for %p retains current owners until the worker commits', async id => {
  await seedProtected();
  expect(await services().retry.retrySingle({ classificationId: id, actor: 'owned' })).toMatchObject({ queued: true });
  const saved = await snapshot(), payload = saved.tasks[0].payload;
  expect(payload.retry_lineage).toEqual({ original_classification_id: id, media_request_ids: [302], webhook_log_ids: [402] });
  expect(saved.history[0].metadata.retry_lineage).toEqual(stale);
  expect(saved.requests[1].classification_id).toBe(41);
  expect(saved.webhooks[1].classification_id).toBe(41);
  const route = mockReview(), task = await claimRetry();
  const { classification_id: replacementId } = await processRetry(task);
  const consumed = await snapshot();
  expect(consumed.requests).toEqual([{ id: 301, classification_id: 42 }, { id: 302, classification_id: replacementId }]);
  expect(consumed.webhooks).toEqual([{ id: 401, classification_id: 42 }, { id: 402, classification_id: replacementId }]);
  expect(consumed.history[0].metadata.classification_details.outcome_link.replacement_classification_id).toBe(replacementId);
  expect(consumed.history[1].metadata).toEqual({});
  expect(route).toHaveBeenCalledTimes(1);
  await expect(processRetry(task)).rejects.toThrow('retry_lineage_already_completed');
  const reclaim = await claimRetry();
  expect(await processRetry(reclaim)).toMatchObject({ recovered: true, classification_id: replacementId,
    routingOutcome: { reason: 'saved_retry_automatic_route_withheld' } });
  await expect(classificationService.queuedRoutingReplayGuard.admit(reclaim, replacementId))
    .rejects.toThrow('task_retry_lineage_refused');
  expect(route).toHaveBeenCalledTimes(1);
});

test.each([
  ['changed owner', 'media_request_links', 'UPDATE media_requests SET classification_id=42 WHERE id=302'],
  ['detached owner', 'media_request_links', 'UPDATE media_requests SET classification_id=NULL WHERE id=302'],
  ['deleted reference', 'webhook_links', 'DELETE FROM webhook_log WHERE id=402'],
  ['changed item', 'media_request_links', 'UPDATE media_requests SET tmdb_id=99 WHERE id=302'],
  ['additional reference', 'media_request_links', 'UPDATE media_requests SET classification_id=41 WHERE id=301'],
  ['newer relationship', 'source_relationship', `UPDATE classification_history SET metadata=jsonb_set(metadata,
    '{classification_details,outcome_link,replacement_task_id}','99') WHERE id=41`],
])('worker terminally refuses %s and does not replace History', async (_name, category, change) => {
  await seedProtected();
  expect(await services().retry.retrySingle({ classificationId: 41, actor: 'owned' })).toMatchObject({ queued: true });
  await query(change);
  const before = await snapshot(), route = mockReview(), task = await claimRetry();
  await worker().processTask(task);
  const after = await snapshot(), mutations = new QueueMutationService({ db: database, logger: createMockLogger() });
  expect(after.tasks[0].status).toBe('failed');
  expect((await query('SELECT error_message,attempts,retry_lineage_refusal_category FROM task_queue WHERE id=$1', [task.id])).rows[0])
    .toEqual({ error_message: 'task_retry_lineage_refused', attempts: 1, retry_lineage_refusal_category: category });
  expect(after.requests).toEqual(before.requests);
  expect(after.webhooks).toEqual(before.webhooks);
  expect(after.history).toEqual(before.history);
  expect(await historyCount()).toBe(1);
  expect(route).not.toHaveBeenCalled();
  expect(await mutations.retryTask(task.id)).toMatchObject({ success: false, code: 'invalid_state' });
  await mutations.retryAllFailedTasks();
  expect((await snapshot()).tasks[0].status).toBe('failed');
});

test.each(['protected', 'legacy'])('manual library selection and unsupported-media shortcut respect %s lineage', async mode => {
  await seedProtected();
  expect(await services().retry.retrySingle({ classificationId: 41, actor: 'owned' })).toMatchObject({ queued: true });
  const { id } = (await snapshot()).tasks[0];
  if (mode === 'legacy') await query('DELETE FROM classification_retry_lineage_proofs WHERE task_id=$1', [id]);
  const admin = new QueueAdminService({ db: database });
  expect(await admin.manualClassifyTask(id, 1)).toMatchObject({ success: false, code: 'retry_lineage_requires_worker' });
  await query(`UPDATE task_queue SET payload=payload || '{"media_type":"music","media":{"media_type":"music"}}'::jsonb WHERE id=$1`, [id]);
  const route = mockReview();
  await worker().processTask(await claimRetry());
  expect((await snapshot()).tasks[0].status).toBe('failed');
  expect((await query('SELECT retry_lineage_refusal_category FROM task_queue WHERE id=$1', [id])).rows[0])
    .toEqual({ retry_lineage_refusal_category: mode === 'legacy' ? 'proof_unavailable' : 'item_identity' });
  expect(await historyCount()).toBe(1);
  expect(route).not.toHaveBeenCalled();
});

test('ordinary classification treats lineage metadata as data and cannot move associations', async () => {
  await seedProtected();
  const before = await snapshot();
  mockReview();
  await classificationService.classify({ title: 'Owned generic item', media_type: 'movie', tmdb_id: tmdbId,
    overview: 'Owned overview', genres: ['Drama'], retry_lineage: stale });
  const after = await snapshot();
  expect(after.requests).toEqual(before.requests);
  expect(after.webhooks).toEqual(before.webhooks);
  expect(after.history).toEqual(before.history);
  expect(await historyCount()).toBe(2);
});

test('overlapping work under one claim commits one replacement and allows only its worker to continue', async () => {
  await seedProtected();
  await services().retry.retrySingle({ classificationId: 41, actor: 'owned' });
  const task = await claimRetry(), route = mockReview(), entered = deferred(), release = deferred();
  const result = await classificationService.runDecisionTree();
  const decide = classificationService.runDecisionTree.mockClear();
  decide.mockImplementation(async () => {
    if (decide.mock.calls.length === 2) entered.resolve();
    await release.promise;
    return { ...result };
  });
  const runs = [processRetry(task), processRetry(task)];
  const results = Promise.allSettled(runs);
  try { await Promise.race([entered.promise, ...runs]); }
  finally { release.resolve(); }
  const settled = await results;
  expect(settled.filter(entry => entry.status === 'fulfilled')).toHaveLength(1);
  expect(settled.find(entry => entry.status === 'rejected').reason.message).toBe('retry_lineage_already_completed');
  expect(await historyCount()).toBe(2);
  expect(route).toHaveBeenCalledTimes(1);
});

test('a contended terminal acknowledgement rechecks the lease after obtaining the lock', async () => {
  await seedProtected();
  await services().retry.retrySingle({ classificationId: 41, actor: 'owned' });
  const task = await claimRetry();
  const holder = await database.pool.connect();
  let pending;
  try {
    await query("UPDATE task_queue SET visible_at=clock_timestamp()+INTERVAL '1 second' WHERE id=$1", [task.id]);
    await holder.query('BEGIN');
    await holder.query('SELECT id FROM task_queue WHERE id=$1 FOR UPDATE', [task.id]);
    pending = acknowledgement().fail(task.id, 'task_retry_lineage_refused', task.claim_token, new RetryLineageRefusal('webhook_links'));
    await query('SELECT pg_sleep(1.1)');
    await holder.query('COMMIT');
    expect(await pending).toBe(false);
    expect((await query('SELECT status,attempts,retry_lineage_refusal_category FROM task_queue WHERE id=$1', [task.id])).rows[0])
      .toEqual({ status: 'processing', attempts: 0, retry_lineage_refusal_category: null });
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
    await pending;
  }
});

test('routing admission follows local commit and its observation survives a later claim', async () => {
  await seedProtected();
  await services().retry.retrySingle({ classificationId: 41, actor: 'owned' });
  const route = mockReview(), task = await claimRetry();
  const { rows: [library] } = await query(`INSERT INTO libraries (name,external_id,media_type)
    VALUES('Owned retry library','owned-retry','movie') RETURNING id,name`);
  classificationService.runDecisionTree.mockResolvedValue({
    method: 'policy_auto', library, confidence: 97, reason: 'Owned eligible fixture',
  });
  route.mockImplementation(async (id, _metadata, _result, _confirmAll, admit) => {
    const proof = (await query(`SELECT replacement_classification_id FROM classification_retry_lineage_proofs
      WHERE task_id=$1`, [task.id])).rows[0];
    expect(proof.replacement_classification_id).toBe(id);
    expect((await snapshot()).requests[1].classification_id).toBe(id);
    await admit(id);
    return null;
  });
  const result = await processRetry(task);
  const next = await claimRetry();
  expect(await processRetry(next)).toMatchObject({ recovered: true, classification_id: result.classification_id,
    routingOutcome: { routeResult: { attempted: true, routed: false, reason: 'automatic_routing_unconfirmed' } } });
  expect(route).toHaveBeenCalledTimes(1);

  // Legacy tasks may observe a historical provider admission without moving links.
  await query('DELETE FROM classification_retry_lineage_proofs WHERE task_id=$1', [task.id]);
  expect(await processRetry(next)).toMatchObject({ recovered: true, classification_id: result.classification_id });
  expect(route).toHaveBeenCalledTimes(1);
});

test.each(['rollback', 'lost reply'])('the atomic transfer handles a database %s at the write boundary', async mode => {
  await seedProtected();
  expect(await services().retry.retrySingle({ classificationId: 41, actor: 'owned' })).toMatchObject({ queued: true });
  const task = await claimRetry(), route = mockReview();
  const guard = classificationService.queuedRoutingReplayGuard;
  const before = await snapshot();
  if (mode === 'rollback') {
    const withClaim = guard.withClaim.bind(guard);
    jest.spyOn(guard, 'withClaim').mockImplementation((claim, work) => withClaim(claim, (client, ...args) => work({
      query: (sql, values) => sql.startsWith('UPDATE webhook_log SET classification_id')
        ? client.query('SELECT 1/0') : client.query(sql, values),
    }, ...args)));
  }
  if (mode === 'lost reply') {
    const owner = createReadinessDatabase({ max: 1 });
    try {
      const client = await owner.pool.connect(), native = client.query.bind(client);
      let marked = false;
      jest.spyOn(client, 'query').mockImplementation(async (...args) => {
        const result = await native(...args);
        if (args[0].startsWith('UPDATE classification_retry_lineage_proofs')) marked = true;
        if (marked && args[0] === 'COMMIT') throw new Error('Owned lost acknowledgement');
        return result;
      });
      client.release();
      jest.replaceProperty(guard, 'db', owner);
      await expect(processRetry(task)).rejects.toThrow('Owned lost acknowledgement');
    } finally {
      jest.restoreAllMocks();
      await owner.pool.end();
    }
    const marked = (await query('SELECT replacement_classification_id FROM classification_retry_lineage_proofs WHERE task_id=$1', [task.id])).rows[0];
    const recovered = await processRetry(await claimRetry());
    expect(recovered).toMatchObject({ recovered: true, classification_id: marked.replacement_classification_id });
    expect((await snapshot()).requests[1].classification_id).toBe(recovered.classification_id);
    expect(await historyCount()).toBe(2);
  } else {
    await expect(processRetry(task)).rejects.toMatchObject({ code: '22012' });
    expect(await snapshot()).toEqual(before);
    expect(await historyCount()).toBe(1);
  }
  expect(route).not.toHaveBeenCalled();
});
test('unsupported reference ids refuse enqueue and keep the existing owners', async () => {
  await seed();
  await query('INSERT INTO media_requests(id,classification_id) VALUES(-301,41)');
  await query('INSERT INTO webhook_log(id,classification_id) VALUES(-401,41)');
  const before = await snapshot();
  expect(await services().retry.retrySingle({ classificationId: 41, actor: 'owned' })).toMatchObject({ failed: true });
  expect(await snapshot()).toEqual(before);
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
