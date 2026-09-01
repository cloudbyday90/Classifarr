/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusControlContract.mjs';
import {
  createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureService,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusCaptureService.mjs';

const REVISION = buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision({
  reviewRecordRetentionDays: 30,
});

function acknowledgedControl() {
  return {
    control_key: 'representative_review_corpus',
    configuration_version: 1,
    purpose_id: 'representative_historical_correction_review',
    required_safeguard_ids: ['authorization', 'redaction', 'retention', 'operator_audit'],
    review_record_retention_days: 30,
    configuration_revision: REVISION,
    acknowledged_at: '2026-09-01T00:00:00.000Z',
  };
}

function attribution(overrides = {}) {
  return {
    version: 'policy.candidate_correction_outcome_attribution.v1',
    scoreMarginBandId: '5_to_14',
    selectionStatusId: 'changed_outside_candidates',
    evidenceSourceStates: [
      { sourceId: 'item_identity', stateId: 'anchored' },
      { sourceId: 'declared_policy', stateId: 'supporting' },
      { sourceId: 'observed_library_profile', stateId: 'contextual' },
      { sourceId: 'similar_item_retrieval', stateId: 'supporting' },
      { sourceId: 'confirmed_outcomes', stateId: 'supporting' },
    ],
    ...overrides,
  };
}

function createHarness({ control = acknowledgedControl() } = {}) {
  const persistence = {
    lockControl: jest.fn().mockResolvedValue(control),
    insertCapture: jest.fn().mockResolvedValue({ capture_id: 'a'.repeat(64) }),
    insertAuditEvent: jest.fn().mockResolvedValue({ id: 1 }),
  };
  return {
    persistence,
    service: createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureService({
      randomHex: jest.fn().mockReturnValue('a'.repeat(64)),
      persistence,
    }),
  };
}

describe('representative review-corpus capture service', () => {
  test('records only the strict redacted attribution after an eligible operator answer', async () => {
    const { service, persistence } = createHarness();
    const client = { query: jest.fn() };

    await expect(service.capture({
      client,
      actorId: 9,
      outcomeAttribution: attribution({
        title: 'Deep Water',
        destinationLibraryId: 123,
        ragResponse: 'must not persist',
      }),
      now: '2026-09-01T12:00:00.000Z',
    })).resolves.toEqual({ statusId: 'captured' });

    expect(persistence.insertCapture).toHaveBeenCalledWith({
      client,
      capture: expect.objectContaining({
        captureId: 'a'.repeat(64),
        configurationRevision: REVISION,
        scoreMarginBandId: '5_to_14',
        selectionStatusId: 'changed_outside_candidates',
        actorId: 9,
        capturedAt: '2026-09-01T12:00:00.000Z',
        expiresAt: '2026-10-01T12:00:00.000Z',
        evidenceSourceStates: [
          { source_id: 'item_identity', state_id: 'anchored' },
          { source_id: 'declared_policy', state_id: 'supporting' },
          { source_id: 'observed_library_profile', state_id: 'contextual' },
          { source_id: 'similar_item_retrieval', state_id: 'supporting' },
          { source_id: 'confirmed_outcomes', state_id: 'supporting' },
        ],
      }),
    });
    expect(JSON.stringify(persistence.insertCapture.mock.calls[0][0].capture)).not.toContain('Deep Water');
    expect(JSON.stringify(persistence.insertCapture.mock.calls[0][0].capture)).not.toContain('must not persist');
    expect(persistence.insertAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ actionId: 'capture_recorded', actorId: 9 }),
    }));
  });

  test('does not query controls or persist when the actor audit identity or attribution is invalid', async () => {
    const { service, persistence } = createHarness();

    await expect(service.capture({
      client: { query: jest.fn() },
      actorId: 'operator-name',
      outcomeAttribution: attribution(),
    })).resolves.toEqual({ statusId: 'not_eligible' });
    await expect(service.capture({
      client: { query: jest.fn() },
      actorId: 9,
      outcomeAttribution: { title: 'not an attribution' },
    })).resolves.toEqual({ statusId: 'not_eligible' });

    expect(persistence.lockControl).not.toHaveBeenCalled();
    expect(persistence.insertCapture).not.toHaveBeenCalled();
  });

  test('captures future rows with the safe default before an optional retention choice is acknowledged', async () => {
    const { service, persistence } = createHarness({ control: null });

    await expect(service.capture({
      client: { query: jest.fn() },
      actorId: 9,
      outcomeAttribution: attribution(),
      now: '2026-09-01T12:00:00.000Z',
    })).resolves.toEqual({ statusId: 'captured' });

    expect(persistence.insertCapture).toHaveBeenCalledWith(expect.objectContaining({
      capture: expect.objectContaining({
        configurationRevision: REVISION,
        expiresAt: '2026-10-01T12:00:00.000Z',
      }),
    }));
    expect(persistence.insertAuditEvent).toHaveBeenCalled();
  });
});
