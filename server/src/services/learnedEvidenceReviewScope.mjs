/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildPolicyCandidateAdjudicationPool } from './policyCandidateAdjudicationContract.mjs';
import { validatePolicyDecisionThresholds } from '../utils/policyThresholds.mjs';

const softReviews = new Set(['weak_evidence_primary', 'weak_evidence_overlap']);
const softSuppressions = new Set(['weak_primary_evidence', 'compatibility_profile_only',
  'broad_compatibility_overlap', 'insufficient_specialized_evidence']);
const id = value => Number.isInteger(value) && value > 0 && value <= 2147483647;

/** Fail closed on unknown review reasons and selected-policy constraints. */
export function inspectLearnedEvidenceReviewScope({ metadata, policyResult, contract, libraries, policies, aiMatch,
  requireAllConfirmations = false } = {}) {
  if (requireAllConfirmations || !id(metadata?.tmdb_id) || !['movie', 'tv'].includes(metadata.media_type) ||
      !['manual', 'prompt_select'].includes(policyResult?.action)) return { reason: 'review_not_resolvable' };
  const review = policyResult.decisionDiagnostics;
  if (review && ((review.reason_code && !softReviews.has(review.reason_code)) ||
      (review.requires_manual_review && !softReviews.has(review.reason_code)))) return { reason: 'explicit_review_required' };
  const ranked = policyResult.ranked;
  if (!Array.isArray(ranked) || ranked.length < 2 || ranked.length > 64 ||
      ranked.some(candidate => !id(candidate?.library_id)) ||
      new Set(ranked.map(candidate => candidate.library_id)).size !== ranked.length ||
      !Array.isArray(libraries) || new Set(libraries.map(library => library?.id)).size !== libraries.length ||
      !Array.isArray(policies)) return { reason: 'candidate_scope_invalid' };
  const pool = buildPolicyCandidateAdjudicationPool({ policyResult, libraries, mediaType: metadata.media_type });
  if (pool.length !== ranked.length || pool.some(candidate => candidate.library.is_active !== true || candidate.mediaType !== metadata.media_type) ||
      contract?.valid !== true || contract.version !== 'policy.candidate_adjudication.v1' ||
      !Array.isArray(contract.candidates) || contract.candidates.length < 2 || contract.candidates.length > 3 ||
      new Set(contract.candidates.map(candidate => candidate?.libraryId)).size !== contract.candidates.length ||
      contract.candidates.some(candidate => !pool.some(value => value.libraryId === candidate?.libraryId)) ||
      !contract.candidates.some(candidate => candidate.libraryId === aiMatch?.library?.id)) return { reason: 'candidate_scope_invalid' };
  const selected = ranked.find(candidate => candidate.library_id === aiMatch.library.id);
  const matches = policies.filter(policy => policy?.id === selected.policy_id && policy.library_id === selected.library_id);
  const policy = matches[0], diagnostics = selected.candidate_diagnostics, constraints = diagnostics?.policy_constraints;
  if (matches.length !== 1 || policy.enabled !== true || policy.library_media_type !== metadata.media_type ||
      policy.trust_rag !== true || !Number.isFinite(policy.rag_weight ?? .15) || (policy.rag_weight ?? .15) <= 0 ||
      !Number.isFinite(selected.score) || selected.score <= 0 || selected.score > 100 ||
      !validatePolicyDecisionThresholds(selected).isValid) return { reason: 'selected_policy_unavailable' };
  if (!constraints || constraints.schema_version !== 1 || constraints.failed !== false ||
      constraints.unknown_count !== 0 || constraints.conflict_count !== 0 ||
      !Array.isArray(constraints.conflicts) || constraints.conflicts.length ||
      !Array.isArray(constraints.unknown) || constraints.unknown.length ||
      diagnostics.profile_hard_excluded !== false || diagnostics.evidence_class === 'negative_conflict' ||
      selected.native_intent_runtime?.eligible === false || diagnostics.native_intent_runtime?.eligible === false ||
      !Array.isArray(diagnostics.suppression_reasons) ||
      diagnostics.suppression_reasons.some(reason => !softSuppressions.has(reason))) return { reason: 'selected_policy_conflict' };
  for (const conflicts of [policyResult.constraintConflicts, policyResult.languageConflicts]) {
    if (conflicts != null && (!Array.isArray(conflicts) || conflicts.some(conflict =>
      !conflict || conflict.library_id === selected.library_id || conflict.policy_id === selected.policy_id ||
      (!id(conflict.library_id) && !id(conflict.policy_id))))) return { reason: 'selected_policy_conflict' };
  }
  return { pool, selected };
}
