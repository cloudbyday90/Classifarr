/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const CANDIDATE_VIABILITY = Object.freeze({
  IDENTITY_EVIDENCE: 'identity_evidence',
  COMPATIBILITY_ONLY: 'compatibility_only',
  PROFILE_ONLY: 'profile_only',
  RAG_IMPROVED: 'rag_improved',
  MULTI_SOURCE_SUPPORT: 'multi_source_support',
  NO_POSITIVE_EVIDENCE: 'no_positive_evidence',
});

const WEAK_CANDIDATE_VIABILITY = new Set([
  CANDIDATE_VIABILITY.COMPATIBILITY_ONLY,
  CANDIDATE_VIABILITY.PROFILE_ONLY,
  CANDIDATE_VIABILITY.RAG_IMPROVED,
]);

export function isWeakPrimaryViability(viability) {
  return WEAK_CANDIDATE_VIABILITY.has(viability);
}

export function isWeakCandidateViability(diagnostics) {
  const viability = diagnostics?.primary_viability || null;
  return diagnostics?.primary_anchor_eligible === false || isWeakPrimaryViability(viability);
}
