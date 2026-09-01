/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusControlContract.mjs';
import {
  getPolicyCandidateCorrectionRepresentativeReviewCorpusAutomaticCaptureConfiguration,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusAutomaticCaptureConfiguration.mjs';

function acknowledgedControl(retentionDays = 45) {
  return {
    control_key: 'representative_review_corpus',
    configuration_version: 1,
    purpose_id: 'representative_historical_correction_review',
    required_safeguard_ids: ['authorization', 'redaction', 'retention', 'operator_audit'],
    review_record_retention_days: retentionDays,
    configuration_revision: buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision({
      reviewRecordRetentionDays: retentionDays,
    }),
    acknowledged_at: '2026-09-01T00:00:00.000Z',
  };
}

describe('automatic reviewed-corpus capture configuration', () => {
  test('uses a deterministic 30-day safe default without acknowledgement', () => {
    expect(getPolicyCandidateCorrectionRepresentativeReviewCorpusAutomaticCaptureConfiguration())
      .toEqual({
        revision: buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision({
          reviewRecordRetentionDays: 30,
        }),
        reviewRecordRetentionDays: 30,
        sourceId: 'safe_default',
      });
  });

  test('uses only a fully valid optional retention choice', () => {
    expect(getPolicyCandidateCorrectionRepresentativeReviewCorpusAutomaticCaptureConfiguration(
      acknowledgedControl(),
    )).toEqual(expect.objectContaining({
      reviewRecordRetentionDays: 45,
      sourceId: 'acknowledged_retention_choice',
    }));
    expect(getPolicyCandidateCorrectionRepresentativeReviewCorpusAutomaticCaptureConfiguration({
      review_record_retention_days: 1,
    })).toEqual(expect.objectContaining({
      reviewRecordRetentionDays: 30,
      sourceId: 'safe_default',
    }));
  });
});
