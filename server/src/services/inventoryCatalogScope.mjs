/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const id = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

/** A typed database projection, not a field accepted from provider metadata. */
export function inventoryCatalogScopeKey(row) {
  const scope = row?.catalog_scope;
  if (scope == null) return null;
  if (row.media_type !== 'tv' || row.tmdb_id != null || scope.kind !== 'season' ||
      Object.keys(scope).length !== 3 || !id(scope.tmdbSeriesId) ||
      !Number.isSafeInteger(scope.seasonNumber) || scope.seasonNumber < 0 || scope.seasonNumber > 10000) {
    throw new Error('inventory_catalog_scope_invalid');
  }
  return `tv:${scope.tmdbSeriesId}:season:${scope.seasonNumber}`;
}

/** A parent query must hold out its seasons, never learn from its own children. */
export function inventoryCatalogScopeMatches(row, key) {
  const scoped = inventoryCatalogScopeKey(row);
  return scoped ? scoped === key || `tv:${row.catalog_scope.tmdbSeriesId}` === key
    : `${row?.media_type}:${row?.tmdb_id}` === key;
}

/** Whole-work-only models may not silently reinterpret a season as its parent. */
export function isWholeWorkInventoryDescription(row) {
  return row?.catalog_scope == null && ['movie', 'tv'].includes(row?.media_type) && id(row?.tmdb_id);
}
