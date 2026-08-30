/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusReadiness,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusReadiness.mjs';

describe('policyCandidateCorrectionRepresentativeReviewCorpusReadiness', () => {
  test('requires a corpus design without selecting or exposing historical records', () => {
    const readiness = buildPolicyCandidateCorrectionRepresentativeReviewCorpusReadiness({
      trendStatusId: 'sustained_review_signal',
    });

    expect(readiness).toEqual({
      version: 'policy.candidate_correction_representative_review_corpus.v1',
      statusId: 'historical_corpus_design_required',
      historicalRecordAccess: false,
      reviewFrame: {
        periodCount: 2,
        completedUtcDaysPerPeriod: 28,
        strata: ['score_margin_band', 'operator_selection_outcome'],
      },
      requiredSafeguardIds: ['authorization', 'redaction', 'retention', 'operator_audit'],
    });
    expect(Object.isFrozen(readiness)).toBe(true);
    expect(Object.isFrozen(readiness.reviewFrame)).toBe(true);
    expect(readiness).not.toHaveProperty('historicalRecords');
    expect(readiness).not.toHaveProperty('recordIds');
    expect(readiness).not.toHaveProperty('mediaIds');
    expect(readiness).not.toHaveProperty('destinations');
  });

  test.each([
    'needs_representative_periods',
    'cohort_comparison_needs_observations',
    'cohort_mix_shift_detected',
    'sustained_low_signal',
    'mixed_signal',
  ])('does not propose a historical corpus for %s', (trendStatusId) => {
    expect(buildPolicyCandidateCorrectionRepresentativeReviewCorpusReadiness({
      trendStatusId,
    })).toMatchObject({
      statusId: 'review_not_indicated',
      historicalRecordAccess: false,
      reviewFrame: null,
      requiredSafeguardIds: [],
    });
  });

  test('rejects an unknown trend state', () => {
    expect(() => buildPolicyCandidateCorrectionRepresentativeReviewCorpusReadiness({
      trendStatusId: 'untrusted_input',
    })).toThrow('A valid long-horizon trend status is required.');
  });
});
