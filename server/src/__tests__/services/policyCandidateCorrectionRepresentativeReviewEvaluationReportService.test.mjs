/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  PolicyCandidateCorrectionRepresentativeReviewEvaluationReportValidationError,
  createPolicyCandidateCorrectionRepresentativeReviewEvaluationReportService,
} from '../../services/policyCandidateCorrectionRepresentativeReviewEvaluationReportService.mjs';

function projectionReadModel() {
  return {
    version: 'policy.candidate_correction_representative_review_projection.v1',
    statusId: 'projection_available',
    historicalRecordAccess: false,
    purposeId: 'representative_historical_correction_review',
    projection: {
      createdAt: '2026-08-30T12:00:00.000Z',
      expiresAt: '2026-09-29T12:00:00.000Z',
      itemCount: 1,
      windows: [
        { periodId: 'previous', startAt: '2026-07-01T00:00:00.000Z', endAt: '2026-07-29T00:00:00.000Z' },
        { periodId: 'current', startAt: '2026-07-29T00:00:00.000Z', endAt: '2026-08-26T00:00:00.000Z' },
      ],
      items: [{
        ordinal: 1,
        periodId: 'current',
        scoreMarginBandId: '5_to_14',
        selectionStatusId: 'confirmed_candidate',
        evidenceSourceStates: [
          { sourceId: 'item_identity', stateId: 'anchored' },
          { sourceId: 'declared_policy', stateId: 'supporting' },
          { sourceId: 'observed_library_profile', stateId: 'contextual' },
          { sourceId: 'similar_item_retrieval', stateId: 'unavailable' },
          { sourceId: 'confirmed_outcomes', stateId: 'supporting' },
        ],
      }],
    },
  };
}

describe('representative review evaluation report service', () => {
  test('uses only the projection service read boundary and returns aggregates', async () => {
    const projectionService = { getProjection: jest.fn().mockResolvedValue(projectionReadModel()) };
    const service = createPolicyCandidateCorrectionRepresentativeReviewEvaluationReportService({ projectionService });

    await expect(service.getEvaluationReport({ actorId: 7 })).resolves.toEqual(expect.objectContaining({
      statusId: 'report_available',
      report: expect.objectContaining({ itemCount: 1 }),
    }));
    expect(projectionService.getProjection).toHaveBeenCalledWith({
      actorId: 7,
      auditProjectionView: false,
    });
  });

  test('rejects invalid actors and invalid projection sources before returning a report', async () => {
    const service = createPolicyCandidateCorrectionRepresentativeReviewEvaluationReportService({
      projectionService: { getProjection: jest.fn().mockResolvedValue({}) },
    });

    await expect(service.getEvaluationReport({ actorId: 0 }))
      .rejects.toBeInstanceOf(PolicyCandidateCorrectionRepresentativeReviewEvaluationReportValidationError);
    await expect(service.getEvaluationReport({ actorId: 7 }))
      .rejects.toBeInstanceOf(PolicyCandidateCorrectionRepresentativeReviewEvaluationReportValidationError);
  });
});
