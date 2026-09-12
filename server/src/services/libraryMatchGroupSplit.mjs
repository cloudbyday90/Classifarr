/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { LIBRARY_MATCH_BASELINE_VERSION, LIBRARY_MATCH_BASELINE_LIMITS } from './libraryMatchBaseline.mjs';

/** Shared deterministic split for offline folds and fresh live-library snapshots. */
export function splitLibraryMatchGroups(allGroups, libraryId, mediaType, held) {
  const groups = [...allGroups].filter(group => group.mediaType === mediaType &&
    !held.has(group.hash) && group.libraryIds.has(libraryId));
  const exclusive = groups.filter(group => group.libraryIds.size === 1).map(group => ({ hash: group.hash,
    order: createHash('sha256').update(JSON.stringify([LIBRARY_MATCH_BASELINE_VERSION, mediaType, group.hash])).digest('hex') }))
    .sort((a, b) => a.order < b.order ? -1 : a.order > b.order ? 1 : 0);
  const limits = LIBRARY_MATCH_BASELINE_LIMITS;
  const count = Math.min(limits.calibration, Math.max(limits.minimum, Math.floor(exclusive.length / 4)));
  return { libraryId, eligibleDescriptions: exclusive.length, sharedDescriptionsExcluded: groups.length - exclusive.length,
    calibration: exclusive.slice(0, count).map(group => group.hash),
    references: exclusive.slice(count, count + limits.references).map(group => group.hash) };
}
