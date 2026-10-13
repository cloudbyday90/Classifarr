/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createQueueMetadataRecoveryRepository } from '../../services/queueMetadataRecoveryRepository.mjs';
import { createQueueMetadataRecoveryService } from '../../services/queueMetadataRecoveryService.mjs';

const db = createIntegrationDatabaseModuleMock();
let ids, repository, provider, service;
beforeEach(() => {
  ids = [];
  repository = createQueueMetadataRecoveryRepository(db);
  provider = { configured: true, revision: 'one', getDetails: jest.fn().mockResolvedValue({ id: 424242, title: 'Recovered fixture' }) };
  service = createQueueMetadataRecoveryService({ repository, readProvider: async () => ({ ...provider }) });
});
afterEach(async () => {
  await db.query('DELETE FROM classification_intake_receipts WHERE queue_task_id=ANY($1::bigint[])', [ids]);
  await db.query('DELETE FROM task_queue WHERE id=ANY($1::bigint[])', [ids]);
});
async function seed(patch = {}) {
  const row = { task_type: 'classification', status: 'failed', current_stage: 'metadata_fetch',
    error_message: 'task_metadata_not_found', attempts: 1, max_attempts: 5,
    claim_token: null, routing_classification_id: null, payload: { tmdb_id: 424242, media_type: 'movie' }, ...patch };
  const result = await db.query(`INSERT INTO task_queue(task_type,status,current_stage,error_message,
    attempts,max_attempts,claim_token,routing_classification_id,payload,completed_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING id`,
  [row.task_type,row.status,row.current_stage,row.error_message,row.attempts,row.max_attempts,row.claim_token,row.routing_classification_id,row.payload]);
  const id = result.rows[0].id; ids.push(id); return id;
}
const read = async id => (await db.query('SELECT * FROM task_queue WHERE id=$1', [id])).rows[0];
const ledger = async id => (await db.query('SELECT * FROM queue_metadata_recovery WHERE task_id=$1', [id])).rows[0];
async function due(id) {
  await repository.claim(); // enrollment starts a durable one-hour delay
  await db.query("UPDATE queue_metadata_recovery SET next_probe_at=clock_timestamp()-interval '1 second' WHERE task_id=$1", [id]);
}

test('backfills eligibility only, preserves a durable cooldown across restart, and is idle on a fresh install', async () => {
  expect(await service.run()).toEqual({ state: 'idle', queued: 0 });
  const id = await seed();
  const before = await read(id);
  expect(await repository.claim()).toBeNull();
  const enrolled = await ledger(id);
  expect(enrolled.probe_count).toBe(0);
  expect(enrolled.next_probe_at.getTime()).toBeGreaterThan(Date.now()+3500000);
  const restarted = createQueueMetadataRecoveryRepository(db);
  expect(await restarted.claim()).toBeNull();
  expect(await ledger(id)).toEqual(enrolled);
  expect(await read(id)).toEqual(before);
});
test('requeues once without changing identity or attempt budgets and aligns the intake receipt', async () => {
  const id = await seed();
  await db.query(`INSERT INTO classification_intake_receipts(queue_task_id,source_class,status_id,queued_at,attempt_count)
    VALUES ($1,'other','failed',NOW(),1)`, [id]);
  await due(id);
  const before = await read(id);
  expect(await service.run()).toEqual({ state: 'requeued', queued: 1 });
  const after = await read(id);
  expect(after).toMatchObject({ status: 'pending', attempts: before.attempts, max_attempts: before.max_attempts,
    payload: before.payload, created_at: before.created_at, source: before.source, routing_classification_id: null });
  expect((await ledger(id)).recovered_at).not.toBeNull();
  expect((await db.query('SELECT status_id FROM classification_intake_receipts WHERE queue_task_id=$1', [id])).rows[0].status_id).toBe('retry_scheduled');
  await db.query("UPDATE task_queue SET status='failed',error_message='task_metadata_not_found' WHERE id=$1", [id]);
  await due(id);
  expect(await service.run()).toEqual({ state: 'idle', queued: 0 });
  expect(provider.getDetails).toHaveBeenCalledTimes(1);
});
test('concurrent schedulers cannot claim the same probe; crash retains cooldown and budget', async () => {
  const id = await seed(); await due(id);
  const claims = await Promise.all([repository.claim(), createQueueMetadataRecoveryRepository(db).claim()]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  expect((await ledger(id)).probe_count).toBe(1);
  expect(await createQueueMetadataRecoveryRepository(db).claim()).toBeNull();
  expect((await read(id)).status).toBe('failed');
});
test('six failed probes stop permanently without consuming classification attempts', async () => {
  const id = await seed();
  provider.getDetails.mockRejectedValue({ response: { status: 404 } });
  for (let i=0; i<6; i++) { await due(id); expect((await service.run()).queued).toBe(0); }
  await due(id);
  expect(await service.run()).toEqual({ state: 'idle', queued: 0 });
  expect((await ledger(id)).probe_count).toBe(6);
  expect((await read(id)).attempts).toBe(1);
  expect(provider.getDetails).toHaveBeenCalledTimes(6);
});
test.each([{ attempts: 5 }, { error_message: 'task_processing_failed' }, { error_message: 'task_metadata_fetch_failed' },
  { status: 'processing' }, { claim_token: randomUUID() }, { routing_classification_id: 99 },
  { current_stage: 'decision' }, { payload: { tmdb_id: 424242, media_type: 'movie', result: {} } }])('excludes unsafe state %j', async patch => {
  const id = await seed(patch);
  expect(await repository.claim()).toBeNull();
  expect(await ledger(id)).toBeUndefined();
});
test('newer same-identity task supersedes the old failure', async () => {
  const id = await seed(); await seed({ status: 'pending' });
  expect(await repository.claim()).toBeNull();
  expect(await ledger(id)).toBeUndefined();
});
test('source changes and old leases cannot requeue', async () => {
  const id = await seed(); await due(id);
  const claim = await repository.claim();
  await db.query('UPDATE task_queue SET priority=priority+1 WHERE id=$1', [id]);
  expect(await repository.finish(claim, 'available', async () => true)).toBe(false);
  await due(id); const current = await repository.claim();
  expect(await repository.finish({ ...current, token: randomUUID() }, 'available', async () => true)).toBe(false);
  expect((await read(id)).status).toBe('failed');
});
test('configuration changes and cancellation never admit a retry', async () => {
  const id = await seed(); await due(id);
  const claim = await repository.claim();
  expect(await repository.finish(claim, 'available', async () => false)).toBe(false);
  expect((await ledger(id)).last_outcome).toBe('configuration_changed');
  await due(id);
  const controller = new AbortController();
  provider.getDetails.mockImplementation(async () => { controller.abort(); return { id: 424242, title: 'Late' }; });
  expect((await service.run(controller.signal)).queued).toBe(0);
  expect((await ledger(id)).last_outcome).toBe('cancelled');
  expect((await read(id)).status).toBe('failed');
});
test('transaction failure rolls back both the requeue and completion ledger', async () => {
  const id = await seed(); await due(id);
  const claim = await repository.claim();
  const before = await read(id);
  const failing = createQueueMetadataRecoveryRepository({ ...db, withTransaction: fn => db.withTransaction(async tx => {
    await fn(tx); throw new Error('fixture rollback');
  }) });
  await expect(failing.finish(claim, 'available', async () => true)).rejects.toThrow('fixture rollback');
  expect(await read(id)).toEqual(before);
  expect((await ledger(id)).recovered_at).toBeNull();
});
test('provider Retry-After extends but never shortens a saved cooldown', async () => {
  const id = await seed(); await due(id);
  provider.getDetails.mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '86400' } } });
  await service.run();
  expect((await ledger(id)).next_probe_at.getTime()).toBeGreaterThan(Date.now()+86000000);
  expect((await read(id)).attempts).toBe(1);
});
test('deleting a task removes only its owned recovery ledger', async () => {
  const id = await seed(); await due(id);
  await db.query('DELETE FROM task_queue WHERE id=$1', [id]);
  expect(await ledger(id)).toBeUndefined();
});

test('rerunning the additive migration preserves recovery budgets', async () => {
  const id = await seed(); await due(id);
  await repository.claim();
  const before = await ledger(id);
  const sql = await readFile(new URL('../../../../database/migrations/20261013_180000_queue_metadata_recovery.sql', import.meta.url), 'utf8');
  await db.query(sql);
  expect(await ledger(id)).toEqual(before);
});

test('typed TV recovery uses the same series ID, without converting it to a movie', async () => {
  const id = await seed({ payload: { tmdb_id: 424242, media_type: 'tv' } });
  provider.getDetails.mockResolvedValue({ id: 424242, name: 'TV fixture' });
  await due(id);
  expect((await service.run()).queued).toBe(1);
  expect(provider.getDetails).toHaveBeenCalledWith(424242, 'tv', expect.any(AbortSignal));
  expect((await read(id)).payload).toEqual({ tmdb_id: 424242, media_type: 'tv' });
});
