/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_VERSION =
  'policy.candidate_semantic_evaluation_results_summary.v1';

export const POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS = Object.freeze({
  EVALUATION_SOURCE_INVALID: 'evaluation_source_invalid',
  INDEPENDENT_REFERENCE_SET_REQUIRED: 'independent_reference_set_required',
  SUMMARY_AVAILABLE: 'summary_available',
});

export const POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_CALIBRATION_STATUS_IDS = Object.freeze({
  SCORELESS_CATEGORICAL_SIGNAL: 'scoreless_categorical_signal',
});

export const POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_AUTHORITY = Object.freeze({
  automaticActions: Object.freeze({
    aiInvocation: false,
    learning: false,
    policyChange: false,
    retry: false,
    routing: false,
  }),
  operatorWorkflowAdmission: false,
  scope: 'offline_evaluation_results_summary_only',
});
