/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';

export const NEIGHBOR_MARGIN_VERSION = 'library_neighbor_margin_v1';
export const NEIGHBOR_MARGIN_LIMITS = Object.freeze({ minimum: 20, references: 64, calibration: 32, tail: .05,
  modelVectorComponents: 20_000_000 });

function neighbors(query, references, consumeWork) {
  consumeWork?.(query.length * references.length);
  let first = -1, second = -1, third = -1;
  for (const vector of references) {
    let dot = 0;
    for (let i = 0; i < query.length; i++) dot += query[i] * vector[i];
    const value = Math.max(-1, Math.min(1, dot));
    if (value > first) { third = second; second = first; first = value; }
    else if (value > second) { third = second; second = value; }
    else if (value > third) third = value;
  }
  return { maximum: first, minimum: third, mean: (first + second + third) / 3 };
}
const margin = (scores, selected) => scores[selected].mean - Math.max(...scores.filter((_, index) => index !== selected).map(value => value.mean));

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
        const scores = copied.map(other => neighbors(vector, other.references, consumeWork));
        for (let target = 0; target < copied.length; target++) distributions[target][source].push(margin(scores, target));
        await setImmediate(undefined, { signal });
      }
    }
  }
  const models = copied.map((group, index) => {
    const positive = distributions[index][index].sort((a, b) => a - b);
    const threshold = sparse ? null : Math.max(0, ...distributions[index].filter((_, source) => source !== index)
      .map(values => values.sort((a, b) => a - b)[Math.ceil((values.length + 1) * (1 - limits.tail)) - 1]));
    const degenerate = !sparse && positive[Math.ceil((positive.length - 1) * .9)] - positive[Math.floor((positive.length - 1) * .1)] <= 1e-6;
    return { libraryId: group.libraryId, positive, threshold, status: sparse ? 'sparse' : degenerate ? 'degenerate' : 'available' };
  });
  signal?.throwIfAborted();
  return Object.freeze({
    assess(vector) {
      const query = normalizeDescriptionVector(vector, dimensions);
      const scores = copied.map(group => neighbors(query, group.references, consumeWork));
      const referenceComplete = copied.every(group => group.references.length >= 3);
      return models.map((model, index) => {
        const value = referenceComplete ? margin(scores, index) : null;
        const empiricalRank = model.status === 'available' ? (1 + model.positive.filter(score => score <= value).length) / (model.positive.length + 1) : null;
        return { libraryId: model.libraryId, status: model.status, referenceComplete,
          referenceDescriptions: copied[index].references.length, calibrationDescriptions: copied[index].calibration.length,
          strict: referenceComplete && scores[index].minimum > Math.max(...scores.filter((_, other) => other !== index).map(score => score.maximum)),
          mean: referenceComplete && value > 0,
          calibrated: model.status === 'available' && value > model.threshold && empiricalRank > limits.tail };
      });
    },
  });
}
