/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { sourceObservationPage, SOURCE_OBSERVATION_LIMITS } from './mediaSourceObservationContract.mjs';
import { START_SOURCE_CAPTURE, CAPTURE_SOURCE_OBSERVATIONS } from './mediaSourceObservationQueries.mjs';
import { requireOwnedMediaSyncDatabase } from './mediaSyncDatabaseScope.mjs';
import { snapshotSourceCapture } from './mediaSourceCaptureContext.mjs';

export class MediaSourceObservationStore {
  async start(mediaServerId, libraryId, { incremental = false, source = 'media_sync' } = {}) {
    if (!positiveDatabaseInteger(mediaServerId) || !positiveDatabaseInteger(libraryId) ||
      !['media_sync', 'local_capture'].includes(source)) throw new Error('Invalid source capture context');
    const ownedDb = requireOwnedMediaSyncDatabase(libraryId);
    return ownedDb.withTransaction(async client => {
      // A changed library owner invalidates observations from its previous server.
      await client.query(`DELETE FROM media_source_capture_state WHERE library_id=$1 AND media_server_id<>$2
        AND EXISTS (SELECT 1 FROM libraries WHERE id=$1 AND media_server_id=$2)`, [libraryId, mediaServerId]);
      const result = await client.query(START_SOURCE_CAPTURE, [libraryId, mediaServerId, incremental ? 'incremental' : 'full', source]);
      if (!result.rows.length) throw new Error('Source capture library is unavailable');
      await client.query(`DELETE FROM media_source_observations WHERE library_id=$1
        AND last_seen_at < clock_timestamp()-$2::integer*INTERVAL '1 day'`, [libraryId, SOURCE_OBSERVATION_LIMITS.retentionDays]);
      return snapshotSourceCapture({ libraryId, mediaServerId, generation: result.rows[0].generation });
    });
  }

  async withCurrentCapture(context, fn) {
    const capture = snapshotSourceCapture(context);
    const ownedDb = requireOwnedMediaSyncDatabase(capture.libraryId);
    return this.#withCurrentCapture(ownedDb, capture, fn);
  }

  async #withCurrentCapture(db, context, fn) {
    return db.withTransaction(async client => {
      const { libraryId, mediaServerId, generation } = context;
      const { rows } = await client.query(`SELECT mode, uncapturable_count FROM media_source_capture_state
        WHERE library_id=$1 AND media_server_id=$2 AND generation=$3 AND phase='collecting' FOR UPDATE`,
      [libraryId, mediaServerId, generation]);
      if (!rows.length) return false;
      await fn(client, rows[0]);
      return true;
    });
  }

  async capture(context, items) {
    const capture = snapshotSourceCapture(context);
    const { libraryId, mediaServerId, generation } = capture;
    const ownedDb = requireOwnedMediaSyncDatabase(libraryId);
    const page = sourceObservationPage(mediaServerId, libraryId, items);
    return this.#withCurrentCapture(ownedDb, capture, async client => {
      await client.query(`DELETE FROM media_source_observations
        WHERE library_id=$1 AND media_server_id=$2 AND external_id=ANY($3::text[]) AND generation<>$4`,
      [libraryId, mediaServerId, page.resolved, generation]);
      const result = await client.query(CAPTURE_SOURCE_OBSERVATIONS,
        [libraryId, mediaServerId, generation, JSON.stringify(page.unresolved), SOURCE_OBSERVATION_LIMITS.retainedPerLibrary]);
      await client.query(`UPDATE media_source_capture_state SET observed_count=observed_count+$2,
        rejected_count=rejected_count+$3, uncapturable_count=uncapturable_count+$4, omitted_count=omitted_count+$5 WHERE library_id=$1`,
      [libraryId, page.observed, page.rejected, page.uncapturable, page.unresolved.length-result.rowCount]);
    });
  }

  async finish(context, { failed = false } = {}) {
    // Snapshot keys before any await so a caller cannot retarget a pending completion.
    const capture = snapshotSourceCapture(context);
    const ownedDb = requireOwnedMediaSyncDatabase(capture.libraryId);
    return this.#withCurrentCapture(ownedDb, capture, async (client, state) => {
      if (!failed && state.mode === 'full' && state.uncapturable_count === 0) await client.query(`DELETE FROM media_source_observations
        WHERE library_id=$1 AND media_server_id=$2 AND generation<>$3`,
      [capture.libraryId, capture.mediaServerId, capture.generation]);
      await client.query(`UPDATE media_source_capture_state SET phase=$2, completed_at=clock_timestamp() WHERE library_id=$1`,
        [capture.libraryId, failed ? 'failed' : 'complete']);
    });
  }
}
