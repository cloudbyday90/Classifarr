/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { createDatabaseClientLease } from '../../utils/databaseClientLease.mjs';
const fallback = jest.fn();
jest.unstable_mockModule('../../config/database.mjs', () => ({ query: fallback, withTransaction: fallback }));
jest.unstable_mockModule('../../services/contentTypeAnalyzer.mjs', () => ({ contentTypeAnalyzer: { analyze: jest.fn() } }));
const { withMediaSyncDatabase } = await import('../../services/mediaSyncDatabaseScope.mjs');
const { MediaSourceObservationStore } = await import('../../services/mediaSourceObservationStore.mjs');
const { snapshotSourceCapture } = await import('../../services/mediaSourceCaptureContext.mjs');
const recovery = await import('../../services/mediaSyncIdentityRecoveryPersistence.mjs');
const { recordSyncIdentityRecoveryOutcome, createSyncIdentityOutcomeRecorder } = await import('../../services/mediaSyncIdentityRecoveryOutcomes.mjs');

const context = () => ({ libraryId: 1, mediaServerId: 2, generation: '3' });
const item = { external_id: 'synthetic', media_type: 'movie', tmdb_id: 11,
  source_identity_evidence: { snapshotDigest: 'a'.repeat(64) } };
function fixture() {
  const client = Object.assign(new EventEmitter(), { query: jest.fn().mockResolvedValue({
    rows: [{ generation: '3', mode: 'full', uncapturable_count: 0 }], rowCount: 1,
  }), release: jest.fn() });
  return { client, lease: createDatabaseClientLease(client, {}) };
}
const operations = {
  start: store => store.start(2, 1, { source: 'local_capture' }),
  page: store => store.capture(context(), [item]),
  callback: (store, fn) => store.withCurrentCapture(context(), fn),
  finish: store => store.finish(context()),
};

test.each(Object.keys(operations))('%s rejects an unowned call despite an injected adapter', async name => {
  const adapter = { query: jest.fn(), withTransaction: jest.fn(), isOwned: () => true };
  const fn = jest.fn();
  await expect(operations[name](new MediaSourceObservationStore(adapter), fn)).rejects.toThrow('ingestion_ownership_required');
  expect(adapter.query).not.toHaveBeenCalled();
  expect(adapter.withTransaction).not.toHaveBeenCalled();
  expect(fn).not.toHaveBeenCalled();
  expect(fallback).not.toHaveBeenCalled();
});

test.each(['wrong-library', 'closed', 'disconnected'])('%s owner cannot create, page, complete, or invoke recovery callbacks', async state => {
  const { client, lease } = fixture();
  const resume = Promise.withResolvers(), fn = jest.fn();
  let pending;
  await withMediaSyncDatabase(client, lease, async () => {
    pending = resume.promise.then(() => Promise.allSettled(Object.values(operations)
      .map(run => run(new MediaSourceObservationStore(), fn))));
    if (state !== 'closed') {
      if (state === 'disconnected') client.emit('error', new Error('lost-fixture-owner'));
      resume.resolve();
      await pending;
    }
  }, state === 'wrong-library' ? 9 : 1);
  resume.resolve();
  for (const result of await pending) expect(result).toMatchObject({ status: 'rejected', reason: { message:
    state === 'wrong-library' ? 'ingestion_library_scope_mismatch' : state === 'closed' ? 'ingestion_scope_closed' : 'lost-fixture-owner',
  } });
  expect(fn).not.toHaveBeenCalled();
  expect(client.query).not.toHaveBeenCalled();
  expect(fallback).not.toHaveBeenCalled();
  lease.release();
});

test('a full lifecycle uses only the owner connection and returns immutable coordinates', async () => {
  const { client, lease } = fixture();
  const adapter = { withTransaction: jest.fn() }, fn = jest.fn();
  const store = new MediaSourceObservationStore(adapter);
  await withMediaSyncDatabase(client, lease, async () => {
    const capture = await store.start(2, 1);
    expect(capture).toEqual(context());
    expect(Object.isFrozen(capture)).toBe(true);
    expect(await store.capture(capture, [item])).toBe(true);
    expect(await store.withCurrentCapture(capture, fn)).toBe(true);
    expect(await store.finish(capture)).toBe(true);
  }, 1);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(client.query.mock.calls.filter(([sql]) => sql === 'BEGIN')).toHaveLength(4);
  expect(client.query.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(4);
  expect(adapter.withTransaction).not.toHaveBeenCalled();
  expect(fallback).not.toHaveBeenCalled();
});

test.each(['page', 'callback'])('%s snapshots coordinates before asynchronous transaction entry', async name => {
  const { client, lease } = fixture(), begin = Promise.withResolvers();
  client.query.mockImplementationOnce(() => begin.promise);
  const capture = context(), fn = jest.fn();
  await withMediaSyncDatabase(client, lease, async () => {
    const store = new MediaSourceObservationStore();
    const pending = name === 'page' ? store.capture(capture, [item]) : store.withCurrentCapture(capture, fn);
    Object.assign(capture, { libraryId: 9, mediaServerId: 8, generation: '7' });
    begin.resolve({ rows: [] });
    expect(await pending).toBe(true);
  }, 1);
  const params = client.query.mock.calls.filter(([, values]) => values).map(([, values]) => values);
  expect(params[0]).toEqual([1, 2, '3']);
  expect(params.every(values => values[0] === 1)).toBe(true);
});

test('stale captures skip the callback and page writes', async () => {
  const { client, lease } = fixture(), fn = jest.fn();
  client.query.mockResolvedValue({ rows: [], rowCount: 0 });
  await withMediaSyncDatabase(client, lease, async () => {
    const store = new MediaSourceObservationStore();
    expect(await store.capture(context(), [item])).toBe(false);
    expect(await store.withCurrentCapture(context(), fn)).toBe(false);
  }, 1);
  expect(fn).not.toHaveBeenCalled();
  expect(client.query.mock.calls.every(([sql]) => ['BEGIN', 'COMMIT'].includes(sql) || sql.startsWith('SELECT'))).toBe(true);
});

test.each(['receipt', 'priority', 'claim', 'outcome', 'recorder'])('%s recovery closure cannot be retargeted while waiting', async operation => {
  const capture = context(), wait = Promise.withResolvers();
  const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const store = { withCurrentCapture: jest.fn(async (_capture, fn) => { await wait.promise; await fn({ query }); }) };
  const calls = {
    receipt: () => recovery.readSyncIdentityRecoveryReceipt(store, capture, item),
    priority: () => recovery.readSyncIdentityRecoveryPriority(store, capture, item),
    claim: () => recovery.claimSyncIdentityRecovery(store, capture, item),
    outcome: () => recordSyncIdentityRecoveryOutcome(store, capture, item, { reason: 'source_changed' }),
    recorder: () => {
      const record = createSyncIdentityOutcomeRecorder(store, capture, { warn: jest.fn() });
      capture.libraryId = 10;
      return record(item, { reason: 'source_changed' });
    },
  };
  const pending = calls[operation]();
  Object.assign(capture, { libraryId: 9, mediaServerId: 8, generation: '7' });
  wait.resolve(); await pending;
  expect(store.withCurrentCapture.mock.calls[0][0]).toEqual(context());
  expect(query.mock.calls[0][1].slice(0, 2)).toEqual([1, 2]);
});

test('repaired inventory snapshots coordinates before content analysis', async () => {
  const capture = context(), wait = Promise.withResolvers();
  const store = { withCurrentCapture: jest.fn().mockResolvedValue(false) };
  const pending = recovery.persistRecoveredSyncItem(store, capture, { item, receipt: {} }, { analyze: () => wait.promise });
  Object.assign(capture, { libraryId: 9, mediaServerId: 8, generation: '7' });
  wait.resolve({ analyzed: false });
  expect(await pending).toBe(false);
  expect(store.withCurrentCapture).toHaveBeenCalledWith(context(), expect.any(Function));
});

test('snapshotting preserves database bigint strings and does not modify callers', () => {
  const original = { ...context(), generation: '9007199254740993', unrelated: 'excluded' };
  const copied = snapshotSourceCapture(original);
  expect(copied).toEqual({ ...context(), generation: '9007199254740993' });
  expect(Object.isFrozen(original)).toBe(false);
  expect(snapshotSourceCapture(null)).toEqual({ libraryId: undefined, mediaServerId: undefined, generation: undefined });
});
