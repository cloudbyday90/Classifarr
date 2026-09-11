/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  formatForEmbedding,
  formatForEmbeddingWithoutClassificationLabel,
} from './embeddingServiceFormatters.mjs';
import {
  isHeldOutSemanticStudyEvaluationBundleShape,
} from './heldOutSemanticStudyEvaluationBundleShape.mjs';
import {
  createHeldOutSemanticStudyScope,
} from './heldOutSemanticStudyScope.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_SOURCE_STATUS_IDS,
} from './heldOutSemanticStudyRetrievalRepresentationScoringSource.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_STRUCTURED_EVALUATOR_STATUS_IDS,
} from './heldOutSemanticStudyRetrievalRepresentationStructuredEvaluator.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_VERSION,
  validateHeldOutSemanticStudyRetrievalRepresentationSubmissionBinding,
} from './heldOutSemanticStudyRetrievalRepresentationSubmission.mjs';
import {
  validateHeldOutSemanticStudyRetrievalRepresentationScoringInputBinding,
} from './heldOutSemanticStudyRetrievalRepresentationScoringInput.mjs';
import {
  evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument,
} from './policyCandidateSemanticSnapshotOfflineEvaluation.mjs';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_VERSION =
  'policy.held_out_semantic_study_retrieval_representation_scorer.v1';
export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS = Object.freeze({
  EVALUATION_SOURCE_INVALID: 'evaluation_source_invalid',
  EVALUATOR_OUTPUT_INVALID: 'evaluator_output_invalid',
  EVALUATOR_UNAVAILABLE: 'evaluator_unavailable',
  HISTORY_UNAVAILABLE: 'history_unavailable',
  SCORING_INPUT_INVALID: 'scoring_input_invalid',
  SUBMISSION_READY: 'submission_ready',
});

function buildAuthority(aiInvocation) {
  return Object.freeze({
    automaticActions: Object.freeze({
      aiInvocation,
      learning: false,
      policyChange: false,
      retry: false,
      routing: false,
    }),
    operatorWorkflowAdmission: false,
    scope: 'offline_retrieval_representation_scoring_only',
  });
}

function result(statusId, submission = null, { aiInvocation = false } = {}) {
  return Object.freeze({
    authority: buildAuthority(aiInvocation),
    status: Object.freeze({
      automaticRoutingEligibility: false,
      id: statusId,
      policyChangeEligibility: false,
    }),
    submission,
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_VERSION,
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

function normalizedHistoryText(item, includeClassificationLabel) {
  const metadata = item?.metadata && typeof item.metadata === 'object'
    ? { ...item.metadata, library_name: item.classificationLabel }
    : null;
  if (!metadata) return null;
  try {
    const value = includeClassificationLabel
      ? formatForEmbedding(metadata)
      : formatForEmbeddingWithoutClassificationLabel(metadata);
    return typeof value === 'string' && value.trim() ? value : null;
  } catch {
    return null;
  }
}

function historyByCandidate(evidence, includeClassificationLabel) {
  if (!Array.isArray(evidence?.candidates)) return null;
  const candidates = evidence.candidates.map((candidate) => {
    if (typeof candidate?.candidateId !== 'string' || !Array.isArray(candidate.items)) return null;
    const items = candidate.items.map((item) => normalizedHistoryText(item, includeClassificationLabel));
    return items.includes(null) ? null : Object.freeze({
      candidateId: candidate.candidateId,
      items: Object.freeze(items),
    });
  });
  return candidates.includes(null) ? null : Object.freeze(candidates);
}

function scorerRequest(studyCase, evidence) {
  let mediaDescription;
  try {
    mediaDescription = formatForEmbedding(studyCase.metadata);
  } catch {
    return null;
  }
  const included = historyByCandidate(evidence, true);
  const excluded = historyByCandidate(evidence, false);
  if (typeof mediaDescription !== 'string' || !mediaDescription.trim() || !included || !excluded) return null;
  return Object.freeze({
    declaredLibraryPurpose: Object.freeze(studyCase.candidates.map((candidate) => Object.freeze({
      candidateId: candidate.candidateId,
      declaredPurposeTerms: candidate.declaredPurposeTerms,
    }))),
    mediaDescription,
    nearestItemHistoryClassificationLabelExcluded: excluded,
    nearestItemHistoryClassificationLabelIncluded: included,
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_VERSION,
  });
}

function signals(fixtureId, decisions) {
  return Object.freeze({
    declaredLibraryPurposeDecisionId: decisions.declaredLibraryPurposeDecisionId,
    fixtureId,
    mediaDescriptionDecisionId: decisions.mediaDescriptionDecisionId,
    nearestItemHistoryClassificationLabelExcludedDecisionId:
      decisions.nearestItemHistoryClassificationLabelExcludedDecisionId,
    nearestItemHistoryClassificationLabelIncludedDecisionId:
      decisions.nearestItemHistoryClassificationLabelIncludedDecisionId,
  });
}

function sourceMatchesCase(evidence, studyCase) {
  const evidenceIds = new Set((Array.isArray(evidence?.candidates) ? evidence.candidates : [])
    .map((candidate) => candidate?.candidateId));
  return evidenceIds.size === studyCase.candidates.length && studyCase.candidates.every((candidate) => (
    evidenceIds.has(candidate.candidateId)
  ));
}

/**
 * Runs a bounded, private study scorer. Source material is passed to the
 * evaluator only in-process; this function returns only a schema-checked,
 * fingerprint-pinned categorical submission. It is never a routing path.
 */
export function createHeldOutSemanticStudyRetrievalRepresentationScorer({
  evaluator,
  historySource,
} = {}) {
  return Object.freeze({
    async score({ evaluationBundle, scoringInput } = {}) {
      if (!evaluationBundleIsValid(evaluationBundle)) {
        return result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.EVALUATION_SOURCE_INVALID);
      }
      const inputBinding = validateHeldOutSemanticStudyRetrievalRepresentationScoringInputBinding({
        fixtureDocument: evaluationBundle.fixtureDocument,
        scoringInput,
        snapshotDocument: evaluationBundle.snapshotDocument,
      });
      if (!inputBinding.ok) {
        return result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.SCORING_INPUT_INVALID);
      }
      if (typeof evaluator?.evaluate !== 'function') {
        return result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.EVALUATOR_UNAVAILABLE);
      }
      if (typeof historySource?.retrieve !== 'function') {
        return result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.HISTORY_UNAVAILABLE);
      }

      let heldOutScope;
      try {
        heldOutScope = createHeldOutSemanticStudyScope(scoringInput.cases.map((studyCase) => studyCase.metadata));
      } catch {
        return result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.SCORING_INPUT_INVALID);
      }

      const scoredSignals = [];
      for (const studyCase of scoringInput.cases) {
        let evidence;
        try {
          evidence = await historySource.retrieve({
            candidates: studyCase.candidates,
            heldOutScope,
            metadata: studyCase.metadata,
          });
        } catch {
          return result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.HISTORY_UNAVAILABLE);
        }
        if (evidence?.statusId !== HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_SOURCE_STATUS_IDS.AVAILABLE ||
            !sourceMatchesCase(evidence, studyCase)) {
          return result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.HISTORY_UNAVAILABLE);
        }
        const request = scorerRequest(studyCase, evidence);
        if (!request) {
          return result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.HISTORY_UNAVAILABLE);
        }
        let response;
        try {
          response = await evaluator.evaluate(request);
        } catch {
          return result(
            HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.EVALUATOR_UNAVAILABLE,
            null,
            { aiInvocation: true },
          );
        }
        if (response?.statusId ===
            HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_STRUCTURED_EVALUATOR_STATUS_IDS.PROVIDER_UNAVAILABLE) {
          return result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.EVALUATOR_UNAVAILABLE);
        }
        if (response?.statusId !==
            HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_STRUCTURED_EVALUATOR_STATUS_IDS.ADMITTED ||
            !response.decisions) {
          return result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.EVALUATOR_OUTPUT_INVALID,
            null, { aiInvocation: true });
        }
        scoredSignals.push(signals(studyCase.fixtureId, response.decisions));
      }
      const submission = Object.freeze({
        fixtureDocumentFingerprint: scoringInput.fixtureDocumentFingerprint,
        signals: Object.freeze(scoredSignals),
        snapshotDocumentFingerprint: scoringInput.snapshotDocumentFingerprint,
        version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_VERSION,
      });
      const submissionBinding = validateHeldOutSemanticStudyRetrievalRepresentationSubmissionBinding({
        fixtureDocument: evaluationBundle.fixtureDocument,
        snapshotDocument: evaluationBundle.snapshotDocument,
        submission,
      });
      return submissionBinding.ok
        ? result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.SUBMISSION_READY,
          submission, { aiInvocation: true })
        : result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS.EVALUATOR_OUTPUT_INVALID,
          null, { aiInvocation: true });
    },
  });
}
