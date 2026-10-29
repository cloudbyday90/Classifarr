/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildPolicyCandidateEvidenceCardCore } from './policyCandidateEvidenceCardCore.mjs';
import { readPolicyPurposeMatchPresentation } from './policyPurposeMatchEvidence.mjs';
export { POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS, POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS,
  POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS } from './policyCandidateEvidenceCardCore.mjs';

export const POLICY_CANDIDATE_EVIDENCE_CARD_VERSION = 'policy.candidate_evidence_card.v2';

/** Current explanations only. Legacy correction statistics use their separately named v1 producer. */
export function buildPolicyCandidateEvidenceCard(input = {}) {
  const purpose = readPolicyPurposeMatchPresentation(input);
  const declaredState = purpose.origin === 'unverified' ? 'unavailable' :
    purpose.declaredMatch === 'matched' && purpose.runtimeEligible === true &&
      purpose.specificity === 'positive_specialized_evidence' ? 'supporting' : 'contextual';
  const card = buildPolicyCandidateEvidenceCardCore({ ...input, declaredState, version: POLICY_CANDIDATE_EVIDENCE_CARD_VERSION });
  const lacksCrossCheck = card.sources.filter(row => ['similar_item_retrieval', 'confirmed_outcomes'].includes(row.source_id))
    .every(row => row.state_id !== 'supporting');
  const status = card.status_id === 'corroborated' && declaredState === 'contextual' && lacksCrossCheck
    ? 'counter_evidence_recommended' : card.status_id;
  return Object.freeze({ ...card, status_id: status, purpose_evidence: purpose });
}
