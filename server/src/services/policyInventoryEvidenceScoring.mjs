/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isWeakCandidateViability } from './policyCandidateDiagnostics.mjs';
import { hasPolicyConstraintFailure } from './policyConstraintSemantics.mjs';
import { assessInventoryDescriptionSeparation } from './inventoryDescriptionSeparation.mjs';

const WEAK_REASONS = new Set(['weak_primary_evidence', 'compatibility_profile_only',
  'broad_compatibility_overlap', 'insufficient_specialized_evidence']);

export function canUseInventoryScoreEvidence(candidate, policy) {
  const diagnostics = candidate?.candidate_diagnostics;
  return policy?.enabled === true && policy.trust_rag === true && (policy.rag_weight ?? .15) > 0 &&
    Number.isFinite(candidate?.score) && candidate.score > 0 && candidate.score <= 95 &&
    isWeakCandidateViability(diagnostics) && diagnostics?.evidence_class !== 'negative_conflict' &&
    diagnostics?.profile_hard_excluded !== true && candidate.native_intent_runtime?.eligible !== false &&
    !hasPolicyConstraintFailure(diagnostics?.policy_constraints) &&
    Array.isArray(diagnostics?.suppression_reasons) &&
    diagnostics.suppression_reasons.every(reason => WEAK_REASONS.has(reason));
}

/** Retain the existing score; replace only a no-longer-applicable weak-evidence discount. */
export function applyInventoryScoreEvidence({ evaluations, policies, evidence }) {
  const assessment = evidence?.statusId === 'available'
    ? assessInventoryDescriptionSeparation(evidence.candidates) : null;
  if (!assessment?.eligible) return evaluations;
  const policyById = new Map(policies.map(policy => [policy.id, policy]));
  return evaluations.map(candidate => {
    if (candidate.library_id !== assessment.libraryId ||
        !canUseInventoryScoreEvidence(candidate, policyById.get(candidate.policy_id))) return candidate;
    const diagnostics = candidate.candidate_diagnostics;
    return { ...candidate, candidate_diagnostics: { ...diagnostics,
      primary_viability: 'learned_inventory_support', evidence_class: 'learned_inventory',
      primary_anchor_eligible: true, suppression_reasons: [],
      drivers: [...(diagnostics.drivers ?? []), 'inventory_comparison_supported'],
      inventory_comparison: assessment.comparison } };
  });
}
