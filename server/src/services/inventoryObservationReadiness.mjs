/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readInventoryTmdbObservation, INVENTORY_TMDB_CACHE_DAYS } from './inventoryTmdbObservation.mjs';
import { inventoryDescriptionIdentity } from './inventoryDescriptionCorpus.mjs';

export const observationReadinessKey = (key, libraryId) => `${key}:${libraryId}`;

/** No provider response, title, text or terms escape this projection. */
export function collectInventoryObservationReadiness(rows) {
  if (!Array.isArray(rows) || rows.length > 50000) throw new Error('inventory_readiness_row_budget');
  const result = new Map();
  for (const row of rows) {
    const key = observationReadinessKey(inventoryDescriptionIdentity({ media_type: row.media_type, tmdb_id: row.tmdb_id }), row.library_id);
    const observation = readInventoryTmdbObservation({ ...row, metadata: row.readiness_metadata });
    const checked = new Date(row.inventory_tmdb_checked_at ?? NaN).getTime();
    const fetched = new Date(row.inventory_tmdb_fetched_at ?? NaN).getTime();
    const status = !Number.isFinite(checked) || row.readiness_metadata == null ? 'unknown' : !observation ? 'missing_or_invalid' :
      fetched <= checked && checked - fetched < INVENTORY_TMDB_CACHE_DAYS * 86400000 ? 'current' : 'stale';
    // Duplicate source rows cannot make an incomplete identity appear complete.
    const previous = result.get(key);
    result.set(key, previous && previous !== status ? 'unknown' : status);
  }
  return result;
}
