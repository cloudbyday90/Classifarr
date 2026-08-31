/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';
import { stableStringify } from './policyEvidenceFingerprint.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_FRAME,
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_REQUIRED_SAFEGUARD_IDS,
} from './policyCandidateCorrectionRepresentativeReviewCorpusVocabulary.mjs';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_VERSION =
  'policy.candidate_correction_representative_review_corpus_control.v1';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_STATUS_IDS =
  Object.freeze({
    CONFIGURATION_REQUIRED: 'configuration_required',
    CONFIGURATION_ACKNOWLEDGED: 'configuration_acknowledged',
  });

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_AUDIT_ACTION_IDS =
  Object.freeze({
    CONFIGURATION_ACKNOWLEDGED: 'configuration_acknowledged',
  });

export const DEFAULT_POLICY_CANDIDATE_CORRECTION_REVIEW_RECORD_RETENTION_DAYS = 30;
export const MIN_POLICY_CANDIDATE_CORRECTION_REVIEW_RECORD_RETENTION_DAYS = 7;
export const MAX_POLICY_CANDIDATE_CORRECTION_REVIEW_RECORD_RETENTION_DAYS = 90;

const CONTROL_CONFIGURATION_VERSION = 1;
const CONTROL_KEY = 'representative_review_corpus';
const REVISION_PATTERN = /^[a-f0-9]{64}$/u;

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeRetentionDays(value) {
  const numeric = normalizePositiveInteger(value);
  return numeric !== null &&
    numeric >= MIN_POLICY_CANDIDATE_CORRECTION_REVIEW_RECORD_RETENTION_DAYS &&
    numeric <= MAX_POLICY_CANDIDATE_CORRECTION_REVIEW_RECORD_RETENTION_DAYS
    ? numeric
    : null;
}

function normalizeRevision(value) {
  return typeof value === 'string' && REVISION_PATTERN.test(value) ? value : null;
}

function normalizeTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeSafeguardIds(value) {
  return Array.isArray(value) &&
    value.length === POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_REQUIRED_SAFEGUARD_IDS.length &&
    value.every((safeguardId, index) => safeguardId ===
      POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_REQUIRED_SAFEGUARD_IDS[index])
    ? [...POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_REQUIRED_SAFEGUARD_IDS]
    : null;
}

function normalizeStoredSafeguards(value) {
  if (typeof value === 'string') {
    try {
      return normalizeSafeguardIds(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return normalizeSafeguardIds(value);
}

export function buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision({
  reviewRecordRetentionDays,
} = {}) {
  const normalizedRetentionDays = normalizeRetentionDays(reviewRecordRetentionDays);
  if (normalizedRetentionDays === null) return null;

  return createHash('sha256')
    .update(stableStringify({
      controlConfigurationVersion: CONTROL_CONFIGURATION_VERSION,
      purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
      requiredSafeguardIds: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_REQUIRED_SAFEGUARD_IDS,
      reviewRecordRetentionDays: normalizedRetentionDays,
    }), 'utf8')
    .digest('hex');
}

export function validatePolicyCandidateCorrectionRepresentativeReviewCorpusControlAcknowledgementRequest(value) {
  const source = asPlainObject(value);
  const expectedKeys = [
    'expected_revision',
    'acknowledged_safeguard_ids',
    'review_record_retention_days',
  ];
  const expectedRevision = source.expected_revision === null
    ? null
    : normalizeRevision(source.expected_revision);
  const acknowledgedSafeguardIds = normalizeSafeguardIds(source.acknowledged_safeguard_ids);
  const reviewRecordRetentionDays = normalizeRetentionDays(source.review_record_retention_days);
  const valid = Object.keys(source).length === expectedKeys.length &&
    expectedKeys.every(key => Object.hasOwn(source, key)) &&
    (source.expected_revision === null || expectedRevision !== null) &&
    acknowledgedSafeguardIds !== null &&
    reviewRecordRetentionDays !== null;

  return {
    ok: valid,
    value: valid
      ? { expectedRevision, acknowledgedSafeguardIds, reviewRecordRetentionDays }
      : null,
  };
}

export function normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration(row) {
  const source = asPlainObject(row);
  const controlKey = source.control_key;
  const configurationVersion = Number(source.configuration_version);
  const purposeId = source.purpose_id;
  const requiredSafeguardIds = normalizeStoredSafeguards(source.required_safeguard_ids);
  const reviewRecordRetentionDays = normalizeRetentionDays(source.review_record_retention_days);
  const revision = normalizeRevision(source.configuration_revision);
  const acknowledgedAt = normalizeTimestamp(source.acknowledged_at);

  if (controlKey !== CONTROL_KEY || configurationVersion !== CONTROL_CONFIGURATION_VERSION ||
      purposeId !== POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID ||
      requiredSafeguardIds === null || reviewRecordRetentionDays === null ||
      revision === null || acknowledgedAt === null ||
      revision !== buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision({
        reviewRecordRetentionDays,
      })) {
    return null;
  }

  return Object.freeze({
    revision,
    reviewRecordRetentionDays,
    acknowledgedAt,
  });
}

function normalizeInMemoryPolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration(value) {
  const source = asPlainObject(value);
  const reviewRecordRetentionDays = normalizeRetentionDays(source.reviewRecordRetentionDays);
  const revision = normalizeRevision(source.revision);
  const acknowledgedAt = normalizeTimestamp(source.acknowledgedAt);

  if (reviewRecordRetentionDays === null || revision === null || acknowledgedAt === null ||
      revision !== buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision({
        reviewRecordRetentionDays,
      })) {
    return null;
  }

  return Object.freeze({ revision, reviewRecordRetentionDays, acknowledgedAt });
}

export function buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlReadModel({
  configuration = null,
} = {}) {
  const normalizedConfiguration = configuration === null
    ? null
    : normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration(configuration)
      || normalizeInMemoryPolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration(configuration);
  const acknowledged = normalizedConfiguration !== null;

  return Object.freeze({
    version: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_VERSION,
    statusId: acknowledged
      ? POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_STATUS_IDS.CONFIGURATION_ACKNOWLEDGED
      : POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_STATUS_IDS.CONFIGURATION_REQUIRED,
    historicalRecordAccess: false,
    purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
    reviewFrame: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_FRAME,
    requiredSafeguardIds: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_REQUIRED_SAFEGUARD_IDS,
    reviewProjectionStatusId: 'redacted_snapshot_available',
    auditTrail: Object.freeze({ appendOnly: true, recentEventsAvailable: true }),
    configuration: acknowledged
      ? Object.freeze({
        revision: normalizedConfiguration.revision,
        reviewRecordRetentionDays: normalizedConfiguration.reviewRecordRetentionDays,
        acknowledgedAt: normalizedConfiguration.acknowledgedAt,
      })
      : null,
  });
}

export function normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvent(row) {
  const source = asPlainObject(row);
  const eventId = normalizePositiveInteger(source.id);
  const actorId = normalizePositiveInteger(source.actor_id);
  const actionId = source.action_id;
  const configurationRevision = normalizeRevision(source.configuration_revision);
  const previousConfigurationRevision = source.previous_configuration_revision === null
    ? null
    : normalizeRevision(source.previous_configuration_revision);
  const reviewRecordRetentionDays = normalizeRetentionDays(source.review_record_retention_days);
  const requiredSafeguardIds = normalizeStoredSafeguards(source.required_safeguard_ids);
  const occurredAt = normalizeTimestamp(source.occurred_at);

  if (!eventId || !actorId ||
      actionId !== POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_AUDIT_ACTION_IDS.CONFIGURATION_ACKNOWLEDGED ||
      !configurationRevision || reviewRecordRetentionDays === null ||
      requiredSafeguardIds === null || !occurredAt) {
    return null;
  }

  return Object.freeze({
    eventId,
    actorId,
    actionId,
    configurationRevision,
    previousConfigurationRevision,
    reviewRecordRetentionDays,
    occurredAt,
  });
}

export {
  CONTROL_CONFIGURATION_VERSION,
  CONTROL_KEY,
  normalizeRetentionDays,
};
