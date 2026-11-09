/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function pendingReviewReference({ policyName = 'Comedy', advisoryName = 'Movies' } = {}) {
  const policy = { library_id: 7, library_name: policyName, evidence_score: 37 }
  const advisory = { library_id: 8, library_name: advisoryName }
  return {
    version: 'policy.runtime_question_answer.v1', fingerprint: 'abcdefghijklmnopqrstuv',
    question: { type: 'runtime_question', text: 'Choose a destination.', why_uncertain: 'Review required.' },
    candidate_destinations: [{ library_id: 8, library_name: advisoryName }, { library_id: 7, library_name: policyName }],
    recommendation: { version: 'policy.runtime_question_recommendation_presentation.v2', status_id: 'manual_destination_selection_required',
      leading_destination: null, policy_destination: policy, advisory_destination: advisory, alternative_candidate_count: 2,
      why_not_automatic: { reason_id: 'advisory_disagreement', message: 'Policy and AI comparison point to different destinations. Choose the destination for this item.' } },
    decision_summary: { version: 'policy.runtime_question_decision_presentation.v1', deterministic: {
      status_id: 'below_review_threshold', destination: { library_id: 7, library_name: policyName }, score: 37, review_threshold: 60, automatic_threshold: 85,
      message: `${policyName} does not meet the policy confirmation threshold.`, evidence: [], additional_safety_gates: [], safety_gate: null },
    candidate_adjudication: { version: 'policy.candidate_adjudication_presentation.v1', status_id: 'proposed',
      label: 'Bounded candidate comparison complete', message: 'The suggestion is advisory. Choose a destination.', proposed_destination: advisory } },
    allowed_actions: ['confirm_destination', 'change_destination'].map(id => ({ id, available: true, destination_required: true,
      destination_scope: id === 'confirm_destination' ? 'candidate_destinations' : 'active_matching_media_type' })),
  }
}
