/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { scoreNeighborReferences, neighborMargin, summarizeNeighborMarginDistributions, assessNeighborMarginModels } from './libraryNeighborScoring.mjs';

export const NEIGHBOR_CROSS_FIT_VERSION = 'library_neighbor_cross_fit_v1';
export const NEIGHBOR_CROSS_FIT_LIMITS = Object.freeze({ minimum: 20, references: 64, calibration: 32,
  pool: 65, tail: .05, modelVectorComponents: 20_000_000 });

/** Rejoin the existing ordered exclusive split; the complete outer fold is already excluded. */
export function selectNeighborCrossFitGroups(splits, vectors) {
  return splits.map(split => ({ libraryId: split.libraryId,
    references: [...split.calibration, ...split.references].slice(0, NEIGHBOR_CROSS_FIT_LIMITS.pool)
      .map(hash => ({ hash, vector: vectors.get(hash) })) }));
}

/** Group-excluded empirical calibration, not conformal coverage or routing permission. */
export async function fitLibraryNeighborCrossFit(groups, dimensions, { signal, consumeWork } = {}) {
  const limits = NEIGHBOR_CROSS_FIT_LIMITS;
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 16000 || !Array.isArray(groups) ||
      groups.length < 2 || groups.length > 64 || new Set(groups.map(group => group?.libraryId)).size !== groups.length ||
      groups.some(group => !Number.isInteger(group?.libraryId) || group.libraryId < 1 || group.libraryId > 2147483647 ||
        !Array.isArray(group.references) || group.references.length > limits.pool)) throw new Error('neighbor_cross_fit_groups_invalid');
  if (groups.reduce((sum, group) => sum + group.references.length, 0) * dimensions > limits.modelVectorComponents) {
    throw new Error('neighbor_cross_fit_vector_budget');
  }
  signal?.throwIfAborted();
  const hashes = new Set();
  const copied = groups.map(group => ({ libraryId: group.libraryId, references: group.references.map(item => {
    if (typeof item?.hash !== 'string' || !/^[a-f0-9]{64}$/.test(item.hash) || hashes.has(item.hash)) throw new Error('neighbor_cross_fit_group_identity_invalid');
    hashes.add(item.hash);
    return { hash: item.hash, vector: normalizeDescriptionVector(item.vector, dimensions) };
  }) }));
  const coverage = copied.map(group => ({ referenceDescriptions: Math.min(limits.references, group.references.length),
    calibrationDescriptions: Math.min(limits.calibration, group.references.length),
    minimumCalibrationReferences: Math.max(0, Math.min(limits.references, group.references.length - 1)) }));
  const sparse = coverage.some(group => group.minimumCalibrationReferences < limits.minimum || group.calibrationDescriptions < limits.minimum);
  const referencesFor = (group, excluded) => group.references.filter(item => item.hash !== excluded).slice(0, limits.references).map(item => item.vector);
  const distributions = copied.map(() => copied.map(() => []));
  if (!sparse) {
    for (const [source, group] of copied.entries()) {
      for (const item of group.references.slice(0, limits.calibration)) {
        signal?.throwIfAborted();
        const scores = copied.map(other => scoreNeighborReferences(item.vector, referencesFor(other, item.hash), consumeWork));
        for (let target = 0; target < copied.length; target++) distributions[target][source].push(neighborMargin(scores, target));
        await setImmediate(undefined, { signal });
      }
    }
  }
  const models = summarizeNeighborMarginDistributions(copied.map(group => group.libraryId), distributions, sparse, limits.tail);
  const references = copied.map(group => referencesFor(group));
  signal?.throwIfAborted();
  return Object.freeze({ assess(vector) {
    const query = normalizeDescriptionVector(vector, dimensions);
    const scores = references.map(group => scoreNeighborReferences(query, group, consumeWork));
    return assessNeighborMarginModels(models, scores, coverage, limits.tail);
  } });
}
