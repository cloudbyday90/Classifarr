/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, NotFoundError } from '../utils/appError.mjs';
import { reviewInteger } from './mediaIdentityReviewContract.mjs';

const FAILURES = new Set(['task_metadata_not_found', 'task_metadata_fetch_failed', 'task_processing_failed']);

/** Read only identity fields from the direct source; never expose its raw request. */
export async function readQueueMetadataCheckTask(db, id) {
  const { rows } = await db.query(`SELECT t.id, t.xmin::text AS revision, t.task_type, t.status,
    t.current_stage, t.error_message, t.claim_token, t.routing_classification_id,
    t.payload->>'tmdb_id' AS tmdb_id, t.payload->>'media_type' AS media_type,
    t.payload->'imdb_id' AS task_imdb_id, t.payload->'tvdb_id' AS task_tvdb_id,
    t.webhook_log_id, w.id AS source_id, w.xmin::text AS source_revision,
    w.tmdb_id AS source_tmdb_id, w.media_type AS source_media_type,
    w.tvdb_id AS source_tvdb_id,
    w.payload#>'{media,imdbId}' AS source_imdb_id,
    w.payload#>'{media,imdb_id}' AS source_imdb_legacy_id,
    w.payload#>'{media,tvdbId}' AS source_payload_tvdb_id,
    w.payload#>'{media,tvdb_id}' AS source_payload_tvdb_legacy_id
    FROM task_queue t LEFT JOIN webhook_log w ON w.id = t.webhook_log_id
    WHERE t.id = $1`, [id]);
  const task = rows[0];
  if (!task) throw new NotFoundError('Task no longer exists');
  if (task.task_type !== 'classification' || task.status !== 'failed' ||
      task.current_stage !== 'metadata_fetch' || !FAILURES.has(task.error_message) ||
      task.claim_token !== null || task.routing_classification_id !== null ||
      !['movie', 'tv'].includes(task.media_type)) {
    throw new ConflictError('This task is no longer eligible for a metadata check');
  }
  reviewInteger(task.tmdb_id);
  return task;
}
