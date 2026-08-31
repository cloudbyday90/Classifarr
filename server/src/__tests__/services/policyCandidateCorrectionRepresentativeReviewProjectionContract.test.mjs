/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyCandidateCorrectionRepresentativeReviewProjectionReadModel,
  normalizePolicyCandidateCorrectionRepresentativeReviewProjection,
} from '../../services/policyCandidateCorrectionRepresentativeReviewProjectionContract.mjs';

const SNAPSHOT_ID = 'a'.repeat(64);
const REVISION = 'b'.repeat(64);
const EVIDENCE_SOURCE_STATES = [
  { source_id: 'item_identity', state_id: 'anchored' },
  { source_id: 'declared_policy', state_id: 'supporting' },
  { source_id: 'observed_library_profile', state_id: 'contextual' },
  { source_id: 'similar_item_retrieval', state_id: 'unavailable' },
  { source_id: 'confirmed_outcomes', state_id: 'supporting' },
];

function snapshot(overrides = {}) {
  return {
    snapshot_id: SNAPSHOT_ID,
    purpose_id: 'representative_historical_correction_review',
    configuration_revision: REVISION,
    previous_window_start_at: '2026-07-01T00:00:00.000Z',
    previous_window_end_at: '2026-07-29T00:00:00.000Z',
    current_window_start_at: '2026-07-29T00:00:00.000Z',
    current_window_end_at: '2026-08-26T00:00:00.000Z',
    sample_per_stratum: 5,
    item_count: 1,
    created_at: '2026-08-30T12:00:00.000Z',
    expires_at: '2026-09-29T12:00:00.000Z',
    ...overrides,
  };
}

function item(overrides = {}) {
  return {
    ordinal: 1,
    period_id: 'current',
    score_margin_band_id: '5_to_14',
    selection_status_id: 'changed_to_candidate',
    evidence_source_states: EVIDENCE_SOURCE_STATES,
    ...overrides,
  };
}

describe('representative review projection contract', () => {
  test('retains only the fixed redacted row fields', () => {
    const projection = normalizePolicyCandidateCorrectionRepresentativeReviewProjection({
      snapshot: snapshot({ title: 'Must not reach the projection' }),
      items: [item({ library_name: 'Must not reach the projection' })],
    });

    expect(projection).toEqual(expect.objectContaining({ itemCount: 1, samplePerStratum: 5 }));
    expect(JSON.stringify(projection)).not.toContain('Must not reach the projection');
    expect(projection.items[0]).toEqual({
      ordinal: 1,
      periodId: 'current',
      scoreMarginBandId: '5_to_14',
      selectionStatusId: 'changed_to_candidate',
      evidenceSourceStates: expect.any(Array),
    });
  });

  test('fails closed for an invalid evidence source, window, or ordinal sequence', () => {
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewProjection({
      snapshot: snapshot(),
      items: [item({ evidence_source_states: [{ source_id: 'unknown', state_id: 'anchored' }] })],
    })).toBeNull();
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewProjection({
      snapshot: snapshot({ current_window_start_at: '2026-07-30T00:00:00.000Z' }),
      items: [item()],
    })).toBeNull();
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewProjection({
      snapshot: snapshot(),
      items: [item({ ordinal: 2 })],
    })).toBeNull();
  });

  test('distinguishes missing acknowledgement from a configured empty projection', () => {
    expect(buildPolicyCandidateCorrectionRepresentativeReviewProjectionReadModel()).toEqual(expect.objectContaining({
      statusId: 'configuration_required',
      historicalRecordAccess: false,
      projection: null,
    }));
    expect(buildPolicyCandidateCorrectionRepresentativeReviewProjectionReadModel({
      configuration: { revision: REVISION },
    })).toEqual(expect.objectContaining({
      statusId: 'projection_not_created',
      historicalRecordAccess: false,
      projection: null,
    }));
  });
});
