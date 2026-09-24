/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildInventoryDescriptionCorpusSql, inventoryDescriptionIdentity, prepareInventoryDescriptionCorpus } from './inventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from './sourceConflictAuthorityGuard.mjs';

export const LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL = buildInventoryDescriptionCorpusSql({
  includeCandidateMetadata: true, includeCompanyMetadata: true, mediaTypeScoped: true, includeSourceItems: true,
});
export const LIVE_INVENTORY_DESCRIPTION_CALIBRATION_SQL = buildInventoryDescriptionCorpusSql({
  includeCandidateMetadata: true, includeCompanyMetadata: true, mediaTypeScoped: true,
});

/** Called inside a fresh read-only transaction; all active same-media libraries remain in scope. */
export async function readLiveInventoryDescriptionCorpus(client, request, signal) {
  signal?.throwIfAborted();
  const { mediaType, key } = request ?? {};
  if (!['movie', 'tv'].includes(mediaType) || typeof key !== 'string' || key.length > 16 ||
      inventoryDescriptionIdentity({ media_type: mediaType, tmdb_id: Number(key.split(':')[1]) }) !== key) {
    throw new Error('live_inventory_description_media_scope_invalid');
  }
  const { matchLibraryId, neighborCalibration } = request;
  const includeSourceItems = matchLibraryId == null && neighborCalibration !== true;
  const { rows } = await client.query(includeSourceItems
    ? LIVE_INVENTORY_DESCRIPTION_CORPUS_SQL : LIVE_INVENTORY_DESCRIPTION_CALIBRATION_SQL,
    [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, mediaType]);
  signal?.throwIfAborted();
  if (request.mediaType !== mediaType || request.key !== key || request.matchLibraryId !== matchLibraryId ||
      request.neighborCalibration !== neighborCalibration ||
      !Array.isArray(rows) || rows.some(row => row?.media_type !== mediaType)) {
    throw new Error('live_inventory_description_media_scope_changed');
  }
  // Source-only evidence informs comparison/learning, not the existing approval calibration.
  return { rows, corpus: prepareInventoryDescriptionCorpus(rows, { includeSourceItems }) };
}
