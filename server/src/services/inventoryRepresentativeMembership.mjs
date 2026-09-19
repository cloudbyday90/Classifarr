/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { representativeValidationError } from './representativeValidation.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';

/** Exact selected partition of available, exclusive source hashes; never infer missing labels. */
export function validateRepresentativeMembership(profile, expectedHashes) {
  const membership = profile.membership, selected = profile.starts[profile.selectedStart];
  if (!membership || Object.keys(membership).length !== 2 || !Array.isArray(membership.groups) ||
      membership.groups.length !== selected.groups.length || !Array.isArray(membership.unassigned) ||
      membership.unassigned.length > expectedHashes.size) throw representativeValidationError('profile_structure');
  const seen = new Set();
  const accept = hashes => {
    for (const hash of hashes) {
      if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash) || !expectedHashes.has(hash) || seen.has(hash)) {
        throw representativeValidationError('profile_structure');
      }
      seen.add(hash);
    }
  };
  for (const [index, hashes] of membership.groups.entries()) {
    const group = selected.groups[index];
    if (!Array.isArray(hashes) || hashes.length < 3 || hashes.length > expectedHashes.size || hashes.length !== group.support ||
        !Array.isArray(group.representatives) || group.representatives.length !== 3 ||
        new Set(group.representatives).size !== 3) throw representativeValidationError('profile_structure');
    accept(hashes);
    const members = new Set(hashes);
    if ([...group.representatives].some(hash => !members.has(hash))) throw representativeValidationError('profile_structure');
  }
  accept(membership.unassigned);
  if (seen.size !== expectedHashes.size) throw representativeValidationError('profile_structure');
}

/** Validate retained means in O(source components), not nearest-centroid reassignment. */
export async function validatedRecoveryGroups(profile, vectors, dimensions, signal) {
  const selected = profile.starts[profile.selectedStart];
  if (profile.coverage.status !== 'complete' || !selected.converged || !selected.groups.length) return null;
  const groups = profile.membership.groups.map(hashes => [...hashes]);
  let processed = 0;
  for (let index = 0; index < groups.length; index++) {
    const sum = Array(dimensions).fill(0);
    for (const hash of groups[index]) {
      if (processed++ % 128 === 0) { await setImmediate(); signal?.throwIfAborted(); }
      const vector = normalizeDescriptionVector(vectors.get(hash), dimensions);
      for (let dimension = 0; dimension < dimensions; dimension++) sum[dimension] += vector[dimension];
    }
    const norm = Math.sqrt(sum.reduce((total, value) => total + value * value, 0));
    const centroid = selected.groups[index].centroid;
    if (norm <= 1e-12 || sum.some((value, dimension) => Math.abs(value / norm - centroid[dimension]) > 1e-6)) {
      throw representativeValidationError('profile_structure');
    }
  }
  signal?.throwIfAborted();
  return groups;
}
