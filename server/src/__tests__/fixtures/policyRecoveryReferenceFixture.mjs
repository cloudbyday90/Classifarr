/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateItem, evaluatePolicy } from '../../services/policyEngineEvaluation.mjs';
import { createLivePolicyRecoveryReference } from '../../services/policyRecoverySuggestionLiveReference.mjs';
import { holdPolicyRecoverySuggestion } from '../../services/policyRecoverySuggestionReader.mjs';
import { buildSignalContext } from '../../services/policyScoringContextBuilder.mjs';
import { purposeMatchFixture } from './purposeMatchEvidenceFixture.mjs';
import { createLivePolicyEvaluationCapture } from '../../services/policyEvaluationCapture.mjs';

export function recoveryPolicies(count = 1, source = 'native_intent') {
  return Array.from({ length: count }, (_unused, index) => {
    const policy = structuredClone(purposeMatchFixture().policy);
    Object.assign(policy, { id: index + 1, library_id: index + 101, enabled: true, native_intent_version: 3,
      name: `Owned policy ${index}`, library_name: `Owned destination ${index}`, auto_classify_threshold: 85,
      prompt_threshold: 60, trust_patterns: false, trust_rag: false, trust_history: false, presets: [] });
    Object.assign(policy.policy_intent_contract, { policy_id: policy.id, library_id: policy.library_id });
    if (source === 'compatibility_bridge') policy.policy_runtime_authority = { sourceId: source, statusId: 'compatibility_bridge_fallback' };
    policy.policy_intent_read_trace = { source, status: policy.policy_runtime_authority.statusId, policy_id: policy.id,
      intent_version: source === 'native_intent' ? policy.native_intent_version : null };
    return policy;
  });
}

export async function policyRecoveryReferenceFixture({ count = 1, source, live = true, confidence = 70,
  configure = () => {}, beforeEvaluate = () => {}, afterEvaluate = () => {}, metadata = {}, item: suppliedItem = null,
  captureEvaluation = false } = {}) {
  const item = suppliedItem || { ...purposeMatchFixture().item, title: 'Owned item', ...metadata };
  const policies = recoveryPolicies(count, source); policies.forEach(configure);
  const libraries = policies.map(policy => ({ id: policy.library_id, name: policy.library_name, media_type: item.media_type, is_active: true }));
  const result = await evaluateItem(item, {}, {
    checkAuthoritativeSignals: async () => null, getActivePolicies: async () => policies,
    evaluatePolicy: async (...args) => {
      await beforeEvaluate(...args);
      const row = await evaluatePolicy(...args, { scoreProfileWithDiagnostics: async () => ({ score: 70, diagnostics: null }) });
      await afterEvaluate(row, ...args); return row;
    },
    applyInventoryEvidence: async ({ evaluations }) => evaluations,
    rankResults: async rows => rows,
    determineAction: ranked => ({ action: 'prompt_confirm', ranked, confidence }),
    ...(live ? { captureRecoveryReference: createLivePolicyRecoveryReference(item) } : {}),
    ...(captureEvaluation ? { capturePolicyEvaluation: createLivePolicyEvaluationCapture(item) } : {}),
  });
  const context = buildSignalContext(result, libraries, result.ranked);
  const args = { policyResult: result, metadata: item, signalContext: context, libraries };
  return { item, policies, libraries, result, context, args, token: holdPolicyRecoverySuggestion(args) };
}
