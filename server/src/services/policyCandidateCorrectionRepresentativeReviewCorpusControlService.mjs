/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import {
  CONTROL_CONFIGURATION_VERSION,
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_VERSION,
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_AUDIT_ACTION_IDS,
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlReadModel,
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvent,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration,
  validatePolicyCandidateCorrectionRepresentativeReviewCorpusControlAcknowledgementRequest,
} from './policyCandidateCorrectionRepresentativeReviewCorpusControlContract.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_REQUIRED_SAFEGUARD_IDS,
} from './policyCandidateCorrectionRepresentativeReviewCorpusVocabulary.mjs';
import {
  acquirePolicyCandidateCorrectionRepresentativeReviewCorpusControlLock,
  insertPolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvent,
  listPolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvents,
  lockPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
  readPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
  upsertPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
} from './policyCandidateCorrectionRepresentativeReviewCorpusControlPersistence.mjs';

const CONTROL_LOCK_KEY = 2026083012;
const DEFAULT_AUDIT_EVENT_LIMIT = 5;
const MAX_AUDIT_EVENT_LIMIT = 25;

export class PolicyCandidateCorrectionRepresentativeReviewCorpusControlValidationError extends Error {
  constructor(message = 'Review-corpus control request is invalid.') {
    super(message);
    this.name = 'PolicyCandidateCorrectionRepresentativeReviewCorpusControlValidationError';
    this.code = 'POLICY_CANDIDATE_CORRECTION_REVIEW_CORPUS_CONTROL_INVALID_REQUEST';
  }
}

export class PolicyCandidateCorrectionRepresentativeReviewCorpusControlConflictError extends Error {
  constructor(message = 'Review-corpus configuration has changed. Refresh and retry.') {
    super(message);
    this.name = 'PolicyCandidateCorrectionRepresentativeReviewCorpusControlConflictError';
    this.code = 'POLICY_CANDIDATE_CORRECTION_REVIEW_CORPUS_CONTROL_REVISION_CONFLICT';
  }
}

function normalizeActorId(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeAuditEventLimit(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_AUDIT_EVENT_LIMIT;
  }

  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 && numeric <= MAX_AUDIT_EVENT_LIMIT
    ? numeric
    : null;
}

function normalizeNow(value) {
  const now = value instanceof Date ? value : new Date(value);
  return Number.isNaN(now.getTime()) ? new Date() : now;
}

function createConfiguration({ actorId, reviewRecordRetentionDays, now }) {
  const revision = buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision({
    reviewRecordRetentionDays,
  });
  if (!revision) {
    throw new PolicyCandidateCorrectionRepresentativeReviewCorpusControlValidationError();
  }

  return {
    configurationVersion: CONTROL_CONFIGURATION_VERSION,
    purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
    requiredSafeguardIds: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_REQUIRED_SAFEGUARD_IDS,
    reviewRecordRetentionDays,
    revision,
    actorId,
    acknowledgedAt: now.toISOString(),
  };
}

export function createPolicyCandidateCorrectionRepresentativeReviewCorpusControlService({
  db = defaultDb,
  lockKey = CONTROL_LOCK_KEY,
  persistence = {
    acquireLock: acquirePolicyCandidateCorrectionRepresentativeReviewCorpusControlLock,
    lockControl: lockPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
    readControl: readPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
    upsertControl: upsertPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
    insertAuditEvent: insertPolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvent,
    listAuditEvents: listPolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvents,
  },
} = {}) {
  async function getConfiguration() {
    const row = await persistence.readControl({ dbClient: db });
    const configuration = row === null ? null
      : normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration(row);
    return buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlReadModel({ configuration });
  }

  async function acknowledgeConfiguration({ actorId, request, now = new Date() } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    const validation = validatePolicyCandidateCorrectionRepresentativeReviewCorpusControlAcknowledgementRequest(request);
    if (!normalizedActorId || !validation.ok || typeof db?.withTransaction !== 'function') {
      throw new PolicyCandidateCorrectionRepresentativeReviewCorpusControlValidationError();
    }

    const acknowledgedAt = normalizeNow(now);
    return db.withTransaction(async client => {
      await persistence.acquireLock({ client, lockKey });
      const stored = await persistence.lockControl({ client });
      const current = stored === null ? null
        : normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration(stored);
      const currentRevision = current?.revision ?? null;
      if (validation.value.expectedRevision !== currentRevision) {
        throw new PolicyCandidateCorrectionRepresentativeReviewCorpusControlConflictError();
      }

      const next = createConfiguration({
        actorId: normalizedActorId,
        reviewRecordRetentionDays: validation.value.reviewRecordRetentionDays,
        now: acknowledgedAt,
      });
      if (current?.revision === next.revision) {
        return Object.freeze({
          ...buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlReadModel({ configuration: current }),
          operationId: 'unchanged',
        });
      }

      const storedNext = await persistence.upsertControl({ client, configuration: next });
      const configuration = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration(storedNext);
      if (!configuration) {
        throw new Error('Review-corpus control persistence returned an invalid configuration.');
      }

      await persistence.insertAuditEvent({
        client,
        event: {
          eventVersion: 1,
          actionId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_AUDIT_ACTION_IDS.CONFIGURATION_ACKNOWLEDGED,
          actorId: normalizedActorId,
          previousConfigurationRevision: currentRevision,
          configurationRevision: configuration.revision,
          purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
          requiredSafeguardIds: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_REQUIRED_SAFEGUARD_IDS,
          reviewRecordRetentionDays: configuration.reviewRecordRetentionDays,
          occurredAt: configuration.acknowledgedAt,
        },
      });

      return Object.freeze({
        ...buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlReadModel({ configuration }),
        operationId: 'configuration_acknowledged',
      });
    });
  }

  async function getRecentAuditEvents({ limit } = {}) {
    const normalizedLimit = normalizeAuditEventLimit(limit);
    if (normalizedLimit === null) {
      throw new PolicyCandidateCorrectionRepresentativeReviewCorpusControlValidationError(
        'Audit event limit must be a positive integer within the configured maximum.',
      );
    }

    const rows = await persistence.listAuditEvents({ dbClient: db, limit: normalizedLimit });
    return Object.freeze({
      version: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_VERSION,
      events: Object.freeze(rows
        .map(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvent)
        .filter(Boolean)),
    });
  }

  return Object.freeze({
    acknowledgeConfiguration,
    getConfiguration,
    getRecentAuditEvents,
  });
}

export {
  CONTROL_LOCK_KEY,
  DEFAULT_AUDIT_EVENT_LIMIT,
  MAX_AUDIT_EVENT_LIMIT,
};
