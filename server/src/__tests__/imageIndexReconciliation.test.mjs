/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { reconcileImageIndexes } from '../services/imageIndexReconciliation.mjs';
import { registerImageIndexReconciliationSchedule } from '../services/imageIndexReconciliationScheduler.mjs';
import { admitAutomaticImageIndexAttempt } from '../services/imageIndexAutomaticAdmission.mjs';
import { IMAGE_INDEXES } from '../services/imageIndexMaintenanceContract.mjs';

const catalog = () => IMAGE_INDEXES.map(index => ({ ...index, method: index.accessMethod, relkind: 'i', expected_table: true,
  valid: true, ready: true, live: true, special: false, expressions: false, keys_only: true,
  constrained: false, default_order: true, default_collation: true }));
function fixture(options = {}) {
  const o = { rows: catalog(), config: { rag_enabled: true, rag_image_weight: 0.5,
    image_embedding_provider_mode: 'separate_local', local_configured: true }, available: true,
    gate: 'ready', readiness: 'ready', state: null, active: null, ...options };
  const query = jest.fn(async (sql, params) => {
    if (sql.includes('pg_try_advisory')) return { rows: [{ acquired: params[0] !== o.deniedLock }] };
    if (sql.startsWith('SELECT gate_state')) return { rows: [{ gate_state: o.gate }] };
    if (sql.startsWith('SELECT rag_enabled')) return { rows: o.config ? [o.config] : [] };
    if (sql.startsWith('SELECT to_regtype')) return { rows: [{ available: o.available }] };
    if (sql.includes('FROM pg_class c')) return { rows: o.rows };
    if (sql.startsWith('SELECT id FROM')) return { rows: o.active ? [o.active] : [] };
    if (sql.startsWith('SELECT * FROM') || sql.startsWith('SELECT task_id')) return { rows: o.state ? [o.state] : [] };
    if (sql.startsWith('WITH active_libraries')) return { rows: [{ readiness: o.readiness }] };
    if (sql.startsWith('INSERT INTO public.task_queue')) return { rows: [{ id: 17 }] };
    if (sql.startsWith('SELECT source')) return { rows: [{ source: o.source }] };
    if (sql.startsWith('SELECT EXTRACT')) return { rows: [{ remaining: o.remaining ?? 150000 }] };
    return { rows: [] };
  });
  const client = Object.assign(new EventEmitter(), { query, release: jest.fn() });
  const database = { pool: { connect: jest.fn(async () => client) } };
  return { o, query, client, database, run: () => reconcileImageIndexes({ database }) };
}
const writes = f => f.query.mock.calls.filter(([sql]) => /^(INSERT|UPDATE|CREATE|DROP)/.test(sql));

test.each([null, { rag_enabled: false, rag_image_weight: 1 }, { rag_enabled: true, rag_image_weight: 0 },
  { rag_enabled: true, rag_image_weight: -1 }, { rag_enabled: true, rag_image_weight: 'NaN' }])('disabled demand %j is read-only and skips catalogs', async config => {
  const f = fixture({ config });
  await expect(f.run()).resolves.toEqual({ status: 'idle', reason: 'disabled' });
  expect(writes(f)).toEqual([]);
  expect(f.query.mock.calls.some(([sql]) => sql.includes('FROM pg_class c'))).toBe(false);
});
test.each(['cloud', 'separate_local', 'local'])('unconfigured %s provider never starts repair', async mode => {
  const f = fixture({ config: { rag_enabled: true, rag_image_weight: 1, image_embedding_provider_mode: mode } });
  expect((await f.run()).reason).toBe('not_configured'); expect(writes(f)).toEqual([]);
  f.o.config.local_configured = true; f.o.config.cloud_configured = true;
  expect((await f.run()).reason).toBe('healthy');
});
test.each([
  [{ deniedLock: 2024 }, 'runtime_or_restore_active'], [{ deniedLock: 2026 }, 'maintenance_busy'],
  [{ gate: 'requires_maintenance' }, 'restore_verification_required'], [{ available: false }, 'schema_unavailable'],
  [{ rows: [{ ...catalog()[0], relkind: 'r' }] }, 'definition_mismatch'],
])('refuses unavailable or unexpected state %j', async (options, reason) => {
  const f = fixture(options);
  await expect(f.run()).resolves.toMatchObject({ reason }); expect(writes(f)).toEqual([]);
});
test('healthy steady state has no writes, DDL, readiness scan or retained session', async () => {
  const f = fixture(); await expect(f.run()).resolves.toEqual({ status: 'idle', reason: 'healthy' });
  expect(writes(f)).toEqual([]);
  expect(f.query.mock.calls.some(([sql]) => sql.startsWith('WITH'))).toBe(false);
  expect(f.client.release.mock.calls).toEqual([[true]]);
});
test('verified healthy state resets an old episode, without erasing its cooldown', async () => {
  const f = fixture({ state: { task_id: 4, attempts: 3 } }); await f.run();
  expect(writes(f)).toHaveLength(1); expect(writes(f)[0][0]).not.toContain('next_attempt_at');
});
test.each(['waiting_for_libraries', 'waiting_for_inventory', 'ingesting', 'backfilling', undefined])('missing indexes wait for %s', async readiness => {
  const f = fixture({ rows: [], readiness });
  await expect(f.run()).resolves.toMatchObject({ status: 'deferred', reason: readiness ?? 'unavailable' });
  expect(writes(f)).toEqual([]);
});
test('active work deduplicates and a pruned task never resets an unresolved episode', async () => {
  const f = fixture({ rows: [], active: { id: 11 } });
  await expect(f.run()).resolves.toMatchObject({ status: 'queued', taskId: 11 });
  f.o.active = null; f.o.state = { task_id: 11, attempts: 1 };
  await expect(f.run()).resolves.toMatchObject({ status: 'review', reason: 'repair_unverified' });
  expect(writes(f)).toEqual([]);
});
test('one fixed queue job and durable episode commit together', async () => {
  const rows = catalog(); rows.pop(); rows[0].valid = false;
  const f = fixture({ rows });
  await expect(f.run()).resolves.toMatchObject({ status: 'queued', taskId: 17, missing: 1, invalid: 1 });
  expect(writes(f)).toHaveLength(2);
  expect(writes(f)[0][0]).toContain("'image_index_reconciliation', 1, 3");
  expect(f.query.mock.calls.at(-1)[0]).toBe('COMMIT');
});
test.each(['ledger', 'connection'])('failure at %s discards uncommitted transaction', async kind => {
  const f = fixture({ rows: [] }), original = f.query.getMockImplementation();
  f.query.mockImplementation(async (sql, params) => {
    if (sql.startsWith('INSERT INTO public.image_index')) {
      if (kind === 'connection') f.client.emit('error', new Error('lost'));
      else throw new Error('lost');
    }
    return original(sql, params);
  });
  await expect(f.run()).rejects.toThrow('lost');
  expect(f.query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
  expect(f.client.release.mock.calls).toEqual([[true]]);
});
test('deadline discards a stuck session without committing after it returns', async () => {
  jest.useFakeTimers();
  try {
    const f = fixture(); let unblock;
    f.query.mockImplementationOnce(() => new Promise(resolve => { unblock = resolve; }));
    const work = f.run(), rejected = expect(work).rejects.toThrow('image_index_reconciliation_deadline');
    await jest.advanceTimersByTimeAsync(10000); unblock({ rows: [] }); await rejected;
    expect(f.client.release.mock.calls).toEqual([[true]]); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

const task = { id: 17, claim_token: '11111111-1111-4111-8111-111111111111' };
test('manual jobs retain existing admission and no automatic budget', async () => {
  const f = fixture(); await expect(admitAutomaticImageIndexAttempt(f.query, task)).resolves.toEqual({ status: 'manual' });
  expect(f.query).toHaveBeenCalledTimes(1);
});
test.each([
  [{ state: { task_id: 17, attempts: 0, cooling_down: false } }, 'admitted'],
  [{ state: { task_id: 17, attempts: 2, cooling_down: true } }, 'deferred'],
  [{ state: { task_id: 17, attempts: 3 } }, 'review'], [{ state: { task_id: 18, attempts: 0 } }, 'review'],
  [{ state: null }, 'review'], [{ readiness: 'backfilling' }, 'deferred'], [{ config: null }, 'deferred'],
])('automatic admission rechecks conditions %j', async (options, status) => {
  const f = fixture({ source: 'image_index_reconciliation', ...options });
  await expect(admitAutomaticImageIndexAttempt(f.query, task)).resolves.toMatchObject({ status });
  expect(writes(f)).toHaveLength(status === 'admitted' ? 1 : 0);
  if (f.o.config) expect(f.query.mock.calls.find(([sql]) => sql.startsWith('WITH'))[1]).toEqual([17]);
});
test('claim loss rolls back budget reservation', async () => {
  const f = fixture({ source: 'image_index_reconciliation', remaining: 0 });
  await expect(admitAutomaticImageIndexAttempt(f.query, task)).rejects.toThrow('queue_claim_not_owned');
  expect(f.query).toHaveBeenLastCalledWith('ROLLBACK'); expect(writes(f)).toEqual([]);
});
test('scheduler coalesces initial/cron calls and logs transitions without raw errors', async () => {
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() }, log = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  let resolve; const run = jest.fn(() => new Promise(done => { resolve = done; }));
  registerImageIndexReconciliationSchedule(scheduler, { run, db: {}, log });
  const handler = scheduler.schedule.mock.calls[0][2];
  expect(scheduler.scheduleInitial.mock.calls[0]).toEqual(['image-index-reconciliation', 600000, handler]);
  const first = handler(); expect(handler()).toBe(first); resolve({ status: 'queued', reason: 'repair_needed' }); await first;
  run.mockResolvedValue({ status: 'queued', reason: 'repair_needed' }); await handler(); expect(log.info).toHaveBeenCalledTimes(1);
  run.mockResolvedValue({ status: 'idle', reason: 'healthy' }); await handler(); expect(log.info).toHaveBeenCalledTimes(2);
  run.mockResolvedValue({ status: 'deferred', reason: 'ingesting' }); await handler(); expect(log.debug).toHaveBeenCalledTimes(1);
  run.mockRejectedValue(new Error('secret')); await handler(); await handler(); expect(log.warn).toHaveBeenCalledTimes(1);
  run.mockResolvedValue({ status: 'review', reason: 'repair_unverified' }); await handler(); expect(log.warn).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(log.warn.mock.calls)).not.toContain('secret');
});
