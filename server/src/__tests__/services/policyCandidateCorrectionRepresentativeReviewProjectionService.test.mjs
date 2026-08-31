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
  PolicyCandidateCorrectionRepresentativeReviewProjectionConfigurationRequiredError,
  createPolicyCandidateCorrectionRepresentativeReviewProjectionService,
} from '../../services/policyCandidateCorrectionRepresentativeReviewProjectionService.mjs';
import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusControlContract.mjs';

const SAFEGUARDS = ['authorization', 'redaction', 'retention', 'operator_audit'];
const SNAPSHOT_ID = 'a'.repeat(64);
const REVISION = buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision({
  reviewRecordRetentionDays: 30,
});
const ITEM = {
  ordinal: 1,
  period_id: 'current',
  score_margin_band_id: '5_to_14',
  selection_status_id: 'changed_to_candidate',
  evidence_source_states: [
    { source_id: 'item_identity', state_id: 'anchored' },
    { source_id: 'declared_policy', state_id: 'supporting' },
    { source_id: 'observed_library_profile', state_id: 'contextual' },
    { source_id: 'similar_item_retrieval', state_id: 'unavailable' },
    { source_id: 'confirmed_outcomes', state_id: 'supporting' },
  ],
};

function controlRow() {
  return {
    control_key: 'representative_review_corpus',
    configuration_version: 1,
    purpose_id: 'representative_historical_correction_review',
    required_safeguard_ids: SAFEGUARDS,
    review_record_retention_days: 30,
    configuration_revision: REVISION,
    acknowledged_at: '2026-08-30T12:00:00.000Z',
  };
}

function snapshot({ itemCount = 1 } = {}) {
  return {
    snapshot_id: SNAPSHOT_ID,
    purpose_id: 'representative_historical_correction_review',
    configuration_revision: REVISION,
    previous_window_start_at: '2026-07-01T00:00:00.000Z',
    previous_window_end_at: '2026-07-29T00:00:00.000Z',
    current_window_start_at: '2026-07-29T00:00:00.000Z',
    current_window_end_at: '2026-08-26T00:00:00.000Z',
    sample_per_stratum: 5,
    item_count: itemCount,
    created_at: '2026-08-30T12:00:00.000Z',
    expires_at: '2026-09-29T12:00:00.000Z',
  };
}

function createHarness({ control = controlRow(), activeSnapshot = null } = {}) {
  const persistence = {
    acquireLock: jest.fn().mockResolvedValue(undefined),
    readControl: jest.fn().mockResolvedValue(control),
    lockControl: jest.fn().mockResolvedValue(control),
    findActiveProjection: jest.fn().mockResolvedValue(activeSnapshot),
    listItems: jest.fn().mockResolvedValue([ITEM]),
    insertProjection: jest.fn().mockResolvedValue(snapshot({ itemCount: 0 })),
    insertItems: jest.fn().mockResolvedValue(1),
    setItemCount: jest.fn().mockResolvedValue(snapshot()),
    insertAuditEvent: jest.fn().mockResolvedValue({ id: 1 }),
  };
  const db = { withTransaction: jest.fn(async callback => callback({ query: jest.fn() })) };
  return {
    db,
    persistence,
    service: createPolicyCandidateCorrectionRepresentativeReviewProjectionService({
      db,
      persistence,
      randomHex: () => SNAPSHOT_ID,
    }),
  };
}

describe('representative review projection service', () => {
  test('does not expose a projection before safeguards are acknowledged', async () => {
    const { service, persistence } = createHarness({ control: null });

    await expect(service.getProjection({ actorId: 7 })).resolves.toEqual(expect.objectContaining({
      statusId: 'configuration_required',
      historicalRecordAccess: false,
      projection: null,
    }));
    expect(persistence.findActiveProjection).not.toHaveBeenCalled();
    expect(persistence.insertAuditEvent).not.toHaveBeenCalled();
  });

  test('creates one server-selected redacted snapshot and records only a minimal audit event', async () => {
    const { service, persistence, db } = createHarness();

    const result = await service.createProjection({
      actorId: 7,
      now: '2026-08-30T12:00:00.000Z',
    });

    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(persistence.acquireLock).toHaveBeenCalledTimes(1);
    expect(persistence.insertItems).toHaveBeenCalledWith(expect.objectContaining({
      snapshotId: SNAPSHOT_ID,
      samplePerStratum: 5,
    }));
    expect(persistence.insertAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ actionId: 'projection_created', actorId: 7, itemCount: 1 }),
    }));
    expect(result).toEqual(expect.objectContaining({
      operationId: 'projection_created',
      statusId: 'projection_available',
      historicalRecordAccess: false,
      projection: expect.objectContaining({ itemCount: 1 }),
    }));
    expect(JSON.stringify(result)).not.toContain(SNAPSHOT_ID);
    expect(result).not.toHaveProperty('classificationId');
  });

  test('reuses a current projection instead of creating another and audits the read', async () => {
    const { service, persistence } = createHarness({ activeSnapshot: snapshot() });

    const result = await service.createProjection({ actorId: 7 });

    expect(result.operationId).toBe('existing_projection');
    expect(persistence.insertProjection).not.toHaveBeenCalled();
    expect(persistence.insertAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ actionId: 'projection_viewed', actorId: 7 }),
    }));
  });

  test('requires an acknowledged configuration for a create request', async () => {
    const { service } = createHarness({ control: null });
    await expect(service.createProjection({ actorId: 7 }))
      .rejects.toBeInstanceOf(PolicyCandidateCorrectionRepresentativeReviewProjectionConfigurationRequiredError);
  });
});
