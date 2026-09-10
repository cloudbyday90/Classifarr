/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';

import {
  runHeldOutSemanticStudyReviewerResults,
} from '../../scripts/runHeldOutSemanticStudyReviewerResults.mjs';

const validArguments = [
  '--bundle-file', '.tmp/evaluation-bundle.json',
  '--reference-set-file', '.tmp/reference-set.json',
  '--output-file', '.tmp/results.json',
];

const availableResult = {
  report: { retained: 'only in the private output file' },
  status: { id: 'summary_available' },
};

test('writes an available aggregate report and omits its contents from the receipt', async () => {
  const readJson = jest.fn(async () => ({}));
  const writeJson = jest.fn(async () => undefined);

  const result = await runHeldOutSemanticStudyReviewerResults({
    argv: validArguments,
    buildResults: jest.fn(() => availableResult),
    readJson,
    writeJson,
  });

  expect(result).toEqual({
    resultsWritten: true,
    status: { id: 'summary_available' },
    version: 'policy.held_out_semantic_study_reviewer_results_workflow.v1',
  });
  expect(JSON.stringify(result)).not.toContain('only in the private output file');
  expect(readJson).toHaveBeenCalledTimes(2);
  expect(writeJson).toHaveBeenCalledWith('.tmp/results.json', availableResult, {
    label: 'Aggregate semantic-study results',
  });
});

test('does not write a report when independent labels are unavailable', async () => {
  const writeJson = jest.fn();
  const result = await runHeldOutSemanticStudyReviewerResults({
    argv: validArguments,
    buildResults: jest.fn(() => ({
      report: null,
      status: { id: 'independent_reference_set_required' },
    })),
    readJson: jest.fn(async () => ({})),
    writeJson,
  });

  expect(result.resultsWritten).toBe(false);
  expect(writeJson).not.toHaveBeenCalled();
});

test('rejects malformed arguments before reading a local artifact', async () => {
  const readJson = jest.fn();

  await expect(runHeldOutSemanticStudyReviewerResults({
    argv: ['--bundle-file', '.tmp/evaluation-bundle.json'],
    readJson,
  })).rejects.toThrow('arguments_invalid');
  expect(readJson).not.toHaveBeenCalled();
});
