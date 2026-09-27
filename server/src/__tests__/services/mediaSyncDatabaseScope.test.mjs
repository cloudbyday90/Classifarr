/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { createDatabaseClientLease } from '../../utils/databaseClientLease.mjs';
const fallback = jest.fn();
jest.unstable_mockModule('../../config/database.mjs', () => ({ query: fallback, withTransaction: fallback }));
const { withMediaSyncDatabase, mediaSyncDatabase: db, requireOwnedMediaSyncDatabase } = await import('../../services/mediaSyncDatabaseScope.mjs');
const { createMediaSyncOwnershipRepository } = await import('../../services/mediaSyncOwnershipRepository.mjs');
const { MediaSourceObservationStore } = await import('../../services/mediaSourceObservationStore.mjs');
const { pruneMissingMediaItems, pruneMissingCollections } = await import('../../services/mediaSyncQueries.mjs');

function fixture() {
  const client = Object.assign(new EventEmitter(), { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() });
  return { client, lease: createDatabaseClientLease(client, {}) };
}

test('nested transactions stay on the owner connection and rollback savepoints', async () => {
  const { client, lease } = fixture();
  await withMediaSyncDatabase(client, lease, async () => {
    expect(db.isOwned()).toBe(true);
    await db.withTransaction(async () => {
      await expect(db.withTransaction(async () => { throw new Error('inner failure'); })).rejects.toThrow('inner failure');
      await db.query('SELECT 1');
    });
  }, 1);
  expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
    'BEGIN', 'SAVEPOINT ingestion_1', 'ROLLBACK TO SAVEPOINT ingestion_1', 'SELECT 1', 'COMMIT',
  ]);
  expect(db.isOwned()).toBe(false);
  expect(fallback).not.toHaveBeenCalled();
});

test('connection loss blocks late writes without falling back to the pool', async () => {
  const { client, lease } = fixture();
  await withMediaSyncDatabase(client, lease, async () => {
    client.emit('error', new Error('connection gone'));
    await expect(db.query('DELETE FROM anything')).rejects.toThrow('connection gone');
    await expect(db.withTransaction(async () => {})).rejects.toThrow('connection gone');
  }, 1);
  expect(client.query).not.toHaveBeenCalled();
  expect(fallback).not.toHaveBeenCalled();
  lease.release();
  expect(client.release).toHaveBeenCalledWith(true);
});

test('escaped callbacks cannot write after the owning callback completes', async () => {
  const { client, lease } = fixture();
  const resume = Promise.withResolvers();
  let late;
  await withMediaSyncDatabase(client, lease, async () => {
    late = resume.promise.then(() => db.query('UPDATE anything'));
  }, 1);
  resume.resolve();
  await expect(late).rejects.toThrow('ingestion_scope_closed');
  expect(client.query).not.toHaveBeenCalled();
});

test('outer transaction failures rollback and preserve the cause', async () => {
  const { client, lease } = fixture();
  await expect(withMediaSyncDatabase(client, lease, () => db.withTransaction(async () => {
    throw new Error('storage failure');
  }), 1)).rejects.toThrow('storage failure');
  expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
});

test.each(['closed', 'disconnected'])('%s owner blocks real checkpoint, completion, capture-finalization and pruning helpers', async cause => {
  const { client, lease } = fixture();
  const resume = Promise.withResolvers();
  let late;
  const run = () => {
    const owner = createMediaSyncOwnershipRepository(db, 1);
    const store = new MediaSourceObservationStore(db);
    return Promise.allSettled([
      owner.checkpoint(2), owner.finish(true, 2),
      store.finish({ libraryId: 1, mediaServerId: 1, generation: 1 }),
      pruneMissingMediaItems(1, []),
    ]);
  };
  await withMediaSyncDatabase(client, lease, async () => {
    late = resume.promise.then(run);
    if (cause === 'disconnected') {
      client.emit('error', new Error('lost-owner-fixture'));
      resume.resolve();
      await late;
    }
  }, 1);
  resume.resolve();
  const outcomes = await late;
  expect(outcomes).toHaveLength(4);
  for (const outcome of outcomes) {
    expect(outcome.status).toBe('rejected');
    expect(outcome.reason.message).toBe(cause === 'closed' ? 'ingestion_scope_closed' : 'lost-owner-fixture');
  }
  expect(client.query).not.toHaveBeenCalled();
  expect(fallback).not.toHaveBeenCalled();
  lease.release();
});

test.each([undefined, null, {}, { isOwned: () => true }])('unowned destructive helpers reject even with a forged database %p', async adapter => {
  const store = new MediaSourceObservationStore(adapter);
  await expect(store.finish({ libraryId: 1, mediaServerId: 1, generation: 1 })).rejects.toThrow('ingestion_ownership_required');
  await expect(store.finish({ libraryId: 1 }, { failed: true })).rejects.toThrow('ingestion_ownership_required');
  await expect(pruneMissingMediaItems(1, [])).rejects.toThrow('ingestion_ownership_required');
  await expect(pruneMissingCollections(1, [])).rejects.toThrow('ingestion_ownership_required');
  expect(fallback).not.toHaveBeenCalled();
});

test('another library or invalid ID cannot borrow ownership', async () => {
  const { client, lease } = fixture();
  await withMediaSyncDatabase(client, lease, async () => {
    for (const id of [2, undefined, 0, -1, 'bad', 2147483648]) {
      await expect(pruneMissingMediaItems(id)).rejects.toThrow('ingestion_library_scope_mismatch');
      await expect(pruneMissingCollections(id)).rejects.toThrow('ingestion_library_scope_mismatch');
      await expect(new MediaSourceObservationStore(db).finish({ libraryId: id })).rejects.toThrow('ingestion_library_scope_mismatch');
    }
    expect(Object.isFrozen(requireOwnedMediaSyncDatabase('1'))).toBe(true);
  }, '1');
  expect(client.query).not.toHaveBeenCalled();
  expect(fallback).not.toHaveBeenCalled();
});

test('valid completion uses only the owning client, never the store adapter', async () => {
  const { client, lease } = fixture();
  const adapter = { withTransaction: jest.fn(), query: jest.fn() };
  client.query.mockResolvedValue({ rows: [{ mode: 'full', uncapturable_count: 0 }], rowCount: 1 });
  await withMediaSyncDatabase(client, lease, async () => {
    await expect(new MediaSourceObservationStore(adapter).finish({ libraryId: 1, mediaServerId: 2, generation: '3' })).resolves.toBe(true);
    await expect(pruneMissingMediaItems(1, ['seen'])).resolves.toBe(1);
    await expect(pruneMissingCollections(1, [])).resolves.toBe(1);
  }, 1);
  expect(client.query.mock.calls[0]).toEqual(['BEGIN']);
  expect(client.query.mock.calls.some(([sql]) => sql.includes('generation=$3'))).toBe(true);
  expect(adapter.withTransaction).not.toHaveBeenCalled();
  expect(adapter.query).not.toHaveBeenCalled();
  expect(fallback).not.toHaveBeenCalled();
});

test('a retained owner facade cannot write after scope closure', async () => {
  const { client, lease } = fixture();
  let retained;
  await withMediaSyncDatabase(client, lease, async () => { retained = requireOwnedMediaSyncDatabase(1); }, 1);
  await expect(retained.query('DELETE FROM anything')).rejects.toThrow('ingestion_scope_closed');
  expect(client.query).not.toHaveBeenCalled();
});

test('invalid ownership cannot initialize a scope', async () => {
  const { client, lease } = fixture();
  const callback = jest.fn();
  await expect(withMediaSyncDatabase(client, lease, callback)).rejects.toThrow('Invalid ingestion library');
  expect(callback).not.toHaveBeenCalled();
  expect(client.query).not.toHaveBeenCalled();
});

test('a query result arriving after closure cannot acknowledge success', async () => {
  const { client, lease } = fixture();
  const result = Promise.withResolvers();
  client.query.mockReturnValue(result.promise);
  let pending;
  await withMediaSyncDatabase(client, lease, async () => {
    pending = requireOwnedMediaSyncDatabase(1).query('SELECT 1');
  }, 1);
  result.resolve({ rows: [] });
  await expect(pending).rejects.toThrow('ingestion_scope_closed');
});

test('mutating a capture during BEGIN cannot retarget an authorized completion', async () => {
  const { client, lease } = fixture();
  const begin = Promise.withResolvers();
  client.query.mockResolvedValue({ rows: [{ mode: 'full', uncapturable_count: 0 }] });
  client.query.mockImplementationOnce(() => begin.promise);
  await withMediaSyncDatabase(client, lease, async () => {
    const context = { libraryId: 1, mediaServerId: 2, generation: 3 };
    const pending = new MediaSourceObservationStore(db).finish(context);
    Object.assign(context, { libraryId: 9, mediaServerId: 8, generation: 7 });
    begin.resolve({ rows: [] });
    expect(await pending).toBe(true);
  }, 1);
  const values = client.query.mock.calls.filter(([, params]) => params).map(([, params]) => params);
  expect(values).toEqual([[1, 2, 3], [1, 2, 3], [1, 'complete']]);
});
