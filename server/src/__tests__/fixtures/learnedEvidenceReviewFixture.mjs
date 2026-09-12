/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { consensusFixture } from './policyCandidateConsensusFixture.mjs';

export function learnedReviewFixture() {
  const input = consensusFixture();
  input.policyResult.confidence = 45;
  input.policyResult.decisionDiagnostics = { requires_manual_review: true, reason_code: 'weak_evidence_primary' };
  input.policyResult.ranked.forEach(candidate => {
    candidate.policy_id = candidate.library_id;
    candidate.score = 45;
    candidate.candidate_diagnostics = { profile_hard_excluded: false, primary_viability: 'profile_only',
      evidence_class: 'profile_only', suppression_reasons: ['weak_primary_evidence'],
      policy_constraints: { schema_version: 1, failed: false, unknown_count: 0, conflict_count: 0, conflicts: [], unknown: [] } };
  });
  input.policies = input.libraries.map(library => ({ id: library.id, library_id: library.id, enabled: true,
    library_media_type: library.media_type, trust_rag: true, rag_weight: .15 }));
  input.reviewEvidence = { statusId: 'available', candidates: input.evidence.candidates.map(candidate => ({
    ...structuredClone(candidate.descriptionEvidence), libraryId: candidate.libraryId,
  })) };
  return input;
}
