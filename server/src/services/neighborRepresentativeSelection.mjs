/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fitRepresentativeGeometry, REPRESENTATIVE_MAX_GROUPS, REPRESENTATIVE_MAX_PASSES } from './inventoryRepresentativeGeometry.mjs';
import { NEIGHBOR_CROSS_FIT_LIMITS } from './libraryNeighborCrossFit.mjs';

export const NEIGHBOR_REPRESENTATIVE_VERSION = 'library_neighbor_representative_cross_fit_v1';
export const NEIGHBOR_REPRESENTATIVE_LIMITS = Object.freeze({ ...NEIGHBOR_CROSS_FIT_LIMITS,
  selectionPool: 256, selectionPasses: REPRESENTATIVE_MAX_PASSES });
// Conservative assignment, mean update, seeding and summary reservation, as in the profile fitter.
const workFactor = REPRESENTATIVE_MAX_GROUPS * (REPRESENTATIVE_MAX_PASSES + 4) + REPRESENTATIVE_MAX_PASSES;

/** Private normalized corpus only. Selection never sees calibration or outer held-out vectors. */
export async function selectRepresentativeNeighborGroups(splits, vectors, dimensions, { signal, consumeWork } = {}) {
  const limits = NEIGHBOR_REPRESENTATIVE_LIMITS, groups = [];
  for (const split of splits) {
    signal?.throwIfAborted();
    const ordered = [...split.calibration, ...split.references].slice(0, limits.selectionPool);
    let selected = ordered.slice(0, limits.pool), selectionStatus = 'unchanged_small';
    if (ordered.length > limits.pool) {
      const fixed = ordered.slice(0, limits.calibration), remaining = ordered.slice(limits.calibration);
      consumeWork?.(remaining.length * dimensions * workFactor);
      const fit = await fitRepresentativeGeometry(remaining.map(hash => ({ hash, vector: vectors.get(hash) })), { signal });
      selectionStatus = fit.converged ? 'representative' : 'ordered_fallback';
      if (fit.converged) {
        const preferred = fit.groups.flatMap(group => group.representatives);
        selected = [...fixed, ...new Set([...preferred, ...remaining])].slice(0, limits.pool);
      }
    }
    groups.push({ libraryId: split.libraryId, selectionStatus, selectionPool: ordered.length,
      references: selected.map(hash => ({ hash, vector: vectors.get(hash) })) });
  }
  signal?.throwIfAborted();
  return groups;
}
