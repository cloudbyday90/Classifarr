/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { sourceEvidenceAnchor } from './librarySourceEvidenceAdapter.mjs';
import { normalizeImdbId } from './mediaSourceIdentity.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';

function sourceKey(row) {
  const anchor = sourceEvidenceAnchor(row, row?.library_id);
  if (!anchor || !['movie', 'tv'].includes(anchor.mediaType)) return null;
  const key = JSON.stringify([positiveDatabaseInteger(anchor.libraryId), anchor.mediaServerId, anchor.mediaType, anchor.externalId]);
  return `source:${createHash('sha256').update(key).digest('hex')}`;
}

/** Private membership identity, not a global work ID or routing authority. */
export function inventorySourceDescriptionKey(row) {
  if (!['movie', 'tv'].includes(row?.media_type)) throw new Error('inventory_description_identity_invalid');
  if (row.tmdb_id != null) {
    if (!Number.isInteger(row.tmdb_id) || !positiveDatabaseInteger(row.tmdb_id)) {
      throw new Error('inventory_description_identity_invalid');
    }
    return `${row.media_type}:${row.tmdb_id}`;
  }
  const key = sourceKey(row);
  if (!key) throw new Error('inventory_description_source_anchor_invalid');
  return key;
}

/** Alternate IDs can remove possible self-evidence, never merge membership. */
export function inventoryDescriptionQueryAliases(metadata) {
  return { imdbId: normalizeImdbId(metadata?.imdb_id), tvdbId: positiveDatabaseInteger(metadata?.tvdb_id), sourceKey: sourceKey(metadata) };
}
