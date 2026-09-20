/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateMatchCalibrationFold, matchCalibrationDigest } from './inventoryMatchCalibrationCorpus.mjs';

/** Validate on every call, including cache hits; copy scope before any asynchronous work. */
export function resolveInventoryCalibrationContext(corpus, entry, omittedLibraryId = null) {
  const { mediaType, descriptionHash, itemIdentity, heldDescriptionHashes: held } = entry ?? {};
  if (!(held instanceof Set) || !held.has(descriptionHash) || itemIdentity?.mediaType !== mediaType ||
      !Number.isSafeInteger(itemIdentity?.tmdbId) || itemIdentity.tmdbId < 1 ||
      corpus.identities.get(`${mediaType}:${itemIdentity.tmdbId}`) !== descriptionHash) throw new Error('inventory_calibration_query_invalid');
  validateMatchCalibrationFold(corpus, mediaType, held);
  if (omittedLibraryId !== null && (!Number.isInteger(omittedLibraryId) || corpus.media.get(omittedLibraryId) !== mediaType)) {
    throw new Error('inventory_calibration_scope_invalid');
  }
  const exclusions = new Set(held);
  const contextId = matchCalibrationDigest(['inventory_calibration_context_v1', corpus.fingerprint,
    mediaType, itemIdentity.tmdbId, descriptionHash, [...exclusions].sort(), omittedLibraryId]);
  return { mediaType, descriptionHash, exclusions, contextId };
}
