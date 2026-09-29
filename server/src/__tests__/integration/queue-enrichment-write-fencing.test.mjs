/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { jest, beforeEach, afterEach, expect, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createQueueClaimWriteGuard } from '../../services/queueClaimWriteGuard.mjs';
import { createHandoffFixture } from '../helpers/sourceRecoveryHandoffFixture.mjs';
import { QueueOmdbEnrichmentService } from '../../services/queueOmdbEnrichmentService.mjs';
import { QueueTmdbResolutionService } from '../../services/queueTmdbResolutionService.mjs';
import { prepareQueueEnrichmentPayload } from '../../services/queueEnrichmentPayload.mjs';
import { createQueueEnrichmentWriteSession } from '../../services/queueEnrichmentWriteSession.mjs';
import { EnrichmentItemStateService } from '../../services/enrichmentItemStateService.mjs';
import { EnrichmentRetryService } from '../../services/enrichmentRetryService.mjs';

const db = createIntegrationDatabaseModuleMock();
let fixture, task, queue;
beforeEach(async () => {
  fixture = await createHandoffFixture(db, 'movie');
  await fixture.scan();
  queue = fixture.queue();
  await queue.refillQueue();
  task = await fixture.claim(queue);
});
afterEach(async () => { await fixture.cleanup(); });
const expire = () => db.query("UPDATE task_queue SET visible_at=clock_timestamp()-interval '1 second' WHERE id=$1", [task.id]);
const item = async () => (await fixture.inventory())[0];
const guard = () => createQueueClaimWriteGuard(db, task);

test.each(['expired', 'cancelled', 'missing_token', 'replacement'])('%s worker cannot change item data or history', async state => {
  const before = await item();
  if (state === 'expired') await expire();
  if (state === 'cancelled') await db.query("UPDATE task_queue SET status='cancelled' WHERE id=$1", [task.id]);
  if (state === 'replacement') await db.query('UPDATE task_queue SET claim_token=$2 WHERE id=$1', [task.id, randomUUID()]);
  if (state === 'missing_token') task.claim_token = null;
  await expect(queue.queueTaskProcessorService.processMetadataEnrichmentTask(task))
    .rejects.toMatchObject({ reason: 'queue_claim_not_owned' });
  expect(await item()).toEqual(before);
  expect(await fixture.history()).toEqual([]);
  expect(fixture.observationMethod).not.toHaveBeenCalled();
});

test('late provider result cannot replace a successor result or append history', async () => {
  let release, entered;
  const held = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  // Pause before the provider-recovery lease is acquired, leaving B free to finish.
  queue.queueTaskProcessorService.queueWebSearchEnrichmentService.enrich = async (_payload, data) => {
    entered(); await held; data.old_worker = true;
  };
  const late = queue.queueTaskProcessorService.processMetadataEnrichmentTask(task).catch(error => error);
  try {
    await started;
    await expire();
    const replacement = await fixture.claim(queue);
    const current = fixture.queue();
    await current.queueTaskProcessorService.processMetadataEnrichmentTask(replacement);
    const before = await item(), history = await fixture.history(), tasks = await fixture.tasks();
    release();
    expect(await late).toMatchObject({ reason: 'queue_claim_not_owned' });
    expect(await item()).toEqual(before);
    expect(await fixture.history()).toEqual(history);
    expect(await fixture.tasks()).toEqual(tasks);
    expect(history).toHaveLength(1);
  } finally { release(); await late; }
});

test('a provider lease is not stolen when the task claim is replaced; its normal expiry permits backfill', async () => {
  let release, entered;
  const held = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const details = await fixture.observationMethod.getMockImplementation()();
  fixture.observationMethod.mockImplementationOnce(async () => { entered(); await held; return details; });
  const late = queue.queueTaskProcessorService.processMetadataEnrichmentTask(task).catch(error => error);
  try {
    await started;
    const providerLease = (await item()).inventory_tmdb_lease_id;
    expect(providerLease).toBeTruthy();
    await expire();
    const current = fixture.queue();
    await current.queueTaskProcessorService.processMetadataEnrichmentTask(await fixture.claim(current));
    const successor = await item();
    expect(successor.metadata.inventory_tmdb).toBeUndefined();
    expect(successor.inventory_tmdb_lease_id).toBe(providerLease);
    release();
    expect(await late).toMatchObject({ reason: 'queue_claim_not_owned' });
    expect(await item()).toEqual(successor);
    // Advance only this disposable fixture's recovery lease, not production clocks.
    await db.query("UPDATE media_server_items SET inventory_tmdb_lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [successor.id]);
    expect((await current.refillQueue()).queued).toBe(1);
    await current.queueTaskProcessorService.processMetadataEnrichmentTask(await fixture.claim(current));
    expect((await item()).metadata.inventory_tmdb).toMatchObject({ tmdb_id: 22, media_type: 'movie' });
    expect((await item()).inventory_tmdb_lease_id).toBeNull();
    expect(await fixture.history()).toHaveLength(1);
  } finally { release(); await late; }
});

test.each(['rating', 'identity', 'retry'])('late %s persistence is also fenced', async kind => {
  const payload = await prepareQueueEnrichmentPayload(task.payload, (...args) => db.query(...args));
  const before = await item();
  const writes = createQueueEnrichmentWriteSession({ db, task, logger: fixture.log,
    enrichmentItemStateService: new EnrichmentItemStateService({ db, logger: fixture.log }),
    retryService: new EnrichmentRetryService({ db, logger: fixture.log }) });
  await expire();
  const operation = kind === 'rating'
    ? new QueueOmdbEnrichmentService({ logger: fixture.log, queryWithTimeout: writes.query })
      .maybeBackfillRating(before.id, { type: 'movie', rated: 'R' }, 'movie', payload.source_identity_snapshot, 22)
    : kind === 'identity' ? new QueueTmdbResolutionService({ logger: fixture.log, queryWithTimeout: writes.query })
      .backfillTmdbId(before.id, 22, 'movie', payload.source_identity_snapshot)
      : writes.queueRetry(before.id, 'omdb', 'synthetic', 5);
  await expect(operation).rejects.toMatchObject({ reason: 'queue_claim_not_owned' });
  expect(await item()).toEqual(before);
  expect((await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1', [before.id])).rows).toEqual([]);
});

test('history/state failure rolls back metadata, history and completion together', async () => {
  const processor = queue.queueTaskProcessorService;
  const before = await item();
  jest.spyOn(processor.enrichmentItemStateService, 'syncItemState').mockRejectedValue(new Error('synthetic state failure'));
  await expect(processor.processMetadataEnrichmentTask(task)).rejects.toMatchObject({ reason: 'queue_claim_write_failed' });
  const stored = await item();
  expect(stored.metadata).toEqual(before.metadata);
  expect(stored.inventory_tmdb_fetched_at).toBeNull();
  expect(await fixture.history()).toEqual([]);
  expect((await fixture.tasks())[0]).toMatchObject({ status: 'processing', claim_token: task.claim_token });
  expect(fixture.log.info).not.toHaveBeenCalledWith('Task completed', expect.anything());
});

test('expiry during DB work rolls back writes and an escaped transaction cannot write later', async () => {
  await db.query("UPDATE task_queue SET visible_at=clock_timestamp()+interval '200 milliseconds' WHERE id=$1", [task.id]);
  const before = await item(); let escaped;
  await expect(guard().run(async client => {
    escaped = client;
    await client.query("UPDATE media_server_items SET metadata='{}' WHERE id=$1", [before.id]);
    await client.query('SELECT pg_sleep(0.25)');
  })).rejects.toMatchObject({ reason: 'queue_claim_not_owned' });
  expect(await item()).toEqual(before);
  await expect(escaped.query('SELECT 1')).rejects.toMatchObject({ reason: 'queue_claim_not_owned' });
});

test.each(['expiry', 'replacement'])('claim is rechecked after waiting for row lock: %s', async kind => {
  const lock = await getPool().connect(); let pending;
  try {
    if (kind === 'expiry') await db.query("UPDATE task_queue SET visible_at=clock_timestamp()+interval '300 milliseconds' WHERE id=$1", [task.id]);
    await lock.query('BEGIN');
    await lock.query('SELECT id FROM task_queue WHERE id=$1 FOR UPDATE', [task.id]);
    const { rows: [{ pid }] } = await lock.query('SELECT pg_backend_pid() AS pid');
    const work = jest.fn();
    pending = guard().run(work).catch(error => error);
    let waiting = false;
    for (let n = 0; n < 100 && !waiting; n++) {
      waiting = (await db.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS waiting', [pid])).rows[0].waiting;
      if (!waiting) await delay(10);
    }
    expect(waiting).toBe(true);
    if (kind === 'expiry') await lock.query('SELECT pg_sleep(0.35)');
    else await lock.query('UPDATE task_queue SET claim_token=$2 WHERE id=$1', [task.id, randomUUID()]);
    await lock.query('COMMIT');
    expect(await pending).toMatchObject({ reason: 'queue_claim_not_owned' });
    expect(work).not.toHaveBeenCalled();
  } finally { await lock.query('ROLLBACK'); lock.release(); if (pending) await pending; }
});
