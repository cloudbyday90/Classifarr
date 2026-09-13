/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assessLearnedEvidenceReview } from './learnedEvidenceReviewResolver.mjs';
import { compareInventoryDescriptionEvidence, hasLeadingLearnedMetadata } from './inventoryDescriptionEvidenceComparison.mjs';
import { NEIGHBOR_CROSS_FIT_VERSION, NEIGHBOR_CROSS_FIT_LIMITS } from './libraryNeighborCrossFit.mjs';

export const INVENTORY_NEIGHBOR_FALLBACK_VERSION = 'inventory_neighbor_fallback_v1';

/** Private snapshot-owned evidence only. This is not a live receipt validator. */
export function isInventoryNeighborFallbackTarget({ proposal, calibration } = {}) {
  const limits = NEIGHBOR_CROSS_FIT_LIMITS;
  const candidates = calibration?.candidates;
  return Number.isInteger(proposal?.selected) && proposal.selected > 0 && proposal.selected <= 2147483647 &&
    proposal.strict === false && proposal.shared === false && calibration?.version === NEIGHBOR_CROSS_FIT_VERSION &&
    calibration.status === 'evaluated' && /^[a-f0-9]{64}$/.test(calibration.snapshotId ?? '') &&
    Array.isArray(candidates) && candidates.length >= 2 && candidates.length <= 64 &&
    new Set(candidates.map(candidate => candidate?.libraryId)).size === candidates.length &&
    candidates.every(candidate => Number.isInteger(candidate?.libraryId) && candidate.libraryId > 0 && candidate.libraryId <= 2147483647 &&
      candidate.status === 'available' && candidate.referenceComplete === true &&
      Number.isInteger(candidate.referenceDescriptions) && candidate.referenceDescriptions >= limits.minimum && candidate.referenceDescriptions <= limits.references &&
      Number.isInteger(candidate.calibrationDescriptions) && candidate.calibrationDescriptions >= limits.minimum && candidate.calibrationDescriptions <= limits.calibration &&
      Number.isInteger(candidate.minimumCalibrationReferences) && candidate.minimumCalibrationReferences >= limits.minimum && candidate.minimumCalibrationReferences <= limits.references) &&
    candidates.find(candidate => candidate.libraryId === proposal.selected)?.calibrated === true;
}

/** Retain strict successes and every non-neighbor veto. Never supplies route authority. */
export function assessInventoryNeighborFallback(input, evidence) {
  const baseline = assessLearnedEvidenceReview(input);
  const result = (reason, wouldResolve = false) => ({ version: INVENTORY_NEIGHBOR_FALLBACK_VERSION,
    baseline, reason, wouldResolve, automaticRouteAllowed: false });
  if (baseline.wouldResolve) return result('strict_preserved', true);
  if (baseline.reason !== 'neighbors_disagree') return result(baseline.reason);
  if (!isInventoryNeighborFallbackTarget(evidence)) return result('calibrated_support_unavailable');
  if (input.aiMatch.library.id !== evidence.proposal.selected) return result('ai_description_disagrees');
  const poolIds = input.reviewEvidence.candidates.map(candidate => candidate.libraryId);
  if (evidence.calibration.candidates.length !== poolIds.length ||
      evidence.calibration.candidates.some(candidate => !poolIds.includes(candidate.libraryId))) return result('calibration_scope_mismatch');
  // The unchanged strict resolver validated the full scope before its neighbor veto.
  const compared = compareInventoryDescriptionEvidence(input.reviewEvidence.candidates);
  const winner = compared.find(entry => entry.candidate.libraryId === evidence.proposal.selected);
  if (!hasLeadingLearnedMetadata(winner, compared.filter(entry => entry !== winner))) return result('metadata_disagrees');
  return result('calibrated_evidence_agrees', true);
}
