/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validatedRecoveryGroups } from './inventoryRepresentativeMembership.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { representativeSimilarity } from './inventoryRepresentativeGeometry.mjs';

/** Training-only descriptive ranges, not confidence intervals or routing thresholds. */
export async function buildCandidateSupportRanges(model, training, dimensions, signal) {
  const ranges = new Map();
  for (const [id, profile] of model.libraries) {
    signal?.throwIfAborted();
    const membership = await validatedRecoveryGroups(profile, training.vectors, dimensions, signal);
    ranges.set(id, membership?.map((hashes, index) => {
      const centroid = normalizeDescriptionVector(profile.starts[profile.selectedStart].groups[index].centroid, dimensions);
      let minimum = 1;
      for (const hash of hashes) minimum = Math.min(minimum,
        representativeSimilarity(centroid, normalizeDescriptionVector(training.vectors.get(hash), dimensions)));
      return { centroid, minimum };
    }) ?? null);
  }
  return ranges;
}

export function candidateSupportSlice(candidates, ranges, vector, dimensions) {
  if (!candidates.length || candidates.some(([id]) => !ranges.get(id)?.length)) return 'unavailable';
  const query = normalizeDescriptionVector(vector, dimensions);
  return candidates.some(([id]) => ranges.get(id).some(group =>
    representativeSimilarity(query, group.centroid) >= group.minimum - 1e-12))
    ? 'within_observed_groups' : 'outside_observed_groups';
}
