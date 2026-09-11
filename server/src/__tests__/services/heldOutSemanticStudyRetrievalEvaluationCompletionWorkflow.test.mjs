/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createHeldOutSemanticStudyRetrievalEvaluationCompletionWorkflow,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_EVALUATION_COMPLETION_STATUS_IDS as STATUS_IDS,
} from '../../services/heldOutSemanticStudyRetrievalEvaluationCompletionWorkflow.mjs';

const paths = Object.freeze({
  bundleFile: '.tmp/study/packet.evaluation-bundle.json',
  packetFile: '.tmp/study/packet.json',
  referenceSetFile: '.tmp/study/results.reference-set.json',
  representationArtifactFile: '.tmp/study/results.representation-artifact.json',
  resultsOutputFile: '.tmp/study/results.json',
  scorerSubmissionFile: '.tmp/study/results.scorer-submission.json',
  scoringInputFile: '.tmp/study/packet.scoring-input.json',
});

const input = Object.freeze({
  paths,
  reviewerOneFile: '.tmp/study/reviewer-one.json',
  reviewerTwoFile: '.tmp/study/reviewer-two.json',
});

describe('held-out semantic study retrieval evaluation completion workflow', () => {
  test('runs each bounded stage in order and returns only a stage receipt', async () => {
    const runReferenceSet = jest.fn(async () => ({ referenceSetWritten: true, status: { id: 'complete' } }));
    const runScorer = jest.fn(async () => ({ submissionWritten: true, status: { id: 'submission_ready' } }));
    const runArtifacts = jest.fn(async () => ({ artifactsWritten: true, status: { id: 'artifact_set_ready' } }));
    const runResults = jest.fn(async () => ({ resultsWritten: true, status: { id: 'summary_available' } }));
    const workflow = createHeldOutSemanticStudyRetrievalEvaluationCompletionWorkflow({
      runArtifacts,
      runReferenceSet,
      runResults,
      runScorer,
    });

    const completion = await workflow.complete(input);

    expect(completion).toMatchObject({
      stages: { artifact: 'ready', referenceSet: 'ready', results: 'ready', scorer: 'ready' },
      status: { id: STATUS_IDS.COMPLETE },
    });
    expect(completion.authority.automaticActions).toEqual({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      retry: false,
      routing: false,
    });
    expect(runReferenceSet).toHaveBeenCalledWith({
      argv: [
        '--packet-file', paths.packetFile,
        '--reviewer-one-file', input.reviewerOneFile,
        '--reviewer-two-file', input.reviewerTwoFile,
        '--output-file', paths.referenceSetFile,
      ],
    });
    expect(runScorer).toHaveBeenCalledWith({
      argv: [
        '--bundle-file', paths.bundleFile,
        '--scoring-input-file', paths.scoringInputFile,
        '--output-file', paths.scorerSubmissionFile,
      ],
    });
    expect(runArtifacts).toHaveBeenCalledWith({
      argv: [
        '--bundle-file', paths.bundleFile,
        '--submission-file', paths.scorerSubmissionFile,
        '--output-file', paths.representationArtifactFile,
      ],
    });
    expect(runResults).toHaveBeenCalledWith({
      argv: [
        '--bundle-file', paths.bundleFile,
        '--reference-set-file', paths.referenceSetFile,
        '--representation-file', paths.representationArtifactFile,
        '--output-file', paths.resultsOutputFile,
      ],
    });
    expect(JSON.stringify(completion)).not.toContain('packet.evaluation');
  });

  test('stops before scoring when an independent consensus needs adjudication', async () => {
    const runScorer = jest.fn();
    const workflow = createHeldOutSemanticStudyRetrievalEvaluationCompletionWorkflow({
      runArtifacts: jest.fn(),
      runReferenceSet: jest.fn(async () => ({
        referenceSetWritten: false,
        status: { id: 'adjudication_required' },
      })),
      runResults: jest.fn(),
      runScorer,
    });

    const completion = await workflow.complete(input);

    expect(completion).toMatchObject({
      stages: { referenceSet: 'adjudication_required' },
      status: { id: STATUS_IDS.REVIEWER_CONSENSUS_INCOMPLETE },
    });
    expect(runScorer).not.toHaveBeenCalled();
  });

  test('stops later stages when the admitted private scorer is unavailable', async () => {
    const runArtifacts = jest.fn();
    const runResults = jest.fn();
    const workflow = createHeldOutSemanticStudyRetrievalEvaluationCompletionWorkflow({
      runArtifacts,
      runReferenceSet: jest.fn(async () => ({ referenceSetWritten: true, status: { id: 'complete' } })),
      runResults,
      runScorer: jest.fn(async () => ({ submissionWritten: false, status: { id: 'provider_unavailable' } })),
    });

    const completion = await workflow.complete(input);

    expect(completion).toMatchObject({
      stages: { referenceSet: 'ready', scorer: 'unavailable' },
      status: { id: STATUS_IDS.SCORER_UNAVAILABLE },
    });
    expect(runArtifacts).not.toHaveBeenCalled();
    expect(runResults).not.toHaveBeenCalled();
  });

  test('rejects colliding reviewer and generated study paths before calling a stage', async () => {
    const runReferenceSet = jest.fn();
    const workflow = createHeldOutSemanticStudyRetrievalEvaluationCompletionWorkflow({
      runArtifacts: jest.fn(),
      runReferenceSet,
      runResults: jest.fn(),
      runScorer: jest.fn(),
    });

    const completion = await workflow.complete({ ...input, reviewerOneFile: paths.referenceSetFile });

    expect(completion.status.id).toBe(STATUS_IDS.INVALID);
    expect(runReferenceSet).not.toHaveBeenCalled();
  });
});
