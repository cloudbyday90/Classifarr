/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AsyncLocalStorage } from 'node:async_hooks';
import * as database from '../config/database.mjs';

const scope = new AsyncLocalStorage();
export const mediaSyncDatabase = {
  query: (...args) => (scope.getStore() ?? database).query(...args),
  withTransaction: fn => (scope.getStore() ?? database).withTransaction(fn),
  isOwned: () => scope.getStore() !== undefined,
};

/** All ingestion mutations use the connection that owns the session lock. */
export async function withMediaSyncDatabase(client, lease, callback) {
  let depth = 0, closed = false;
  const query = async (...args) => {
    if (closed) throw new Error('ingestion_scope_closed');
    lease.assertHealthy();
    const result = await client.query(...args);
    lease.assertHealthy();
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
  try { return await scope.run(owned, () => callback(owned)); }
  finally { closed = true; }
}
