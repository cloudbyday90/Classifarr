/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest'
import {
  normalizePolicyCandidateCorrectionRepresentativeReviewProjection,
  presentPolicyCandidateCorrectionRepresentativeReviewProjectionItem,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewProjectionPresentation'

function response(overrides = {}) {
  return {
    version: 'policy.candidate_correction_representative_review_projection.v1',
    statusId: 'projection_available',
    historicalRecordAccess: false,
    purposeId: 'representative_historical_correction_review',
    projection: {
      createdAt: '2026-08-30T12:00:00.000Z',
      expiresAt: '2026-09-29T12:00:00.000Z',
      samplePerStratum: 5,
      itemCount: 1,
      windows: [
        { periodId: 'previous', startAt: '2026-07-01T00:00:00.000Z', endAt: '2026-07-29T00:00:00.000Z' },
        { periodId: 'current', startAt: '2026-07-29T00:00:00.000Z', endAt: '2026-08-26T00:00:00.000Z' },
      ],
      items: [{
        ordinal: 1,
        periodId: 'current',
        scoreMarginBandId: '5_to_14',
        selectionStatusId: 'changed_to_candidate',
        evidenceSourceStates: [
          { sourceId: 'item_identity', stateId: 'anchored' },
          { sourceId: 'declared_policy', stateId: 'supporting' },
          { sourceId: 'observed_library_profile', stateId: 'contextual' },
          { sourceId: 'similar_item_retrieval', stateId: 'unavailable' },
          { sourceId: 'confirmed_outcomes', stateId: 'supporting' },
        ],
      }],
    },
    ...overrides,
  }
}

describe('representative review projection presentation', () => {
  it('retains only the fixed redacted view model and presents static labels', () => {
    const normalized = normalizePolicyCandidateCorrectionRepresentativeReviewProjection(response({
      projection: {
        ...response().projection,
        mediaTitle: 'Must not render',
        items: [{ ...response().projection.items[0], libraryName: 'Must not render' }],
      },
    }))

    expect(normalized).toEqual(expect.objectContaining({ statusId: 'projection_available' }))
    expect(JSON.stringify(normalized)).not.toContain('Must not render')
    expect(presentPolicyCandidateCorrectionRepresentativeReviewProjectionItem(normalized.projection.items[0]))
      .toEqual(expect.objectContaining({
        periodLabel: 'Current 28 days',
        marginLabel: '5–14 points',
        selectionLabel: 'Changed to another candidate',
      }))
  })

  it('fails closed if the response grants source-record access or changes a fixed evidence source', () => {
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewProjection(response({
      historicalRecordAccess: true,
    }))).toBeNull()
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewProjection(response({
      projection: {
        ...response().projection,
        items: [{
          ...response().projection.items[0],
          evidenceSourceStates: [{ sourceId: 'unknown', stateId: 'anchored' }],
        }],
      },
    }))).toBeNull()
  })
})
