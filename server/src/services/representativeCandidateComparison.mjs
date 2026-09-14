/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { representativeSimilarity } from './inventoryRepresentativeGeometry.mjs';
import { representativeValidationError, validateRepresentativeProfiles, validateRepresentativeVector } from './representativeValidation.mjs';
import { representativeValidationIssue } from './representativeValidationDiagnostics.mjs';

/** Content-neutral diagnostic. All candidates stay in scope; no score grants routing authority. */
export function compareRepresentativeCandidates(profiles, vector, dimensions, destinationIndex, onInvalid = null) {
  try {
    validateRepresentativeProfiles(profiles, dimensions, 2);
    if (!Number.isInteger(destinationIndex) || destinationIndex < 0 || destinationIndex >= profiles.length)
      throw representativeValidationError('decision_scope');
    validateRepresentativeVector(vector, dimensions, 'query');
    const query = normalizeDescriptionVector(vector, dimensions);
    // Validate every retained centroid before diagnosing; reuse these bounded scalar scores in the selected view.
    const candidateScores = profiles.map(profile => profile.starts.map(start => Math.max(...start.groups.map(group =>
      representativeSimilarity(query, normalizeDescriptionVector(group.centroid, dimensions))))));
    if (profiles.some(profile => profile.starts.some(start => !start.converged))) return 'unconverged_profiles';
    if (profiles.some(profile => profile.starts.some(start => !start.groups.length ||
        start.groups.some(group => group.support < 3)))) return 'sparse_profiles';
    const winners = [];
    for (let view = 0; view < 4; view++) {
      const scores = profiles.map((profile, index) => ({ index,
        score: candidateScores[index][view === 3 ? profile.selectedStart : view] }));
      scores.sort((a, b) => b.score - a.score);
      if (scores[0].score <= 0) return 'no_positive_match';
      if (scores[0].score - scores[1].score <= 1e-12) return 'tied_destinations';
      winners.push(scores[0].index);
    }
    if (new Set(winners).size !== 1) return 'initialization_sensitive';
    return winners[0] === destinationIndex ? 'agrees' : 'disagrees';
  } catch (error) {
    try { onInvalid?.(representativeValidationIssue(error)); } catch { /* Passive diagnostics only. */ }
    return 'invalid_input';
  }
}
