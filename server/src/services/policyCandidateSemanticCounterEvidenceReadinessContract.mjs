/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_REPORT_VERSION =
  'policy.candidate_semantic_counter_evidence_readiness_report.v1';

export const POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_STATUS_IDS = Object.freeze({
  INVALID_EVALUATION: 'invalid_evaluation',
  NOT_READY: 'not_ready',
  READY_FOR_HUMAN_REVIEW: 'ready_for_human_review',
});

export const POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_BLOCKER_IDS = Object.freeze({
  ABSTENTION_ABOVE_MAXIMUM: 'abstention_above_maximum',
  EVALUATION_SOURCE_INVALID: 'evaluation_source_invalid',
  FALSE_POSITIVE_PRESENT: 'false_positive_present',
  INDEPENDENT_REFERENCE_SET_UNAVAILABLE: 'independent_reference_set_unavailable',
  INSUFFICIENT_FIXTURE_COUNT: 'insufficient_fixture_count',
  INSUFFICIENT_REFERENCE_REVIEW_COUNT: 'insufficient_reference_review_count',
  INSUFFICIENT_STRATUM_COVERAGE: 'insufficient_stratum_coverage',
  PRECISION_BELOW_MINIMUM: 'precision_below_minimum',
  RECALL_BELOW_MINIMUM: 'recall_below_minimum',
});

export const POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_PROFILE = Object.freeze({
  maximumFalsePositiveCount: 0,
  maximumAbstentionRatePercent: 35,
  minimumFixtureCount: 24,
  minimumPrecisionPercent: 95,
  minimumRecallPercent: 90,
  minimumReferenceReviewCount: 8,
  requiredStrata: Object.freeze([
    Object.freeze({ minimumFixtureCount: 4, tagId: 'broad-policy' }),
    Object.freeze({ minimumFixtureCount: 4, tagId: 'documentary' }),
    Object.freeze({ minimumFixtureCount: 4, tagId: 'genre-overlap' }),
    Object.freeze({ minimumFixtureCount: 4, tagId: 'reality' }),
  ]),
  semanticSignalId: 'semantic_retrieval_proposal',
});

export const POLICY_CANDIDATE_SEMANTIC_COUNTER_EVIDENCE_READINESS_AUTHORITY = Object.freeze({
  automaticActions: Object.freeze({
    aiInvocation: false,
    learning: false,
    policyChange: false,
    retry: false,
    routing: false,
  }),
  operatorWorkflowAdmission: false,
  scope: 'offline_evaluation_only',
  snapshotAccess: 'committed_read_only',
});
