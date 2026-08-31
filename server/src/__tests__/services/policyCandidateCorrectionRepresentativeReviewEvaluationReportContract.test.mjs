/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionRepresentativeReviewEvaluationReportReadModel,
  buildPolicyCandidateCorrectionRepresentativeReviewWilsonInterval,
} from '../../services/policyCandidateCorrectionRepresentativeReviewEvaluationReportContract.mjs';

function item({ ordinal, periodId, scoreMarginBandId, selectionStatusId, stateId = 'supporting' }) {
  return {
    ordinal,
    periodId,
    scoreMarginBandId,
    selectionStatusId,
    evidenceSourceStates: [
      { sourceId: 'item_identity', stateId: 'anchored' },
      { sourceId: 'declared_policy', stateId },
      { sourceId: 'observed_library_profile', stateId: 'contextual' },
      { sourceId: 'similar_item_retrieval', stateId: 'unavailable' },
      { sourceId: 'confirmed_outcomes', stateId: 'supporting' },
    ],
  };
}

function projectionReadModel() {
  return {
    version: 'policy.candidate_correction_representative_review_projection.v1',
    statusId: 'projection_available',
    historicalRecordAccess: false,
    purposeId: 'representative_historical_correction_review',
    projection: {
      createdAt: '2026-08-30T12:00:00.000Z',
      expiresAt: '2026-09-29T12:00:00.000Z',
      itemCount: 4,
      windows: [
        { periodId: 'previous', startAt: '2026-07-01T00:00:00.000Z', endAt: '2026-07-29T00:00:00.000Z' },
        { periodId: 'current', startAt: '2026-07-29T00:00:00.000Z', endAt: '2026-08-26T00:00:00.000Z' },
      ],
      items: [
        item({ ordinal: 1, periodId: 'previous', scoreMarginBandId: '0_to_4', selectionStatusId: 'confirmed_candidate' }),
        item({ ordinal: 2, periodId: 'previous', scoreMarginBandId: '0_to_4', selectionStatusId: 'changed_to_candidate', stateId: 'conflicting' }),
        item({ ordinal: 3, periodId: 'current', scoreMarginBandId: '5_to_14', selectionStatusId: 'confirmed_candidate' }),
        item({ ordinal: 4, periodId: 'current', scoreMarginBandId: '5_to_14', selectionStatusId: 'changed_outside_candidates' }),
      ],
      mediaTitle: 'must not leave the projection source',
    },
  };
}

describe('representative review evaluation report contract', () => {
  test('uses a Wilson interval for a bounded binomial rate', () => {
    const interval = buildPolicyCandidateCorrectionRepresentativeReviewWilsonInterval({
      successfulCount: 1,
      totalCount: 2,
    });

    expect(interval.lowerBound).toBeCloseTo(0.0945, 3);
    expect(interval.upperBound).toBeCloseTo(0.9055, 3);
    expect(buildPolicyCandidateCorrectionRepresentativeReviewWilsonInterval({ successfulCount: 0, totalCount: 0 }))
      .toBeNull();
  });

  test('rebuilds only aggregate period, margin, and evidence-state summaries', () => {
    const result = buildPolicyCandidateCorrectionRepresentativeReviewEvaluationReportReadModel({
      projectionReadModel: projectionReadModel(),
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'report_available',
      historicalRecordAccess: false,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      report: expect.objectContaining({ itemCount: 4 }),
    }));
    expect(result.report.periodSummaries).toEqual(expect.arrayContaining([
      expect.objectContaining({ periodId: 'previous', itemCount: 2, confirmedCandidateCount: 1 }),
      expect.objectContaining({ periodId: 'current', itemCount: 2, confirmedCandidateCount: 1 }),
    ]));
    expect(result.report.marginSummaries).toEqual(expect.arrayContaining([
      expect.objectContaining({ periodId: 'previous', scoreMarginBandId: '0_to_4', itemCount: 2 }),
      expect.objectContaining({ periodId: 'current', scoreMarginBandId: '5_to_14', itemCount: 2 }),
    ]));
    expect(result.report.evidenceStateSummaries).toEqual(expect.arrayContaining([
      expect.objectContaining({ periodId: 'previous', sourceId: 'declared_policy', stateId: 'conflicting', itemCount: 1 }),
    ]));
    expect(JSON.stringify(result)).not.toContain('must not leave the projection source');
    expect(JSON.stringify(result)).not.toContain('ordinal');
  });

  test('preserves unavailable status without creating a report', () => {
    const result = buildPolicyCandidateCorrectionRepresentativeReviewEvaluationReportReadModel({
      projectionReadModel: {
        ...projectionReadModel(),
        statusId: 'projection_not_created',
        projection: null,
      },
    });
    expect(result).toEqual(expect.objectContaining({ statusId: 'projection_not_created', report: null }));
  });

  test('fails closed if the projection source changes a fixed evidence category', () => {
    const invalid = projectionReadModel();
    invalid.projection.items[0].evidenceSourceStates[0].sourceId = 'unexpected';

    expect(() => buildPolicyCandidateCorrectionRepresentativeReviewEvaluationReportReadModel({
      projectionReadModel: invalid,
    })).toThrow('Review projection report source is invalid.');
  });
});
