/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';
import { ConflictError } from '../utils/appError.mjs';
export const LIBRARY_CATALOG_LOCK = 0x4c434154;

/** One catalog owner; all protected writes stay on its session, including commit. */
export async function withLibraryCatalogSession(pool, callback) {
  const client = await pool.connect();
  const lease = createDatabaseClientLease(client, { operation: 'library_catalog' });
  let locked = false, discard = false, closed = false;
  const query = async (...args) => {
    if (closed) throw new Error('library_catalog_session_closed');
    lease.assertHealthy();
    const result = await client.query(...args);
    lease.assertHealthy();
    return result;
  };
  const db = { query, async withTransaction(fn) {
    await query('BEGIN');
    try { const result = await fn({ query }); await query('COMMIT'); return result; }
    catch (error) { try { await query('ROLLBACK'); } catch { discard = true; } throw error; }
  } };
  try {
    locked = (await query('SELECT pg_try_advisory_lock($1) AS acquired', [LIBRARY_CATALOG_LOCK])).rows[0]?.acquired === true;
    if (!locked) throw new ConflictError('Library discovery is already running. Wait before retrying.', { code: 'library_catalog_busy' });
    const result = await callback(db, lease.signal);
    lease.assertHealthy();
    return result;
  } catch (error) { discard = true; throw error; }
  finally {
    if (locked && !lease.failed) {
      try { await query('SELECT pg_advisory_unlock($1)', [LIBRARY_CATALOG_LOCK]); } catch { discard = true; }
    }
    closed = true;
    lease.release(discard);
  }
}
