/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';

export const LIBRARY_MATCH_BASELINE_VERSION = 'library_match_baseline_v1';
export const LIBRARY_MATCH_BASELINE_LIMITS = Object.freeze({ minimum: 20, references: 256, calibration: 128, tail: .05 });

// Vectors are normalized and copied at the session boundary. Keep only three maxima.
function score(query, references) {
  let first = -1, second = -1, third = -1;
  for (const vector of references) {
    let dot = 0;
    for (let index = 0; index < query.length; index++) dot += query[index] * vector[index];
    const value = Math.max(-1, Math.min(1, dot));
    if (value > first) { third = second; second = first; first = value; }
    else if (value > second) { third = second; second = value; }
    else if (value > third) third = value;
  }
  return (first + second + third) / 3;
}

/** Internal numeric kernel. No IO, confidence, labels, names or routing capability. */
export async function fitLibraryMatchBaseline(referenceVectors, calibrationVectors, dimensions, { signal, consumeWork } = {}) {
  const limits = LIBRARY_MATCH_BASELINE_LIMITS;
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 16000 ||
      !Array.isArray(referenceVectors) || !Array.isArray(calibrationVectors) ||
      referenceVectors.length < limits.minimum || referenceVectors.length > limits.references ||
      calibrationVectors.length < limits.minimum || calibrationVectors.length > limits.calibration) {
    throw new Error('library_match_baseline_sample_invalid');
  }
  signal?.throwIfAborted();
  const references = referenceVectors.map(vector => normalizeDescriptionVector(vector, dimensions));
  const calibration = calibrationVectors.map(vector => normalizeDescriptionVector(vector, dimensions));
  const work = references.length * dimensions;
  const scores = [];
  for (const vector of calibration) {
    // A bounded row of dot products, then a yield so cancellation is observable.
    consumeWork?.(work);
    scores.push(score(vector, references));
    await setImmediate(undefined, { signal });
  }
  scores.sort((a, b) => a - b);
  const lower = scores[Math.floor((scores.length - 1) * .1)];
  const upper = scores[Math.ceil((scores.length - 1) * .9)];
  const status = upper - lower <= 1e-6 ? 'degenerate' : 'available';
  const summary = Object.freeze({ status, referenceDescriptions: references.length, calibrationDescriptions: scores.length });
  return Object.freeze({ summary,
    assess(vector) {
      if (status !== 'available') return { status, empiricalRank: null };
      const query = normalizeDescriptionVector(vector, dimensions);
      consumeWork?.(work);
      const similarity = score(query, references);
      const rank = (1 + scores.filter(value => value <= similarity).length) / (scores.length + 1);
      return { status: rank > limits.tail ? 'familiar' : 'unusual', empiricalRank: rank };
    },
  });
}
