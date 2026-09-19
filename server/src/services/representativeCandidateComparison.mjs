/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { representativeSimilarity } from './inventoryRepresentativeGeometry.mjs';
import { representativeValidationError, validateRepresentativeProfiles, validateRepresentativeVector } from './representativeValidation.mjs';
import { representativeValidationIssue } from './representativeValidationDiagnostics.mjs';
import { inspectRepresentativeStartAgreement } from './representativeStartAgreement.mjs';

const abstain = reason => ({ aligned: { reason }, independent: { reason } });

/** Content-neutral diagnostic. All candidates stay in scope; no score grants routing authority. */
function evaluateCandidates(profiles, vector, dimensions, onInvalid, decision) {
  try {
    validateRepresentativeProfiles(profiles, dimensions, 2);
    if (decision && (!Number.isInteger(decision.index) || decision.index < 0 || decision.index >= profiles.length))
      throw representativeValidationError('decision_scope');
    validateRepresentativeVector(vector, dimensions, 'query');
    const query = normalizeDescriptionVector(vector, dimensions);
    // Validate every retained centroid before diagnosing; reuse these bounded scalar scores in the selected view.
    const candidateScores = profiles.map(profile => profile.starts.map(start => Math.max(...start.groups.map(group =>
      representativeSimilarity(query, normalizeDescriptionVector(group.centroid, dimensions))))));
    if (profiles.some(profile => profile.starts.some(start => !start.converged))) return abstain('unconverged_profiles');
    if (profiles.some(profile => profile.starts.some(start => !start.groups.length ||
        start.groups.some(group => group.support < 3)))) return abstain('sparse_profiles');
    return inspectRepresentativeStartAgreement(candidateScores, profiles.map(profile => profile.selectedStart));
  } catch (error) {
    try { onInvalid?.(representativeValidationIssue(error)); } catch { /* Passive diagnostics only. */ }
    return abstain('invalid_input');
  }
}

/** Private index only; callers must retain their complete, validated candidate scope. */
export function rankRepresentativeCandidates(profiles, vector, dimensions, onInvalid = null) {
  return evaluateCandidates(profiles, vector, dimensions, onInvalid, null).independent;
}

/** Paired private benchmark control. Neither result carries routing authority. */
export function inspectRepresentativeCandidates(profiles, vector, dimensions) {
  return evaluateCandidates(profiles, vector, dimensions, null, null);
}

export function compareRepresentativeCandidates(profiles, vector, dimensions, destinationIndex, onInvalid = null) {
  const result = evaluateCandidates(profiles, vector, dimensions, onInvalid, { index: destinationIndex }).independent;
  return result.reason !== 'selected' ? result.reason : result.index === destinationIndex ? 'agrees' : 'disagrees';
}
