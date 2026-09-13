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

/** Fixed, saturating counters only; no user content or per-item identifiers. */
export function createLearnedNeighborShadowCounters() {
  const counts = Object.fromEntries(['preparation_admin_blocked', 'live_guard_blocked', 'busy', 'unavailable',
    'fallback_blocked', 'freshness_blocked', 'qualified'].map(reason => [reason, 0]));
  return Object.freeze({
    record(reason) { if (Object.hasOwn(counts, reason)) counts[reason] = Math.min(1_000_000, counts[reason] + 1); },
    read() { return { version: 'learned_neighbor_shadow_v1', counts: { ...counts }, automaticRouteAllowed: false }; },
  });
}
