/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_WORKFLOW_VERSION =
  'policy.held_out_semantic_study_retrieval_evaluation_completion_workflow.v1';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_STATUS_IDS = Object.freeze({
  ARTIFACT_UNAVAILABLE: 'artifact_unavailable',
  COMPLETE: 'complete',
  INVALID: 'invalid',
  REFERENCE_SET_CONFLICT: 'reference_set_conflict',
  RESULTS_UNAVAILABLE: 'results_unavailable',
  REVIEWER_CONSENSUS_INCOMPLETE: 'reviewer_consensus_incomplete',
  SCORER_UNAVAILABLE: 'scorer_unavailable',
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
    scope: 'explicit_local_offline_retrieval_evaluation_completion_only',
  });
}

function buildStages({ artifact = 'not_started', referenceSet = 'not_started', results = 'not_started', scorer = 'not_started' } = {}) {
  return Object.freeze({ artifact, referenceSet, results, scorer });
}

function result(statusId, stages = buildStages()) {
  return Object.freeze({
    authority: buildAuthority(),
    stages,
    status: Object.freeze({ id: statusId }),
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_WORKFLOW_VERSION,
  });
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function pathIdentity(value) {
  const absolutePath = resolve(value);
  return process.platform === 'win32' ? absolutePath.toLowerCase() : absolutePath;
}

function hasDistinctPaths(paths) {
  if (!paths || typeof paths !== 'object' || Array.isArray(paths)) return false;
  const requiredKeys = [
    'bundleFile',
    'packetFile',
    'referenceSetFile',
    'representationArtifactFile',
    'resultsOutputFile',
    'scorerSubmissionFile',
    'scoringInputFile',
  ];
  return Object.keys(paths).length === requiredKeys.length &&
    requiredKeys.every((key) => hasNonEmptyString(paths[key])) &&
    new Set(requiredKeys.map((key) => pathIdentity(paths[key]))).size === requiredKeys.length;
}

function hasDistinctInputAndOutputPaths({ adjudicationFile, paths, reviewerOneFile, reviewerTwoFile }) {
  const inputs = [reviewerOneFile, reviewerTwoFile, ...(adjudicationFile ? [adjudicationFile] : [])];
  return inputs.every(hasNonEmptyString) &&
    new Set([...Object.values(paths), ...inputs].map(pathIdentity)).size === Object.keys(paths).length + inputs.length;
}

function isReferenceSetReady(receipt) {
  return receipt?.referenceSetWritten === true;
}

function referenceSetStage(receipt) {
  return receipt?.status?.id === 'adjudication_required' ? 'adjudication_required' : 'unavailable';
}

function isSubmissionReady(receipt) {
  return receipt?.submissionWritten === true;
}

function isArtifactReady(receipt) {
  return receipt?.artifactsWritten === true;
}

function isResultsReady(receipt) {
  return receipt?.resultsWritten === true;
}

function options(entries) {
  return entries.flat();
}

/**
 * Chains already-audited local study commands after independent submissions
 * exist. It receives only paths and status receipts, never private document
 * contents. Every unavailable prerequisite stops subsequent work.
 */
export function createHeldOutSemanticStudyRetrievalEvaluationCompletionWorkflow({
  runArtifacts,
  runReferenceSet,
  runResults,
  runScorer,
} = {}) {
  return Object.freeze({
    async complete({ adjudicationFile = null, paths, reviewerOneFile, reviewerTwoFile } = {}) {
      if (typeof runArtifacts !== 'function' || typeof runReferenceSet !== 'function' ||
          typeof runResults !== 'function' || typeof runScorer !== 'function' ||
          !hasDistinctPaths(paths) || !hasNonEmptyString(reviewerOneFile) ||
          !hasNonEmptyString(reviewerTwoFile) || reviewerOneFile === reviewerTwoFile ||
          (adjudicationFile !== null && !hasNonEmptyString(adjudicationFile)) ||
          !hasDistinctInputAndOutputPaths({ adjudicationFile, paths, reviewerOneFile, reviewerTwoFile })) {
        return result(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_STATUS_IDS.INVALID);
      }

      let referenceSetReceipt;
      try {
        referenceSetReceipt = await runReferenceSet({
          argv: options([
            ['--packet-file', paths.packetFile],
            ['--reviewer-one-file', reviewerOneFile],
            ['--reviewer-two-file', reviewerTwoFile],
            ...(adjudicationFile ? [['--adjudication-file', adjudicationFile]] : []),
            ['--output-file', paths.referenceSetFile],
          ]),
        });
      } catch (error) {
        if (error?.code === 'STUDY_REFERENCE_SET_CONFLICT') {
          return result(
            HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_STATUS_IDS.REFERENCE_SET_CONFLICT,
            buildStages({ referenceSet: 'conflict' }),
          );
        }
        referenceSetReceipt = null;
      }
      if (!isReferenceSetReady(referenceSetReceipt)) {
        return result(
          HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_STATUS_IDS.REVIEWER_CONSENSUS_INCOMPLETE,
          buildStages({ referenceSet: referenceSetStage(referenceSetReceipt) }),
        );
      }

      let scorerReceipt;
      try {
        scorerReceipt = await runScorer({
          argv: options([
            ['--bundle-file', paths.bundleFile],
            ['--scoring-input-file', paths.scoringInputFile],
            ['--output-file', paths.scorerSubmissionFile],
          ]),
        });
      } catch {
        scorerReceipt = null;
      }
      if (!isSubmissionReady(scorerReceipt)) {
        return result(
          HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_STATUS_IDS.SCORER_UNAVAILABLE,
          buildStages({ referenceSet: 'ready', scorer: 'unavailable' }),
        );
      }

      let artifactReceipt;
      try {
        artifactReceipt = await runArtifacts({
          argv: options([
            ['--bundle-file', paths.bundleFile],
            ['--submission-file', paths.scorerSubmissionFile],
            ['--output-file', paths.representationArtifactFile],
          ]),
        });
      } catch {
        artifactReceipt = null;
      }
      if (!isArtifactReady(artifactReceipt)) {
        return result(
          HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_STATUS_IDS.ARTIFACT_UNAVAILABLE,
          buildStages({ artifact: 'unavailable', referenceSet: 'ready', scorer: 'ready' }),
        );
      }

      let resultsReceipt;
      try {
        resultsReceipt = await runResults({
          argv: options([
            ['--bundle-file', paths.bundleFile],
            ['--reference-set-file', paths.referenceSetFile],
            ['--representation-file', paths.representationArtifactFile],
            ['--output-file', paths.resultsOutputFile],
          ]),
        });
      } catch {
        resultsReceipt = null;
      }
      if (!isResultsReady(resultsReceipt)) {
        return result(
          HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_STATUS_IDS.RESULTS_UNAVAILABLE,
          buildStages({ artifact: 'ready', referenceSet: 'ready', results: 'unavailable', scorer: 'ready' }),
        );
      }

      return result(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_STATUS_IDS.COMPLETE,
        buildStages({ artifact: 'ready', referenceSet: 'ready', results: 'ready', scorer: 'ready' }),
      );
    },
  });
}
