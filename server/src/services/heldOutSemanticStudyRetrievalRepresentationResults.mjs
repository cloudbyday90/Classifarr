/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  isHeldOutSemanticStudyEvaluationBundleShape,
} from './heldOutSemanticStudyEvaluationBundleShape.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS,
  validateHeldOutSemanticStudyRetrievalRepresentationArtifactBinding,
} from './heldOutSemanticStudyRetrievalRepresentationArtifact.mjs';
import {
  buildPolicyCandidateSemanticEvaluationAggregateReport,
} from './policyCandidateSemanticEvaluationAggregateReport.mjs';
import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS,
} from './policyCandidateEvidenceOfflineEvaluationSignalMapping.mjs';
import {
  buildPolicyCandidateSemanticEvaluationSource,
} from './policyCandidateSemanticEvaluationSource.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_CALIBRATION_STATUS_IDS,
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS,
} from './policyCandidateSemanticEvaluationResultsSummaryContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS,
} from './policyCandidateSemanticReferenceSetArtifact.mjs';
import {
  evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument,
} from './policyCandidateSemanticSnapshotOfflineEvaluation.mjs';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_RESULTS_VERSION =
  'policy.held_out_semantic_study_retrieval_representation_results.v1';

function buildAuthority() {
  return Object.freeze({
    automaticActions: Object.freeze({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      retry: false,
      routing: false,
    }),
    operatorWorkflowAdmission: false,
    scope: 'offline_retrieval_representation_evaluation_only',
  });
}

function buildResult(statusId, report = null) {
  return Object.freeze({
    authority: buildAuthority(),
    report,
    status: Object.freeze({
      automaticRoutingEligibility: false,
      id: statusId,
      policyChangeEligibility: false,
    }),
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_RESULTS_VERSION,
  });
}

function artifactSignalsByRepresentation(artifact) {
  return new Map(artifact.representationResults.map((representation) => [
    representation.representationId,
    new Map(representation.signals.map((signal) => [signal.fixtureId, signal.decisionId])),
  ]));
}

function representationRows({ fixtureDocument, representationSignals, sourceRows }) {
  if (!(representationSignals instanceof Map) || !Array.isArray(sourceRows) ||
      sourceRows.length !== fixtureDocument.length) return null;
  const rows = fixtureDocument.map((fixture, index) => {
    const sourceRow = sourceRows[index];
    const signalDecisionId = representationSignals.get(fixture.id);
    if (!sourceRow || typeof signalDecisionId !== 'string') return null;
    return Object.freeze({
      referenceDecisionId: sourceRow.referenceDecisionId,
      signalDecisionId,
      tags: Object.freeze([...sourceRow.tags]),
    });
  });
  return rows.includes(null) ? null : Object.freeze(rows);
}

function buildAvailableReport({ artifact, fixtureDocument, source }) {
  const signalsByRepresentation = artifactSignalsByRepresentation(artifact);
  const comparisons = Object.values(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS)
    .map((representationId) => {
      const rows = representationRows({
        fixtureDocument,
        representationSignals: signalsByRepresentation.get(representationId),
        sourceRows: source.rows,
      });
      if (!rows) return null;
      return Object.freeze({
        representationId,
        ...buildPolicyCandidateSemanticEvaluationAggregateReport({
          referenceSet: source.referenceSet,
          rows,
          signalId: representationId,
        }),
      });
    });
  if (comparisons.includes(null)) return null;
  return Object.freeze({
    calibration: Object.freeze({
      available: false,
      reasonId: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_CALIBRATION_STATUS_IDS
        .SCORELESS_CATEGORICAL_SIGNAL,
    }),
    comparisons: Object.freeze(comparisons),
  });
}

/**
 * Compares three separately scored representations—media description,
 * declared library purpose, and nearest-item history—against the same pinned
 * independent reference set. Inputs are fixed, redacted, categorical study
 * artifacts. The result is aggregate-only and cannot invoke AI/RAG, retain
 * representation text, learn, change policy, retry, or route media.
 */
export function buildHeldOutSemanticStudyRetrievalRepresentationResults({
  evaluationBundle,
  referenceSetDocument,
  representationArtifact,
} = {}) {
  if (!isHeldOutSemanticStudyEvaluationBundleShape(evaluationBundle)) {
    return buildResult(
      POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.EVALUATION_SOURCE_INVALID,
    );
  }
  const binding = validateHeldOutSemanticStudyRetrievalRepresentationArtifactBinding({
    artifact: representationArtifact,
    fixtureDocument: evaluationBundle.fixtureDocument,
    snapshotDocument: evaluationBundle.snapshotDocument,
  });
  if (!binding.ok) {
    return buildResult(
      POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.EVALUATION_SOURCE_INVALID,
    );
  }
  const snapshotReport = evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument({
    fixtureDocument: evaluationBundle.fixtureDocument,
    manifest: evaluationBundle.manifest,
    snapshotDocument: evaluationBundle.snapshotDocument,
  });
  const source = buildPolicyCandidateSemanticEvaluationSource({
    fixtureDocument: evaluationBundle.fixtureDocument,
    referenceSetDocument,
    signalId: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS.SEMANTIC_RETRIEVAL_PROPOSAL,
    snapshotReport,
  });
  if (!source.ok) {
    return buildResult(
      POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.EVALUATION_SOURCE_INVALID,
    );
  }
  if (source.referenceSet.status.id !==
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INDEPENDENTLY_LABELLED) {
    return buildResult(
      POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.INDEPENDENT_REFERENCE_SET_REQUIRED,
    );
  }
  const report = buildAvailableReport({
    artifact: representationArtifact,
    fixtureDocument: evaluationBundle.fixtureDocument,
    source,
  });
  return report
    ? buildResult(POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.SUMMARY_AVAILABLE, report)
    : buildResult(POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.EVALUATION_SOURCE_INVALID);
}
