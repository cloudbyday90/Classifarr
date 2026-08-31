/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import { describe, expect, test } from '@jest/globals';

import {
  validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureContract.mjs';

const FIXTURE_CORPUS_URL = new URL(
  '../../../../scripts/fixtures/policy-candidate-correction-policy-change-review-history-calibration-route-safety.fixtures.json',
  import.meta.url,
);

describe('policy-change calibration route-safety fixture corpus', () => {
  test('keeps the committed route-safety corpus valid and gate-complete', async () => {
    const corpus = JSON.parse(await readFile(FIXTURE_CORPUS_URL, 'utf8'));

    expect(validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus(corpus)).toEqual({
      ok: true,
      fixtureCount: 10,
      issues: [],
    });
    expect(corpus.fixtures.map(fixture => fixture.id)).toEqual([
      'baseline-current-policy-auto',
      'provider-recovery-blocks-high-score',
      'weak-evidence-blocks-high-score',
      'ai-advisory-blocks-high-score',
      'mismatched-provenance-blocks-high-score',
      'installation-confirmation-blocks-high-score',
      'fallback-blocks-high-score',
      'low-confidence-blocks-high-policy-score',
      'clarification-blocks-high-score',
      'provider-precedes-ai-and-installation-confirmation',
    ]);
  });
});
