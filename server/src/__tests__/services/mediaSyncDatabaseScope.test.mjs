/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { createDatabaseClientLease } from '../../utils/databaseClientLease.mjs';
const fallback = jest.fn();
jest.unstable_mockModule('../../config/database.mjs', () => ({ query: fallback, withTransaction: fallback }));
const { withMediaSyncDatabase, mediaSyncDatabase: db } = await import('../../services/mediaSyncDatabaseScope.mjs');

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
  });
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
  });
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
  });
  resume.resolve();
  await expect(late).rejects.toThrow('ingestion_scope_closed');
  expect(client.query).not.toHaveBeenCalled();
});

test('outer transaction failures rollback and preserve the cause', async () => {
  const { client, lease } = fixture();
  await expect(withMediaSyncDatabase(client, lease, () => db.withTransaction(async () => {
    throw new Error('storage failure');
  }))).rejects.toThrow('storage failure');
  expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
});
