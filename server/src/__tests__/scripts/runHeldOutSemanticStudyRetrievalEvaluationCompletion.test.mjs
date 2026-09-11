/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';

import {
  runHeldOutSemanticStudyRetrievalEvaluationCompletion,
} from '../../scripts/runHeldOutSemanticStudyRetrievalEvaluationCompletion.mjs';

const argv = [
  '--confirm-private-study-evaluation',
  '--packet-file', '.tmp/study/packet.json',
  '--reviewer-one-file', '.tmp/study/reviewer-one.json',
  '--reviewer-two-file', '.tmp/study/reviewer-two.json',
  '--adjudication-file', '.tmp/study/adjudication.json',
  '--output-file', '.tmp/study/results.json',
];

test('requires explicit confirmation and derives private study companions without exposing paths', async () => {
  const complete = jest.fn(async () => ({ status: { id: 'complete' } }));
  const createWorkflow = jest.fn(() => ({ complete }));

  await expect(runHeldOutSemanticStudyRetrievalEvaluationCompletion({
    argv: argv.slice(1),
    createWorkflow,
  })).rejects.toThrow('arguments_invalid');
  expect(createWorkflow).not.toHaveBeenCalled();

  const result = await runHeldOutSemanticStudyRetrievalEvaluationCompletion({ argv, createWorkflow });

  expect(result).toEqual({ status: { id: 'complete' } });
  expect(complete).toHaveBeenCalledWith({
    adjudicationFile: '.tmp/study/adjudication.json',
    paths: {
      bundleFile: '.tmp\\study\\packet.evaluation-bundle.json',
      packetFile: '.tmp/study/packet.json',
      referenceSetFile: '.tmp\\study\\results.reference-set.json',
      representationArtifactFile: '.tmp\\study\\results.representation-artifact.json',
      resultsOutputFile: '.tmp/study/results.json',
      scorerSubmissionFile: '.tmp\\study\\results.scorer-submission.json',
      scoringInputFile: '.tmp\\study\\packet.scoring-input.json',
    },
    reviewerOneFile: '.tmp/study/reviewer-one.json',
    reviewerTwoFile: '.tmp/study/reviewer-two.json',
  });
  expect(JSON.stringify(result)).not.toContain('.tmp');
});
