/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';

import {
  runHeldOutSemanticStudyRetrievalRepresentationScorer,
} from '../../scripts/runHeldOutSemanticStudyRetrievalRepresentationScorer.mjs';

test('writes only a categorical submission and returns a content-free receipt', async () => {
  const close = jest.fn();
  const submission = Object.freeze({ signals: [{ fixtureId: 'fixture_0000000000000000' }] });
  const scorer = {
    score: jest.fn(async () => ({
      authority: { source: 'private' },
      status: { id: 'submission_ready' },
      submission,
    })),
  };
  const readJson = jest.fn(async (file) => ({ file, privateTitle: 'not-in-receipt' }));
  const writeJson = jest.fn(async () => undefined);
  const loadRuntime = jest.fn(async () => ({ close, scorer }));
  const argv = [
    '--bundle-file', '.tmp/reviewers/packet.evaluation-bundle.json',
    '--scoring-input-file', '.tmp/reviewers/packet.scoring-input.json',
    '--output-file', '.tmp/reviewers/packet.submission.json',
  ];

  const receipt = await runHeldOutSemanticStudyRetrievalRepresentationScorer({
    argv,
    loadRuntime,
    readJson,
    writeJson,
  });

  expect(receipt).toEqual({
    status: { id: 'submission_ready' },
    submissionWritten: true,
    version: 'policy.held_out_semantic_study_retrieval_representation_scorer_workflow.v1',
  });
  expect(writeJson).toHaveBeenCalledWith('.tmp/reviewers/packet.submission.json', submission,
    expect.objectContaining({ label: expect.any(String) }));
  expect(JSON.stringify(receipt)).not.toContain('not-in-receipt');
  expect(close).toHaveBeenCalledTimes(1);
});

test('does not write when the private evaluator is unavailable', async () => {
  const writeJson = jest.fn();
  await expect(runHeldOutSemanticStudyRetrievalRepresentationScorer({
    argv: [
      '--bundle-file', '.tmp/reviewers/packet.evaluation-bundle.json',
      '--scoring-input-file', '.tmp/reviewers/packet.scoring-input.json',
      '--output-file', '.tmp/reviewers/packet.submission.json',
    ],
    loadRuntime: async () => ({
      close: jest.fn(),
      scorer: { score: async () => ({ status: { id: 'evaluator_unavailable' }, submission: null }) },
    }),
    readJson: async () => ({}),
    writeJson,
  })).resolves.toMatchObject({ submissionWritten: false, status: { id: 'evaluator_unavailable' } });
  expect(writeJson).not.toHaveBeenCalled();
});
