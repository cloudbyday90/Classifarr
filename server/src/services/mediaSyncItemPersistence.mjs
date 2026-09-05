/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { decideSyncedIdentity, normalizeSourceProviderIds, sourceMetadata } from './mediaSourceIdentity.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { READ_SYNC_ITEM, UPSERT_SYNC_ITEM } from './mediaSyncItemQueries.mjs';

/** Capture once, analyze without locks, then recompute after any concurrent writer. */
export async function persistSyncedMediaItem(mediaServerId, libraryId, item, { query, analyze }) {
  const incoming = structuredClone(item);
  const ids = normalizeSourceProviderIds(incoming);
  const mediaType = canonicalMediaType(incoming.media_type);
  if (!positiveDatabaseInteger(mediaServerId) || !ids || !mediaType ||
      typeof incoming.external_id !== 'string' || !incoming.external_id.trim()) return 'invalid_source_identity';
  Object.assign(incoming, ids, { media_server_id: mediaServerId, media_type: mediaType,
    metadata: sourceMetadata(incoming.metadata) });
  const genres = normalizeMetadataList(incoming.genres);
  const tags = normalizeMetadataList(incoming.tags);
  const collections = normalizeMetadataList(incoming.collections);
  const analysis = await analyze({ title: incoming.title, overview: incoming.metadata.summary || '',
    genres, tags, keywords: [], content_rating: incoming.content_rating,
    original_language: null, tmdb_id: incoming.tmdb_id }, null, true);
  if (analysis.analyzed && analysis.bestMatch) incoming.metadata.content_analysis = {
    type: analysis.bestMatch.type, confidence: analysis.bestMatch.confidence, detected_at: new Date().toISOString(),
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const { rows } = await query(READ_SYNC_ITEM, [mediaServerId, incoming.external_id]);
    const current = rows[0];
    const decision = decideSyncedIdentity(current, incoming);
    const updated = await query(UPSERT_SYNC_ITEM, [mediaServerId, libraryId, incoming.external_id,
      decision.tmdbId, ids.imdb_id, ids.tvdb_id, incoming.title, incoming.original_title || null,
      incoming.year || null, mediaType, genres, tags, collections, incoming.studio || null,
      incoming.content_rating || null, incoming.added_at || null, JSON.stringify(decision.metadata),
      current?.source_revision ?? null, decision.preserveRating]);
    if (updated.rowCount === 1) return 'synced';
  }
  return 'concurrent_source_change';
}
