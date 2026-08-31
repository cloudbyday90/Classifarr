/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import { describe, expect, test } from '@jest/globals';

import {
  validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureContract.mjs';

const FIXTURE_CORPUS_URL = new URL(
  '../../../../scripts/fixtures/policy-candidate-correction-policy-change-review-history-calibration-bands.fixtures.json',
  import.meta.url,
);

describe('policy-change calibration band fixture corpus', () => {
  test('keeps the committed default-band corpus valid and boundary-complete', async () => {
    const corpus = JSON.parse(await readFile(FIXTURE_CORPUS_URL, 'utf8'));

    expect(validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus(corpus)).toEqual({
      ok: true,
      fixtureCount: 9,
      issues: [],
    });
    expect(corpus.fixtures.map(fixture => fixture.id)).toEqual([
      'manual-floor',
      'manual-before-selection',
      'selection-boundary',
      'selection-before-confirmation',
      'confirmation-boundary',
      'confirmation-before-automatic',
      'automatic-boundary',
      'automatic-policy-ceiling',
      'automatic-score-ceiling',
    ]);
  });
});
