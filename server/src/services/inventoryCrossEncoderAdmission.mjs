/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildPolicyCandidateAdjudicationContract, POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS } from './policyCandidateAdjudicationContract.mjs';
import { prepareSemanticComparisonPlan, SemanticComparisonEvidenceError } from './inventorySemanticComparisonContract.mjs';

// A diagnosis is not permission to retry or enqueue a repair. In particular,
// sparse fold-local evidence may be intentional, not a missing live observation.
const reasons = new Map([
  ['policy_auto_decision', ['policy_scope', 'not_needed']],
  ['policy_not_reviewable', ['policy_scope', 'inspect_policy_scope']],
  ['insufficient_policy_candidates', ['policy_scope', 'inspect_policy_scope']],
  ['query_metadata_unavailable', ['missing_evidence', 'check_existing_readiness']],
  ['query_description_missing', ['missing_evidence', 'check_existing_readiness']],
  ['retrieval_unavailable', ['missing_evidence', 'check_existing_readiness']],
  ['example_coverage_incomplete', ['missing_evidence', 'check_existing_readiness']],
  ['examples_missing', ['missing_evidence', 'check_fold_eligibility']],
  ['too_few_examples', ['missing_evidence', 'check_fold_eligibility']],
  ['shared_examples', ['integrity_guard', 'preserve_exclusion']],
  ['duplicate_examples', ['integrity_guard', 'preserve_exclusion']],
  ['query_in_examples', ['integrity_guard', 'preserve_exclusion']],
  ['candidate_scope_invalid', ['invalid_contract', 'inspect_contract']],
  ['snapshot_context_invalid', ['invalid_contract', 'inspect_contract']],
  ['candidate_evidence_mismatch', ['invalid_contract', 'inspect_contract']],
  ['example_counts_invalid', ['invalid_contract', 'inspect_contract']],
  ['examples_invalid', ['invalid_contract', 'inspect_contract']],
  ['validation_failed', ['invalid_contract', 'inspect_contract']],
  ['retention_budget', ['resource_limit', 'reduce_run_size']],
]);

/** Reuse policy admission and the authoritative evidence validator, without I/O. */
export function prepareCrossEncoderEvidence(input) {
  if (!['movie', 'tv'].includes(input?.metadata?.media_type)) return { reason: 'query_metadata_unavailable' };
  const admission = buildPolicyCandidateAdjudicationContract({ policyResult: input.policyResult,
    libraries: input.libraries, mediaType: input.metadata.media_type });
  if (!admission.valid) {
    if (admission.reasonCode === POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.INSUFFICIENT_CANDIDATES) {
      return { reason: 'insufficient_policy_candidates' };
    }
    return { reason: input.policyResult?.action === 'auto_classify' ? 'policy_auto_decision' : 'policy_not_reviewable' };
  }
  try {
    const plan = prepareSemanticComparisonPlan(input);
    return plan.candidates.some(candidate => candidate.examples.length < 2) ? { reason: 'too_few_examples' } : { plan };
  } catch (error) {
    return { reason: error instanceof SemanticComparisonEvidenceError && reasons.has(error.reasonCode) ? error.reasonCode : 'validation_failed' };
  }
}

/** Only fixed reason codes and counts leave the private evidence preparation. */
export function createCrossEncoderExclusionDiagnostics() {
  const counts = new Map();
  return {
    record(reason, mediaType) {
      const code = reasons.has(reason) ? reason : 'validation_failed';
      const row = counts.get(code) ?? { count: 0, byMedia: { movie: 0, tv: 0, unknown: 0 } };
      row.count++; row.byMedia[['movie', 'tv'].includes(mediaType) ? mediaType : 'unknown']++;
      counts.set(code, row);
    },
    report() {
      const ordered = [...counts].sort(([a], [b]) => a.localeCompare(b));
      return {
        excluded: Object.fromEntries(ordered.map(([reason, row]) => [reason, row.count])),
        exclusionDiagnostics: ordered.map(([reason, row]) => ({ reason, count: row.count,
          category: reasons.get(reason)[0], nextStep: reasons.get(reason)[1], byMedia: { ...row.byMedia } })),
      };
    },
  };
}
