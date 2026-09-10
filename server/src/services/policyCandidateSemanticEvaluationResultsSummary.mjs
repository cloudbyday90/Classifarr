/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS,
} from './policyCandidateEvidenceOfflineEvaluationSignalMapping.mjs';
import {
  buildPolicyCandidateSemanticEvaluationAggregateReport,
} from './policyCandidateSemanticEvaluationAggregateReport.mjs';
import {
  buildPolicyCandidateSemanticEvaluationSource,
} from './policyCandidateSemanticEvaluationSource.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS,
} from './policyCandidateSemanticReferenceSetArtifact.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_CALIBRATION_STATUS_IDS,
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_AUTHORITY,
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS,
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_VERSION,
} from './policyCandidateSemanticEvaluationResultsSummaryContract.mjs';

const SEMANTIC_SIGNAL_ID = POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS
  .SEMANTIC_RETRIEVAL_PROPOSAL;

function cloneAuthority() {
  return Object.freeze({
    ...POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_AUTHORITY,
    automaticActions: Object.freeze({
      ...POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_AUTHORITY.automaticActions,
    }),
  });
}

function buildAvailableReport(source) {
  return Object.freeze({
    calibration: Object.freeze({
      available: false,
      reasonId: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_CALIBRATION_STATUS_IDS
        .SCORELESS_CATEGORICAL_SIGNAL,
    }),
    ...buildPolicyCandidateSemanticEvaluationAggregateReport({
      referenceSet: source.referenceSet,
      rows: source.rows,
      signalId: SEMANTIC_SIGNAL_ID,
    }),
  });
}

function buildResult({ report, statusId }) {
  return Object.freeze({
    authority: cloneAuthority(),
    report,
    status: Object.freeze({
      automaticRoutingEligibility: false,
      id: statusId,
      policyChangeEligibility: false,
    }),
    version: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_VERSION,
  });
}

/**
 * Produces a content-free, descriptive report from a validated fixed semantic
 * evaluation and independently reviewed reference set. A categorical semantic
 * proposal has no probability, so this reports calibration as unavailable
 * rather than manufacturing a confidence claim. It never invokes AI/RAG,
 * retains source material, learns, changes policy, or routes media.
 */
export function buildPolicyCandidateSemanticEvaluationResultsSummary({
  fixtureDocument,
  referenceSetDocument,
  snapshotReport,
} = {}) {
  const source = buildPolicyCandidateSemanticEvaluationSource({
    fixtureDocument,
    referenceSetDocument,
    signalId: SEMANTIC_SIGNAL_ID,
    snapshotReport,
  });
  if (!source.ok) {
    return buildResult({
      report: null,
      statusId: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS
        .EVALUATION_SOURCE_INVALID,
    });
  }
  if (source.referenceSet.status.id !==
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INDEPENDENTLY_LABELLED) {
    return buildResult({
      report: null,
      statusId: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS
        .INDEPENDENT_REFERENCE_SET_REQUIRED,
    });
  }
  return buildResult({
    report: buildAvailableReport(source),
    statusId: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.SUMMARY_AVAILABLE,
  });
}
