/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomBytes } from 'node:crypto';
import * as defaultDb from '../config/database.mjs';
import {
  buildAdjacentCompletedUtcDayMetricsWindows,
} from './completedUtcDayMetricsWindow.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_WINDOW_DAYS,
} from './policyCandidateCorrectionLongHorizonTrend.mjs';
import {
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration,
} from './policyCandidateCorrectionRepresentativeReviewCorpusControlContract.mjs';
import {
  readPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
  lockPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
} from './policyCandidateCorrectionRepresentativeReviewCorpusControlPersistence.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
} from './policyCandidateCorrectionRepresentativeReviewCorpusVocabulary.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_AUDIT_ACTION_IDS,
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_SAMPLE_PER_STRATUM,
  buildPolicyCandidateCorrectionRepresentativeReviewProjectionReadModel,
  normalizePolicyCandidateCorrectionRepresentativeReviewProjection,
} from './policyCandidateCorrectionRepresentativeReviewProjectionContract.mjs';
import {
  acquirePolicyCandidateCorrectionRepresentativeReviewProjectionLock,
  findActivePolicyCandidateCorrectionRepresentativeReviewProjection,
  insertPolicyCandidateCorrectionRepresentativeReviewProjection,
  insertPolicyCandidateCorrectionRepresentativeReviewProjectionAuditEvent,
  insertPolicyCandidateCorrectionRepresentativeReviewProjectionItems,
  listPolicyCandidateCorrectionRepresentativeReviewProjectionItems,
  setPolicyCandidateCorrectionRepresentativeReviewProjectionItemCount,
} from './policyCandidateCorrectionRepresentativeReviewProjectionPersistence.mjs';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_LOCK_KEY = 2026083013;

export class PolicyCandidateCorrectionRepresentativeReviewProjectionValidationError extends Error {
  constructor(message = 'Review projection request is invalid.') {
    super(message);
    this.name = 'PolicyCandidateCorrectionRepresentativeReviewProjectionValidationError';
    this.code = 'POLICY_CANDIDATE_CORRECTION_REVIEW_PROJECTION_INVALID_REQUEST';
  }
}

export class PolicyCandidateCorrectionRepresentativeReviewProjectionConfigurationRequiredError extends Error {
  constructor() {
    super('Review-corpus safeguards must be acknowledged before a redacted projection can be created.');
    this.name = 'PolicyCandidateCorrectionRepresentativeReviewProjectionConfigurationRequiredError';
    this.code = 'POLICY_CANDIDATE_CORRECTION_REVIEW_PROJECTION_CONFIGURATION_REQUIRED';
  }
}

function normalizeActorId(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeNow(value) {
  const now = value instanceof Date ? value : new Date(value);
  return Number.isNaN(now.getTime()) ? new Date() : now;
}

function expiresAt({ createdAt, retentionDays }) {
  const result = new Date(createdAt);
  result.setUTCDate(result.getUTCDate() + retentionDays);
  return result;
}

async function readProjection({ persistence, dbClient, configuration, now, auditActorId = null }) {
  if (!configuration) {
    return buildPolicyCandidateCorrectionRepresentativeReviewProjectionReadModel({ configuration: null });
  }

  const snapshot = await persistence.findActiveProjection({
    dbClient,
    configurationRevision: configuration.revision,
    now: now.toISOString(),
  });
  if (!snapshot) {
    return buildPolicyCandidateCorrectionRepresentativeReviewProjectionReadModel({ configuration });
  }

  const items = await persistence.listItems({ dbClient, snapshotId: snapshot.snapshot_id });
  const projection = normalizePolicyCandidateCorrectionRepresentativeReviewProjection({ snapshot, items });
  if (!projection) {
    throw new Error('Review projection persistence returned an invalid redacted projection.');
  }

  if (auditActorId !== null) {
    await persistence.insertAuditEvent({
      client: dbClient,
      event: {
        actionId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_AUDIT_ACTION_IDS.PROJECTION_VIEWED,
        actorId: auditActorId,
        projectionCreatedAt: projection.createdAt,
        configurationRevision: configuration.revision,
        itemCount: projection.itemCount,
        occurredAt: now.toISOString(),
      },
    });
  }

  return buildPolicyCandidateCorrectionRepresentativeReviewProjectionReadModel({ configuration, projection });
}

export function createPolicyCandidateCorrectionRepresentativeReviewProjectionService({
  db = defaultDb,
  lockKey = POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_LOCK_KEY,
  randomHex = (byteLength) => randomBytes(byteLength).toString('hex'),
  persistence = {
    acquireLock: acquirePolicyCandidateCorrectionRepresentativeReviewProjectionLock,
    readControl: readPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
    lockControl: lockPolicyCandidateCorrectionRepresentativeReviewCorpusControl,
    findActiveProjection: findActivePolicyCandidateCorrectionRepresentativeReviewProjection,
    listItems: listPolicyCandidateCorrectionRepresentativeReviewProjectionItems,
    insertProjection: insertPolicyCandidateCorrectionRepresentativeReviewProjection,
    insertItems: insertPolicyCandidateCorrectionRepresentativeReviewProjectionItems,
    setItemCount: setPolicyCandidateCorrectionRepresentativeReviewProjectionItemCount,
    insertAuditEvent: insertPolicyCandidateCorrectionRepresentativeReviewProjectionAuditEvent,
  },
} = {}) {
  async function getProjection({
    actorId,
    now = new Date(),
    auditProjectionView = true,
  } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    if (!normalizedActorId || typeof db?.withTransaction !== 'function') {
      throw new PolicyCandidateCorrectionRepresentativeReviewProjectionValidationError();
    }

    const observedAt = normalizeNow(now);
    return db.withTransaction(async client => {
      const controlRow = await persistence.readControl({ dbClient: client });
      const configuration = controlRow
        ? normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration(controlRow)
        : null;
      return readProjection({
        persistence,
        dbClient: client,
        configuration,
        now: observedAt,
        auditActorId: auditProjectionView === false ? null : normalizedActorId,
      });
    });
  }

  async function createProjection({ actorId, now = new Date() } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    if (!normalizedActorId || typeof db?.withTransaction !== 'function') {
      throw new PolicyCandidateCorrectionRepresentativeReviewProjectionValidationError();
    }

    const createdAt = normalizeNow(now);
    return db.withTransaction(async client => {
      await persistence.acquireLock({ client, lockKey });
      const controlRow = await persistence.lockControl({ client });
      const configuration = controlRow
        ? normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration(controlRow)
        : null;
      if (!configuration) {
        throw new PolicyCandidateCorrectionRepresentativeReviewProjectionConfigurationRequiredError();
      }

      const activeSnapshot = await persistence.findActiveProjection({
        dbClient: client,
        configurationRevision: configuration.revision,
        now: createdAt.toISOString(),
        lock: true,
      });
      if (activeSnapshot) {
        const result = await readProjection({
          persistence,
          dbClient: client,
          configuration,
          now: createdAt,
          auditActorId: normalizedActorId,
        });
        return Object.freeze({ ...result, operationId: 'existing_projection' });
      }

      const windows = buildAdjacentCompletedUtcDayMetricsWindows({
        windowDays: POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_WINDOW_DAYS,
        now: createdAt,
      });
      const insertedSnapshot = await persistence.insertProjection({
        client,
        projection: {
          snapshotId: randomHex(32),
          purposeId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID,
          configurationRevision: configuration.revision,
          previousWindow: windows.previous,
          currentWindow: windows.current,
          samplePerStratum: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_SAMPLE_PER_STRATUM,
          actorId: normalizedActorId,
          createdAt: createdAt.toISOString(),
          expiresAt: expiresAt({
            createdAt,
            retentionDays: configuration.reviewRecordRetentionDays,
          }).toISOString(),
        },
      });
      if (!insertedSnapshot) {
        throw new Error('Review projection persistence did not create a snapshot.');
      }

      const itemCount = await persistence.insertItems({
        client,
        snapshotId: insertedSnapshot.snapshot_id,
        previousWindow: windows.previous,
        currentWindow: windows.current,
        sampleSeed: randomHex(32),
        samplePerStratum: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_SAMPLE_PER_STRATUM,
      });
      const snapshot = await persistence.setItemCount({
        client,
        snapshotId: insertedSnapshot.snapshot_id,
        itemCount,
      });
      const items = await persistence.listItems({ dbClient: client, snapshotId: insertedSnapshot.snapshot_id });
      const projection = normalizePolicyCandidateCorrectionRepresentativeReviewProjection({ snapshot, items });
      if (!projection) {
        throw new Error('Review projection persistence returned an invalid newly created projection.');
      }

      await persistence.insertAuditEvent({
        client,
        event: {
          actionId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_AUDIT_ACTION_IDS.PROJECTION_CREATED,
          actorId: normalizedActorId,
          projectionCreatedAt: projection.createdAt,
          configurationRevision: configuration.revision,
          itemCount: projection.itemCount,
          occurredAt: createdAt.toISOString(),
        },
      });

      return Object.freeze({
        ...buildPolicyCandidateCorrectionRepresentativeReviewProjectionReadModel({ configuration, projection }),
        operationId: 'projection_created',
      });
    });
  }

  return Object.freeze({ createProjection, getProjection });
}
