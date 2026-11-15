/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, afterEach, beforeAll, expect, jest, test } from '@jest/globals';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createMockLogger } from '../helpers/mockFactory.mjs';

let database;
const query = (...args) => database.query(...args), withTransaction = (...args) => database.withTransaction(...args);
jest.unstable_mockModule('../../config/database.mjs', () => ({ query, withTransaction, default: { query, withTransaction } }));
const { ClassificationRetryStateService } = await import('../../services/classificationRetryStateService.mjs');
const { ClassificationRetryService } = await import('../../services/classificationRetryService.mjs');
const state = new ClassificationRetryStateService();
const history = new Set(), notifications = new Set(), requests = new Set(), webhooks = new Set();
const tmdbId = 889960, markerType = 'retry_notification_owned_receipt', priorTime = new Date('2010-01-01T00:00:00Z');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

beforeAll(() => { database = createReadinessDatabase({ max: 4 }); });
afterEach(async () => {
  jest.restoreAllMocks();
  await query("DELETE FROM task_queue WHERE payload->>'tmdb_id'=$1", [String(tmdbId)]);
  await query('DELETE FROM rag_logs WHERE type=$1', [markerType]);
  for (const [table, ids] of [['media_requests', requests], ['webhook_log', webhooks], ['app_notifications', notifications]]) {
    await query(`DELETE FROM ${table} WHERE id=ANY($1::integer[])`, [[...ids]]); ids.clear();
  }
  await query('DELETE FROM classification_history WHERE id=ANY($1::bigint[])', [[...history]]); history.clear();
});
afterAll(async () => { await database.pool.end(); });

async function seed(id = 41) {
  history.add(String(id));
  await query(`INSERT INTO classification_history(id,tmdb_id,media_type,title,method,status,metadata)
    VALUES($1,$2,'movie','Owned retry notification','fallback','awaiting_decision','{}')`, [id, tmdbId]);
  for (const [table, ids, titleColumn] of [['media_requests', requests, 'title'], ['webhook_log', webhooks, 'media_title']]) {
    const result = await query(`INSERT INTO ${table}(${titleColumn},media_type,tmdb_id,classification_id)
      VALUES('Owned retry notification','movie',$1,$2) RETURNING id`, [tmdbId, id]); ids.add(result.rows[0].id);
  }
}
async function notice(data, { read = false, type = 'warning' } = {}) {
  const id = (await query(`INSERT INTO app_notifications(type,title,message,data,is_read,read_at)
    VALUES($1,'Owned retry notification','Owned retry notification',$2::jsonb,$3,$4) RETURNING id`,
  [type, data, read, priorTime])).rows[0].id;
  notifications.add(id); return id;
}
const payload = (key, scalar) => `{"notificationType":"other","${key}":${scalar}}`;
const quoted = value => JSON.stringify(value);
const notification = async id => (await query('SELECT id,data,is_read,read_at,type FROM app_notifications WHERE id=$1', [id])).rows[0];
async function snapshot() {
  return {
    history: (await query('SELECT id,status,metadata FROM classification_history WHERE id=ANY($1::bigint[]) ORDER BY id', [[...history]])).rows,
    notifications: (await query('SELECT id,data,is_read,read_at FROM app_notifications WHERE id=ANY($1::integer[]) ORDER BY id', [[...notifications]])).rows,
    requests: (await query('SELECT id,classification_id FROM media_requests WHERE id=ANY($1::integer[]) ORDER BY id', [[...requests]])).rows,
    webhooks: (await query('SELECT id,classification_id FROM webhook_log WHERE id=ANY($1::integer[]) ORDER BY id', [[...webhooks]])).rows,
    tasks: (await query("SELECT id,payload,status FROM task_queue WHERE payload->>'tmdb_id'=$1 ORDER BY id", [String(tmdbId)])).rows,
    markers: (await query('SELECT id FROM rag_logs WHERE type=$1', [markerType])).rows,
  };
}
function retryService(db = database) {
  const followupService = { enqueueMetadataEnrichmentTask: jest.fn().mockResolvedValue({ metadataEnrichmentQueued: false }) };
  return { service: new ClassificationRetryService({ db, logger: createMockLogger(), followupService }), followupService };
}
const receiptMarker = ({ client }) => client.query("INSERT INTO rag_logs(level,type,message) VALUES('info',$1,'Owned callback marker')", [markerType]);

test.each(['classificationId', 'classification_id'])('full retry survives unrelated %s overflow and queues once', async key => {
  await seed(); const matching = await notice(payload(key, quoted('00041'))), bad = await notice(payload(key, quoted('2147483648')));
  const beforeBad = await notification(bad), { service, followupService } = retryService();
  const result = await service.retrySingle({ classificationId: 41, actor: 'owned', retryReceiptRecorder: receiptMarker });
  expect(result).toMatchObject({ queued: true, failed: false, reasonCode: 'queued', purgedLearning: false });
  expect(await notification(matching)).toBeUndefined(); expect(await notification(bad)).toEqual(beforeBad);
  const saved = await snapshot();
  expect(saved.history[0].status).toBe('reclassified'); expect(saved.tasks).toHaveLength(1); expect(saved.markers).toHaveLength(1);
  expect(saved.requests[0].classification_id).toBeNull(); expect(saved.webhooks[0].classification_id).toBeNull();
  expect(followupService.enqueueMetadataEnrichmentTask).toHaveBeenCalledTimes(1);
});

const cases = [
  ['number', '41', true], ['string', quoted('41'), true], ['leading zeros', quoted('00041'), true],
  ['long leading zeros', quoted('0'.repeat(65536) + '41'), true], ['neighbor', '42', false],
  ['INTEGER maximum', '2147483647', false], ['overflow number', '2147483648', false],
  ['overflow string', quoted('2147483648'), false], ['BIGINT maximum', quoted('9223372036854775807'), false],
  ['BIGINT overflow', quoted('9223372036854775808'), false], ['huge digits', quoted('9'.repeat(65536)), false],
  ['zero', '0', false], ['all zeros', quoted('0'.repeat(65536)), false], ['negative number', '-41', false],
  ['plus', quoted('+41'), false], ['space', quoted(' 41'), false], ['newline', quoted('41\n'), false],
  ['decimal number', '41.0', false], ['decimal string', quoted('41.0'), false],
  ['exponent number', '4.1e1', true], ['exponent string', quoted('4.1e1'), false], ['scaled exponent', '4.100e1', false],
  ['underscore', quoted('4_1'), false], ['hex', quoted('0x29'), false], ['boolean', 'true', false],
  ['array', '[41]', false], ['object', '{"id":41}', false], ['JSON null', 'null', false],
  ['empty', quoted(''), false], ['non-ASCII digits', quoted('４１'), false],
];
test.each(['classificationId', 'classification_id'].flatMap(key => cases.map(([label, scalar, matches]) => [key, label, scalar, matches])))(
  '%s %s obeys notification matching without changing retained fields', async (key, _label, scalar, matches) => {
    await seed(); const candidate = await notice(payload(key, scalar)), before = await notification(candidate);
    const unrelated = await notice(payload(key, '42')), unrelatedBefore = await notification(unrelated);
    await database.withTransaction(client => state.cleanupClassificationArtifacts(client, 41));
    expect(await notification(candidate)).toEqual(matches ? undefined : before);
    expect(await notification(unrelated)).toEqual(unrelatedBefore);
  });

test.each([
  [{ classificationId: '41', classification_id: 'bad' }, true],
  [{ classificationId: 'bad', classification_id: '00041' }, true],
  [{ classificationId: '41', classification_id: '2147483648' }, true],
  [{ classificationId: '2147483648', classification_id: '41' }, true],
  [{ classificationId: 41, classification_id: 42 }, true], [{ classificationId: 42, classification_id: 41 }, true],
  [{ classificationId: 42, classification_id: '2147483648' }, false], [{ classificationId: 'bad', classification_id: 42 }, false],
  [{}, false], [null, false], [[41], false], ['41', false],
])('independent-key OR retains the deletion contract for %#', async (data, matches) => {
  await seed(); const candidate = await notice(JSON.stringify(data)), before = await notification(candidate);
  await database.withTransaction(client => state.cleanupClassificationArtifacts(client, 41));
  expect(await notification(candidate)).toEqual(matches ? undefined : before);
});
test('SQL-null notification data stays unchanged', async () => {
  await seed(); const id = await notice(null), before = await notification(id);
  await database.withTransaction(client => state.cleanupClassificationArtifacts(client, 41)); expect(await notification(id)).toEqual(before);
});
test.each(['classificationId', 'classification_id'].flatMap(key => [false, true].flatMap(read =>
  ['info', 'warning', 'error'].map(type => [key, read, type]))))('%s read=%s type=%s is deleted without new filters', async (key, read, type) => {
  await seed(); const id = await notice(payload(key, '41'), { read, type });
  await database.withTransaction(client => state.cleanupClassificationArtifacts(client, 41)); expect(await notification(id)).toBeUndefined();
});
test.each([
  ['00041', '41', true], [' 41 ', quoted('00041'), true], ['+41', '41', true],
  [0, '0', true], ['-0', quoted('0'.repeat(65536)), true], [0, quoted(''), false], [0, 'null', false],
  [-41, '41', false], [2147483647, '2147483647', true], ['2147483647', quoted('0002147483647'), true],
  [-2147483648, '2147483648', false], [null, '0', false],
])('target %s retains INTEGER coercion, range and zero normalization', async (target, scalar, matches) => {
  await seed(); const id = await notice(payload('classificationId', scalar)), before = await notification(id);
  await database.withTransaction(client => state.cleanupClassificationArtifacts(client, target));
  expect(await notification(id)).toEqual(matches ? undefined : before);
});
test.each(['2147483648', '-2147483649', '9007199254740993', '41.0', '41x'])(
  'invalid/out-of-INTEGER target %s still refuses without notifications', async target => {
    await seed(); const before = await snapshot();
    await expect(database.withTransaction(client => state.cleanupClassificationArtifacts(client, target))).rejects.toMatchObject({
      code: /\./.test(target) || target.endsWith('x') ? '22P02' : '22003',
    }); expect(await snapshot()).toEqual(before);
  });
test('an existing positive BIGINT target above INTEGER still rolls back full retry', async () => {
  await seed('2147483648'); const before = await snapshot(), { service, followupService } = retryService();
  expect(await service.retrySingle({ classificationId: '2147483648', actor: 'owned' })).toMatchObject({ failed: true, reasonCode: 'retry_failed' });
  expect(await snapshot()).toEqual(before); expect(followupService.enqueueMetadataEnrichmentTask).not.toHaveBeenCalled();
});

test.each(['task', 'receipt'])('real %s SQL failure restores links, notifications, queue and callback marker', async phase => {
  await seed(); await notice(payload('classificationId', '41')); await notice(payload('classification_id', quoted('2147483648')));
  const before = await snapshot(), observedErrors = [];
  const fail = async client => { try { await client.query('SELECT 1/0'); } catch (error) { observedErrors.push(error.code); throw error; } };
  const db = { withTransaction: fn => database.withTransaction(client => fn({ query: async (sql, params) => {
    const result = await client.query(sql, params);
    if (phase === 'task' && sql.includes('INSERT INTO task_queue')) await fail(client);
    return result;
  } })) };
  const { service, followupService } = retryService(db);
  const recorder = jest.fn(async args => { await receiptMarker(args); if (phase === 'receipt') await fail(args.client); });
  expect(await service.retrySingle({ classificationId: 41, actor: 'owned', retryReceiptRecorder: recorder })).toMatchObject({ failed: true, reasonCode: 'retry_failed' });
  expect(observedErrors).toEqual(['22012']); expect(await snapshot()).toEqual(before);
  expect(recorder).toHaveBeenCalledTimes(phase === 'receipt' ? 1 : 0);
  expect(followupService.enqueueMetadataEnrichmentTask).not.toHaveBeenCalled();
});
test('concurrent full retries retain one queue task and callback marker with malformed notifications', async () => {
  await seed(); await notice(payload('classificationId', '41')); await notice(payload('classification_id', quoted('2147483648')));
  const services = [retryService(), retryService()], recorder = jest.fn(receiptMarker);
  const results = await Promise.all(services.map(({ service }) => service.retrySingle({ classificationId: 41, actor: 'owned', retryReceiptRecorder: recorder })));
  expect(results.filter(result => result.queued)).toHaveLength(1); expect(results.filter(result => result.skipped)).toHaveLength(1);
  expect(results.some(result => result.failed)).toBe(false); const saved = await snapshot();
  expect(saved.tasks).toHaveLength(1); expect(saved.markers).toHaveLength(1); expect(recorder).toHaveBeenCalledTimes(1);
});
test.each(['delayed', 'lost'])('native COMMIT with %s acknowledgement does not replay cleanup or callback', async mode => {
  await seed(); const matching = await notice(payload('classificationId', '41')), malformed = await notice(payload('classification_id', quoted('2147483648')));
  const malformedBefore = await notification(malformed), owner = createReadinessDatabase({ max: 1 });
  const committed = deferred(), release = deferred(); let execution, spy;
  const { service, followupService } = retryService(owner), recorder = jest.fn(receiptMarker);
  try {
    const client = await owner.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0] === 'COMMIT') { committed.resolve(); await release.promise; if (mode === 'lost') throw new Error('Owned lost acknowledgement'); }
      return result;
    }); client.release();
    execution = service.retrySingle({ classificationId: 41, actor: 'owned', retryReceiptRecorder: recorder });
    await Promise.race([committed.promise, execution.then(() => { throw new Error('Owned commit was not reached'); })]);
    const durable = await snapshot(); expect(durable.history[0].status).toBe('reclassified'); expect(durable.tasks).toHaveLength(1);
    expect(durable.markers).toHaveLength(1); expect(await notification(matching)).toBeUndefined(); expect(await notification(malformed)).toEqual(malformedBefore);
    expect(followupService.enqueueMetadataEnrichmentTask).not.toHaveBeenCalled(); release.resolve(); const result = await execution;
    expect(result).toMatchObject(mode === 'lost' ? { failed: true, queued: false, reasonCode: 'retry_failed' } : { queued: true, failed: false });
    expect(followupService.enqueueMetadataEnrichmentTask).toHaveBeenCalledTimes(mode === 'lost' ? 0 : 1);
    expect(recorder).toHaveBeenCalledTimes(1); expect(spy.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
    expect(await snapshot()).toEqual(durable);
  } finally { release.resolve(); await execution; spy?.mockRestore(); await owner.pool.end(); }
});
