/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fitLibraryMatchBaseline, LIBRARY_MATCH_BASELINE_LIMITS, LIBRARY_MATCH_BASELINE_VERSION } from './libraryMatchBaseline.mjs';
import { prepareMatchCalibrationCorpus, splitMatchCalibrationGroups, matchCalibrationDigest } from './inventoryMatchCalibrationCorpus.mjs';
import { resolveInventoryCalibrationContext } from './inventoryCalibrationContext.mjs';
import { fitLibraryMatchCrossFit, LIBRARY_MATCH_CROSS_FIT_VERSION, LIBRARY_MATCH_CROSS_FIT_LIMITS } from './libraryMatchCrossFit.mjs';

async function fitSplit(split, corpus, crossFit, options) {
  if (crossFit) {
    const groups = [...split.calibration, ...split.references].slice(0, LIBRARY_MATCH_CROSS_FIT_LIMITS.pool);
    return groups.length <= LIBRARY_MATCH_CROSS_FIT_LIMITS.minimum ? null : fitLibraryMatchCrossFit(
      groups.map(hash => ({ hash, vector: corpus.vectors.get(hash) })), corpus.dimensions, options);
  }
  return split.references.length < LIBRARY_MATCH_BASELINE_LIMITS.minimum ? null : fitLibraryMatchBaseline(
    split.references.map(hash => corpus.vectors.get(hash)), split.calibration.map(hash => corpus.vectors.get(hash)), corpus.dimensions, options);
}

/** Snapshot-scoped learning: no singleton, persistence, provider calls or route authority. */
export function createInventoryMatchCalibration(input, { crossFit = false } = {}) {
  if (typeof crossFit !== 'boolean') throw new Error('inventory_match_calibration_mode_invalid');
  const version = crossFit ? LIBRARY_MATCH_CROSS_FIT_VERSION : LIBRARY_MATCH_BASELINE_VERSION;
  const corpus = prepareMatchCalibrationCorpus(input);
  const models = new Map();
  let operations = 0, retainedComponents = 0;
  const consumeWork = count => {
    operations += count;
    if (operations > 2_000_000_000) throw new Error('inventory_match_calibration_work_budget');
  };
  return Object.freeze({
    async assess(entry, { signal, omittedLibraryId = null } = {}) {
      signal?.throwIfAborted();
      const { mediaType, descriptionHash: queryHash, exclusions: held, contextId } = resolveInventoryCalibrationContext(corpus, entry, omittedLibraryId);
      const key = matchCalibrationDigest([corpus.fingerprint, mediaType, [...held].sort(),
        ...(crossFit ? [version, LIBRARY_MATCH_CROSS_FIT_LIMITS] : [])]);
      if (!models.has(key)) {
        if (models.size >= 20) throw new Error('inventory_match_calibration_fold_budget');
        const splits = splitMatchCalibrationGroups(corpus, mediaType, held);
        const components = crossFit ? splits.reduce((sum, split) => sum +
          Math.min(split.references.length + split.calibration.length, LIBRARY_MATCH_CROSS_FIT_LIMITS.pool), 0) * corpus.dimensions : 0;
        if (retainedComponents + components > LIBRARY_MATCH_CROSS_FIT_LIMITS.modelVectorComponents) {
          throw new Error('inventory_match_calibration_model_memory_budget');
        }
        retainedComponents += components;
        const fit = async () => {
          const result = [];
          for (const split of splits) {
            signal?.throwIfAborted();
            const { libraryId, eligibleDescriptions, sharedDescriptionsExcluded } = split;
            const baseline = await fitSplit(split, corpus, crossFit, { signal, consumeWork });
            result.push({ libraryId, eligibleDescriptions, sharedDescriptionsExcluded, baseline });
          }
          return result;
        };
        models.set(key, fit().catch(error => { models.delete(key); retainedComponents -= components; throw error; }));
      }
      const fitted = await models.get(key);
      signal?.throwIfAborted();
      // Familiarity is fitted independently per library, so omission does not refit remaining libraries.
      return { version, snapshotId: key, contextId, candidates: fitted.filter(model => model.libraryId !== omittedLibraryId).map(model => ({
        libraryId: model.libraryId, eligibleDescriptions: model.eligibleDescriptions,
        sharedDescriptionsExcluded: model.sharedDescriptionsExcluded,
        referenceDescriptions: model.baseline?.summary.referenceDescriptions ?? 0,
        calibrationDescriptions: model.baseline?.summary.calibrationDescriptions ?? 0,
        ...(crossFit ? { minimumCalibrationReferences: model.baseline?.summary.minimumCalibrationReferences ?? 0 } : {}),
        ...(model.baseline ? model.baseline.assess(corpus.vectors.get(queryHash)) : { status: 'sparse', empiricalRank: null }),
      })) };
    },
  });
}
