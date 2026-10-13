/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createQueueIdentityRepairService } from '../../services/queueIdentityRepairService.mjs';
import { createQueueMetadataRecoveryRepository } from '../../services/queueMetadataRecoveryRepository.mjs';
import { QueueMutationService } from '../../services/queueMutationService.mjs';

let db, actorId, otherActorId, taskId, sourceId, provider, service, extraTasks;
const payload = { tmdb_id: 42, media_type: 'movie', title: 'Original edition', imdb_id: 'tt123' };
beforeEach(async () => {
  db = createIntegrationDatabaseModuleMock(); extraTasks = [];
  const actor = async () => (await db.query("INSERT INTO users(username,password_hash,role) VALUES ($1,'fixture','admin') RETURNING id", [randomUUID()])).rows[0].id;
  actorId = await actor(); otherActorId = await actor();
  sourceId = (await db.query(`INSERT INTO webhook_log(webhook_type,payload,tmdb_id,media_type)
    VALUES ('fixture','{"media":{"imdbId":"tt123"},"private":"not exposed"}',42,'movie') RETURNING id`)).rows[0].id;
  taskId = (await db.query(`INSERT INTO task_queue(task_type,payload,status,current_stage,error_message,attempts,webhook_log_id)
    VALUES ('classification',$1,'failed','metadata_fetch','task_metadata_not_found',1,$2) RETURNING id`, [payload, sourceId])).rows[0].id;
  provider = { configured: true, revision: 'a'.repeat(64),
    getDetails: jest.fn(async id => { if (id === 42) throw { response: { status: 404 } }; return { id, title: 'Candidate edition', overview: 'Verified fixture' }; }),
    findByExternalId: jest.fn().mockResolvedValue({ movie_results: [{ id: 99 }] }),
    getExternalIds: jest.fn().mockResolvedValue({ id: 99, imdb_id: 'tt123' }) };
  service = createQueueIdentityRepairService({ db, readProvider: async () => provider });
});
afterEach(async () => {
  await db.query('DELETE FROM classification_intake_receipts WHERE queue_task_id=$1', [taskId]);
  await db.query('DELETE FROM queue_identity_repair_receipts WHERE task_id=$1', [taskId]);
  await db.query('DELETE FROM task_queue WHERE id=ANY($1::bigint[])', [[taskId, ...extraTasks]]);
  await db.query('DELETE FROM webhook_log WHERE id=$1', [sourceId]);
  await db.query('DELETE FROM users WHERE id=ANY($1::integer[])', [[actorId, otherActorId]]);
});
const readTask = async () => (await db.query('SELECT * FROM task_queue WHERE id=$1', [taskId])).rows[0];
const preview = () => service.preview(actorId, taskId, {});
const confirm = p => service.confirm(actorId, taskId, { previewId: p.previewId, sameWorkAndEdition: true });
const retry = r => service.retry(actorId, taskId, { receiptId: r.id });

test('atomic repair preserves source, budgets and failure; retry is a separate one-time command', async () => {
  await db.query(`INSERT INTO queue_metadata_recovery(task_id,probe_count,last_outcome) VALUES ($1,4,'not_found')`, [taskId]);
  await db.query(`INSERT INTO classification_intake_receipts(queue_task_id,source_class,status_id,queued_at,attempt_count)
    VALUES ($1,'webhook','failed',NOW(),1)`, [taskId]);
  const before = await readTask();
  const source = (await db.query('SELECT * FROM webhook_log WHERE id=$1', [sourceId])).rows[0];
  const ledger = (await db.query('SELECT * FROM queue_metadata_recovery WHERE task_id=$1', [taskId])).rows[0];
  const p = await preview();
  expect(await readTask()).toEqual(before);
  const { receipt } = await confirm(p);
  expect(receipt).toMatchObject({ oldTmdbId: 42, newTmdbId: 99, attempts: 1, retriedAt: null });
  expect(await readTask()).toEqual({ ...before, payload: { ...payload, tmdb_id: 99, identity_repair: receipt.id } });
  expect((await db.query('SELECT * FROM webhook_log WHERE id=$1', [sourceId])).rows[0]).toEqual(source);
  expect((await db.query('SELECT * FROM queue_metadata_recovery WHERE task_id=$1', [taskId])).rows[0]).toEqual(ledger);
  expect((await db.query('SELECT * FROM queue_identity_repair_previews WHERE actor_id=$1', [actorId])).rowCount).toBe(0);
  const calls = provider.getDetails.mock.calls.length;
  expect(await confirm(p)).toEqual({ receipt }); // Lost response / duplicate confirmation.
  expect(await service.receipt(otherActorId, taskId)).toEqual({ receipt });
  expect(provider.getDetails).toHaveBeenCalledTimes(calls);
  const retried = await retry(receipt);
  expect(retried.receipt.retriedAt).not.toBeNull();
  expect(await readTask()).toMatchObject({ status: 'pending', attempts: 1, max_attempts: 5, error_message: null });
  expect((await db.query('SELECT status_id,attempt_count FROM classification_intake_receipts WHERE queue_task_id=$1', [taskId])).rows[0])
    .toEqual({ status_id: 'retry_scheduled', attempt_count: 1 });
  expect(await retry(receipt)).toEqual(retried);
  expect(provider.getDetails).toHaveBeenCalledTimes(calls);
});

test('TV series checks both external IDs, preserves type and does not need a named library', async () => {
  await db.query(`UPDATE task_queue SET payload=$2 WHERE id=$1`, [taskId, { ...payload, media_type: 'tv', tvdb_id: 456 }]);
  await db.query(`UPDATE webhook_log SET media_type='tv',tvdb_id=456 WHERE id=$1`, [sourceId]);
  provider.getDetails.mockImplementation(async id => { if (id === 42) throw { response: { status: 404 } }; return { id, name: 'Series fixture' }; });
  provider.findByExternalId.mockResolvedValue({ tv_results: [{ id: 99 }] });
  provider.getExternalIds.mockResolvedValue({ id: 99, imdb_id: 'tt123', tvdb_id: 456 });
  const { receipt } = await confirm(await preview());
  expect(receipt).toMatchObject({ mediaType: 'tv', sources: ['imdb_id', 'tvdb_id'], candidate: { title: 'Series fixture' } });
  expect(provider.findByExternalId).toHaveBeenCalledTimes(4);
  expect(provider.getDetails).toHaveBeenCalledWith(99, 'tv', expect.any(AbortSignal));
});

test('provider unavailability never stores a preview or changes a task', async () => {
  provider.configured = false;
  await expect(preview()).rejects.toMatchObject({ statusCode: 409 });
  expect(provider.getDetails).not.toHaveBeenCalled();
  expect((await db.query('SELECT id FROM queue_identity_repair_previews WHERE actor_id=$1', [actorId])).rowCount).toBe(0);
  expect((await readTask()).payload).toEqual(payload);
});

test('single-flight admission is released after a failed provider check', async () => {
  let finish, started;
  const entered = new Promise(resolve => { started = resolve; });
  provider.getDetails.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; started(); }));
  const first = preview();
  const failure = expect(first).rejects.toMatchObject({ statusCode: 409 });
  await entered;
  await expect(service.preview(otherActorId, taskId, {})).rejects.toMatchObject({ statusCode: 409 });
  finish({ id: 42, title: 'Original restored' }); await failure;
  expect((await preview()).candidate.tmdbId).toBe(99);
});

test('an intake decision prevents repair even without a linked classification', async () => {
  await db.query(`INSERT INTO classification_intake_receipts(queue_task_id,source_class,status_id,queued_at,attempt_count,decision_context)
    VALUES ($1,'webhook','failed',NOW(),1,'{}')`, [taskId]);
  await expect(preview()).rejects.toMatchObject({ statusCode: 409 });
});

test('separate retry rejects competing work and repeat confirmation cannot change its ID', async () => {
  const p = await preview(); const { receipt } = await confirm(p);
  extraTasks.push((await db.query(`INSERT INTO task_queue(task_type,payload) VALUES ('classification','{"tmdb_id":99,"media_type":"movie"}') RETURNING id`)).rows[0].id);
  await expect(retry(receipt)).rejects.toMatchObject({ statusCode: 409 });
  await expect(service.confirm(actorId, taskId, { previewId: randomUUID(), sameWorkAndEdition: true })).rejects.toMatchObject({ statusCode: 409 });
  expect(await readTask()).toMatchObject({ status: 'failed', attempts: 1 });
});

test('durable receipt survives task/source/actor retention and reports no implicit retry', async () => {
  const { receipt } = await confirm(await preview());
  await db.query('DELETE FROM task_queue WHERE id=$1', [taskId]);
  await db.query('DELETE FROM webhook_log WHERE id=$1', [sourceId]);
  await db.query('DELETE FROM users WHERE id=$1', [actorId]);
  expect((await service.receipt(otherActorId, taskId)).receipt).toEqual(receipt);
  await expect(service.receipt(actorId, taskId)).rejects.toMatchObject({ statusCode: 403 });
});

test('generic single, bulk and automatic recovery cannot retry a repaired task', async () => {
  await confirm(await preview());
  const before = await readTask();
  const mutation = new QueueMutationService({ db, logger: { info: jest.fn(), error: jest.fn() } });
  expect(await mutation.retryTask(taskId)).toMatchObject({ success: false, code: 'invalid_state' });
  expect(await mutation.retryAllFailedTasks()).toMatchObject({ success: true, count: 0 });
  expect(await createQueueMetadataRecoveryRepository(db).claim()).toBeNull();
  expect(await readTask()).toEqual(before);
});

test.each(['task', 'source', 'provider', 'expired', 'rotated', 'actor', 'candidate', 'original_available'])('confirmation rejects %s changed after preview', async change => {
  const p = await preview();
  if (change === 'task') await db.query('UPDATE task_queue SET priority=1 WHERE id=$1', [taskId]);
  if (change === 'source') await db.query("UPDATE webhook_log SET payload='{}' WHERE id=$1", [sourceId]);
  if (change === 'provider') provider.revision = 'b'.repeat(64);
  if (change === 'expired') await db.query("UPDATE queue_identity_repair_previews SET expires_at=clock_timestamp()-interval '1 second' WHERE actor_id=$1", [actorId]);
  if (change === 'rotated') await preview();
  if (change === 'actor') await db.query("UPDATE users SET role='user' WHERE id=$1", [actorId]);
  if (change === 'candidate') provider.getDetails.mockImplementation(async id => { if (id === 42) throw { response: { status: 404 } }; return { id, title: 'Changed edition' }; });
  if (change === 'original_available') provider.getDetails.mockImplementation(async id => ({ id, title: 'Restored' }));
  await expect(confirm(p)).rejects.toMatchObject({ statusCode: change === 'actor' ? 403 : 409 });
  expect((await readTask()).payload).toEqual(payload);
  expect((await db.query('SELECT * FROM queue_identity_repair_receipts WHERE task_id=$1', [taskId])).rowCount).toBe(0);
});

test.each(['task', 'source', 'actor', 'provider'])('rejects %s changing during confirmation provider reads', async change => {
  const p = await preview();
  provider.getExternalIds.mockImplementation(async () => {
    if (change === 'task') await db.query('UPDATE task_queue SET priority=1 WHERE id=$1', [taskId]);
    if (change === 'source') await db.query('DELETE FROM webhook_log WHERE id=$1', [sourceId]);
    if (change === 'actor') await db.query('UPDATE users SET is_active=false WHERE id=$1', [actorId]);
    if (change === 'provider') provider.revision = 'c'.repeat(64);
    return { id: 99, imdb_id: 'tt123' };
  });
  await expect(confirm(p)).rejects.toMatchObject({ statusCode: change === 'actor' ? 403 : 409 });
  expect((await readTask()).payload).toEqual(payload);
});

test.each([42, 99])('rejects a concurrent competing task for typed ID %s', async tmdb_id => {
  const p = await preview();
  const id = (await db.query(`INSERT INTO task_queue(task_type,payload) VALUES ('classification',$1) RETURNING id`,
    [{ tmdb_id, media_type: 'movie' }])).rows[0].id;
  extraTasks.push(id);
  await expect(confirm(p)).rejects.toMatchObject({ statusCode: 409 });
  expect((await readTask()).payload).toEqual(payload);
});

test('another media type is not an identity collision', async () => {
  extraTasks.push((await db.query(`INSERT INTO task_queue(task_type,payload) VALUES ('classification','{"tmdb_id":99,"media_type":"tv"}') RETURNING id`)).rows[0].id);
  expect((await confirm(await preview())).receipt.newTmdbId).toBe(99);
});

test.each([
  { media: { tmdbId: '00099', media_type: ' Movie ' } },
  { mediaType: 'movie', extra: [{ name: 'TMDB ID', value: ' 42 ' }] },
])('recognized legacy/nested competing identity %j blocks repair', async competing => {
  extraTasks.push((await db.query(`INSERT INTO task_queue(task_type,payload) VALUES ('classification',$1) RETURNING id`, [competing])).rows[0].id);
  await expect(preview()).rejects.toMatchObject({ statusCode: 409 });
});

test.each([{ result: {} }, { media: { tmdbId: 42 } }, { itemId: 3 }, { overview: 'cached' }, { extra: [] }])('unsupported payload %j fails before provider reads', async extra => {
  await db.query('UPDATE task_queue SET payload=payload||$2::jsonb WHERE id=$1', [taskId, extra]);
  await expect(preview()).rejects.toMatchObject({ statusCode: 409 });
  expect(provider.getDetails).not.toHaveBeenCalled();
});

test.each([['attempts=5'], ['max_attempts=6'], ["source='reprocess'"], ['classification_recovery_attempts=1']])('blocks exhausted or unsafe state %s', async assignment => {
  // sql-interpolation: assignments come only from the fixed test fixture list above.
  await db.query(`UPDATE task_queue SET ${assignment} WHERE id=$1`, [taskId]);
  await expect(preview()).rejects.toMatchObject({ statusCode: 409 });
  expect(provider.getDetails).not.toHaveBeenCalled();
});

test('two processes confirming different previews produce one repair, not two', async () => {
  const p = await preview();
  const second = createQueueIdentityRepairService({ db, readProvider: async () => provider });
  const q = await second.preview(otherActorId, taskId, {});
  const result = await Promise.allSettled([confirm(p), second.confirm(otherActorId, taskId, { previewId: q.previewId, sameWorkAndEdition: true })]);
  expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect((await db.query('SELECT * FROM queue_identity_repair_receipts WHERE task_id=$1', [taskId])).rowCount).toBe(1);
  expect(await readTask()).toMatchObject({ status: 'failed', attempts: 1 });
});

test('receipt insertion failure rolls back task change and preview consumption', async () => {
  const p = await preview();
  const failingDb = { ...db, withTransaction: fn => db.withTransaction(tx => fn({ query: async (sql, args) => {
    if (sql.includes('INSERT INTO queue_identity_repair_receipts')) throw new Error('synthetic receipt unavailable');
    return tx.query(sql, args);
  } })) };
  const failing = createQueueIdentityRepairService({ db: failingDb, readProvider: async () => provider });
  await expect(failing.confirm(actorId, taskId, { previewId: p.previewId, sameWorkAndEdition: true })).rejects.toThrow('synthetic');
  expect((await readTask()).payload).toEqual(payload);
  expect((await db.query('SELECT id FROM queue_identity_repair_previews WHERE actor_id=$1', [actorId])).rows[0].id).toBe(p.previewId);
});

test('cancellation immediately before commit rolls the real transaction back', async () => {
  const p = await preview();
  const controller = new AbortController();
  const cancellingDb = { ...db, withTransaction: fn => db.withTransaction(tx => fn({ query: async (sql, args) => {
    const result = await tx.query(sql, args);
    if (sql.startsWith('DELETE FROM queue_identity_repair_previews')) controller.abort();
    return result;
  } })) };
  const cancelling = createQueueIdentityRepairService({ db: cancellingDb, readProvider: async () => provider });
  await expect(cancelling.confirm(actorId, taskId, { previewId: p.previewId, sameWorkAndEdition: true }, controller.signal)).rejects.toThrow();
  expect((await readTask()).payload).toEqual(payload);
  expect((await service.receipt(actorId, taskId)).receipt).toBeNull();
});

test('an uncommitted old-writer update is fenced and fails within the lock deadline', async () => {
  const p = await preview();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE task_queue SET priority=2 WHERE id=$1', [taskId]);
    await expect(confirm(p)).rejects.toMatchObject({ statusCode: 409 });
  } finally { await client.query('ROLLBACK'); client.release(); }
  expect((await readTask()).payload).toEqual(payload);
});

test('retry rejects source/task changes without resetting the budget', async () => {
  const { receipt } = await confirm(await preview());
  await db.query('UPDATE webhook_log SET tmdb_id=77 WHERE id=$1', [sourceId]);
  await expect(retry(receipt)).rejects.toMatchObject({ statusCode: 409 });
  expect(await readTask()).toMatchObject({ status: 'failed', attempts: 1 });
  expect((await service.receipt(actorId, taskId)).receipt.retriedAt).toBeNull();
});

test('malformed bodies, unconfirmed edition and other-actor preview cannot authorize a repair', async () => {
  await expect(service.preview(actorId, taskId, { tmdbId: 99 })).rejects.toMatchObject({ statusCode: 400 });
  const p = await preview();
  await expect(service.confirm(actorId, taskId, { previewId: p.previewId, sameWorkAndEdition: false })).rejects.toMatchObject({ statusCode: 400 });
  await expect(service.confirm(otherActorId, taskId, { previewId: p.previewId, sameWorkAndEdition: true })).rejects.toMatchObject({ statusCode: 409 });
  expect((await readTask()).payload).toEqual(payload);
});
