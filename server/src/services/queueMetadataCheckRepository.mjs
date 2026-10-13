/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, NotFoundError } from '../utils/appError.mjs';
import { normalizeRequestIdentity } from './requestIdentityNormalization.mjs';

const FAILURES = new Set(['task_metadata_not_found', 'task_metadata_fetch_failed', 'task_processing_failed']);

/** Normalize bounded saved requests internally; never return their raw payloads. */
export async function readQueueMetadataCheckTask(db, id) {
  const { rows } = await db.query(`SELECT t.id, t.xmin::text AS revision, t.task_type, t.status,
    t.current_stage, t.error_message, t.claim_token, t.routing_classification_id,
    CASE WHEN octet_length(t.payload::text)<=65536 THEN t.payload END AS request_payload,
    CASE WHEN octet_length(w.payload::text)<=65536 THEN w.payload END AS source_payload,
    t.webhook_log_id, w.id AS source_id, w.xmin::text AS source_revision,
    w.tmdb_id AS source_tmdb_id, w.media_type AS source_media_type,
    w.tvdb_id AS source_tvdb_id
    FROM task_queue t LEFT JOIN webhook_log w ON w.id = t.webhook_log_id
    WHERE t.id = $1`, [id]);
  if (!rows[0]) throw new NotFoundError('Task no longer exists');
  const { request_payload, source_payload, ...task } = rows[0];
  const identity = normalizeRequestIdentity(request_payload);
  if (identity.reason || identity.externalReason || !identity.tmdbId) throw new ConflictError('The saved request identity needs review.',
    { code: identity.reason || (identity.externalReason === 'conflicting_external_ids' ? 'request_identity_conflict' : 'request_identity_invalid') });
  Object.assign(task, { tmdb_id: identity.tmdbId, media_type: identity.mediaType,
    task_imdb_id: identity.imdbId, task_tvdb_id: identity.tvdbId,
    identity_external_reason: identity.externalReason,
    source_identity: task.source_id == null ? null : normalizeRequestIdentity(source_payload) });
  if (task.task_type !== 'classification' || task.status !== 'failed' ||
      task.current_stage !== 'metadata_fetch' || !FAILURES.has(task.error_message) ||
      task.claim_token !== null || task.routing_classification_id !== null ||
      !['movie', 'tv'].includes(task.media_type)) {
    throw new ConflictError('This task is no longer eligible for a metadata check');
  }
  return task;
}
