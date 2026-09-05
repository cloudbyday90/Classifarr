/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { ConflictError, ServiceUnavailableError, ValidationError } from '../utils/appError.mjs';

export function reviewInteger(value) {
  if (!/^[1-9]\d{0,9}$/.test(String(value)) || !['string', 'number'].includes(typeof value)) {
    throw new ValidationError('A positive integer ID is required');
  }
  const result = Number(value);
  if (result > 2147483647) throw new ValidationError('ID is out of range');
  return result;
}

export function reviewBody(body, keys) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== keys.length || Object.keys(body).some(key => !keys.includes(key))) {
    throw new ValidationError('Invalid review request');
  }
}

export function sourceVersion(row) {
  return createHash('sha256').update(JSON.stringify([
    row.id, row.revision, row.media_server_id, row.external_id, row.library_id,
    row.tmdb_id, row.tvdb_id, row.imdb_id, row.media_type, row.title, row.year,
  ])).digest('hex');
}

export function assertReviewSource(row, version) {
  if (!row || row.tmdb_id !== null || !['movie', 'tv'].includes(row.media_type) ||
      row.metadata?.tmdb_resolution?.version !== 1 ||
      row.metadata?.tmdb_resolution?.status !== 'review_required' || sourceVersion(row) !== version) {
    throw new ConflictError('The source item changed. Refresh the queue and review it again.', { code: 'review_source_changed' });
  }
}

export function projectReviewSource(row) {
  return {
    id: row.id, title: row.title, year: row.year, mediaType: row.media_type,
    libraryName: row.library_name, imdbId: row.imdb_id, tvdbId: row.tvdb_id,
    reason: typeof row.metadata?.tmdb_resolution?.reason === 'string'
      ? row.metadata.tmdb_resolution.reason.slice(0, 100) : 'unknown',
    sourceVersion: sourceVersion(row),
  };
}

/** Reject a provider payload that cannot establish the requested typed identity. */
export function projectReviewCandidate(data, tmdbId, mediaType) {
  const title = mediaType === 'movie' ? data?.title : data?.name;
  if (!data || Array.isArray(data) || data.id !== tmdbId ||
      (data.media_type !== undefined && data.media_type !== mediaType) ||
      typeof title !== 'string' || !title.trim() || title.length > 500) {
    throw new ServiceUnavailableError('TMDb returned invalid identity details. Try again later.', { code: 'review_provider_invalid' });
  }
  const original = mediaType === 'movie' ? data.original_title : data.original_name;
  const date = mediaType === 'movie' ? data.release_date : data.first_air_date;
  return {
    tmdbId, mediaType, title: title.trim(),
    originalTitle: typeof original === 'string' ? original.slice(0, 500) : null,
    releaseDate: typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    overview: typeof data.overview === 'string' ? data.overview.slice(0, 1500) : null,
  };
}
