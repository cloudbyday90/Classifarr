/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import { describe, expect, test } from '@jest/globals';

import {
  validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureContract.mjs';

const FIXTURE_CORPUS_URL = new URL(
  '../../../../scripts/fixtures/policy-candidate-correction-policy-change-review-history-calibration.fixtures.json',
  import.meta.url,
);

describe('policy-change calibration fixture corpus', () => {
  test('keeps the committed synthetic-only corpus valid and complete', async () => {
    const corpus = JSON.parse(await readFile(FIXTURE_CORPUS_URL, 'utf8'));

    expect(validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus(corpus)).toEqual({
      ok: true,
      fixtureCount: 3,
      issues: [],
    });
    expect(corpus.fixtures.map(fixture => fixture.id)).toEqual([
      'awaiting-aggregate-evidence',
      'review-process-follow-up-required',
      'ready-for-offline-protocol',
    ]);
  });
});
