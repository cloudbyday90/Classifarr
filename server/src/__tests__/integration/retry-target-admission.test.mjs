/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, afterEach, beforeAll, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createMockLogger } from '../helpers/mockFactory.mjs';

let database;
const query = (...args) => database.query(...args), withTransaction = (...args) => database.withTransaction(...args);
jest.unstable_mockModule('../../config/database.mjs', () => ({ query, withTransaction, default: { query, withTransaction } }));
const { ClassificationRetryService } = await import('../../services/classificationRetryService.mjs');
const { createClassificationRouter } = await import('../../routes/classificationRouteShared.mjs');
const { requireReadWrite } = await import('../../middleware/apiKeyAuth.mjs');
const { errorHandler } = await import('../../middleware/errorHandler.mjs');
const { PolicyRuntimeHistoricRouteSafetyRefreshExecutionService } = await import('../../services/policyRuntimeHistoricRouteSafetyRefreshExecutionService.mjs');
const { PolicyRuntimeHistoricRouteSafetyRefreshInventoryService } = await import('../../services/policyRuntimeHistoricRouteSafetyRefreshInventory.mjs');
const { PolicyRuntimeHistoricRouteSafetyRefreshReceiptRepository } = await import('../../services/policyRuntimeHistoricRouteSafetyRefreshReceiptRepository.mjs');
const { PolicyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService } = await import('../../services/policyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService.mjs');
const { normalizePolicyRuntimeQuestion } = await import('../../services/policyRuntimeQuestionNormalizer.mjs');
const history = new Set(), receipts = new Set(), links = new Set();
const mediaIds = ['889970', '889971'];

beforeAll(() => { database = createReadinessDatabase({ max: 4 }); });
afterEach(async () => {
  jest.restoreAllMocks();
  await query("DELETE FROM task_queue WHERE payload->>'tmdb_id'=ANY($1::text[])", [mediaIds]);
  await query('DELETE FROM media_requests WHERE id=ANY($1::integer[])', [[...links]]); links.clear();
  await query('DELETE FROM policy_runtime_historic_route_safety_refresh_receipt_items WHERE receipt_id=ANY($1::uuid[])', [[...receipts]]);
  await query('DELETE FROM policy_runtime_historic_route_safety_refresh_receipts WHERE receipt_id=ANY($1::uuid[])', [[...receipts]]); receipts.clear();
  await query('DELETE FROM classification_history WHERE id=ANY($1::bigint[])', [[...history]]); history.clear();
});
afterAll(async () => { await database.pool.end(); });

const historicQuestion = () => normalizePolicyRuntimeQuestion({ metadata: { media_type: 'movie' },
  libraries: [{ id: 8, name: 'Owned fixture', media_type: 'movie', is_active: true }], policyResult: { action: 'auto_classify',
    ranked: [{ library_id: 8, score: 90, prompt_threshold: 60, auto_classify_threshold: 85 }] } });
async function seed(id = 1, { historic = false, status = 'awaiting_decision', tmdbId = id === 100 ? 889971 : 889970 } = {}) {
  history.add(String(id));
  const metadata = historic ? { policyResult: { action: 'auto_classify', thresholds: { prompt: 60, auto_classify: 85 },
    ranked: [{ library_id: 8, score: 90, prompt_threshold: 60, auto_classify_threshold: 85 }] } } : {};
  await query(`INSERT INTO classification_history(id,tmdb_id,media_type,title,year,confidence,method,status,metadata,policy_question)
    VALUES($1,$2,'movie',$3,2026,90,$4,$5,$6::jsonb,$7::jsonb)`,
  [id, tmdbId, `Owned target admission ${id}`, historic ? 'signal_calculation' : 'fallback', status, JSON.stringify(metadata), historic ? JSON.stringify(historicQuestion()) : null]);
}
async function snapshot() {
  return {
    history: (await query('SELECT id,status,metadata FROM classification_history WHERE id=ANY($1::bigint[]) ORDER BY id', [[...history]])).rows,
    tasks: (await query("SELECT id,payload,status FROM task_queue WHERE payload->>'tmdb_id'=ANY($1::text[]) ORDER BY id", [mediaIds])).rows,
    receipts: (await query('SELECT receipt_id,requested_record_count FROM policy_runtime_historic_route_safety_refresh_receipts WHERE receipt_id=ANY($1::uuid[])', [[...receipts]])).rows,
    items: (await query('SELECT classification_id,execution_status FROM policy_runtime_historic_route_safety_refresh_receipt_items WHERE receipt_id=ANY($1::uuid[]) ORDER BY classification_id', [[...receipts]])).rows,
  };
}
function services() {
  const db = { withTransaction: jest.fn((...args) => database.withTransaction(...args)) }, logger = createMockLogger();
  const followupService = { enqueueMetadataEnrichmentTask: jest.fn().mockResolvedValue({ metadataEnrichmentQueued: false }) };
  const retry = new ClassificationRetryService({ db, logger, followupService });
  const createReceipt = jest.fn(() => { const id = randomUUID(); receipts.add(id); return id; });
  const historic = new PolicyRuntimeHistoricRouteSafetyRefreshExecutionService({ db: database, classificationRetryService: retry, createReceipt });
  return { db, retry, historic, logger, followupService, createReceipt };
}
function app({ retry, historic }, permissions = 'read_write', actorId = 1) {
  const logger = createMockLogger(), application = express(); application.use(express.json());
  application.use((req, _res, next) => { req.user = { id: actorId, role: 'admin', username: 'owned' };
    req.apiKey = { permissions }; next(); });
  const receiptRepository = new PolicyRuntimeHistoricRouteSafetyRefreshReceiptRepository({ db: database });
  application.use('/api/classification', createClassificationRouter({ express, db: database,
    classificationService: {}, classificationRetryService: retry, clarificationService: {},
    createLogger: () => logger, requireReadWrite, reclassificationService: {},
    policyRuntimeHistoricRouteSafetyRefreshInventoryService: new PolicyRuntimeHistoricRouteSafetyRefreshInventoryService({ db: database }),
    policyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService: new PolicyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService({ db: database, receiptRepository }),
    policyRuntimeHistoricRouteSafetyRefreshExecutionService: historic }));
  application.use(errorHandler); return application;
}

const invalid = [['string exponent', '1e2'], ['unsafe numeric exponent', 1e21], ['nested array', [1]],
  ['boolean', true], ['object', {}], ['fraction', 1.5], ['decimal string', '1.0'], ['whitespace', ' 1 '],
  ['leading zero', '01'], ['plus', '+1'], ['partial', '1junk'], ['zero', 0], ['negative', -1],
  ['BIGINT overflow', '9223372036854775808'], ['unsafe number', Number.MAX_SAFE_INTEGER + 1]];
test.each(invalid)('HTTP rejects %s without selecting either owned row', async (_label, id) => {
  await seed(1); await seed(100); const before = await snapshot(), deps = services();
  const command = jest.spyOn(deps.retry, 'retryClassifications');
  const response = await request(app(deps)).post('/api/classification/retry').send({ classificationIds: [id] });
  expect(response.status).toBe(400); expect(command).not.toHaveBeenCalled(); expect(deps.db.withTransaction).not.toHaveBeenCalled();
  expect(await snapshot()).toEqual(before); expect(deps.followupService.enqueueMetadataEnrichmentTask).not.toHaveBeenCalled();
});
test.each([100, '100'])('HTTP admits exact %s and queues row 100', async id => {
  await seed(1); await seed(100); const deps = services();
  const response = await request(app(deps)).post('/api/classification/retry').send({ classificationIds: [id] });
  expect(response.status).toBe(200); expect(response.body).toMatchObject({ queued: 1, failed: 0, results: [{ classificationId: 100 }] });
  const saved = await snapshot(); expect(saved.history.map(row => [row.id, row.status])).toEqual([[1, 'awaiting_decision'], [100, 'reclassified']]);
  expect(saved.tasks).toHaveLength(1); expect(saved.tasks[0].payload.tmdb_id).toBe(889971);
});

test.each([['9007199254740992', '9007199254740993'], ['9223372036854775806', '9223372036854775807']])(
  'HTTP queues exact History target %s without touching adjacent %s', async (target, neighbor) => {
    await seed(target); await seed(neighbor, { tmdbId: 889971 });
    const deps = services(), http = request(app(deps));
    const response = await http.post('/api/classification/retry').send({ classificationIds: [neighbor, '9223372036854775808'] });
    expect(response.status).toBe(400);
    expect(deps.db.withTransaction).not.toHaveBeenCalled();
    const accepted = await http.post('/api/classification/retry').send({ classificationIds: [target, target] }).expect(200);
    expect(accepted.body).toMatchObject({ requested: 1, queued: 1, failed: 0, results: [{ classificationId: target }] });
    const saved = await snapshot();
    expect(saved.history.map(row => [row.id, row.status])).toEqual([[target, 'reclassified'], [neighbor, 'awaiting_decision']]);
    expect(saved.tasks).toHaveLength(1);
    expect(saved.tasks[0].payload.tmdb_id).toBe(889970);
    const adjacent = await http.post('/api/classification/retry').send({ classificationIds: [neighbor] }).expect(200);
    expect(adjacent.body).toMatchObject({ queued: 1, results: [{ classificationId: neighbor }] });
  });
test('decoded numeric JSON exponent remains the exact number 100', async () => {
  await seed(1); await seed(100); const response = await request(app(services())).post('/api/classification/retry')
    .set('Content-Type', 'application/json').send('{"classificationIds":[1e2]}');
  expect(response.status).toBe(200); expect(response.body.results[0].classificationId).toBe(100);
});
test('mixed batch fails before any item, request log or transaction', async () => {
  await seed(1); const before = await snapshot(), deps = services();
  await expect(deps.retry.retryClassifications({ classificationIds: [1, '1e2'] })).rejects.toMatchObject({ name: 'ValidationError', statusCode: 400 });
  expect(deps.db.withTransaction).not.toHaveBeenCalled(); expect(deps.logger.info).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
});
test('raw batch limit precedes deduplication; permitted duplicates still queue one numeric target', async () => {
  await seed(1); const deps = services();
  await expect(deps.retry.retryClassifications({ classificationIds: Array(101).fill('1') })).rejects.toMatchObject({ name: 'ValidationError' });
  expect(deps.db.withTransaction).not.toHaveBeenCalled();
  const result = await deps.retry.retryClassifications({ classificationIds: Array.from({ length: 100 }, (_, i) => i % 2 ? '1' : 1) });
  expect(result).toMatchObject({ requested: 1, queued: 1, results: [{ classificationId: 1 }] });
  expect((await snapshot()).tasks).toHaveLength(1);
});
test.each(['0001', 0, -1, '9223372036854775808', 1e21])('direct target %s refuses before transaction and callbacks', async id => {
  await seed(1); await seed(100); if (id === 0 || id === -1) await seed(id);
  const before = await snapshot(), deps = services(), eligibility = jest.fn(), recorder = jest.fn();
  expect(await deps.retry.retrySingle({ classificationId: id, retryEligibilityCheck: eligibility, retryReceiptRecorder: recorder }))
    .toMatchObject({ classificationId: id, oldClassificationId: id, failed: true, queued: false, skipped: false, reasonCode: 'retry_failed' });
  expect(deps.db.withTransaction).not.toHaveBeenCalled(); expect(eligibility).not.toHaveBeenCalled(); expect(recorder).not.toHaveBeenCalled();
  expect(deps.followupService.enqueueMetadataEnrichmentTask).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
});
test.each([1, '1', 2147483648, '2147483648', '9223372036854775807'])('valid direct %s preserves its scalar type in results and fresh lineage', async id => {
  await seed(id);
  const link = (await query(`INSERT INTO media_requests(title,media_type,tmdb_id,classification_id)
    VALUES('Owned admission link','movie',889970,$1) RETURNING id`, [id])).rows[0].id; links.add(link);
  const deps = services(), result = await deps.retry.retrySingle({ classificationId: id, actor: 'owned' });
  expect(result).toMatchObject({ queued: true, failed: false, classificationId: id, oldClassificationId: id });
  expect((await snapshot()).tasks[0].payload.retry_lineage.original_classification_id).toBe(id);
  const proof = await query('SELECT source_classification_id::text FROM classification_retry_lineage_proofs WHERE task_id=$1', [result.taskId]);
  expect(proof.rows).toEqual([{ source_classification_id: String(id) }]);
});
test('admitted absent and ineligible targets keep existing skips', async () => {
  await seed(1, { status: 'routed' }); const deps = services();
  expect(await deps.retry.retrySingle({ classificationId: '9223372036854775807' })).toMatchObject({ skipped: true, failed: false, reasonCode: 'not_found' });
  expect(await deps.retry.retrySingle({ classificationId: 1 })).toMatchObject({ skipped: true, failed: false, reasonCode: 'status_ineligible' });
  expect(deps.db.withTransaction).toHaveBeenCalledTimes(2); expect((await snapshot()).tasks).toHaveLength(0);
});
test.each([['exponent', [1, '1e2']], ['overflow', ['9223372036854775808']], ['unsafe number', [Number.MAX_SAFE_INTEGER + 1]],
  ['duplicate', [1, '1']], ['large duplicate', Array(2).fill('9223372036854775807')], ['over limit', Array(51).fill(1)]])(
  'historic %s selection refuses before receipt creation', async (_label, ids) => {
    await seed(1, { historic: true }); const before = await snapshot(), deps = services(), command = jest.spyOn(deps.retry, 'retryClassifications');
    const response = await request(app(deps)).post('/api/classification/pending/route-safety-refresh/retry').send({ classificationIds: ids });
    expect(response.status).toBe(400); expect(deps.createReceipt).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled();
    expect(deps.db.withTransaction).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
  });
test('valid historic selections preserve actor-bound queued receipts and numeric IDs', async () => {
  await seed(1, { historic: true }); await seed(100, { historic: true }); const deps = services();
  const response = await request(app(deps)).post('/api/classification/pending/route-safety-refresh/retry').send({ classificationIds: ['1', 100] });
  expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.summary).toMatchObject({ requestedRecordCount: 2, queued: 2 });
  expect(response.body.records.map(row => row.classificationId)).toEqual([1, 100]); const saved = await snapshot();
  expect(saved.receipts).toHaveLength(1); expect(saved.receipts[0].requested_record_count).toBe(2);
  expect(saved.items).toEqual([{ classification_id: 1, execution_status: 'queued' }, { classification_id: 100, execution_status: 'queued' }]);
  expect((await query('SELECT actor_id FROM policy_runtime_historic_route_safety_refresh_receipts WHERE receipt_id=$1', [response.body.retryReceipt])).rows[0].actor_id).toBe('user:1');
});

test('historic paging and a mixed-outcome receipt keep adjacent BIGINT identities distinct', async () => {
  const penultimate = '9223372036854775806', maximum = '9223372036854775807';
  await seed(penultimate, { historic: true });
  await seed(maximum, { historic: true, tmdbId: 889971 });
  const deps = services(), http = request(app(deps));
  const base = '/api/classification/pending';
  const inventory = `${base}/route-safety-refresh-inventory`;
  const first = await http.get(inventory).query({ limit: 1, cursor: '9223372036854775805' }).expect(200);
  expect(first.body.pagination).toMatchObject({ nextCursor: penultimate, hasNextPage: true });
  expect(first.body.records[0]).toMatchObject({ classificationId: penultimate, candidateItem: { classification_id: penultimate } });
  const second = await http.get(inventory).query({ limit: 1, cursor: first.body.pagination.nextCursor }).expect(200);
  expect(second.body.records).toEqual([expect.objectContaining({ classificationId: maximum, candidateItem: expect.objectContaining({ classification_id: maximum }) })]);
  await http.get(inventory).query({ cursor: maximum }).expect(200).expect(res => expect(res.body.records).toEqual([]));
  for (const cursor of ['', '1e2', '9223372036854775808']) await http.get(inventory).query({ cursor }).expect(400);

  // The locked execution must recheck eligibility after the read-only inventory.
  await query("UPDATE classification_history SET status='routed' WHERE id=$1", [penultimate]);
  const submitted = await http.post(`${base}/route-safety-refresh/retry`).send({ classificationIds: [maximum, penultimate] }).expect(200);
  expect(submitted.body.records).toEqual([
    { classificationId: maximum, resultStatusId: 'queued', reasonId: 'queued_for_current_runtime_evaluation' },
    { classificationId: penultimate, resultStatusId: 'skipped', reasonId: 'status_ineligible' },
  ]);
  const path = `${base}/route-safety-refresh/receipts/${submitted.body.retryReceipt}`;
  const saved = await snapshot();
  const receipt = await http.get(path).expect(200);
  expect(receipt.body.records).toEqual([
    expect.objectContaining({ classificationId: penultimate, executionStatusId: 'skipped' }),
    expect.objectContaining({ classificationId: maximum, executionStatusId: 'queued' }),
  ]);
  await request(app(deps, 'read_write', 2)).get(path).expect(404);
  expect(await snapshot()).toEqual(saved);
  expect(saved.tasks).toHaveLength(1);
});

test.each([
  ['9007199254740992', '9007199254740993'],
  ['9223372036854775806', '9223372036854775807'],
])('historic retry binds adjacent queue tasks %s and %s to their own receipt items', async (firstId, secondId) => {
  await seed(1, { historic: true });
  await seed(100, { historic: true });
  const sequence = (await query('SELECT last_value, is_called FROM task_queue_id_seq')).rows[0];
  const deps = services();
  const http = request(app(deps));
  const base = '/api/classification/pending/route-safety-refresh';
  try {
    await query("SELECT setval('task_queue_id_seq', $1, false)", [firstId]);
    const submitted = await http.post(`${base}/retry`).send({ classificationIds: [1, 100] }).expect(200);
    expect(submitted.body.summary).toMatchObject({ requestedRecordCount: 2, queued: 2, failed: 0 });
    const { rows } = await query(`
      SELECT item.classification_id, item.retry_task_id, task.payload->>'tmdb_id' AS tmdb_id
      FROM policy_runtime_historic_route_safety_refresh_receipt_items item
      JOIN task_queue task ON task.id=item.retry_task_id
      WHERE item.receipt_id=$1 ORDER BY item.classification_id`, [submitted.body.retryReceipt]);
    expect(rows).toEqual([
      { classification_id: 1, retry_task_id: firstId, tmdb_id: '889970' },
      { classification_id: 100, retry_task_id: secondId, tmdb_id: '889971' },
    ]);

    await query("UPDATE task_queue SET status='failed' WHERE id=$1", [secondId]);
    const saved = await snapshot();
    const path = `${base}/receipts/${submitted.body.retryReceipt}`;
    const expectedRecords = [
      { classificationId: 1, executionStatusId: 'queued', executionReasonId: 'queued_for_current_runtime_evaluation',
        reconciliationStatusId: 'queue_pending' },
      { classificationId: 100, executionStatusId: 'queued', executionReasonId: 'queued_for_current_runtime_evaluation',
        reconciliationStatusId: 'queue_failed' },
    ];
    const receipt = await http.get(path).expect(200);
    expect(receipt.body.records).toEqual(expectedRecords);
    const repeated = await http.get(path).expect(200);
    expect(repeated.body).toEqual(receipt.body);
    await request(app(deps, 'read_write', 2)).get(path).expect(404);
    expect(await snapshot()).toEqual(saved);
  } finally {
    await query("SELECT setval('task_queue_id_seq', $1, $2)", [sequence.last_value, sequence.is_called]);
  }
});

test('historic retry rolls back task admission when the requested receipt item is absent', async () => {
  await seed(1, { historic: true });
  const deps = services();
  const repository = deps.historic.receiptRepository;
  const markRetryQueued = repository.markRetryQueued.bind(repository);
  jest.spyOn(repository, 'markRetryQueued').mockImplementation(input =>
    markRetryQueued({ ...input, classificationId: 100 }));
  const before = await snapshot();

  const response = await request(app(deps)).post('/api/classification/pending/route-safety-refresh/retry')
    .send({ classificationIds: [1] }).expect(200);
  expect(response.body.records).toEqual([{ classificationId: 1, resultStatusId: 'failed', reasonId: 'retry_failed' }]);
  const saved = await snapshot();
  expect(saved.history).toEqual(before.history);
  expect(saved.tasks).toEqual(before.tasks);
  expect(saved.items).toEqual([{ classification_id: 1, execution_status: 'failed' }]);
  expect(deps.followupService.enqueueMetadataEnrichmentTask).not.toHaveBeenCalled();
});

test.each([{ ids: Array(1) }, { ids: Object.assign(Array(2), { 0: 1 }) }])('direct historic sparse selection %# refuses before receipt work', async ({ ids }) => {
  await seed(1, { historic: true }); const before = await snapshot(), deps = services(), command = jest.spyOn(deps.retry, 'retryClassifications');
  await expect(deps.historic.run({ classificationIds: ids, actorId: 'user:1' })).rejects.toMatchObject({ name: 'ValidationError', statusCode: 400 });
  expect(deps.createReceipt).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled();
  expect(deps.db.withTransaction).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
});
test.each(['/api/classification/retry', '/api/classification/pending/route-safety-refresh/retry'])(
  'read-only authority still refuses %s before commands', async path => {
    const deps = services(), command = jest.spyOn(deps.retry, 'retryClassifications');
    const response = await request(app(deps, 'read_only')).post(path).send({ classificationIds: [1] });
    expect(response.status).toBe(403); expect(command).not.toHaveBeenCalled(); expect(deps.createReceipt).not.toHaveBeenCalled();
  });
