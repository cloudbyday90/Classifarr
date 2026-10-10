/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, sourceConflictAuthorityExclusionForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';

// Explicit ranges avoid PostgreSQL locale-dependent \s disagreeing with JS.
// Exclude controls and Unicode whitespace; URI encoding remains supported.
const POSTER_SEPARATORS = String.raw`\u0001-\u0020\u007f-\u009f\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff`;
const POSTER_PATTERN = `^(https?://[^${POSTER_SEPARATORS}]+|/[^/${POSTER_SEPARATORS}][^${POSTER_SEPARATORS}]*)$`;
const posterPattern = new RegExp(POSTER_PATTERN, 'i');
const trimPoster = value => value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '');

export function classificationPosterPath(metadata) {
  for (const value of [metadata?.poster_path, metadata?.posterPath]) {
    if (typeof value !== 'string') continue;
    const path = trimPoster(value);
    // PostgreSQL text/jsonb cannot contain NUL; reject it before an in-memory URL projection too.
    if (!path.includes('\0') && Buffer.byteLength(path, 'utf8') <= 4096 && posterPattern.test(path)) return path;
  }
  return null;
}

function posterSql(alias) {
  // Internal identifiers only; never accept a caller-supplied SQL expression.
  if (!['ch', 'msi'].includes(alias)) throw new Error('classification_poster_alias_invalid');
  return `COALESCE(${['poster_path', 'posterPath'].map(field => {
    const value = `btrim(${alias}.metadata->>'${field}', E' \\t\\n\\r\\f\\013')`;
    return `CASE WHEN jsonb_typeof(${alias}.metadata->'${field}')='string'
      AND octet_length(${value}) <= 4096 AND ${value} ~* '${POSTER_PATTERN}' THEN ${value} END`;
  }).join(', ')})`;
}

const historyPoster = posterSql('ch');
const inventoryPoster = posterSql('msi');
export const CLASSIFICATION_POSTER_SQL = `COALESCE(${historyPoster}, inventory_poster.poster_path)`;

/** At most one candidate per classification; artwork never resolves identity. */
export function classificationPosterJoinSql(retentionParameter) {
  const eligible = sourceConflictAuthorityExclusionForMediaServerItem(retentionParameter);
  return `LEFT JOIN LATERAL (
    SELECT ${inventoryPoster} AS poster_path FROM media_server_items msi
    JOIN libraries l ON l.id=msi.library_id AND l.media_server_id=msi.media_server_id
      AND l.is_active=true AND l.media_type=msi.media_type
    JOIN media_server s ON s.id=msi.media_server_id AND s.is_active=true
    WHERE ${historyPoster} IS NULL AND ch.tmdb_id > 0
      AND ch.media_type IN ('movie','tv') AND msi.tmdb_id=ch.tmdb_id AND msi.media_type=ch.media_type
      AND ${eligible} AND ${inventoryPoster} IS NOT NULL
    ORDER BY msi.last_synced DESC NULLS LAST, msi.id DESC LIMIT 1
  ) inventory_poster ON true`;
}

export async function readClassificationPosterPath(query, classificationId) {
  const { rows } = await query( // sql-interpolation: fixed internal fragments and validated placeholder only; values are parameters.
    `SELECT ${CLASSIFICATION_POSTER_SQL} AS poster_path FROM classification_history ch
      ${classificationPosterJoinSql('$2')} WHERE ch.id=$1`,
    [classificationId, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
  return classificationPosterPath(rows[0]);
}
