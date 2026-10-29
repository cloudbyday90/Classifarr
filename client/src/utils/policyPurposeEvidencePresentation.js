/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const VERSION = 'policy.purpose_match_evidence.v1'
const origins = ['declared_native', 'profile_derived', 'mixed', 'unverified']
const matches = ['matched', 'not_matched', 'not_evaluated', 'no_declared_rules']
const scopes = ['not_evaluated', 'positive_specialized_evidence', 'broad_compatibility_overlap', 'insufficient_specialized_evidence', 'not_applicable']

export function normalizePolicyPurposeEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== 'declaredMatch|origin|runtimeEligible|specificity|version' ||
    value.version !== VERSION || !origins.includes(value.origin) || !matches.includes(value.declaredMatch) ||
    !scopes.includes(value.specificity) || ![true, false, null].includes(value.runtimeEligible) ||
    (value.declaredMatch === 'matched' && !['declared_native', 'mixed'].includes(value.origin))) return null
  return { version: VERSION, origin: value.origin, declaredMatch: value.declaredMatch,
    runtimeEligible: value.runtimeEligible, specificity: value.specificity }
}

export function policyPurposeEvidenceCopy(purpose, legacy = false) {
  if (legacy) return { label: 'Legacy policy context', message: 'This retained heuristic does not establish declared purpose or a declared-rule match.' }
  if (purpose.origin === 'profile_derived') return { label: 'Inferred purpose', message: 'Purpose was inferred from library observations. It provides context and does not establish an operator declaration.' }
  if (purpose.origin === 'mixed') return { label: 'Mixed purpose origins', message: purpose.declaredMatch === 'matched'
    ? 'The declared subset matched; other purpose origins remain separate context. Specialized checks still apply.'
    : 'Multiple purpose origins were retained, but a declared-subset match is not established.' }
  if (purpose.origin === 'declared_native') return { label: 'Declared purpose', message: purpose.declaredMatch === 'matched'
    ? 'Declared rules matched this item. Runtime eligibility and specialized/conflict checks remain separate.'
    : 'Declared purpose was retained, but a declared-rule match is not established.' }
  return { label: 'Purpose origin unavailable', message: 'Retained evidence cannot establish declared or inferred purpose and a declared-rule match.' }
}
