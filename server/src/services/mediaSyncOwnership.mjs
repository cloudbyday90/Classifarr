/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';
import { withMediaSyncDatabase } from './mediaSyncDatabaseScope.mjs';
import { createMediaSyncOwnershipRepository } from './mediaSyncOwnershipRepository.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { MEDIA_SYNC_OWNER_LOCK, MEDIA_SYNC_SLOT_LOCK } from './mediaSyncLockKeys.mjs';
export function createMediaSyncOwnership({ pool }) {
  return async function own(libraryId, callback) {
    if (!positiveDatabaseInteger(libraryId)) throw new TypeError('Invalid ingestion library');
    const client = await pool.connect();
    const lease = createDatabaseClientLease(client, { operation: 'library_ingestion' });
    const locks = [];
    let discard = false;
    const lock = async (namespace, key) => {
      const { rows: [row] } = await client.query('SELECT pg_try_advisory_lock($1::integer,$2::integer) AS acquired', [namespace, key]);
      lease.assertHealthy();
      if (row.acquired) locks.push([namespace, key]);
      return row.acquired;
    };
    try {
      if (!await lock(MEDIA_SYNC_OWNER_LOCK, libraryId)) return { success: false, deferred: true, reason: 'ingestion_owned' };
      if (!await lock(MEDIA_SYNC_SLOT_LOCK, 1) && !await lock(MEDIA_SYNC_SLOT_LOCK, 2)) {
        return { success: false, deferred: true, reason: 'ingestion_capacity' };
      }
      return await withMediaSyncDatabase(client, lease, async db => {
        const repository = createMediaSyncOwnershipRepository(db, libraryId);
        // The callback validates current source configuration before claiming durable work.
        return callback({ ...repository, signal: lease.signal });
      });
    } catch (error) { discard = true; throw error; }
    finally {
      if (!lease.failed) {
        for (const keys of locks.reverse()) {
          try { await client.query('SELECT pg_advisory_unlock($1::integer,$2::integer)', keys); }
          catch { discard = true; }
        }
      }
      lease.release(discard);
    }
  };
}
