/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateItem, evaluatePolicy } from './policyEngineEvaluation.mjs';
import { scorePresets, scoreProfileWithDiagnostics, scoreRAGWithDiagnostics } from './policyEngineSourceScoring.mjs';
import { computeProfileScoreDetails } from './libraryProfileComputations.mjs';
import { projectRankedPolicyCandidates } from './policyCandidateRankingProjection.mjs';
import { projectPolicyCandidateDecision } from './policyCandidateDecisionProjection.mjs';
import { policyDecisionBuilder } from './policyDecisionBuilder.mjs';
import { createPolicyInventoryEvidenceService } from './policyInventoryEvidenceService.mjs';
import { buildPolicyCandidateAdjudicationContract } from './policyCandidateAdjudicationContract.mjs';
import { resolveDeterministicOutcomeAiMode } from './classificationDeterministicAiMode.mjs';
import { preparePolicyShortlistReplayCase } from './policyShortlistReplayCase.mjs';

/** Production formulas and exclusions; all evidence readers are explicitly fold-local. */
export async function prepareFreshInventoryPolicyCase(entry, source, evidence, signal) {
  signal?.throwIfAborted();
  const runtime = evidence.forCase(entry);
  if (!runtime) return { status: 'metadata_unavailable' };
  const { metadata } = runtime;
  const inventory = createPolicyInventoryEvidenceService({ retriever: runtime });
  const result = await evaluateItem(metadata, { ragCache: { matches: [], timestamp: 1 }, relatedEvidence: [] }, {
    checkAuthoritativeSignals: async () => null,
    getActivePolicies: async () => source.policies,
    evaluatePolicy: (policy, item, cache, related) => evaluatePolicy(policy, item, cache, related, {
      scorePresets, scoreRAGWithDiagnostics,
      scoreProfileWithDiagnostics: (id, item) => scoreProfileWithDiagnostics(id, item, {
        getProfileScoreDetails: () => computeProfileScoreDetails(runtime.profiles.get(id)?.profile ?? {}, item),
      }),
      scorePatterns: async () => 0, scoreHistory: async () => 0,
    }),
    applyInventoryEvidence: input => inventory.apply(input),
    rankResults: projectRankedPolicyCandidates,
    determineAction: ranked => policyDecisionBuilder.buildPolicyDecision(projectPolicyCandidateDecision({ ranked })),
  });
  const policyResult = { ...result, ragCache: { matches: [], timestamp: 1 } };
  const candidateAdjudication = buildPolicyCandidateAdjudicationContract({ policyResult, libraries: source.libraries, mediaType: entry.mediaType });
  const mode = resolveDeterministicOutcomeAiMode({ policyResult, libraries: source.libraries, candidateAdjudication });
  const common = { policyResult, mode: mode.mode, modeReason: mode.reasonCode,
    missingMetadata: ['genres', 'keywords', 'certification', 'original_language'].filter(field => !metadata[field]?.length) };
  if (!mode.shouldInvoke || mode.mode !== 'adjudicate') return { ...common, status: 'mode_not_adjudication' };
  const replay = await preparePolicyShortlistReplayCase({ metadata, policyResult }, source, runtime, signal);
  return { ...replay, ...common, reviewPolicies: source.policies };
}
