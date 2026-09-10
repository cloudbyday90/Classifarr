/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';

import {
  runHeldOutSemanticStudyRetrievalRepresentationArtifacts,
} from '../../scripts/runHeldOutSemanticStudyRetrievalRepresentationArtifacts.mjs';

const validArguments = [
  '--bundle-file', '.tmp/evaluation-bundle.json',
  '--submission-file', '.tmp/evaluator-submission.json',
  '--output-file', '.tmp/representation-artifacts.json',
];

test('writes only a ready paired artifact set and keeps the artifact out of the receipt', async () => {
  const writeJson = jest.fn(async () => undefined);
  const artifactSet = { private: 'only in the protected artifact output' };

  const result = await runHeldOutSemanticStudyRetrievalRepresentationArtifacts({
    argv: validArguments,
    buildArtifacts: jest.fn(() => ({
      artifactSet,
      status: { id: 'artifact_set_ready' },
    })),
    readJson: jest.fn(async () => ({})),
    writeJson,
  });

  expect(result).toEqual({
    artifactsWritten: true,
    status: { id: 'artifact_set_ready' },
    version: 'policy.held_out_semantic_study_retrieval_representation_artifacts_workflow.v1',
  });
  expect(JSON.stringify(result)).not.toContain('protected artifact output');
  expect(writeJson).toHaveBeenCalledWith('.tmp/representation-artifacts.json', artifactSet, {
    label: 'Paired retrieval-representation study artifacts',
  });
});

test('does not write when the submission fails fixed-source validation', async () => {
  const writeJson = jest.fn();
  const result = await runHeldOutSemanticStudyRetrievalRepresentationArtifacts({
    argv: validArguments,
    buildArtifacts: jest.fn(() => ({
      artifactSet: null,
      status: { id: 'submission_invalid' },
    })),
    readJson: jest.fn(async () => ({})),
    writeJson,
  });

  expect(result.artifactsWritten).toBe(false);
  expect(writeJson).not.toHaveBeenCalled();
});

test('rejects malformed arguments before opening a private study artifact', async () => {
  const readJson = jest.fn();

  await expect(runHeldOutSemanticStudyRetrievalRepresentationArtifacts({
    argv: ['--bundle-file', '.tmp/evaluation-bundle.json'],
    readJson,
  })).rejects.toThrow('arguments_invalid');
  expect(readJson).not.toHaveBeenCalled();
});
