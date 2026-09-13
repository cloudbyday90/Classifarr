/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assessLearnedEvidenceReview } from './learnedEvidenceReviewResolver.mjs';
import { assessLearnedEvidenceRoutingGuards } from './learnedEvidenceRoutingAssessment.mjs';
import { compareInventoryDescriptionEvidence, hasLeadingLearnedMetadata } from './inventoryDescriptionEvidenceComparison.mjs';
import { assessInventoryNeighborFallback } from './inventoryNeighborFallback.mjs';

/** Inspect cheap current guards before requesting a calibration fit. */
export function canAssessLearnedNeighborShadow(input) {
  if (assessLearnedEvidenceReview(input).reason !== 'neighbors_disagree' || !assessLearnedEvidenceRoutingGuards(input)) return false;
  const compared = compareInventoryDescriptionEvidence(input.reviewEvidence.candidates);
  const winner = compared.find(entry => entry.candidate.libraryId === input.aiMatch.library.id);
  return compared[0] === winner && winner.mean > compared[1].mean &&
    hasLeadingLearnedMetadata(winner, compared.filter(entry => entry !== winner));
}

export function assessLearnedNeighborShadow(input) {
  if (!canAssessLearnedNeighborShadow(input)) return false;
  const compared = compareInventoryDescriptionEvidence(input.reviewEvidence.candidates);
  const selected = input.aiMatch.library.id;
  return assessInventoryNeighborFallback(input, { proposal: { selected, strict: false, shared: false },
    calibration: compared[0].candidate.neighborCalibration }).wouldResolve;
}
