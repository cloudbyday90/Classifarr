/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const INFERRED_PURPOSE_ADMISSION = 'inferred_profile_ranking';

/** Recognize only the server-generated observation shape, never generic advisory rules. */
export function isInferredProfilePurposeRule(rule) {
  const values = rule?.values;
  return rule?.intent_role === 'purpose' && rule.source === 'media_server_library_profile' &&
    rule.inference_state === 'inferred' && rule.constraint_mode === 'advisory' &&
    ['genres', 'media_type'].includes(rule.signal_type) && rule.operator === 'require_any' &&
    values !== null && typeof values === 'object' && !Array.isArray(values) &&
    Object.keys(values).every(key => key === 'require_any' || key === 'weight') &&
    Array.isArray(values.require_any) && values.require_any.length > 0 &&
    values.require_any.every(value => typeof value === 'string' && value.trim().length > 0);
}

/** Trusted evaluator output only: admission permits comparison, not routing. */
export function isInferredPurposeCandidate(candidate) {
  const runtime = candidate?.native_intent_runtime;
  const constraints = runtime?.constraintDiagnostics;
  const diagnostics = candidate?.candidate_diagnostics;
  return runtime?.eligible === true && runtime.admissionBasis === INFERRED_PURPOSE_ADMISSION &&
    constraints?.failed === false && constraints.unknown_count === 0 && constraints.conflict_count === 0 &&
    diagnostics?.profile_hard_excluded !== true && diagnostics?.evidence_class !== 'negative_conflict';
}

export function isComparablePolicyCandidate(candidate) {
  return Number.isFinite(candidate?.score) && candidate.native_intent_runtime?.eligible !== false &&
    (candidate.score > 0 || (candidate.score === 0 && isInferredPurposeCandidate(candidate)));
}
