/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { MEDIA_SYNC_OWNER_LOCK } from '../../services/mediaSyncLockKeys.mjs';
import { positiveDatabaseInteger } from '../../services/mediaIdentityValues.mjs';

/** Dedicated authenticated worker connection; calls contain values, never caller-supplied SQL. */
export function createFenceRehearsalClient(client) {
  let active = false;
  return {
    async begin(libraryId) {
      if (!positiveDatabaseInteger(libraryId)) throw new TypeError('Invalid ingestion library');
      if (active) throw new Error('ingestion_fence_client_already_active');
      active = true;
      let locked = false;
      try {
        const { rows: [lock] } = await client.query('SELECT pg_try_advisory_lock($1::integer,$2::integer) acquired',
          [MEDIA_SYNC_OWNER_LOCK, libraryId]);
        locked = lock.acquired;
        if (!locked) { active = false; return { deferred: true, reason: 'ingestion_owned' }; }
        const { rows: [row] } = await client.query('SELECT ingestion_fence_rehearsal.begin_run($1) token', [libraryId]);
        return { libraryId, token: row.token };
      } catch (error) {
        active = false;
        if (locked) await client.query('SELECT pg_advisory_unlock($1::integer,$2::integer)', [MEDIA_SYNC_OWNER_LOCK, libraryId]);
        throw error;
      }
    },
    async write(run, externalId, title) {
      await client.query('SELECT ingestion_fence_rehearsal.write_item($1,$2,$3,$4)',
        [run.libraryId, run.token, externalId, title]);
    },
    async finish(run, expected) {
      await client.query('SELECT ingestion_fence_rehearsal.finish_run($1,$2,$3)', [run.libraryId, run.token, expected]);
      await client.query('SELECT pg_advisory_unlock($1::integer,$2::integer)', [MEDIA_SYNC_OWNER_LOCK, run.libraryId]);
      active = false;
    },
  };
}
