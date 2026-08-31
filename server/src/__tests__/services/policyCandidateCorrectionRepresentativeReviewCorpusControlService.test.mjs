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
  PolicyCandidateCorrectionRepresentativeReviewCorpusControlConflictError,
  createPolicyCandidateCorrectionRepresentativeReviewCorpusControlService,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusControlService.mjs';
import { jest } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusControlContract.mjs';

const SAFEGUARDS = ['authorization', 'redaction', 'retention', 'operator_audit'];

function configurationRow({ retentionDays = 30 } = {}) {
  return {
    control_key: 'representative_review_corpus',
    configuration_version: 1,
    purpose_id: 'representative_historical_correction_review',
    required_safeguard_ids: SAFEGUARDS,
    review_record_retention_days: retentionDays,
    configuration_revision: buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision({
      reviewRecordRetentionDays: retentionDays,
    }),
    acknowledged_at: '2026-08-30T12:00:00.000Z',
  };
}

function createHarness({ stored = null } = {}) {
  const persistence = {
    acquireLock: jest.fn().mockResolvedValue(undefined),
    lockControl: jest.fn().mockResolvedValue(stored),
    readControl: jest.fn().mockResolvedValue(stored),
    upsertControl: jest.fn().mockImplementation(async ({ configuration }) => ({
      ...configurationRow({ retentionDays: configuration.reviewRecordRetentionDays }),
      acknowledged_at: configuration.acknowledgedAt,
    })),
    insertAuditEvent: jest.fn().mockResolvedValue({ id: 1 }),
    listAuditEvents: jest.fn().mockResolvedValue([]),
  };
  const db = {
    query: jest.fn(),
    withTransaction: jest.fn(async callback => callback({ query: jest.fn() })),
  };

  return {
    persistence,
    db,
    service: createPolicyCandidateCorrectionRepresentativeReviewCorpusControlService({ db, persistence }),
  };
}

function acknowledgement({ expectedRevision = null, retentionDays = 30 } = {}) {
  return {
    expected_revision: expectedRevision,
    acknowledged_safeguard_ids: SAFEGUARDS,
    review_record_retention_days: retentionDays,
  };
}

describe('representative review-corpus control service', () => {
  test('reports an unconfigured control without historical-record access', async () => {
    const { service } = createHarness();

    await expect(service.getConfiguration()).resolves.toEqual(expect.objectContaining({
      statusId: 'configuration_required',
      historicalRecordAccess: false,
      configuration: null,
    }));
  });

  test('acknowledges an exact administrator request transactionally and writes a minimal audit event', async () => {
    const { service, persistence, db } = createHarness();

    const result = await service.acknowledgeConfiguration({
      actorId: 7,
      request: acknowledgement({ retentionDays: 45 }),
      now: '2026-08-30T13:00:00.000Z',
    });

    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(persistence.acquireLock).toHaveBeenCalledTimes(1);
    expect(persistence.upsertControl).toHaveBeenCalledWith(expect.objectContaining({
      configuration: expect.objectContaining({
        actorId: 7,
        reviewRecordRetentionDays: 45,
      }),
    }));
    expect(persistence.insertAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({
        actorId: 7,
        reviewRecordRetentionDays: 45,
        previousConfigurationRevision: null,
      }),
    }));
    expect(result).toEqual(expect.objectContaining({
      operationId: 'configuration_acknowledged',
      statusId: 'configuration_acknowledged',
      historicalRecordAccess: false,
    }));
  });

  test('rejects a stale write before changing the control or audit trail', async () => {
    const stored = configurationRow();
    const { service, persistence } = createHarness({ stored });

    await expect(service.acknowledgeConfiguration({
      actorId: 7,
      request: acknowledgement({ expectedRevision: 'b'.repeat(64) }),
    })).rejects.toBeInstanceOf(PolicyCandidateCorrectionRepresentativeReviewCorpusControlConflictError);

    expect(persistence.upsertControl).not.toHaveBeenCalled();
    expect(persistence.insertAuditEvent).not.toHaveBeenCalled();
  });

  test('does not duplicate audit events for an unchanged acknowledged configuration', async () => {
    const stored = configurationRow();
    const { service, persistence } = createHarness({ stored });

    const result = await service.acknowledgeConfiguration({
      actorId: 7,
      request: acknowledgement({ expectedRevision: stored.configuration_revision }),
    });

    expect(result.operationId).toBe('unchanged');
    expect(persistence.upsertControl).not.toHaveBeenCalled();
    expect(persistence.insertAuditEvent).not.toHaveBeenCalled();
  });
});
