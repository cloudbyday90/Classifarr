/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createQueueIdentityRepairService } from '../../services/queueIdentityRepairService.mjs';
import { createQueueIdentityRepairBackfill } from '../../services/queueIdentityRepairBackfill.mjs';

let db, actorId, provider, manual, backfill, tasks;
beforeEach(async () => {
  db = createIntegrationDatabaseModuleMock(); tasks = [];
  actorId = (await db.query("INSERT INTO users(username,password_hash,role) VALUES ($1,'fixture','admin') RETURNING id", [randomUUID()])).rows[0].id;
  provider = { configured: true, revision: 'a'.repeat(64),
    getDetails: jest.fn(async id => { if (id < 1000) throw { response: { status: 404 } }; return { id, title: `Fixture ${id}` }; }),
    findByExternalId: jest.fn(async id => ({ movie_results: [{ id: Number(id.slice(2)) + 1000 }] })),
    getExternalIds: jest.fn(async id => ({ id, imdb_id: `tt${id - 1000}` })) };
  manual = createQueueIdentityRepairService({ db, readProvider: async () => provider });
  backfill = createQueueIdentityRepairBackfill({ db, readProvider: async () => provider });
});
afterEach(async () => {
  await db.query('DELETE FROM queue_identity_repair_receipts WHERE task_id=ANY($1::bigint[])', [tasks]);
  await db.query('DELETE FROM task_queue WHERE id=ANY($1::bigint[])', [tasks]);
  await db.query('DELETE FROM users WHERE id=$1', [actorId]);
});
async function approved(oldId) {
  const id = (await db.query(`INSERT INTO task_queue(task_type,source,payload,status,current_stage,error_message,attempts)
    VALUES ('classification','manual',$1,'failed','metadata_fetch','task_metadata_not_found',1) RETURNING id`,
  [{ media: { tmdbId: oldId, mediaType: 'movie', imdbId: `tt${oldId}` } }])).rows[0].id;
  tasks.push(id);
  const preview = await manual.preview(actorId, id, {});
  const { receipt } = await manual.confirm(actorId, id, { previewId: preview.previewId, sameWorkAndEdition: true });
  return { taskId: String(id), receiptId: receipt.id };
}
const body = items => ({ items, confirmRetry: true });
const states = async () => (await db.query('SELECT status,attempts,max_attempts FROM task_queue WHERE id=ANY($1::bigint[]) ORDER BY id', [tasks])).rows;
const pending = { status: 'pending', attempts: 1, max_attempts: 5 };
const failed = { ...pending, status: 'failed' };

test('fresh discovery performs no provider I/O or writes', async () => {
  expect(await backfill.list(actorId)).toEqual({ items: [], nextCursor: null, checkedAt: expect.any(Date) });
  expect(provider.getDetails).not.toHaveBeenCalled();
});
test('selected nested repairs enqueue atomically once and retain outcomes across service restart/retention', async () => {
  const items = [await approved(10), await approved(20)];
  provider.getDetails.mockClear(); provider.findByExternalId.mockClear(); provider.getExternalIds.mockClear();
  const listing = await backfill.list(actorId);
  expect(listing.items).toHaveLength(2);
  expect(listing.items[0]).toMatchObject({ ...items[0], oldTmdbId: 10, newTmdbId: 1010, readiness: { status: 'ready', reason: 'ready' } });
  expect(JSON.stringify(listing)).not.toMatch(/payload|provider_revision|api_key/);
  const result = await backfill.run(actorId, body(items));
  expect(result.receipts.every(r => r.retriedAt)).toBe(true);
  expect(await states()).toEqual([pending, pending]);
  expect(await backfill.list(actorId)).toEqual({ items: [], nextCursor: null, checkedAt: expect.any(Date) });
  await db.query('DELETE FROM task_queue WHERE id=ANY($1::bigint[])', [tasks]);
  provider.configured = false;
  const restarted = createQueueIdentityRepairBackfill({ db, readProvider: async () => provider });
  expect(await restarted.run(actorId, body(items))).toEqual(result);
  expect(provider.getDetails).not.toHaveBeenCalled();
  expect(provider.findByExternalId).not.toHaveBeenCalled();
  expect(provider.getExternalIds).not.toHaveBeenCalled();
});
test.each(['task', 'receipt', 'budget', 'provider', 'disabled', 'actor', 'deleted'])('changed %s rolls back every new enqueue', async change => {
  const items = [await approved(10), await approved(20)];
  if (change === 'task') await db.query('UPDATE task_queue SET priority=1 WHERE id=$1', [items[1].taskId]);
  if (change === 'receipt') items[1].receiptId = randomUUID();
  if (change === 'budget') await db.query('UPDATE task_queue SET attempts=5 WHERE id=$1', [items[1].taskId]);
  if (change === 'provider') provider.revision = 'b'.repeat(64);
  if (change === 'disabled') provider.configured = false;
  if (change === 'actor') await db.query('UPDATE users SET is_active=false WHERE id=$1', [actorId]);
  if (change === 'deleted') await db.query('DELETE FROM task_queue WHERE id=$1', [items[1].taskId]);
  await expect(backfill.run(actorId, body(items))).rejects.toMatchObject({ statusCode: change === 'actor' ? 403 : change === 'deleted' ? 404 : 409 });
  expect((await states())[0]).toEqual(failed);
  expect((await db.query('SELECT retried_at FROM queue_identity_repair_receipts WHERE task_id=ANY($1::bigint[])', [tasks])).rows.every(r => r.retried_at === null)).toBe(true);
});
test('unselected approval is not enrolled; manual retry racing batch records only one enqueue', async () => {
  const one = await approved(10); await approved(20);
  const second = createQueueIdentityRepairBackfill({ db, readProvider: async () => provider });
  const result = await Promise.all([
    backfill.run(actorId, body([one])), second.run(actorId, body([one])),
    manual.retry(actorId, one.taskId, { receiptId: one.receiptId }),
  ]);
  expect(result[0].receipts[0]).toEqual(result[1].receipts[0]);
  expect(result[0].receipts[0]).toEqual(result[2].receipt);
  expect(await states()).toEqual([pending, failed]);
});
test.each(['cancel', 'write_failure'])('%s after first receipt update rolls back the whole transaction', async failure => {
  const items = [await approved(10), await approved(20)];
  const controller = new AbortController();
  const wrapped = { ...db, withTransaction: fn => db.withTransaction(tx => fn({ query: async (sql, args) => {
    const result = await tx.query(sql, args);
    if (sql.startsWith('UPDATE queue_identity_repair_receipts')) {
      if (failure === 'cancel') controller.abort();
      else throw new Error('synthetic receipt failure');
    }
    return result;
  } })) };
  const service = createQueueIdentityRepairBackfill({ db: wrapped, readProvider: async () => provider });
  await expect(service.run(actorId, body(items), controller.signal)).rejects.toThrow();
  expect(await states()).toEqual([failed, failed]);
  expect((await manual.receipt(actorId, items[0].taskId)).receipt.retriedAt).toBeNull();
});
test('busy old writer is fenced without resetting attempts', async () => {
  const item = await approved(10);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN'); await client.query('UPDATE task_queue SET priority=3 WHERE id=$1', [item.taskId]);
    await expect(backfill.run(actorId, body([item]))).rejects.toMatchObject({ statusCode: 409 });
  } finally { await client.query('ROLLBACK'); client.release(); }
  expect(await states()).toEqual([failed]);
});
test('five is the maximum atomic group; discovery pages remain bounded and do not imply eligibility', async () => {
  const items = [];
  for (let i = 1; i <= 21; i++) items.push(await approved(i));
  const first = await backfill.list(actorId);
  expect(first.items).toHaveLength(20); expect(first.nextCursor).toBe(items[19].taskId);
  expect((await backfill.list(actorId, { afterId: first.nextCursor })).items).toHaveLength(1);
  await backfill.run(actorId, body(items.slice(0, 5)));
  expect((await states()).filter(s => s.status === 'pending')).toHaveLength(5);
  expect((await states()).filter(s => s.status === 'failed')).toHaveLength(16);
});

test('a mixed batch cannot roll back an earlier saved retry or replay it after a later failure', async () => {
  const items = [await approved(10), await approved(20)];
  const saved = await manual.retry(actorId, items[0].taskId, { receiptId: items[0].receiptId });
  await db.query('UPDATE task_queue SET priority=3 WHERE id=$1', [items[1].taskId]);
  await expect(backfill.run(actorId, body(items))).rejects.toMatchObject({ statusCode: 409 });
  expect(await states()).toEqual([pending, failed]);
  expect(await manual.receipt(actorId, items[0].taskId)).toEqual(saved);
});
test('cancellation after the last item write prevents every newly queued task from committing', async () => {
  const items = [await approved(10), await approved(20)];
  const controller = new AbortController(); let writes = 0;
  const wrapped = { ...db, withTransaction: fn => db.withTransaction(tx => fn({ query: async (sql, args) => {
    const result = await tx.query(sql, args);
    if (sql.startsWith('UPDATE queue_identity_repair_receipts') && ++writes === 2) controller.abort();
    return result;
  } })) };
  await expect(createQueueIdentityRepairBackfill({ db: wrapped, readProvider: async () => provider })
    .run(actorId, body(items), controller.signal)).rejects.toThrow();
  expect(writes).toBe(2); expect(await states()).toEqual([failed, failed]);
});

test.each([
  ['task', 'request_changed'], ['budget', 'retry_budget_exhausted'],
  ['attempt', 'retry_budget_changed'], ['provider', 'provider_changed'],
  ['disabled', 'provider_unconfigured'], ['unsupported', 'request_unsupported'],
  ['identity', 'identity_conflict'], ['invalid', 'identity_invalid'],
  ['stage', 'task_ineligible'], ['competing', 'prior_work'],
])('readiness explains %s without writes or provider requests and agrees with final refusal', async (change, reason) => {
  const item = await approved(10);
  if (change === 'task') await db.query('UPDATE task_queue SET priority=1 WHERE id=$1', [item.taskId]);
  if (change === 'budget') await db.query('UPDATE task_queue SET attempts=5 WHERE id=$1', [item.taskId]);
  if (change === 'attempt') await db.query('UPDATE task_queue SET attempts=2 WHERE id=$1', [item.taskId]);
  if (change === 'provider') provider.revision = 'b'.repeat(64);
  if (change === 'disabled') provider.configured = false;
  if (change === 'unsupported') await db.query(`UPDATE task_queue SET payload=payload||'{"private_context":"secret"}' WHERE id=$1`, [item.taskId]);
  if (change === 'identity') await db.query(`UPDATE task_queue SET payload=payload||'{"tmdb_id":999}' WHERE id=$1`, [item.taskId]);
  if (change === 'invalid') await db.query(`UPDATE task_queue SET payload=payload||'{"tmdb_id":false}' WHERE id=$1`, [item.taskId]);
  if (change === 'stage') await db.query("UPDATE task_queue SET current_stage='classification' WHERE id=$1", [item.taskId]);
  if (change === 'competing') tasks.push((await db.query(`INSERT INTO task_queue(task_type,source,payload,status)
    VALUES ('classification','manual','{"media_type":"movie","tmdbId":1010}','pending') RETURNING id`)).rows[0].id);
  const before = (await db.query('SELECT to_jsonb(t) AS row FROM task_queue t WHERE id=ANY($1::bigint[]) ORDER BY id', [tasks])).rows;
  provider.getDetails.mockClear(); provider.findByExternalId.mockClear(); provider.getExternalIds.mockClear();
  const result = await backfill.list(actorId);
  expect(result.items[0].readiness).toEqual({ status: 'blocked', reason });
  expect(result.checkedAt).toBeInstanceOf(Date);
  expect(JSON.stringify(result)).not.toMatch(/secret|private_context|provider_revision|repaired_version|api_key/);
  await expect(backfill.run(actorId, body([item]))).rejects.toMatchObject({ statusCode: 409 });
  expect((await db.query('SELECT to_jsonb(t) AS row FROM task_queue t WHERE id=ANY($1::bigint[]) ORDER BY id', [tasks])).rows).toEqual(before);
  expect((await manual.receipt(actorId, item.taskId)).receipt.retriedAt).toBeNull();
  expect(provider.getDetails).not.toHaveBeenCalled();
  expect(provider.findByExternalId).not.toHaveBeenCalled();
  expect(provider.getExternalIds).not.toHaveBeenCalled();
});

test('read-only snapshot stays consistent across a concurrent writer but cannot authorize a stale retry', async () => {
  const item = await approved(10);
  let modes;
  const snapshot = createQueueIdentityRepairBackfill({ db, readProvider: async tx => {
    modes = (await tx.query("SELECT current_setting('transaction_read_only') AS readonly, current_setting('transaction_isolation') AS isolation")).rows[0];
    // A separate connection commits while the advisory read is active; no reader row locks.
    await db.query('UPDATE task_queue SET attempts=5 WHERE id=$1', [item.taskId]);
    return provider;
  } });
  expect((await snapshot.list(actorId)).items[0].readiness).toEqual({ status: 'ready', reason: 'ready' });
  expect(modes).toEqual({ readonly: 'on', isolation: 'repeatable read' });
  await expect(backfill.run(actorId, body([item]))).rejects.toMatchObject({ code: 'queue_identity_repair_budget' });
  expect((await backfill.list(actorId)).items[0].readiness.reason).toBe('retry_budget_exhausted');
});

test('unknown database failure aborts the read and read-only mode prevents accidental writes', async () => {
  const item = await approved(10);
  const accidentalWrite = createQueueIdentityRepairBackfill({ db, readProvider: async tx => {
    await tx.query('UPDATE task_queue SET attempts=5 WHERE id=$1', [item.taskId]);
    return provider;
  } });
  await expect(accidentalWrite.list(actorId)).rejects.toMatchObject({ code: '25006' });
  expect(await states()).toEqual([failed]);
  expect((await backfill.list(actorId)).items[0].readiness.reason).toBe('ready');
});

test('readiness cancellation after item assessment returns no partial page and no writes', async () => {
  await approved(10); await approved(20);
  const controller = new AbortController(); let assessments = 0;
  const wrapped = { ...db, withTransaction: fn => db.withTransaction(tx => fn({ query: async (sql, args) => {
    const result = await tx.query(sql, args);
    if (sql.includes('AS blocked')) { assessments++; controller.abort(); }
    return result;
  } })) };
  const service = createQueueIdentityRepairBackfill({ db: wrapped, readProvider: async () => provider });
  await expect(service.list(actorId, {}, controller.signal)).rejects.toThrow();
  expect(assessments).toBe(1); expect(await states()).toEqual([failed, failed]);
});

test('missing configuration blocks readiness; revoked actors and table-lock timeouts fail the read', async () => {
  await approved(10);
  const noProvider = createQueueIdentityRepairBackfill({ db, readProvider: async () => null });
  expect((await noProvider.list(actorId)).items[0].readiness.reason).toBe('provider_unconfigured');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN'); await client.query('LOCK TABLE task_queue IN ACCESS EXCLUSIVE MODE');
    await expect(backfill.list(actorId)).rejects.toMatchObject({ code: '55P03' });
  } finally { await client.query('ROLLBACK'); client.release(); }
  expect((await backfill.list(actorId)).items[0].readiness.reason).toBe('ready');
  await db.query('UPDATE users SET is_active=false WHERE id=$1', [actorId]);
  await expect(backfill.list(actorId)).rejects.toMatchObject({ statusCode: 403 });
});
