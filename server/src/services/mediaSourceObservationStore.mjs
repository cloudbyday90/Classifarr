/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { sourceObservationPage, SOURCE_OBSERVATION_LIMITS } from './mediaSourceObservationContract.mjs';
import { START_SOURCE_CAPTURE, CAPTURE_SOURCE_OBSERVATIONS } from './mediaSourceObservationQueries.mjs';

export class MediaSourceObservationStore {
  constructor(db) { this.db = db; }

  async start(mediaServerId, libraryId, { incremental = false, source = 'media_sync' } = {}) {
    if (!positiveDatabaseInteger(mediaServerId) || !positiveDatabaseInteger(libraryId) ||
      !['media_sync', 'local_capture'].includes(source)) throw new Error('Invalid source capture context');
    return this.db.withTransaction(async client => {
      // A changed library owner invalidates observations from its previous server.
      await client.query(`DELETE FROM media_source_capture_state WHERE library_id=$1 AND media_server_id<>$2
        AND EXISTS (SELECT 1 FROM libraries WHERE id=$1 AND media_server_id=$2)`, [libraryId, mediaServerId]);
      const result = await client.query(START_SOURCE_CAPTURE, [libraryId, mediaServerId, incremental ? 'incremental' : 'full', source]);
      if (!result.rows.length) throw new Error('Source capture library is unavailable');
      await client.query(`DELETE FROM media_source_observations WHERE library_id=$1
        AND last_seen_at < clock_timestamp()-$2::integer*INTERVAL '1 day'`, [libraryId, SOURCE_OBSERVATION_LIMITS.retentionDays]);
      return { libraryId, mediaServerId, generation: result.rows[0].generation };
    });
  }

  async withCurrentCapture(context, fn) {
    return this.db.withTransaction(async client => {
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
    const { libraryId, mediaServerId, generation } = context;
    const page = sourceObservationPage(mediaServerId, libraryId, items);
    return this.withCurrentCapture(context, async client => {
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
    return this.withCurrentCapture(context, async (client, state) => {
      if (!failed && state.mode === 'full' && state.uncapturable_count === 0) await client.query(`DELETE FROM media_source_observations
        WHERE library_id=$1 AND media_server_id=$2 AND generation<>$3`,
      [context.libraryId, context.mediaServerId, context.generation]);
      await client.query(`UPDATE media_source_capture_state SET phase=$2, completed_at=clock_timestamp() WHERE library_id=$1`,
        [context.libraryId, failed ? 'failed' : 'complete']);
    });
  }
}
