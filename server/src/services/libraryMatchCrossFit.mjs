/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { scoreNeighborReferences } from './libraryNeighborScoring.mjs';
import { LIBRARY_MATCH_BASELINE_LIMITS } from './libraryMatchBaseline.mjs';

export const LIBRARY_MATCH_CROSS_FIT_VERSION = 'library_match_cross_fit_v1';
export const LIBRARY_MATCH_CROSS_FIT_LIMITS = Object.freeze({ ...LIBRARY_MATCH_BASELINE_LIMITS,
  pool: LIBRARY_MATCH_BASELINE_LIMITS.references + 1, modelVectorComponents: 20_000_000 });

/** Numeric experiment only: caller supplies ordered groups outside the complete evaluation fold. */
export async function fitLibraryMatchCrossFit(groups, dimensions, { signal, consumeWork } = {}) {
  const limits = LIBRARY_MATCH_CROSS_FIT_LIMITS;
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 16000 || !Array.isArray(groups) ||
      groups.length <= limits.minimum || groups.length > limits.pool) throw new Error('library_match_cross_fit_sample_invalid');
  signal?.throwIfAborted();
  const hashes = new Set();
  const copied = groups.map(group => {
    if (typeof group?.hash !== 'string' || !/^[a-f0-9]{64}$/.test(group.hash) || hashes.has(group.hash)) {
      throw new Error('library_match_cross_fit_group_invalid');
    }
    hashes.add(group.hash);
    return { hash: group.hash, vector: normalizeDescriptionVector(group.vector, dimensions) };
  });
  const count = Math.min(limits.references, copied.length - 1);
  const referencesFor = excluded => copied.filter(group => group.hash !== excluded).slice(0, count).map(group => group.vector);
  const scores = [];
  for (const group of copied.slice(0, limits.calibration)) {
    scores.push(scoreNeighborReferences(group.vector, referencesFor(group.hash), consumeWork).mean);
    await setImmediate(undefined, { signal });
  }
  scores.sort((a, b) => a - b);
  const lower = scores[Math.floor((scores.length - 1) * .1)];
  const upper = scores[Math.ceil((scores.length - 1) * .9)];
  const status = upper - lower <= 1e-6 ? 'degenerate' : 'available';
  // Match calibration reference counts exactly, including for the smallest libraries.
  const references = referencesFor();
  const summary = Object.freeze({ status, referenceDescriptions: count, calibrationDescriptions: scores.length,
    minimumCalibrationReferences: count });
  return Object.freeze({ summary, assess(vector, { consumeWork: queryWork = consumeWork } = {}) {
    if (status !== 'available') return { status, empiricalRank: null };
    const query = normalizeDescriptionVector(vector, dimensions);
    const value = scoreNeighborReferences(query, references, queryWork).mean;
    const rank = (1 + scores.filter(score => score <= value).length) / (scores.length + 1);
    return { status: rank > limits.tail ? 'familiar' : 'unusual', empiricalRank: rank };
  } });
}
