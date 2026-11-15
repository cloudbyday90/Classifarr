/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, afterEach, beforeAll, expect, jest, test } from '@jest/globals';
import { setTimeout as delay } from 'node:timers/promises';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';

let database;
const query = (...args) => database.query(...args), withTransaction = (...args) => database.withTransaction(...args);
jest.unstable_mockModule('../../config/database.mjs', () => ({ query, withTransaction, default: { query, withTransaction } }));
jest.unstable_mockModule('../../services/classification.mjs', () => ({ classificationService: {} }));
jest.unstable_mockModule('../../services/embeddingService.mjs', () => ({ embeddingService: { generateAndStore: jest.fn() } }));
const { ClassificationPendingDecisionLifecycleService } = await import('../../services/classificationPendingDecisionLifecycleService.mjs');
const { ClassificationPersistenceService } = await import('../../services/classificationPersistenceService.mjs');
const identity = { key: 'tmdb:movie:884450' }, history = new Set();
const context = { extractQuestionContext: () => ({}), getPolicyQuestionContextVersion: async () => 1,
  stampPolicyQuestionContext: value => value, isPolicyQuestionStale: () => false };
const persistence = new ClassificationPersistenceService({ policyQuestionContext: context });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

beforeAll(() => { database = createReadinessDatabase({ max: 4 }); });
afterEach(async () => {
  jest.restoreAllMocks();
  await query("DELETE FROM app_notifications WHERE data->>'fixture'='pending-bigint-owned' OR data->>'classificationId'=ANY($1::text[])", [[...history]]);
  await query('DELETE FROM classification_history WHERE id=ANY($1::bigint[])', [[...history]]); history.clear();
});
afterAll(async () => { await database.pool.end(); });

async function insert(client, id, key = identity.key, status = 'pending_retry', predecessors = []) {
  history.add(String(id));
  const metadata = predecessors.length ? { pending_decision_lifecycle: { version: 'classification.pending_decision_identity.v1',
    state: 'current', supersedes_classification_ids: predecessors } } : {};
  return (await client.query(`INSERT INTO classification_history(id,tmdb_id,media_type,title,method,status,pending_identity_key,metadata)
    VALUES($1,884450,'movie','Owned pending BIGINT','queued_for_retry',$2,$3,$4::jsonb) RETURNING id`,
  [id, status, key, JSON.stringify(metadata)])).rows[0].id;
}
async function replace(id, { db = database, status = 'pending_retry', callback = null } = {}) {
  return new ClassificationPendingDecisionLifecycleService({ db }).persist({ status, identity,
    insert: callback || ((client, predecessors) => insert(client, id, identity.key, status, predecessors)) });
}
const rows = async () => (await query('SELECT * FROM classification_history WHERE id=ANY($1::bigint[]) ORDER BY id', [[...history]])).rows;
async function notification(id, { numeric = false, kind = 'awaiting_decision', read = false, at = null } = {}) {
  const scalar = numeric ? 'to_jsonb($1::bigint)' : 'to_jsonb($1::text)';
  return (await query(`INSERT INTO app_notifications(type,title,message,data,is_read,read_at)
    VALUES('warning','Owned pending','Owned pending',jsonb_build_object('fixture','pending-bigint-owned',
      'notificationType',$2::text,'classificationId',${scalar}),$3,$4) RETURNING id`, [id, kind, read, at])).rows[0].id;
}

const cases = [[41, 42], [Number.MAX_SAFE_INTEGER, '9007199254740992'],
  ['9007199254740992', '9007199254740993'], ['9007199254740993', '9007199254740995'], ['9223372036854775807', 42]];
test.each(['awaiting_decision', 'pending_retry'].flatMap(status => cases.map(([old, next]) => [status, old, next])))(
  '%s replacement from %s to %s preserves both JSON links and exact notification targeting', async (status, old, next) => {
    await insert(database, old, identity.key, status);
    const neighbor = typeof old === 'number' && old < 100 ? 40 : String(BigInt(old) - 1n);
    await insert(database, neighbor, 'tmdb:movie:884451', status);
    const stringNotice = await notification(old), numericNotice = await notification(old, { numeric: true });
    const otherNotice = await notification(neighbor), otherKind = await notification(old, { kind: 'other' });
    const priorTime = new Date('2010-01-01T00:00:00Z');
    const alreadyRead = await notification(old, { read: true, at: priorTime });
    const withTime = await notification(old, { at: priorTime });
    const result = await replace(next, { status });
    expect(result).toEqual({ classificationId: next, supersededClassificationIds: [old] });
    const saved = await rows(), predecessor = saved.find(row => String(row.id) === String(old));
    const successor = saved.find(row => String(row.id) === String(next));
    expect(predecessor).toMatchObject({ status: 'reclassified', clarification_status: 'superseded', policy_question: null });
    expect(predecessor.metadata.pending_decision_lifecycle.superseded_by_classification_id).toBe(next);
    expect(successor.metadata.pending_decision_lifecycle.supersedes_classification_ids).toEqual([old]);
    expect(JSON.parse(JSON.stringify(predecessor.metadata))).toEqual(predecessor.metadata);
    expect(saved.find(row => String(row.id) === String(neighbor)).status).toBe(status);
    expect(saved.filter(row => row.pending_identity_key === identity.key && row.status === status)).toHaveLength(1);
    const notices = (await query('SELECT id,is_read,read_at FROM app_notifications ORDER BY id')).rows;
    for (const id of [stringNotice, numericNotice, withTime]) expect(notices.find(row => row.id === id).is_read).toBe(true);
    for (const id of [otherNotice, otherKind]) expect(notices.find(row => row.id === id).is_read).toBe(false);
    for (const id of [alreadyRead, withTime]) expect(notices.find(row => row.id === id).read_at).toEqual(priorTime);
  });

test('concurrent large replacements serialize into an exact chain with one current decision', async () => {
  const old = '9007199254740993', first = '9007199254740995', second = '9007199254740997';
  await insert(database, old); await notification(old);
  const forwardLinks = [];
  const callback = id => async (client, predecessors) => {
    const inserted = await insert(client, id, identity.key, 'pending_retry', predecessors);
    const metadata = (await client.query('SELECT metadata FROM classification_history WHERE id=$1', [inserted])).rows[0].metadata;
    forwardLinks.push({ id: inserted, predecessors: metadata.pending_decision_lifecycle.supersedes_classification_ids });
    return inserted;
  };
  const results = await Promise.all([replace(first, { callback: callback(first) }), replace(second, { callback: callback(second) })]);
  const saved = await rows();
  const current = saved.find(row => row.status === 'pending_retry');
  expect(saved.filter(row => row.status === 'pending_retry')).toHaveLength(1);
  expect(results.map(result => result.classificationId).sort()).toEqual([first, second]);
  for (const row of saved.filter(row => row.status === 'reclassified')) {
    const successorId = row.metadata.pending_decision_lifecycle.superseded_by_classification_id;
    expect(typeof successorId).toBe('string');
    expect(forwardLinks.find(link => link.id === successorId).predecessors).toEqual([row.id]);
  }
  expect(current.metadata.pending_decision_lifecycle.state).toBe('current');
  expect(current.metadata.pending_decision_lifecycle.supersedes_classification_ids)
    .toEqual(forwardLinks.find(link => link.id === current.id).predecessors);
});

test.each(['callback failure', 'backlink failure', 'invalid result'])(
  '%s rolls back predecessor, notification and actual inserted row', async kind => {
    const old = '9007199254740993', next = '9007199254740995'; await insert(database, old); const notice = await notification(old);
    const db = { withTransaction: fn => database.withTransaction(client => fn({ query: async (sql, params) => {
      if (kind === 'backlink failure' && sql.includes("'superseded_by_classification_id'")) return client.query('SELECT 1/0');
      return client.query(sql, params);
    } })) };
    const callback = jest.fn(async (client, predecessors) => {
      const id = await insert(client, next, identity.key, 'pending_retry', predecessors);
      if (kind === 'callback failure') await client.query('SELECT 1/0');
      return kind === 'invalid result' ? null : id;
    });
    await expect(replace(next, { db, callback })).rejects.toThrow(); expect(callback).toHaveBeenCalledTimes(1);
    expect((await rows()).map(row => ({ id: row.id, status: row.status, metadata: row.metadata })))
      .toEqual([{ id: old, status: 'pending_retry', metadata: {} }]);
    expect((await query('SELECT is_read FROM app_notifications WHERE id=$1', [notice])).rows[0].is_read).toBe(false);
  });

test.each(['delayed', 'lost'])('real COMMIT with %s acknowledgement preserves one exact replacement without replay', async mode => {
  const old = '9007199254740993', next = '9007199254740995'; await insert(database, old);
  const owner = createReadinessDatabase({ max: 1 }), committed = deferred(), release = deferred(); let spy, execution;
  const callback = jest.fn((client, predecessors) => insert(client, next, identity.key, 'pending_retry', predecessors));
  try {
    const client = await owner.pool.connect(), native = client.query.bind(client);
    spy = jest.spyOn(client, 'query').mockImplementation(async (...args) => {
      const result = await native(...args);
      if (args[0] === 'COMMIT') { committed.resolve(); await release.promise;
        if (mode === 'lost') throw new Error('Owned lost acknowledgement'); }
      return result;
    }); client.release();
    execution = Promise.allSettled([replace(next, { db: owner, callback })]); await committed.promise;
    const durable = await rows();
    expect(durable.find(row => row.id === old).metadata.pending_decision_lifecycle.superseded_by_classification_id).toBe(next);
    expect(durable.find(row => row.id === next).metadata.pending_decision_lifecycle.supersedes_classification_ids).toEqual([old]);
    release.resolve(); const result = (await execution)[0];
    expect(result.status).toBe(mode === 'lost' ? 'rejected' : 'fulfilled');
    if (mode === 'lost') expect(result.reason.message).toBe('Owned lost acknowledgement');
    else expect(result.value.classificationId).toBe(next);
    expect(callback).toHaveBeenCalledTimes(1); expect(spy.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
    expect(await rows()).toEqual(durable);
  } finally { release.resolve(); await execution; spy?.mockRestore(); await owner.pool.end(); }
});

test('late notification creation cannot restore an action on a superseded large row', async () => {
  const old = '9007199254740993', next = '9007199254740995'; await insert(database, old);
  const entered = deferred(), release = deferred(); let execution, notificationResult;
  const native = database.query.bind(database), notificationErrors = [], notificationWrites = [];
  jest.spyOn(database, 'query').mockImplementation(async (sql, params) => {
    const notificationQuery = sql.includes('WITH active_pending_decision AS (');
    try {
      const result = await native(sql, params);
      if (notificationQuery) notificationWrites.push(result.rowCount);
      return result;
    } catch (error) { if (notificationQuery) notificationErrors.push(error); throw error; }
  });
  try {
    execution = replace(next, { callback: async (client, predecessors) => {
      entered.resolve(); await release.promise; return insert(client, next, identity.key, 'pending_retry', predecessors);
    } }); await entered.promise;
    notificationResult = persistence._createAwaitingDecisionNotification(old, 'Owned late notification', 'Owned reason', 'movie');
    let blocked = false;
    const deadline = performance.now() + 5000;
    while (!blocked && performance.now() < deadline) {
      blocked = (await native(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
        WHERE datname=current_database() AND pid<>pg_backend_pid()
          AND query LIKE 'WITH active_pending_decision AS (%'
          AND cardinality(pg_blocking_pids(pid))>0) AS blocked`)).rows[0].blocked;
      if (!blocked) await delay(10);
    }
    expect(blocked).toBe(true);
    release.resolve(); await execution; await notificationResult;
    expect(notificationErrors).toEqual([]); expect(notificationWrites).toEqual([0]);
    expect((await query("SELECT id FROM app_notifications WHERE data->>'classificationId'=$1", [old])).rowCount).toBe(0);
  } finally { release.resolve(); await execution; await notificationResult; }
});

test('real persistence callback keeps generated large IDs and both metadata links exact', async () => {
  const original = (await query('SELECT last_value,is_called FROM classification_history_id_seq')).rows[0];
  try {
    await query("SELECT setval('classification_history_id_seq',9007199254740992,true)");
    const item = { tmdb_id: 884450, media_type: 'movie', title: 'Owned writer replacement' };
    const result = { method: 'fallback', confidence: 50, needs_clarification: true, reason: 'Owned review' };
    const old = await persistence.logClassification(item, result); history.add(String(old));
    const next = await persistence.logClassification(item, result); history.add(String(next));
    expect(old).toBe('9007199254740993'); expect(next).toBe('9007199254740994');
    const saved = await rows();
    expect(saved.find(row => row.id === old).metadata.pending_decision_lifecycle.superseded_by_classification_id).toBe(next);
    expect(saved.find(row => row.id === next).metadata.pending_decision_lifecycle.supersedes_classification_ids).toEqual([old]);
    const notices = (await query('SELECT data,is_read FROM app_notifications ORDER BY id')).rows;
    expect(notices.find(row => row.data.classificationId === old).is_read).toBe(true);
    expect(notices.find(row => row.data.classificationId === next).is_read).toBe(false);
  } finally { await query("SELECT setval('classification_history_id_seq',$1,$2)", [original.last_value, original.is_called]); }
});
