/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { setTimeout as delay } from 'node:timers/promises';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const db = await import('../../config/database.mjs');
const { QueueService } = await import('../../services/queueService.mjs');
const { releaseQueueClaim } = await import('../../services/queueTaskAcknowledgementService.mjs');
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
const worker = () => new QueueService({ db, logger });

describe('Queue claim fencing against live stale workers', () => {
  beforeEach(async () => { jest.clearAllMocks(); await db.query('DELETE FROM task_queue'); });

  test.each(['complete', 'retry', 'fail'])('late %s cannot overwrite a newer completed claim', async operation => {
    const first = worker(), second = worker();
    const id = await first.enqueue('metadata_enrichment', {});
    const old = await first.dequeue();
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const late = (async () => {
      await held;
      if (operation === 'complete') return first.completeTask(id, { owner: 'old' }, old.claim_token);
      return first.failTask(id, 'task_processing_failed', operation === 'retry' ? 0 : 2, 3, old.claim_token);
    })();
    try {
      // Deterministically expire only the disposable test row, not production timers.
      await db.query("UPDATE task_queue SET visible_at=NOW()-INTERVAL '1 second' WHERE id=$1", [id]);
      const current = await second.dequeue();
      expect(current.id).toBe(id);
      expect(current.claim_token).not.toBe(old.claim_token);
      expect(await second.completeTask(id, { owner: 'current' }, current.claim_token)).toBe(true);
      const before = (await db.query('SELECT * FROM task_queue WHERE id=$1', [id])).rows[0];
      release();
      expect(await late).toBe(false);
      expect((await db.query('SELECT * FROM task_queue WHERE id=$1', [id])).rows[0]).toEqual(before);
    } finally { release(); await late; }
  });

  test('stale completion, failure and requeue cannot change a replacement still processing', async () => {
    const first = worker(), second = worker();
    const id = await first.enqueue('metadata_enrichment', {});
    const old = await first.dequeue();
    await db.query("UPDATE task_queue SET visible_at=NOW()-INTERVAL '1 second' WHERE id=$1", [id]);
    const current = await second.dequeue();
    expect(await first.completeTask(id, {}, old.claim_token)).toBe(false);
    expect(await first.failTask(id, 'task_processing_failed', 0, 3, old.claim_token)).toBe(false);
    expect(await releaseQueueClaim(db, old)).toBe(false);
    expect((await db.query('SELECT * FROM task_queue WHERE id=$1', [id])).rows[0]).toEqual(current);
    expect(await second.completeTask(id, {}, current.claim_token)).toBe(true);
    expect(await second.completeTask(id, { duplicate: true }, current.claim_token)).toBe(false);
  });

  test('missing tokens fail closed, legacy expired work acquires ownership on dequeue', async () => {
    const queue = worker();
    const { rows: [legacy] } = await db.query(`INSERT INTO task_queue(task_type,payload,status,started_at,visible_at)
      VALUES ('metadata_enrichment','{}','processing',NOW()-INTERVAL '20 minutes',NOW()-INTERVAL '10 minutes') RETURNING id`);
    expect(await queue.completeTask(legacy.id, {})).toBe(false);
    expect(await queue.failTask(legacy.id, 'task_processing_failed', 0, 3)).toBe(false);
    const owned = await queue.dequeue();
    expect(owned.claim_token).toMatch(/^[0-9a-f-]{36}$/);
    expect(await queue.completeTask(owned.id, {}, owned.claim_token)).toBe(true);
  });

  test('current late acknowledgement is accepted before reclamation, cancellation invalidates it', async () => {
    const queue = worker();
    await queue.enqueue('metadata_enrichment', {});
    const owned = await queue.dequeue();
    await db.query("UPDATE task_queue SET visible_at=NOW()-INTERVAL '1 second' WHERE id=$1", [owned.id]);
    expect(await queue.completeTask(owned.id, {}, owned.claim_token)).toBe(true);
    await queue.enqueue('metadata_enrichment', {});
    const cancelled = await queue.dequeue();
    await db.query("UPDATE task_queue SET status='cancelled' WHERE id=$1", [cancelled.id]);
    expect(await queue.completeTask(cancelled.id, {}, cancelled.claim_token)).toBe(false);
    expect(await queue.failTask(cancelled.id, 'task_processing_failed', 0, 3, cancelled.claim_token)).toBe(false);
  });

  test('failure uses stored attempts and preserves retry schedule and terminal budget', async () => {
    const queue = worker();
    await queue.enqueue('metadata_enrichment', {}, { maxAttempts: 2 });
    const owned = await queue.dequeue();
    expect(await queue.failTask(owned.id, 'private details', 999, 999, owned.claim_token)).toBe(true);
    const retry = (await db.query('SELECT *, extract(epoch FROM next_retry_at-NOW()) AS delay FROM task_queue WHERE id=$1', [owned.id])).rows[0];
    expect(retry).toMatchObject({ status: 'pending', attempts: 1, claim_token: null, visible_at: null, error_message: 'task_processing_failed' });
    expect(Number(retry.delay)).toBeGreaterThan(28);
    expect(Number(retry.delay)).toBeLessThanOrEqual(30);
    await db.query('UPDATE task_queue SET next_retry_at=NOW() WHERE id=$1', [owned.id]);
    const last = await queue.dequeue();
    expect(last.claim_token).not.toBe(owned.claim_token);
    expect(await queue.failTask(last.id, 'private', 0, 999, last.claim_token)).toBe(true);
    expect((await db.query('SELECT status,attempts,claim_token FROM task_queue WHERE id=$1', [last.id])).rows[0])
      .toEqual({ status: 'failed', attempts: 2, claim_token: null });
  });

  test('shutdown releases only locally tracked current claims, never a successor or another instance', async () => {
    const first = worker(), second = worker();
    await first.enqueue('metadata_enrichment', {});
    await first.enqueue('metadata_enrichment', {});
    const old = await first.dequeue(), unrelated = await second.dequeue();
    first.queueWorkerLoopService.activeClaims.add(old);
    await db.query("UPDATE task_queue SET visible_at=NOW()-INTERVAL '1 second' WHERE id=$1", [old.id]);
    const successor = await second.dequeue();
    await first.gracefulShutdown();
    expect((await db.query("SELECT count(*)::integer AS n FROM task_queue WHERE status='processing'")).rows[0].n).toBe(2);
    second.queueWorkerLoopService.activeClaims.add(successor);
    await second.gracefulShutdown();
    expect((await db.query('SELECT status,claim_token FROM task_queue WHERE id=$1', [successor.id])).rows[0])
      .toEqual({ status: 'pending', claim_token: null });
    expect((await db.query('SELECT status,claim_token FROM task_queue WHERE id=$1', [unrelated.id])).rows[0])
      .toEqual({ status: 'processing', claim_token: unrelated.claim_token });
  });

  test('a stale UPDATE already waiting on the row lock rechecks ownership after successor commit', async () => {
    const first = worker();
    await first.enqueue('metadata_enrichment', {});
    const old = await first.dequeue();
    await db.query("UPDATE task_queue SET visible_at=NOW()-INTERVAL '1 second' WHERE id=$1", [old.id]);
    const client = await db.pool.connect();
    let late;
    try {
      await client.query('BEGIN');
      const { rows: [{ pid }] } = await client.query('SELECT pg_backend_pid() AS pid');
      const second = new QueueService({ db: { query: (...args) => client.query(...args) }, logger });
      const current = await second.dequeue();
      late = first.completeTask(old.id, { owner: 'stale' }, old.claim_token);
      let waiting = false;
      for (let count = 0; count < 100 && !waiting; count++) {
        waiting = (await db.query(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
          WHERE $1=ANY(pg_blocking_pids(pid))) AS waiting`, [pid])).rows[0].waiting;
        if (!waiting) await delay(10);
      }
      expect(waiting).toBe(true);
      await client.query('COMMIT');
      expect(await late).toBe(false);
      expect((await db.query('SELECT * FROM task_queue WHERE id=$1', [old.id])).rows[0]).toEqual(current);
    } finally {
      await client.query('ROLLBACK');
      client.release();
      if (late) await late;
    }
  });
});
