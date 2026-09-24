/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { normalizeImdbId } from './mediaSourceIdentity.mjs';
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';

/** A local membership key, never a claim that two providers identify one work. */
export function sourceEvidenceAnchor(row, libraryId) {
  const serverId = positiveDatabaseInteger(row?.media_server_id);
  const externalId = row?.external_id;
  const mediaType = row?.media_type;
  if (!positiveDatabaseInteger(libraryId) || !serverId || typeof externalId !== 'string' ||
      !externalId.trim() || [...externalId].length > 100 || typeof mediaType !== 'string' ||
      !mediaType.trim() || [...mediaType].length > 10) return null;
  return { scope: 'source_item', libraryId, mediaServerId: serverId, mediaType, externalId };
}

/** Provider IDs remain observations; source anchors are not cross-library joins. */
export function summarizeLibrarySourceEvidence(rows, libraryId, libraryMediaType) {
  if (!Array.isArray(rows) || rows.length > 10000 || typeof libraryMediaType !== 'string') {
    throw new TypeError('Invalid bounded source evidence window');
  }
  const counts = { statusId: 'measured', typeMatchedItemCount: 0, anchoredItemCount: 0,
    conflictBlockedItemCount: 0, eligibleItemCount: 0, describedItemCount: 0,
    missingDescriptionItemCount: 0, describedWithoutTmdbItemCount: 0,
    alternateProviderObservedItemCount: 0 };
  const anchors = new Set();
  for (const row of rows) {
    if (row.media_type !== libraryMediaType) continue;
    counts.typeMatchedItemCount++;
    const anchor = sourceEvidenceAnchor(row, libraryId);
    if (!anchor) continue;
    const key = JSON.stringify([anchor.libraryId, anchor.mediaServerId,
      anchor.mediaType, anchor.externalId]);
    if (anchors.has(key)) throw new TypeError('Duplicate source evidence anchor');
    anchors.add(key);
    counts.anchoredItemCount++;
    if (row.source_conflict === true) { counts.conflictBlockedItemCount++; continue; }
    counts.eligibleItemCount++;
    if (normalizeImdbId(row.imdb_id) || positiveDatabaseInteger(row.tvdb_id)) {
      counts.alternateProviderObservedItemCount++;
    }
    const projection = projectInventoryDescription({ metadata: { overview: row.overview } });
    if (!projection) { counts.missingDescriptionItemCount++; continue; }
    counts.describedItemCount++;
    if (!positiveDatabaseInteger(row.tmdb_id)) counts.describedWithoutTmdbItemCount++;
  }
  return counts;
}
