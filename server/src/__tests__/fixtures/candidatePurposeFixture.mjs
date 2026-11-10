/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { purposeMatchFixture } from './purposeMatchEvidenceFixture.mjs';
import { evaluateItem, evaluatePolicy } from '../../services/policyEngineEvaluation.mjs';
import { createLivePolicyCandidatePurposeCapture, holdLivePolicyCandidatePurpose } from '../../services/policyCandidatePurposeLiveCapture.mjs';
import { buildPolicyCandidateAdjudicationContract } from '../../services/policyCandidateAdjudicationContract.mjs';

export async function candidatePurposeFixture({ configure = () => {}, live = true, count = 2, beforeEvaluate = () => {}, afterEvaluate = () => {}, metadata = {} } = {}) {
  const base = purposeMatchFixture();
  const item = { ...base.item, title: 'Synthetic media', overview: 'Synthetic synopsis', ...metadata };
  const policies = Array.from({ length: count }, (_value, index) => {
    const policy = structuredClone(base.policy);
    policy.id += index; policy.library_id += index;
    policy.policy_intent_contract.policy_id = policy.id; policy.policy_intent_contract.library_id = policy.library_id;
    policy.native_intent_version = 1; policy.name = `Policy ${index}`; policy.library_name = `Destination ${index}`;
    policy.auto_classify_threshold = 85; policy.prompt_threshold = 60;
    configure(policy, index, item);
    return policy;
  });
  const allLibraries = policies.map(policy => ({ id: policy.library_id, name: policy.library_name, media_type: item.media_type, is_active: true }));
  const result = await evaluateItem(item, {}, {
    checkAuthoritativeSignals: async () => null, getActivePolicies: async () => policies,
    evaluatePolicy: async (...args) => {
      await beforeEvaluate(...args);
      const evaluation = await evaluatePolicy(...args, { scoreProfileWithDiagnostics: async () => ({ score: 70, diagnostics: null }) });
      await afterEvaluate(evaluation, ...args);
      return evaluation;
    },
    rankResults: async values => values,
    applyInventoryEvidence: async ({ evaluations }) => evaluations,
    determineAction: ranked => ({ action: 'prompt_select', ranked, confidence: ranked[0]?.score ?? 0 }),
    ...(live ? { captureCandidatePurpose: createLivePolicyCandidatePurposeCapture(item) } : {}),
  });
  const contract = buildPolicyCandidateAdjudicationContract({ policyResult: result, libraries: allLibraries, mediaType: item.media_type });
  const libraries = contract.valid ? contract.candidates.map(row => row.library) : allLibraries;
  const hold = () => holdLivePolicyCandidatePurpose({ policyResult: result, contract, metadata: item });
  return { item, policies, libraries, result, contract, hold, token: hold() };
}
