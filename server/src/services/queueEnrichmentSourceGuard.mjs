/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const SOURCE_FIELDS = Object.freeze([
  'media_server_id', 'external_id', 'library_id', 'media_type', 'title', 'year', 'imdb_id', 'tvdb_id',
]);

// Fixed column projection shared by conditional writes; no caller controls SQL identifiers.
export const ENRICHMENT_SOURCE_SQL = `jsonb_build_object(
  'media_server_id', media_server_id, 'external_id', external_id, 'library_id', library_id,
  'media_type', media_type, 'title', title, 'year', year, 'imdb_id', imdb_id, 'tvdb_id', tvdb_id)`;

export function captureEnrichmentSource(row) {
  return Object.fromEntries(SOURCE_FIELDS.map(field => [field, row[field] ?? null]));
}

/** Missing fields cannot silently become null and match an unrelated incomplete source. */
export function encodeEnrichmentSource(source, mediaType, libraryId = undefined) {
  if (!source || typeof source !== 'object' || Array.isArray(source) ||
      source.media_type !== mediaType || (libraryId !== undefined && source.library_id !== libraryId) ||
      SOURCE_FIELDS.some(field => !Object.hasOwn(source, field) ||
        !(source[field] === null || typeof source[field] === 'string' ||
          (typeof source[field] === 'number' && Number.isFinite(source[field]))))) return null;
  return JSON.stringify(captureEnrichmentSource(source));
}
