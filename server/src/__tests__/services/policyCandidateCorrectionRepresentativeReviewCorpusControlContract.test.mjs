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
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_STATUS_IDS,
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlReadModel,
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvent,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration,
  validatePolicyCandidateCorrectionRepresentativeReviewCorpusControlAcknowledgementRequest,
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

describe('representative review-corpus control contract', () => {
  test('accepts only the exact acknowledgement shape and fixed safeguard sequence', () => {
    expect(validatePolicyCandidateCorrectionRepresentativeReviewCorpusControlAcknowledgementRequest({
      expected_revision: null,
      acknowledged_safeguard_ids: SAFEGUARDS,
      review_record_retention_days: 30,
    })).toEqual({
      ok: true,
      value: {
        expectedRevision: null,
        acknowledgedSafeguardIds: SAFEGUARDS,
        reviewRecordRetentionDays: 30,
      },
    });

    expect(validatePolicyCandidateCorrectionRepresentativeReviewCorpusControlAcknowledgementRequest({
      expected_revision: null,
      acknowledged_safeguard_ids: [...SAFEGUARDS].reverse(),
      review_record_retention_days: 30,
    }).ok).toBe(false);
    expect(validatePolicyCandidateCorrectionRepresentativeReviewCorpusControlAcknowledgementRequest({
      expected_revision: null,
      acknowledged_safeguard_ids: SAFEGUARDS,
      review_record_retention_days: 30,
      enable_historical_records: true,
    }).ok).toBe(false);
  });

  test('rejects a persisted configuration whose revision or safeguards do not match the server contract', () => {
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration(
      configurationRow(),
    )).toEqual(expect.objectContaining({
      reviewRecordRetentionDays: 30,
      acknowledgedAt: '2026-08-30T12:00:00.000Z',
    }));

    expect(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration({
      ...configurationRow(),
      required_safeguard_ids: ['authorization'],
    })).toBeNull();
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration({
      ...configurationRow(),
      configuration_revision: 'a'.repeat(64),
    })).toBeNull();
  });

  test('projects configuration status without granting historical-record access', () => {
    const required = buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlReadModel();
    expect(required).toEqual(expect.objectContaining({
      statusId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_STATUS_IDS.CONFIGURATION_REQUIRED,
      historicalRecordAccess: false,
      reviewProjectionStatusId: 'redacted_snapshot_available',
    }));

    const acknowledged = buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlReadModel({
      configuration: configurationRow(),
    });
    expect(acknowledged).toEqual(expect.objectContaining({
      statusId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_STATUS_IDS.CONFIGURATION_ACKNOWLEDGED,
      historicalRecordAccess: false,
      configuration: expect.objectContaining({ reviewRecordRetentionDays: 30 }),
    }));
    expect(acknowledged).not.toHaveProperty('historicalRecords');
    expect(acknowledged).not.toHaveProperty('recordIds');

    expect(buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlReadModel({
      configuration: {
        revision: 'a'.repeat(64),
        reviewRecordRetentionDays: 30,
        acknowledgedAt: '2026-08-30T12:00:00.000Z',
      },
    }).statusId).toBe(POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_STATUS_IDS.CONFIGURATION_REQUIRED);
  });

  test('admits only minimal append-only audit event metadata', () => {
    const revision = buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision({
      reviewRecordRetentionDays: 30,
    });
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvent({
      id: 4,
      action_id: 'configuration_acknowledged',
      actor_id: 7,
      previous_configuration_revision: null,
      configuration_revision: revision,
      required_safeguard_ids: SAFEGUARDS,
      review_record_retention_days: 30,
      occurred_at: '2026-08-30T12:00:00.000Z',
    })).toEqual(expect.objectContaining({ eventId: 4, actorId: 7 }));

    expect(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvent({
      id: 4,
      action_id: 'configuration_acknowledged',
      actor_id: 7,
      configuration_revision: revision,
      required_safeguard_ids: SAFEGUARDS,
      review_record_retention_days: 30,
      occurred_at: 'invalid',
    })).toBeNull();
  });
});
