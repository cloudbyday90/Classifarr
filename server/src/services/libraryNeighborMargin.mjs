/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { scoreNeighborReferences, neighborMargin, summarizeNeighborMarginDistributions, assessNeighborMarginModels } from './libraryNeighborScoring.mjs';

export const NEIGHBOR_MARGIN_VERSION = 'library_neighbor_margin_v1';
export const NEIGHBOR_MARGIN_LIMITS = Object.freeze({ minimum: 20, references: 64, calibration: 32, tail: .05,
  modelVectorComponents: 20_000_000 });

/** Numeric experiment only: no confidence probability, labels, IO or routing capability. */
export async function fitLibraryNeighborMargins(groups, dimensions, { signal, consumeWork } = {}) {
  const limits = NEIGHBOR_MARGIN_LIMITS;
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 16000 || !Array.isArray(groups) ||
      groups.length < 2 || groups.length > 64 || new Set(groups.map(group => group?.libraryId)).size !== groups.length ||
      groups.some(group => !Number.isInteger(group?.libraryId) || group.libraryId < 1 || group.libraryId > 2147483647 ||
        !Array.isArray(group.references) || group.references.length > limits.references ||
        !Array.isArray(group.calibration) || group.calibration.length > limits.calibration)) throw new Error('neighbor_margin_groups_invalid');
  if (groups.reduce((sum, group) => sum + group.references.length + group.calibration.length, 0) * dimensions > limits.modelVectorComponents) {
    throw new Error('neighbor_margin_vector_budget');
  }
  signal?.throwIfAborted();
  const copied = groups.map(group => ({ libraryId: group.libraryId,
    references: group.references.map(vector => normalizeDescriptionVector(vector, dimensions)),
    calibration: group.calibration.map(vector => normalizeDescriptionVector(vector, dimensions)) }));
  const sparse = copied.some(group => group.references.length < limits.minimum || group.calibration.length < limits.minimum);
  const distributions = copied.map(() => copied.map(() => []));
  if (!sparse) {
    for (const [source, group] of copied.entries()) {
      for (const vector of group.calibration) {
        signal?.throwIfAborted();
        const scores = copied.map(other => scoreNeighborReferences(vector, other.references, consumeWork));
        for (let target = 0; target < copied.length; target++) distributions[target][source].push(neighborMargin(scores, target));
        await setImmediate(undefined, { signal });
      }
    }
  }
  const models = summarizeNeighborMarginDistributions(copied.map(group => group.libraryId), distributions, sparse, limits.tail);
  const coverage = copied.map(group => ({ referenceDescriptions: group.references.length, calibrationDescriptions: group.calibration.length }));
  signal?.throwIfAborted();
  return Object.freeze({
    assess(vector) {
      const query = normalizeDescriptionVector(vector, dimensions);
      const scores = copied.map(group => scoreNeighborReferences(query, group.references, consumeWork));
      return assessNeighborMarginModels(models, scores, coverage, limits.tail);
    },
  });
}
