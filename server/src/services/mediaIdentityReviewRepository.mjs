/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, ForbiddenError } from '../utils/appError.mjs';
import { projectReviewSource } from './mediaIdentityReviewContract.mjs';

const SOURCE_COLUMNS = `msi.id, msi.xmin::text AS revision, msi.media_server_id,
  msi.external_id, msi.library_id, msi.tmdb_id, msi.tvdb_id, msi.imdb_id,
  msi.media_type, msi.title, msi.year, msi.metadata, l.name AS library_name`;

export async function requireReviewActor(db, actorId, lock = false) {
  const { rows } = await db.query(`SELECT role, is_active FROM users WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [actorId]); // sql-interpolation: boolean selects a fixed lock clause; actor ID is bound
  if (rows[0]?.role !== 'admin' || rows[0]?.is_active !== true) {
    throw new ForbiddenError('An active administrator account is required', { code: 'review_admin_required' });
  }
}

export async function readReviewSource(db, itemId, lock = false) {
  const { rows } = await db.query( // sql-interpolation: fixed column allowlist and boolean lock clause; item ID is bound
    `SELECT ${SOURCE_COLUMNS}
    FROM media_server_items msi LEFT JOIN libraries l ON l.id = msi.library_id
    WHERE msi.id = $1${lock ? ' FOR UPDATE OF msi' : ''}`, [itemId]);
  return rows[0];
}

export async function listReviewSources(db, { afterId, limit, mediaType }) {
  const { rows } = await db.query( // sql-interpolation: fixed column allowlist; pagination and filter values are bound
    `SELECT ${SOURCE_COLUMNS}
    FROM media_server_items msi LEFT JOIN libraries l ON l.id = msi.library_id
    WHERE msi.id > $1 AND msi.tmdb_id IS NULL AND msi.media_type IN ('movie', 'tv')
      AND msi.metadata @> '{"tmdb_resolution":{"version":1,"status":"review_required"}}'::jsonb
      AND ($2::text IS NULL OR msi.media_type = $2)
    ORDER BY msi.id LIMIT $3`, [afterId, mediaType, limit + 1]);
  const items = rows.slice(0, limit).map(projectReviewSource);
  return { items, nextCursor: rows.length > limit ? items.at(-1).id : null };
}

export async function storeReviewPreview(db, { actorId, id, itemId, version, candidate }) {
  const { rows } = await db.query(`INSERT INTO media_identity_review_previews
    (actor_id, id, item_id, source_version, candidate, expires_at)
    VALUES ($1, $2, $3, $4, $5::jsonb, clock_timestamp() + interval '10 minutes')
    ON CONFLICT (actor_id) DO UPDATE SET id = EXCLUDED.id, item_id = EXCLUDED.item_id,
      source_version = EXCLUDED.source_version, candidate = EXCLUDED.candidate,
      expires_at = EXCLUDED.expires_at, created_at = clock_timestamp()
    RETURNING expires_at`, [actorId, id, itemId, version, JSON.stringify(candidate)]);
  return rows[0].expires_at;
}

export async function applyReviewedIdentity(db, { actorId, preview, source }) {
  const receipt = {
    version: 1, status: 'resolved', method: 'operator', reason: 'operator_confirmed', review_id: preview.id,
  };
  const updated = await db.query(`UPDATE media_server_items SET tmdb_id = $2,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('tmdb_resolution', $3::jsonb)
    WHERE id = $1 AND tmdb_id IS NULL AND media_type = $4 RETURNING id`,
  [source.id, preview.candidate.tmdbId, JSON.stringify(receipt), preview.candidate.mediaType]);
  if (updated.rowCount !== 1) throw new ConflictError('The source item changed. Review it again.', { code: 'review_source_changed' });
  // Deliberately use the same transaction: the general audit helper swallows failures.
  const { rows } = await db.query(`INSERT INTO audit_log (user_id, action, metadata)
    VALUES ($1, 'media_identity_confirmed', $2::jsonb) RETURNING id, created_at`, [actorId, JSON.stringify({
    version: 1, reviewId: preview.id, itemId: source.id, tmdbId: preview.candidate.tmdbId,
    mediaType: source.media_type, sourceVersion: preview.source_version,
    previousReason: projectReviewSource(source).reason,
  })]);
  return { auditId: rows[0].id, confirmedAt: rows[0].created_at, itemId: source.id, candidate: preview.candidate };
}
