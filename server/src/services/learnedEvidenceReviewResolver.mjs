/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { compareInventoryDescriptionEvidence } from './inventoryDescriptionEvidenceComparison.mjs';
import { isLocalCandidateProposal } from './policyCandidateProposalAuthority.mjs';
import { inspectLearnedEvidenceReviewScope } from './learnedEvidenceReviewScope.mjs';

export const LEARNED_EVIDENCE_REVIEW_VERSION = 'learned_evidence_review_v1';

/** Evaluation-only selective rule. No receipts, calibrated confidence or routing permission. */
export function assessLearnedEvidenceReview(input = {}) {
  const result = (reason, wouldResolve = false) => ({ version: LEARNED_EVIDENCE_REVIEW_VERSION,
    wouldResolve, reason, automaticRouteAllowed: false });
  if (!isLocalCandidateProposal(input.aiMatch)) return result('provider_proposal_unavailable');
  const scope = inspectLearnedEvidenceReviewScope(input);
  if (scope.reason) return result(scope.reason);
  const evidence = input.reviewEvidence;
  if (evidence?.statusId !== 'available' || !Array.isArray(evidence.candidates) ||
      evidence.candidates.length !== scope.pool.length ||
      evidence.candidates.some(candidate => !scope.pool.some(value => value.libraryId === candidate?.libraryId))) {
    return result('full_pool_evidence_unavailable');
  }
  const compared = compareInventoryDescriptionEvidence(evidence.candidates);
  if (!compared) return result('evidence_incomplete');
  const winner = compared.find(entry => entry.candidate.libraryId === scope.selected.library_id);
  const others = compared.filter(entry => entry !== winner);
  const examples = winner.candidate.items;
  const normalized = text => text.trim().toLowerCase();
  const otherDescriptions = new Set(others.flatMap(entry => entry.candidate.items.map(item => normalized(item.description))));
  if (examples.some(item => item.sharedAcrossCandidates !== false || otherDescriptions.has(normalized(item.description)))) {
    return result('shared_description_support');
  }
  const weakest = Math.min(...examples.map(item => item.similarity));
  if (others.some(entry => entry.candidate.items.some(item => item.similarity >= weakest))) return result('neighbors_disagree');
  if (winner.profile.statusId !== 'available' || winner.profile.relativeFit <= 0 ||
      others.some(entry => entry.profile.relativeFit >= winner.profile.relativeFit)) return result('metadata_disagrees');
  return result('learned_evidence_agrees', true);
}
