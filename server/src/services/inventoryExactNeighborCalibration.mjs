/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { splitMatchCalibrationGroups, matchCalibrationDigest } from './inventoryMatchCalibrationCorpus.mjs';
import { resolveInventoryCalibrationContext } from './inventoryCalibrationContext.mjs';
import { createExactNeighborScoreCache, EXACT_NEIGHBOR_BUDGET } from './exactNeighborScoreCache.mjs';
import { neighborMargin, summarizeNeighborMarginDistributions, assessNeighborMarginModels } from './libraryNeighborScoring.mjs';

export const EXACT_NEIGHBOR_VERSION = 'library_neighbor_exact_cross_fit_v2';
export const EXACT_NEIGHBOR_LIMITS = Object.freeze({ minimum: 20, references: 10000, calibration: 32, tail: .05 });

/** Internal factory: corpus is already validated, copied and exclusively owned by the paired evaluator. */
export function createExactNeighborCalibration(corpus) {
  const limits = EXACT_NEIGHBOR_LIMITS, models = new Map(), cache = createExactNeighborScoreCache(corpus.vectors);
  const score = async (queryHash, groups, signal) => {
    const scores = [];
    for (const group of groups) scores.push(await cache.score(queryHash, group.references.filter(hash => hash !== queryHash), { signal }));
    return scores;
  };
  async function fit(groups, signal) {
    const coverage = groups.map(group => ({ referenceDescriptions: group.references.length,
      calibrationDescriptions: group.calibration.length, minimumCalibrationReferences: Math.max(0, group.references.length - 1) }));
    const sparse = coverage.some(group => group.minimumCalibrationReferences < limits.minimum || group.calibrationDescriptions < limits.minimum);
    const distributions = groups.map(() => groups.map(() => []));
    if (!sparse) for (const [source, group] of groups.entries()) {
      for (const hash of group.calibration) {
        const scores = await score(hash, groups, signal);
        for (let target = 0; target < groups.length; target++) distributions[target][source].push(neighborMargin(scores, target));
      }
    }
    return { groups, coverage, summaries: summarizeNeighborMarginDistributions(groups.map(group => group.libraryId), distributions, sparse, limits.tail) };
  }
  return Object.freeze({
    contextFor: (entry, omittedLibraryId = null) => resolveInventoryCalibrationContext(corpus, entry, omittedLibraryId).contextId,
    async assess(entry, { signal, omittedLibraryId = null } = {}) {
      signal?.throwIfAborted();
      const { mediaType, descriptionHash, exclusions, contextId } = resolveInventoryCalibrationContext(corpus, entry, omittedLibraryId);
      const key = matchCalibrationDigest([EXACT_NEIGHBOR_VERSION, limits, EXACT_NEIGHBOR_BUDGET, corpus.fingerprint, mediaType, [...exclusions].sort(), omittedLibraryId]);
      if (!models.has(key)) {
        if (models.size >= 20) throw new Error('exact_neighbor_fold_budget');
        const splits = splitMatchCalibrationGroups(corpus, mediaType, exclusions).filter(split => split.libraryId !== omittedLibraryId);
        if (splits.length < 2) return { version: EXACT_NEIGHBOR_VERSION, contextId, candidates: [], status: 'insufficient_libraries' };
        const admitted = [...corpus.groups.values()].filter(group => group.mediaType === mediaType &&
          group.libraryIds.size === 1 && !exclusions.has(group.hash));
        const groups = splits.map(split => ({ libraryId: split.libraryId,
          calibration: [...split.calibration, ...split.references].slice(0, limits.calibration),
          references: admitted.filter(group => group.libraryIds.has(split.libraryId)).map(group => group.hash).sort() }));
        const fitting = async () => {
          const sparse = groups.some(group => group.references.length - 1 < limits.minimum || group.calibration.length < limits.minimum);
          await cache.preflight([descriptionHash, ...(sparse ? [] : groups.flatMap(group => group.calibration))],
            groups.flatMap(group => group.references), { signal });
          return fit(groups, signal);
        };
        models.set(key, fitting().catch(error => { models.delete(key); throw error; }));
      }
      const fitted = await models.get(key);
      const scores = await score(descriptionHash, fitted.groups, signal);
      signal?.throwIfAborted();
      return { version: EXACT_NEIGHBOR_VERSION, snapshotId: key, contextId, status: 'evaluated',
        candidates: assessNeighborMarginModels(fitted.summaries, scores, fitted.coverage, limits.tail), resources: cache.stats() };
    },
  });
}
