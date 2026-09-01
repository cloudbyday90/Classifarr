/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusControlContract.mjs';
import {
  PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationValidationError,
  createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationService,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationService.mjs';

function controlRow() {
  const reviewRecordRetentionDays = 30;
  return {
    control_key: 'representative_review_corpus',
    configuration_version: 1,
    purpose_id: 'representative_historical_correction_review',
    required_safeguard_ids: JSON.stringify(['authorization', 'redaction', 'retention', 'operator_audit']),
    review_record_retention_days: reviewRecordRetentionDays,
    configuration_revision: buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision({
      reviewRecordRetentionDays,
    }),
    acknowledged_at: '2026-09-01T00:00:00.000Z',
  };
}

function createService({ row = controlRow(), aggregateRows = [] } = {}) {
  const client = {};
  const db = { withTransaction: async work => work(client) };
  const persistence = {
    readControl: jest.fn().mockResolvedValue(row),
    listAggregates: jest.fn().mockResolvedValue(aggregateRows),
  };
  return {
    persistence,
    service: createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationService({ db, persistence }),
  };
}

describe('representative review-corpus capture evaluation service', () => {
  test('passes only the current control revision to the aggregate query', async () => {
    const { service, persistence } = createService({
      aggregateRows: [{
        score_margin_band_id: '0_to_4',
        selection_status_id: 'confirmed_candidate',
        capture_count: 1,
      }],
    });

    await expect(service.getEvaluation({
      actorId: 7,
      now: new Date('2026-09-01T12:00:00.000Z'),
    })).resolves.toEqual(expect.objectContaining({
      statusId: 'collecting',
      report: expect.objectContaining({ capturedOutcomeCount: 1 }),
    }));
    expect(persistence.listAggregates).toHaveBeenCalledWith(expect.objectContaining({
      configurationRevision: controlRow().configuration_revision,
      now: '2026-09-01T12:00:00.000Z',
    }));
  });

  test('reads the safe default captures before an optional retention choice is acknowledged', async () => {
    const { service, persistence } = createService({ row: null });

    await expect(service.getEvaluation({ actorId: 7 })).resolves.toEqual(expect.objectContaining({
      statusId: 'collecting',
      report: expect.objectContaining({ capturedOutcomeCount: 0 }),
    }));
    expect(persistence.listAggregates).toHaveBeenCalledWith(expect.objectContaining({
      configurationRevision: controlRow().configuration_revision,
    }));
  });

  test('rejects invalid actors and invalid aggregate data', async () => {
    const invalidActor = createService().service;
    await expect(invalidActor.getEvaluation({ actorId: 0 }))
      .rejects.toBeInstanceOf(PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationValidationError);

    const invalidAggregate = createService({
      aggregateRows: [{ score_margin_band_id: 'unknown', selection_status_id: 'confirmed_candidate', capture_count: 1 }],
    }).service;
    await expect(invalidAggregate.getEvaluation({ actorId: 7 }))
      .rejects.toBeInstanceOf(PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationValidationError);
  });
});
