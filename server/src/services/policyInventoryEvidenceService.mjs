/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createLiveInventoryDescriptionRetriever } from './liveInventoryDescriptionRetriever.mjs';
import { applyInventoryScoreEvidence, canUseInventoryScoreEvidence } from './policyInventoryEvidenceScoring.mjs';

/** One bounded comparison of the whole eligible pool, before ranking/shortlist truncation. */
export function createPolicyInventoryEvidenceService({
  retriever = createLiveInventoryDescriptionRetriever({ maxCandidates: 64 }),
} = {}) {
  return {
    async apply({ evaluations, policies, item }) {
      const baseline = evaluations;
      try {
        if (!['movie', 'tv'].includes(item?.media_type) || !Array.isArray(evaluations) || !Array.isArray(policies)) return baseline;
        const policyById = new Map(policies.map(policy => [policy.id, policy]));
        if (!evaluations.some(candidate => canUseInventoryScoreEvidence(candidate, policyById.get(candidate.policy_id)))) return baseline;
        // Invalid membership is not silently dropped: doing so would manufacture separation.
        if (evaluations.some(candidate => {
          const policy = policyById.get(candidate?.policy_id);
          return !Number.isInteger(candidate?.library_id) || candidate.library_id < 1 || candidate.library_id > 2147483647 ||
            policy?.library_id !== candidate.library_id || policy?.enabled !== true || policy.library_media_type !== item.media_type;
        })) return baseline;
        const ids = [...new Set(evaluations.map(candidate => candidate.library_id))].sort((a, b) => a - b);
        if (ids.length < 2 || ids.length > 64) return baseline;
        const evidence = await retriever.retrieve({ metadata: item, contract: { valid: true,
          candidates: ids.map(libraryId => ({ libraryId, mediaType: item.media_type })) } });
        if (!Array.isArray(evidence?.candidates) || evidence.candidates.length !== ids.length ||
            evidence.candidates.some(candidate => !ids.includes(candidate?.libraryId))) return baseline;
        return applyInventoryScoreEvidence({ evaluations, policies, evidence });
      } catch {
        // Missing/stale evidence never changes a score; do not log private provider errors.
        return baseline;
      }
    },
  };
}

export const policyInventoryEvidenceService = createPolicyInventoryEvidenceService();
