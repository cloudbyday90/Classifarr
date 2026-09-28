/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AsyncLocalStorage } from 'node:async_hooks';
import * as database from '../config/database.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';

const scope = new AsyncLocalStorage();
export const mediaSyncDatabase = {
  pool: database.pool,
  query: (...args) => (scope.getStore()?.db ?? database).query(...args),
  withTransaction: fn => (scope.getStore()?.db ?? database).withTransaction(fn),
  isOwned: () => scope.getStore() !== undefined,
};

/** Destructive helpers must never fall back to the pool or another library's owner. */
export function requireOwnedMediaSyncDatabase(libraryId) {
  const current = scope.getStore();
  if (!current) throw new Error('ingestion_ownership_required');
  current.assertHealthy();
  if (positiveDatabaseInteger(libraryId) !== current.libraryId) {
    throw new Error('ingestion_library_scope_mismatch');
  }
  return current.db;
}

/** All ingestion mutations use the connection that owns the session lock. */
export async function withMediaSyncDatabase(client, lease, callback, libraryId) {
  const ownedLibraryId = positiveDatabaseInteger(libraryId);
  if (!ownedLibraryId) throw new TypeError('Invalid ingestion library');
  let depth = 0, closed = false;
  const assertHealthy = () => {
    if (closed) throw new Error('ingestion_scope_closed');
    lease.assertHealthy();
  };
  const query = async (...args) => {
    assertHealthy();
    const result = await client.query(...args);
    assertHealthy();
    return result;
  };
  const owned = { query, async withTransaction(fn) {
    const level = depth++;
    const savepoint = `ingestion_${level}`;
    try {
      await query(level ? `SAVEPOINT ${savepoint}` : 'BEGIN');
      const result = await fn({ query });
      await query(level ? `RELEASE SAVEPOINT ${savepoint}` : 'COMMIT');
      return result;
    } catch (error) {
      try { await query(level ? `ROLLBACK TO SAVEPOINT ${savepoint}` : 'ROLLBACK'); }
      catch { /* A lost connection cannot be reused by this scope. */ }
      throw error;
    } finally { depth--; }
  } };
  Object.freeze(owned);
  try { return await scope.run({ db: owned, libraryId: ownedLibraryId, assertHealthy }, () => callback(owned)); }
  finally { closed = true; }
}
