/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { REPRESENTATIVE_MAX_GROUPS } from './inventoryRepresentativeGeometry.mjs';

export function representativeValidationError(issue, message = 'representative_validation_failed') {
  return Object.assign(new Error(message), { representativeIssue: issue });
}

/** The existing embedding validator is authoritative; only diagnose after it rejects. */
export function validateRepresentativeVector(vector, dimensions, source) {
  try {
    if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 16000) throw representativeValidationError(`${source}_dimensions`);
    return validateEmbedding(vector, dimensions);
  }
  catch {
    let cause = 'shape';
    if (Array.isArray(vector) && vector.length > 0 && vector.length <= 16000) {
      if (!Number.isInteger(dimensions) || vector.length !== dimensions) cause = 'dimensions';
      else if (Array.from({ length: vector.length }, (_, index) => index).some(index =>
        !Object.hasOwn(vector, index) || !Number.isFinite(vector[index]))) cause = 'nonfinite';
      else if (vector.some(value => !Number.isFinite(Math.fround(value)) || (value !== 0 && Math.fround(value) === 0))) cause = 'float32';
      else if (vector.every(value => value === 0)) cause = 'zero';
    }
    throw representativeValidationError(`${source}_${cause}`);
  }
}

export function validateRepresentativeProfiles(profiles, dimensions, minimum = 1) {
  if (!Array.isArray(profiles) || profiles.length < minimum || profiles.length > 64 ||
      profiles.some(profile => !Array.isArray(profile?.starts) || profile.starts.length !== 3 ||
        !Number.isInteger(profile.selectedStart) || profile.selectedStart < 0 || profile.selectedStart > 2 ||
        profile.starts.some(start => typeof start?.converged !== 'boolean' || !Array.isArray(start.groups) ||
          start.groups.length > REPRESENTATIVE_MAX_GROUPS || start.groups.some(group =>
            !Number.isInteger(group?.support) || group.support < 0)))) {
    throw representativeValidationError('profile_structure');
  }
  for (const profile of profiles) for (const start of profile.starts) for (const group of start.groups)
    validateRepresentativeVector(group.centroid, dimensions, 'profile');
}
