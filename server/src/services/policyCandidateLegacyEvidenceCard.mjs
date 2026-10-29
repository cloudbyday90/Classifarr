/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildPolicyCandidateEvidenceCardCore, LEGACY_POLICY_CANDIDATE_EVIDENCE_CARD_VERSION } from './policyCandidateEvidenceCardCore.mjs';
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/** Frozen v1 statistical heuristic. Never use as verified declaration evidence or current UI copy. */
export function buildLegacyPolicyCandidateEvidenceCard(input = {}) {
  const diagnostics = object(input.candidate?.candidate_diagnostics || input.candidate?.candidateDiagnostics);
  const identity = object(diagnostics.identity_evidence || diagnostics.identityEvidence);
  const native = object(diagnostics.native_intent_runtime || diagnostics.nativeIntentRuntime);
  const declaredState = identity.status_id === 'positive_specialized_evidence' ? 'supporting' :
    ['broad_compatibility_overlap', 'insufficient_specialized_evidence'].includes(identity.status_id) ? 'contextual' :
      native.eligible === true && Number(native.rule_counts?.purpose || 0) > 0 ? 'supporting' : 'unavailable';
  return buildPolicyCandidateEvidenceCardCore({ ...input, declaredState, version: LEGACY_POLICY_CANDIDATE_EVIDENCE_CARD_VERSION });
}
