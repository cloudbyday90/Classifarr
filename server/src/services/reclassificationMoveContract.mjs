/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { ValidationError } from '../utils/appError.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { safeParseJsonObject } from '../utils/classificationRetryPayloads.mjs';

export function moveBlocked(code, message) {
  return new ValidationError(message, { code });
}

export function classificationMoveRevision(row) {
  return createHash('sha256').update(JSON.stringify([
    row.id, row.library_id, row.media_type, row.tmdb_id, row.title, row.year ?? null, row.method ?? null, row.status ?? null,
    safeParseJsonObject(row.metadata),
  ])).digest('hex');
}

export function moveProviderIdentity(row) {
  const metadata = safeParseJsonObject(row.metadata);
  if (row.media_type === 'tv' && metadata.tvdb_id != null && metadata.tvdbId != null &&
      positiveDatabaseInteger(metadata.tvdb_id) !== positiveDatabaseInteger(metadata.tvdbId)) {
    throw moveBlocked('move_identity_conflict', 'The stored TVDB identifiers conflict. Refresh the item metadata before retrying.');
  }
  const providerId = row.media_type === 'movie' ? positiveDatabaseInteger(row.tmdb_id)
    : row.media_type === 'tv' ? positiveDatabaseInteger(metadata.tvdb_id ?? metadata.tvdbId) : null;
  if (!providerId) throw moveBlocked('move_identity_missing', 'A valid TMDB movie ID or TVDB show ID is required; refresh the item metadata before retrying.');
  return providerId;
}

export function arrPath(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\x00-\x1f\x7f]/.test(value)) {
    throw moveBlocked('move_path_invalid', 'The configured media path is invalid.');
  }
  const normalized = value.replaceAll('\\', '/');
  if (!path.posix.isAbsolute(normalized) && !path.win32.isAbsolute(value)) {
    throw moveBlocked('move_path_invalid', 'Media paths must be absolute.');
  }
  if (normalized.split('/').some(part => part === '..' || part === '.')) {
    throw moveBlocked('move_path_invalid', 'Media paths must not contain traversal segments.');
  }
  return normalized.replace(/\/+$/, '');
}

export function moveTargetPath(root, current) {
  const normalizedRoot = arrPath(root);
  const normalizedCurrent = arrPath(current);
  const folder = path.posix.basename(normalizedCurrent);
  if (!folder || normalizedCurrent === '/' || /^[a-z]:$/i.test(normalizedCurrent)) {
    throw moveBlocked('move_path_invalid', 'A media item folder, not a filesystem root, is required.');
  }
  return `${normalizedRoot}/${folder}`;
}

export function assertSeparatePaths(source, destination) {
  const from = arrPath(source).toLowerCase(), to = arrPath(destination).toLowerCase();
  if (!from || !to || /^[a-z]:$/i.test(from) || /^[a-z]:$/i.test(to) ||
      from === to || from.startsWith(`${to}/`) || to.startsWith(`${from}/`)) {
    throw moveBlocked('move_paths_overlap', 'Source and destination must be distinct, non-overlapping item folders. Check the library path mappings.');
  }
}

export function mappingRevision(original, target, url) {
  const fields = mapping => [mapping?.arr_type, mapping?.arr_config_id,
    mapping?.arr_root_folder_path, mapping?.quality_profile_id ?? null];
  return createHash('sha256').update(JSON.stringify([fields(original), fields(target), url])).digest('hex');
}
