/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function purposeEvaluationMessage(summary) {
  if (!summary || summary.status === 'never_run') return 'Destination reviews run automatically. Waiting for the first saved summary.'
  if (summary.status === 'unavailable') return 'Destination review evidence is not available yet. Checks run automatically.'
  if (summary.status === 'deferred') return 'Destination reviews are waiting for background capacity and will retry automatically.'
  if (summary.status === 'stale') return 'The saved destination review summary is out of date. Waiting for an automatic refresh.'
  if (summary.status !== 'complete' || !summary.report) return 'Destination review summary is unavailable. It will retry automatically.'
  if (summary.report.phase === 'no_retained_choices') return 'Destination reviews run automatically once recorded choices are available.'
  if (summary.report.phase === 'no_eligible_choices') return 'Comparable destination reviews are not available yet.'
  const choices = summary.report.eligible, differences = summary.report.comparisons.policyVersusChoice.differs
  return `Destination reviews: ${purposeChoiceCount(choices)}; ${differences} ${differences === 1 ? 'differs' : 'differ'} from the policy recommendation.`
}
export const purposeChoiceCount = count => `${count} comparable ${count === 1 ? 'choice' : 'choices'}`
export const purposeFailureLabels = { busy: 'Other background work is active.', memory_pressure: 'Waiting for available memory.',
  memory_unknown: 'Available memory could not be verified.', evidence_budget: 'The retained evidence exceeds the summary budget.',
  invalid_evidence: 'Retained evidence did not pass validation.', deadline: 'Evaluation reached its time budget.',
  sources_unavailable: 'Required review evidence sources are unavailable.', evaluation_unavailable: 'Evaluation could not complete.' }
export const purposeComparisonLabels = { policyVersusChoice: 'Policy recommendation and operator choice',
  originalVersusChoice: 'Original automated destination and operator choice', policyVersusOriginal: 'Policy recommendation and original destination' }
export const purposeSourceLabels = { manual: 'History destination decisions', runtime: 'Pending-request answers', history_review: 'History assessments' }
export const purposeGapLabels = { missing_capture: 'Missing saved policy evaluation', legacy_capture: 'Older policy evidence', expired_capture: 'Expired policy evaluation',
  capture_gap: 'Incomplete policy evaluation', invalid_capture: 'Invalid policy evaluation', unverified_purpose: 'Policy purpose could not be verified',
  no_policy_leader: 'No saved policy recommendation', source_only_identity: 'Item identity is missing', binding_failure: 'Item or destination evidence does not match',
  legacy_event: 'Older event evidence', missing_action_evidence: 'The action evidence is missing', selection_only: 'Selection without an assessment',
  unknown_action: 'The original action was not recorded', missing_supplement: 'Missing saved comparison reference', expired: 'Expired evidence',
  conflicting: 'Conflicting evidence', unavailable_destination: 'Unavailable destination' }
