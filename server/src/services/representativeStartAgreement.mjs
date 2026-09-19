/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { representativeValidationError } from './representativeValidation.mjs';

const TIE_TOLERANCE = 1e-12;

/** Historical aligned views are a private control, never a runtime opt-out. */
function alignedAgreement(scores, selectedStarts) {
  const winners = [];
  for (let view = 0; view < 4; view++) {
    const ranked = scores.map((starts, index) => ({ index, score: starts[view === 3 ? selectedStarts[index] : view] }))
      .sort((a, b) => b.score - a.score);
    if (ranked[0].score <= 0) return { reason: 'no_positive_match' };
    if (ranked[0].score - ranked[1].score <= TIE_TOLERANCE) return { reason: 'tied_destinations' };
    winners.push(ranked[0].index);
  }
  return new Set(winners).size === 1 ? { reason: 'selected', index: winners[0] } : { reason: 'initialization_sensitive' };
}

/** Exact unique positive winner across independently chosen starts, using a linear interval check. */
export function inspectRepresentativeStartAgreement(scores, selectedStarts) {
  if (!Array.isArray(scores) || scores.length < 2 || scores.length > 64 || !Array.isArray(selectedStarts) ||
      selectedStarts.length !== scores.length || scores.some(starts => !Array.isArray(starts) || starts.length !== 3 ||
        starts.some(score => !Number.isFinite(score) || score < -1 || score > 1)) ||
      selectedStarts.some(start => !Number.isInteger(start) || start < 0 || start > 2)) {
    throw representativeValidationError('profile_structure');
  }
  const aligned = alignedAgreement(scores, selectedStarts);
  if (aligned.reason !== 'selected') return { aligned, independent: { ...aligned } };
  const lowestWinner = Math.min(...scores[aligned.index]);
  const highestRival = Math.max(...scores.filter((_, index) => index !== aligned.index).map(starts => Math.max(...starts)));
  const independent = lowestWinner - highestRival > TIE_TOLERANCE ? { ...aligned } : { reason: 'initialization_sensitive' };
  return { aligned, independent };
}
