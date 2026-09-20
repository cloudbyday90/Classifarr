/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assessLearnedEvidenceReview } from './learnedEvidenceReviewResolver.mjs';
import { LIBRARY_MATCH_BASELINE_VERSION, LIBRARY_MATCH_BASELINE_LIMITS } from './libraryMatchBaseline.mjs';
import { projectLiveInventoryDescriptionEvidence } from './liveInventoryDescriptionEvidence.mjs';

/** Additional live checks; this assessment alone cannot authorize a route. */
export function assessLearnedEvidenceRouting(input) {
  return inspectLearnedEvidenceRouting(input).passed;
}

/** Same routing predicate with a fixed, content-free first stopping reason. */
export function inspectLearnedEvidenceRouting(input) {
  const review = assessLearnedEvidenceReview(input);
  if (!review.wouldResolve) return { passed: false, reason: 'comparison_not_supported' };
  return inspectRoutingGuards(input);
}

/** Requires a previously validated full review scope. No authority is granted. */
export function assessLearnedEvidenceRoutingGuards(input) {
  return inspectRoutingGuards(input).passed;
}

function inspectRoutingGuards(input) {
  if (input.reviewEvidence.candidates.some(candidate => candidate.libraryId !== input.aiMatch.library.id &&
      candidate.queryIdentityPresent !== false)) return { passed: false, reason: 'identity_not_clear' };
  const limits = LIBRARY_MATCH_BASELINE_LIMITS;
  const baseline = input.reviewEvidence.candidates.find(candidate => candidate.libraryId === input.aiMatch.library.id)?.matchBaseline;
  if (baseline?.version !== LIBRARY_MATCH_BASELINE_VERSION || baseline.libraryId !== input.aiMatch.library.id ||
      !Number.isFinite(baseline.empiricalRank) || baseline.empiricalRank < 0 || baseline.empiricalRank > 1 ||
      !Number.isInteger(baseline.referenceDescriptions) || baseline.referenceDescriptions < limits.minimum || baseline.referenceDescriptions > limits.references ||
      !Number.isInteger(baseline.calibrationDescriptions) || baseline.calibrationDescriptions < limits.minimum || baseline.calibrationDescriptions > limits.calibration ||
      !/^[a-f0-9]{64}$/.test(baseline.snapshotId ?? '')) return { passed: false, reason: 'familiarity_unavailable' };
  if (baseline.status !== 'familiar' || baseline.empiricalRank <= limits.tail) {
    return { passed: false, reason: baseline.status === 'unusual' && baseline.empiricalRank <= limits.tail
      ? 'item_unusual' : 'familiarity_unavailable' };
  }
  const supplied = input.evidence;
  if (supplied?.version !== input.contract.version || !Array.isArray(supplied.candidates) ||
      supplied.candidates.length !== input.contract.candidates.length ||
      new Set(supplied.candidates.map(candidate => candidate.libraryId)).size !== supplied.candidates.length) {
    return { passed: false, reason: 'prompt_evidence_changed' };
  }
  const unchanged = input.contract.candidates.every(candidate => {
    const shown = supplied.candidates.find(value => value.libraryId === candidate.libraryId);
    const current = input.reviewEvidence.candidates.find(value => value.libraryId === candidate.libraryId);
    return shown?.mediaType === input.metadata.media_type &&
      (candidate.libraryId === input.aiMatch.library.id || shown.currentLibrary?.directMatch === false) &&
      JSON.stringify(shown.descriptionEvidence) === JSON.stringify(projectLiveInventoryDescriptionEvidence({
        ...current, statusId: input.reviewEvidence.statusId,
      }, true));
  });
  return { passed: unchanged, reason: unchanged ? null : 'prompt_evidence_changed' };
}
