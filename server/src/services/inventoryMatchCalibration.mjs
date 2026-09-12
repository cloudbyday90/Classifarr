/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fitLibraryMatchBaseline, LIBRARY_MATCH_BASELINE_LIMITS, LIBRARY_MATCH_BASELINE_VERSION } from './libraryMatchBaseline.mjs';
import { prepareMatchCalibrationCorpus, splitMatchCalibrationGroups, validateMatchCalibrationFold, matchCalibrationDigest } from './inventoryMatchCalibrationCorpus.mjs';

/** Snapshot-scoped learning: no singleton, persistence, provider calls or route authority. */
export function createInventoryMatchCalibration(input) {
  const corpus = prepareMatchCalibrationCorpus(input);
  const models = new Map();
  let operations = 0;
  const consumeWork = count => {
    operations += count;
    if (operations > 2_000_000_000) throw new Error('inventory_match_calibration_work_budget');
  };
  return Object.freeze({
    async assess(entry, { signal } = {}) {
      signal?.throwIfAborted();
      const held = entry?.heldDescriptionHashes;
      const queryHash = entry?.descriptionHash;
      const queryKey = `${entry?.mediaType}:${entry?.itemIdentity?.tmdbId}`;
      if (!(held instanceof Set) || !held.has(entry.descriptionHash) || entry.itemIdentity?.mediaType !== entry.mediaType ||
          corpus.identities.get(queryKey) !== entry.descriptionHash) throw new Error('inventory_match_calibration_query_invalid');
      // Validate even on cache hits, then copy the exclusion set before the first await.
      validateMatchCalibrationFold(corpus, entry.mediaType, held);
      const key = matchCalibrationDigest([corpus.fingerprint, entry.mediaType, [...held].sort()]);
      if (!models.has(key)) {
        if (models.size >= 20) throw new Error('inventory_match_calibration_fold_budget');
        const splits = splitMatchCalibrationGroups(corpus, entry.mediaType, new Set(held));
        const fit = async () => {
          const result = [];
          for (const split of splits) {
            signal?.throwIfAborted();
            const { libraryId, eligibleDescriptions, sharedDescriptionsExcluded, references, calibration } = split;
            const baseline = references.length < LIBRARY_MATCH_BASELINE_LIMITS.minimum ? null :
              await fitLibraryMatchBaseline(references.map(hash => corpus.vectors.get(hash)),
                calibration.map(hash => corpus.vectors.get(hash)), corpus.dimensions, { signal, consumeWork });
            result.push({ libraryId, eligibleDescriptions, sharedDescriptionsExcluded, baseline });
          }
          return result;
        };
        models.set(key, fit().catch(error => { models.delete(key); throw error; }));
      }
      const fitted = await models.get(key);
      signal?.throwIfAborted();
      return { version: LIBRARY_MATCH_BASELINE_VERSION, snapshotId: key, candidates: fitted.map(model => ({
        libraryId: model.libraryId, eligibleDescriptions: model.eligibleDescriptions,
        sharedDescriptionsExcluded: model.sharedDescriptionsExcluded,
        referenceDescriptions: model.baseline?.summary.referenceDescriptions ?? 0,
        calibrationDescriptions: model.baseline?.summary.calibrationDescriptions ?? 0,
        ...(model.baseline ? model.baseline.assess(corpus.vectors.get(queryHash)) : { status: 'sparse', empiricalRank: null }),
      })) };
    },
  });
}
