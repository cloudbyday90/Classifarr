/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const db = await import('../../config/database.mjs');
const { QueuedRoutingReplayGuard } = await import('../../services/queuedRoutingReplayGuard.mjs');
const { releaseQueueClaim, completeQueueClaim } = await import('../../services/queueTaskAcknowledgementService.mjs');
let task, historyId, libraryId;
const guard = () => new QueuedRoutingReplayGuard({ db });
const readTask = async () => (await getPool().query('SELECT * FROM task_queue WHERE id=$1', [task.id])).rows[0];
beforeEach(async () => {
  libraryId = (await getPool().query(`INSERT INTO libraries(name,external_id,media_type)
    VALUES('Queued routing fixture','queued-routing','movie') RETURNING id`)).rows[0].id;
  historyId = (await getPool().query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,library_name,method,status,metadata)
    VALUES(42,'movie','Fixture',$1,'Queued routing fixture','policy_auto','completed',
      '{"classification_details":{"evidence":"preserved"}}') RETURNING id`, [libraryId])).rows[0].id;
  task = (await getPool().query(`INSERT INTO task_queue(task_type,payload,status,claim_token,visible_at)
    VALUES('classification','{}','processing',$1,NOW()+INTERVAL '10 minutes') RETURNING *`, [randomUUID()])).rows[0];
});
afterEach(async () => {
  await getPool().query('DELETE FROM task_queue WHERE id=$1', [task.id]);
  await getPool().query('DELETE FROM classification_history WHERE id=$1', [historyId]);
  await getPool().query('DELETE FROM libraries WHERE id=$1', [libraryId]);
});

test('fresh command admits once; a fresh guard returns uncertainty without modifying the original decision', async () => {
  expect(await guard().read(task)).toBeNull();
  await guard().admit(task, historyId);
  await expect(guard().admit(task, historyId)).rejects.toThrow('already_admitted');
  expect(await guard().read(task)).toMatchObject({ classification_id: historyId, method: 'policy_auto',
    routingOutcome: { routeResult: { routed: false, reason: 'automatic_routing_unconfirmed' } } });
  const { rows: [history] } = await getPool().query('SELECT status,metadata FROM classification_history WHERE id=$1', [historyId]);
  expect(history).toEqual({ status: 'completed', metadata: { classification_details: {
    evidence: 'preserved', routing: 'automatic_routing_pending',
  } } });
});

test('concurrent admission commits exactly one marker', async () => {
  const results = await Promise.allSettled([guard().admit(task, historyId), guard().admit(task, historyId)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await readTask()).routing_classification_id).toBe(historyId);
});

test.each(['missing-token', 'wrong-token', 'expired', 'cancelled', 'wrong-type'])('%s claim cannot read or admit', async kind => {
  if (kind === 'missing-token') task.claim_token = null;
  if (kind === 'wrong-token') task.claim_token = randomUUID();
  if (kind === 'expired') await getPool().query("UPDATE task_queue SET visible_at=NOW()-INTERVAL '1 second' WHERE id=$1", [task.id]);
  if (kind === 'cancelled') await getPool().query("UPDATE task_queue SET status='cancelled' WHERE id=$1", [task.id]);
  if (kind === 'wrong-type') await getPool().query("UPDATE task_queue SET task_type='metadata_enrichment' WHERE id=$1", [task.id]);
  await expect(guard().read(task)).rejects.toThrow('claim_not_owned');
  await expect(guard().admit(task, historyId)).rejects.toThrow('claim_not_owned');
  expect((await readTask()).routing_classification_id).toBeNull();
});

test('marker survives release and a new claim; old claim cannot acknowledge', async () => {
  await guard().admit(task, historyId);
  expect(await releaseQueueClaim(db, task)).toBe(true);
  await getPool().query(`UPDATE task_queue SET status='processing',claim_token=$2,
    visible_at=NOW()+INTERVAL '10 minutes' WHERE id=$1`, [task.id, randomUUID()]);
  const next = await readTask();
  await expect(guard().read(task)).rejects.toThrow('claim_not_owned');
  expect(await completeQueueClaim(db.query, task.id, {}, task.claim_token)).toBeNull();
  expect(await guard().read(next)).toMatchObject({ classification_id: historyId, recovered: true });
  await expect(guard().admit(next, historyId)).rejects.toThrow('already_admitted');
});

test('missing or changed classification rolls back admission', async () => {
  await getPool().query("UPDATE classification_history SET status='failed' WHERE id=$1", [historyId]);
  await expect(guard().admit(task, historyId)).rejects.toThrow('classification_unavailable');
  expect((await readTask()).routing_classification_id).toBeNull();
});

test('transaction failure after updating history leaves neither marker nor pending status', async () => {
  const failing = new QueuedRoutingReplayGuard({ db: { withTransaction: work => db.withTransaction(client => work({
    query: (sql, values) => sql.startsWith('UPDATE task_queue SET routing_classification_id')
      ? Promise.reject(new Error('injected_commit_boundary')) : client.query(sql, values),
  })) } });
  await expect(failing.admit(task, historyId)).rejects.toThrow('injected_commit_boundary');
  expect((await readTask()).routing_classification_id).toBeNull();
  const { rows: [history] } = await getPool().query('SELECT metadata FROM classification_history WHERE id=$1', [historyId]);
  expect(history.metadata.classification_details).toEqual({ evidence: 'preserved' });
});

test('history retention does not reopen a command', async () => {
  await guard().admit(task, historyId);
  await getPool().query('DELETE FROM classification_history WHERE id=$1', [historyId]);
  expect(await guard().read(task)).toMatchObject({ classification_id: historyId, method: null,
    routingOutcome: { routeResult: { routed: false, reason: 'automatic_routing_unconfirmed' } } });
  await expect(guard().admit(task, historyId)).rejects.toThrow('already_admitted');
});

test.each([['routed', 'routed', true], ['completed', 'routed', false], ['routed', 'automatic_routing_pending', false],
  ['corrected', 'routed', false]])('saved status %s and routing %s recover routed=%s', async (status, routing, routed) => {
  await guard().admit(task, historyId);
  await getPool().query(`UPDATE classification_history SET status=$2,
    metadata=jsonb_set(metadata,'{classification_details,routing}',to_jsonb($3::text)) WHERE id=$1`, [historyId, status, routing]);
  expect((await guard().read(task)).routingOutcome.routeResult.routed).toBe(routed);
});

test('deadline is checked after a contended row lock, not before waiting', async () => {
  const blocker = await getPool().connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM task_queue WHERE id=$1 FOR UPDATE', [task.id]);
    const pending = guard().admit(task, historyId);
    const assertion = expect(pending).rejects.toThrow('claim_not_owned');
    await blocker.query("UPDATE task_queue SET visible_at=NOW()-INTERVAL '1 second' WHERE id=$1", [task.id]);
    await blocker.query('COMMIT');
    await assertion;
    expect((await readTask()).routing_classification_id).toBeNull();
  } finally { await blocker.query('ROLLBACK'); blocker.release(); }
});
