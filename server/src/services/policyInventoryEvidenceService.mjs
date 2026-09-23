/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createLiveInventoryDescriptionRetriever } from './liveInventoryDescriptionRetriever.mjs';
import { applyInventoryScoreEvidence, canUseInventoryScoreEvidence } from './policyInventoryEvidenceScoring.mjs';
import { isInferredPurposeCandidate } from './policyInferredPurposeAdmission.mjs';
import { rememberInventoryRankingShadow, setInventoryRankingShadowReason } from './inventoryRankingShadow.mjs';

/** One bounded comparison of the whole eligible pool, before ranking/shortlist truncation. */
export function createPolicyInventoryEvidenceService({
  retriever = createLiveInventoryDescriptionRetriever({ maxCandidates: 64 }),
  captureShadow = true,
} = {}) {
  return {
    async apply({ evaluations, policies, item }) {
      const baseline = evaluations;
      try {
        if (!Array.isArray(evaluations) || !Array.isArray(policies)) return baseline;
        rememberInventoryRankingShadow(evaluations, item, null);
        if (!['movie', 'tv'].includes(item?.media_type)) {
          setInventoryRankingShadowReason(evaluations, 'not_applicable_media');
          return baseline;
        }
        const policyById = new Map(policies.map(policy => [policy.id, policy]));
        if (!evaluations.some(candidate => {
          const policy = policyById.get(candidate.policy_id);
          return canUseInventoryScoreEvidence(candidate, policy) ||
            (isInferredPurposeCandidate(candidate) && policy?.trust_rag === true && (policy.rag_weight ?? .15) > 0);
        })) {
          setInventoryRankingShadowReason(evaluations, 'no_eligible_pool');
          return baseline;
        }
        // Invalid membership is not silently dropped: doing so would manufacture separation.
        if (evaluations.some(candidate => {
          const policy = policyById.get(candidate?.policy_id);
          return !Number.isInteger(candidate?.library_id) || candidate.library_id < 1 || candidate.library_id > 2147483647 ||
            policy?.library_id !== candidate.library_id || policy?.enabled !== true || policy.library_media_type !== item.media_type;
        })) {
          setInventoryRankingShadowReason(evaluations, 'invalid_candidate_pool');
          return baseline;
        }
        const ids = [...new Set(evaluations.map(candidate => candidate.library_id))].sort((a, b) => a - b);
        if (ids.length < 2 || ids.length > 64) {
          setInventoryRankingShadowReason(evaluations, 'candidate_pool_size');
          return baseline;
        }
        const evidence = await retriever.retrieve({ metadata: item, contract: { valid: true,
          candidates: ids.map(libraryId => ({ libraryId, mediaType: item.media_type })) } });
        if (!Array.isArray(evidence?.candidates) || evidence.candidates.length !== ids.length ||
            evidence.candidates.some(candidate => !ids.includes(candidate?.libraryId))) {
          setInventoryRankingShadowReason(evaluations, 'retrieval_mismatch');
          return baseline;
        }
        const scored = applyInventoryScoreEvidence({ evaluations, policies, evidence });
        if (captureShadow) rememberInventoryRankingShadow(scored, item, evidence);
        else setInventoryRankingShadowReason(scored, 'capture_disabled');
        return scored;
      } catch {
        // Missing/stale evidence never changes a score; do not log private provider errors.
        setInventoryRankingShadowReason(baseline, 'unexpected_error');
        return baseline;
      }
    },
  };
}

export const policyInventoryEvidenceService = createPolicyInventoryEvidenceService();
