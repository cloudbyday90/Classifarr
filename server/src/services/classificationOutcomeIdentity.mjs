/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { inventorySourceDescriptionKey } from './inventorySourceDescriptionIdentity.mjs';
import { safeParseJsonObject } from '../utils/classificationRetryPayloads.mjs';

/** Titles/year only guard an exact persisted source pointer; never use them as identity. */
export async function readClassificationOutcomeIdentity(client, classification) {
  if (!['movie', 'tv'].includes(classification.media_type)) return null;
  if (classification.tmdb_id != null) {
    const id = positiveDatabaseInteger(classification.tmdb_id);
    return id ? `${classification.media_type}:${id}` : null;
  }
  if (classification.method !== 'source_library') return null;
  const metadata = safeParseJsonObject(classification.metadata);
  const itemId = positiveDatabaseInteger(metadata.itemId);
  const libraryId = positiveDatabaseInteger(metadata.source_library_id);
  if (!itemId || !libraryId) return null;
  const { rows } = await client.query(`
    SELECT media_server_id, external_id, library_id, media_type, tmdb_id
    FROM media_server_items
    WHERE id = $1 AND library_id = $2 AND media_type = $3 AND tmdb_id IS NULL
      AND title = $4 AND year IS NOT DISTINCT FROM $5::integer
    FOR SHARE`, [itemId, libraryId, classification.media_type, classification.title, classification.year ?? null]);
  if (!rows[0]) return null;
  try { return inventorySourceDescriptionKey(rows[0]); }
  catch { return null; }
}
