/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readNativePurposePositiveRule } from './nativePurposePositiveSemantics.mjs';
import { buildPolicyPurposeProvenance, classifyPolicyDeclaredPurposeRuleProvenance, isPolicyDeclaredNativePurposeRule } from './policyDeclaredPurposeProvenance.mjs';
import { normalizeCombinationMode } from './policyEngineUtils.mjs';

export const CANDIDATE_PURPOSE_VERSION = 'policy.candidate_purpose.v1';
export const CANDIDATE_PURPOSE_LIMITS = Object.freeze({ candidates: 64, rules: 32, candidateBytes: 4096, sectionBytes: 16384 });
export const freezeCandidatePurpose = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeCandidatePurpose);
    Object.freeze(value);
  }
  return value;
};

// Encoding preserves terms, including punctuation and non-Latin text. It is
// data framing, not a prompt-injection or authorization boundary.
export const encodeCandidatePurpose = value => JSON.stringify(value)
  .replace(/[<>&\u2028\u2029]/gu, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
export const candidatePurposeBytes = value => Buffer.byteLength(encodeCandidatePurpose(value), 'utf8');

export function unavailableCandidatePurpose(reasonId, origin = 'unverified') {
  return Object.freeze({ statusId: 'unavailable', origin, declaredMatch: 'not_evaluated', reasonId });
}

/** Pure structure/meaning only. A successful projection is NOT live authority. */
export function snapshotCandidatePurpose(policy) {
  const contract = policy.policy_intent_contract;
  const origin = buildPolicyPurposeProvenance(contract.purpose).id;
  const declared = contract.purpose.filter(isPolicyDeclaredNativePurposeRule);
  if (!declared.length) return unavailableCandidatePurpose('no_declared_rules', origin);
  if (declared.length > CANDIDATE_PURPOSE_LIMITS.rules) return unavailableCandidatePurpose('rule_overflow', origin);
  const rules = [];
  for (const rule of declared) {
    const definition = readNativePurposePositiveRule(rule);
    if (!definition || ![undefined, null, 'advisory', 'strict'].includes(rule.constraint_mode)) {
      return unavailableCandidatePurpose('unsupported_declared_rule', origin);
    }
    rules.push({ role: 'purpose', semantics: definition.evidenceMode, signal: definition.signalType,
      operator: definition.operator, terms: [...rule.values[definition.operator]],
      constraintMode: rule.constraint_mode ?? null, declaredWeight: rule.values.weight ?? null,
      effectiveWeight: rule.values.weight ?? 1 });
  }
  const payload = { version: CANDIDATE_PURPOSE_VERSION, statusId: 'available', origin,
    declaredMatch: 'not_evaluated', scope: policy.library_media_type,
    omittedOrigins: [...new Set(contract.purpose.filter(rule => !isPolicyDeclaredNativePurposeRule(rule))
      .map(classifyPolicyDeclaredPurposeRuleProvenance))].sort(),
    combinationMode: normalizeCombinationMode(contract.review_behavior?.combination_mode || policy.combination_mode),
    sourceWeight: policy.preset_weight ?? 0.35, rules };
  return candidatePurposeBytes(payload) > CANDIDATE_PURPOSE_LIMITS.candidateBytes
    ? unavailableCandidatePurpose('payload_overflow', origin) : freezeCandidatePurpose(payload);
}
