/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  isHeldOutSemanticStudyEvaluationBundleShape,
} from './heldOutSemanticStudyEvaluationBundleShape.mjs';
import {
  buildHeldOutSemanticStudyRetrievalRepresentationArtifactSet,
  validateHeldOutSemanticStudyRetrievalRepresentationArtifactSetBinding,
} from './heldOutSemanticStudyRetrievalRepresentationArtifactSet.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_VERSION,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS,
} from './heldOutSemanticStudyRetrievalRepresentationArtifact.mjs';
import {
  validateHeldOutSemanticStudyRetrievalRepresentationSubmissionBinding,
} from './heldOutSemanticStudyRetrievalRepresentationSubmission.mjs';
import {
  evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument,
} from './policyCandidateSemanticSnapshotOfflineEvaluation.mjs';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_PRODUCER_VERSION =
  'policy.held_out_semantic_study_retrieval_representation_artifact_producer.v1';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_PRODUCER_STATUS_IDS = Object.freeze({
  ARTIFACT_SET_READY: 'artifact_set_ready',
  EVALUATION_SOURCE_INVALID: 'evaluation_source_invalid',
  SUBMISSION_INVALID: 'submission_invalid',
});

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
    scope: 'offline_retrieval_representation_artifact_production_only',
  });
}

function buildResult(statusId, artifactSet = null) {
  return Object.freeze({
    artifactSet,
    authority: buildAuthority(),
    status: Object.freeze({
      automaticRoutingEligibility: false,
      id: statusId,
      policyChangeEligibility: false,
    }),
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_PRODUCER_VERSION,
  });
}

function signalsFor(submissionSignals, key) {
  return Object.freeze(submissionSignals.map((signal) => Object.freeze({
    decisionId: signal[key],
    fixtureId: signal.fixtureId,
  })));
}

function artifactFor(submission, nearestItemHistoryKey) {
  return Object.freeze({
    fixtureDocumentFingerprint: submission.fixtureDocumentFingerprint,
    representationResults: Object.freeze([
      Object.freeze({
        representationId: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS.DECLARED_LIBRARY_PURPOSE,
        signals: signalsFor(submission.signals, 'declaredLibraryPurposeDecisionId'),
      }),
      Object.freeze({
        representationId: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS.MEDIA_DESCRIPTION,
        signals: signalsFor(submission.signals, 'mediaDescriptionDecisionId'),
      }),
      Object.freeze({
        representationId: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS.NEAREST_ITEM_HISTORY,
        signals: signalsFor(submission.signals, nearestItemHistoryKey),
      }),
    ]),
    snapshotDocumentFingerprint: submission.snapshotDocumentFingerprint,
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_VERSION,
  });
}

function evaluationBundleIsValid(evaluationBundle) {
  if (!isHeldOutSemanticStudyEvaluationBundleShape(evaluationBundle)) return false;
  const report = evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument({
    fixtureDocument: evaluationBundle.fixtureDocument,
    manifest: evaluationBundle.manifest,
    snapshotDocument: evaluationBundle.snapshotDocument,
  });
  return report?.evaluation?.validation?.ok === true;
}

/**
 * Produces two identically pinned, categorical artifacts from one complete
 * private evaluator submission. The only permitted condition difference is
 * whether a historical item's Classification label was available to the
 * evaluator; source text and every external-model detail are discarded before
 * the artifact set exists.
 */
export function buildHeldOutSemanticStudyRetrievalRepresentationArtifactSetFromSubmission({
  evaluationBundle,
  submission,
} = {}) {
  if (!evaluationBundleIsValid(evaluationBundle)) {
    return buildResult(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_PRODUCER_STATUS_IDS
        .EVALUATION_SOURCE_INVALID,
    );
  }
  const submissionBinding = validateHeldOutSemanticStudyRetrievalRepresentationSubmissionBinding({
    fixtureDocument: evaluationBundle.fixtureDocument,
    snapshotDocument: evaluationBundle.snapshotDocument,
    submission,
  });
  if (!submissionBinding.ok) {
    return buildResult(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_PRODUCER_STATUS_IDS.SUBMISSION_INVALID,
    );
  }
  const artifactSet = buildHeldOutSemanticStudyRetrievalRepresentationArtifactSet({
    excludedArtifact: artifactFor(
      submission,
      'nearestItemHistoryClassificationLabelExcludedDecisionId',
    ),
    fixtureDocumentFingerprint: submission.fixtureDocumentFingerprint,
    includedArtifact: artifactFor(
      submission,
      'nearestItemHistoryClassificationLabelIncludedDecisionId',
    ),
    snapshotDocumentFingerprint: submission.snapshotDocumentFingerprint,
  });
  const artifactSetBinding = validateHeldOutSemanticStudyRetrievalRepresentationArtifactSetBinding({
    artifactSet,
    fixtureDocument: evaluationBundle.fixtureDocument,
    snapshotDocument: evaluationBundle.snapshotDocument,
  });
  return artifactSetBinding.ok
    ? buildResult(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_PRODUCER_STATUS_IDS.ARTIFACT_SET_READY,
      artifactSet,
    )
    : buildResult(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_PRODUCER_STATUS_IDS.SUBMISSION_INVALID,
    );
}
