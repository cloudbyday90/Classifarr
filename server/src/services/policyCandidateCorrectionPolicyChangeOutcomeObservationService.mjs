/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { randomBytes } from 'node:crypto';
import {
  buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationReadModel,
  buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationWindows,
  normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationRow,
  normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationSummary,
} from './policyCandidateCorrectionPolicyChangeOutcomeObservationContract.mjs';
import {
  acquirePolicyCandidateCorrectionPolicyChangeOutcomeObservationLock,
  findRecentPolicyCandidateCorrectionPolicyChangeReceipt,
  readPolicyCandidateCorrectionPolicyChangeOutcomeObservation,
  upsertPolicyCandidateCorrectionPolicyChangeOutcomeObservation,
} from './policyCandidateCorrectionPolicyChangeOutcomeObservationPersistence.mjs';
import {
  deleteExpiredPolicyCandidateCorrectionPolicyChangeDecisionRecord,
} from './policyCandidateCorrectionPolicyChangeDecisionRecordPersistence.mjs';
import {
  buildPolicyCandidateCorrectionAnalyticsMetricsReport,
} from './policyCandidateCorrectionAnalyticsMetrics.mjs';
import {
  loadPolicyCandidateCorrectionAnalyticsMetrics,
} from './policyCandidateCorrectionAnalyticsMetricsRepository.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_RECEIPT_MAX_AGE_SECONDS =
  60 * 60;

export class PolicyCandidateCorrectionPolicyChangeOutcomeObservationValidationError extends Error {
  constructor(message = 'Policy-change outcome observation request is invalid.') {
    super(message);
    this.name = 'PolicyCandidateCorrectionPolicyChangeOutcomeObservationValidationError';
    this.code = 'POLICY_CHANGE_OUTCOME_OBSERVATION_INVALID_REQUEST';
  }
}

export class PolicyCandidateCorrectionPolicyChangeOutcomeObservationReceiptRequiredError extends Error {
  constructor() {
    super('Apply a native policy change, then as the same administrator start its outcome observation within one hour.');
    this.name = 'PolicyCandidateCorrectionPolicyChangeOutcomeObservationReceiptRequiredError';
    this.code = 'POLICY_CHANGE_OUTCOME_OBSERVATION_RECEIPT_REQUIRED';
  }
}

export class PolicyCandidateCorrectionPolicyChangeOutcomeObservationActiveError extends Error {
  constructor() {
    super('A current policy-change outcome observation is already running. Wait for its result or expiry before starting another.');
    this.name = 'PolicyCandidateCorrectionPolicyChangeOutcomeObservationActiveError';
    this.code = 'POLICY_CHANGE_OUTCOME_OBSERVATION_ACTIVE';
  }
}

function normalizeActorId(value) {
  const actorId = Number(value);
  return Number.isInteger(actorId) && actorId > 0 ? actorId : null;
}

function normalizeNow(value) {
  const now = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(now.getTime()) ? null : now;
}

function buildHypothesisId() {
  return `pco_${randomBytes(24).toString('base64url')}`;
}

function recentReceiptStartAt(now) {
  return new Date(now.getTime() -
    POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_RECEIPT_MAX_AGE_SECONDS * 1000);
}

function normalizeReceipt(value) {
  const receiptId = Number(value?.id);
  const sourceIntentVersion = Number(value?.source_intent_version ?? value?.sourceIntentVersion);
  const targetIntentVersion = Number(value?.target_intent_version ?? value?.targetIntentVersion);
  if (!Number.isSafeInteger(receiptId) || receiptId <= 0 ||
      !Number.isSafeInteger(sourceIntentVersion) || sourceIntentVersion <= 0 ||
      !Number.isSafeInteger(targetIntentVersion) || targetIntentVersion <= sourceIntentVersion) {
    return null;
  }
  return Object.freeze({ receiptId, sourceIntentVersion, targetIntentVersion });
}

function summaryFromMetricsReport(report) {
  return normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationSummary(report?.summary);
}

function createPersistence() {
  return Object.freeze({
    acquireLock: acquirePolicyCandidateCorrectionPolicyChangeOutcomeObservationLock,
    findRecentReceipt: findRecentPolicyCandidateCorrectionPolicyChangeReceipt,
    readObservation: readPolicyCandidateCorrectionPolicyChangeOutcomeObservation,
    deleteExpiredDecisionRecord: deleteExpiredPolicyCandidateCorrectionPolicyChangeDecisionRecord,
    upsertObservation: upsertPolicyCandidateCorrectionPolicyChangeOutcomeObservation,
  });
}

/**
 * Owns a single, bounded, content-free before/after observation. The service
 * never accepts policy, library, media, AI, RAG, or time-range selectors from
 * a caller; the authenticated actor's recent native receipt anchors the start.
 */
export function createPolicyCandidateCorrectionPolicyChangeOutcomeObservationService({
  db,
  persistence = createPersistence(),
  loadMetrics = loadPolicyCandidateCorrectionAnalyticsMetrics,
  randomHypothesisId = buildHypothesisId,
} = {}) {
  async function loadSummary({ dbClient, window }) {
    const rows = await loadMetrics(dbClient, window);
    const report = buildPolicyCandidateCorrectionAnalyticsMetricsReport({ rows, window });
    const summary = summaryFromMetricsReport(report);
    if (!summary) throw new Error('Aggregate outcome metrics returned an invalid summary.');
    return summary;
  }

  async function findRecentReceipt({ dbClient, actorId, now }) {
    const receipt = await persistence.findRecentReceipt({
      dbClient,
      actorId,
      notBefore: recentReceiptStartAt(now).toISOString(),
      notAfter: now.toISOString(),
    });
    return normalizeReceipt(receipt);
  }

  async function buildObservationReadModel({
    observation,
    now,
    dbClient,
    startAvailable = false,
  }) {
    if (observation.followupWindow.endAt <= now.toISOString() &&
        observation.expiresAt > now.toISOString()) {
      const followupWindow = {
        days: 28,
        start: new Date(observation.followupWindow.startAt),
        end: new Date(observation.followupWindow.endAt),
      };
      const followupSummary = await loadSummary({ dbClient, window: followupWindow });
      return buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationReadModel({
        observation,
        now,
        followupSummary,
      });
    }

    return buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationReadModel({
      observation,
      now,
      startAvailable,
    });
  }

  async function getOutcomeObservation({ actorId, now = new Date() } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    const observedAt = normalizeNow(now);
    if (!normalizedActorId || !observedAt || !db || typeof db.query !== 'function') {
      throw new PolicyCandidateCorrectionPolicyChangeOutcomeObservationValidationError();
    }

    const observation = normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationRow(
      await persistence.readObservation({ dbClient: db }),
    );
    if (!observation) {
      const recentReceipt = await findRecentReceipt({ dbClient: db, actorId: normalizedActorId, now: observedAt });
      return buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationReadModel({
        now: observedAt,
        startAvailable: recentReceipt !== null,
      });
    }

    const recentReceipt = observation.expiresAt <= observedAt.toISOString()
      ? await findRecentReceipt({ dbClient: db, actorId: normalizedActorId, now: observedAt })
      : null;
    return buildObservationReadModel({
      observation,
      now: observedAt,
      dbClient: db,
      startAvailable: recentReceipt !== null,
    });
  }

  async function startOutcomeObservation({ actorId, now = new Date() } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    const startedAt = normalizeNow(now);
    if (!normalizedActorId || !startedAt || !db || typeof db.withTransaction !== 'function') {
      throw new PolicyCandidateCorrectionPolicyChangeOutcomeObservationValidationError();
    }

    return db.withTransaction(async client => {
      await persistence.acquireLock({ client });
      const existingObservation = normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationRow(
        await persistence.readObservation({ dbClient: client, lock: true }),
      );
      if (existingObservation && existingObservation.expiresAt > startedAt.toISOString()) {
        return Object.freeze({
          ...await buildObservationReadModel({
            observation: existingObservation,
            now: startedAt,
            dbClient: client,
          }),
          operationId: 'existing_observation',
        });
      }

      const receipt = await findRecentReceipt({ dbClient: client, actorId: normalizedActorId, now: startedAt });
      if (!receipt) throw new PolicyCandidateCorrectionPolicyChangeOutcomeObservationReceiptRequiredError();

      // A prior decision has the same expiry as the old observation. Remove it
      // inside the replacement transaction so a new observation cannot inherit
      // or be blocked by that prior bounded conclusion before daily retention
      // has run.
      await persistence.deleteExpiredDecisionRecord({
        dbClient: client,
        now: startedAt.toISOString(),
      });

      const windows = buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationWindows({ now: startedAt });
      const baselineSummary = await loadSummary({ dbClient: client, window: windows.baselineWindow });
      const insertedObservation = await persistence.upsertObservation({
        client,
        observation: {
          hypothesisId: randomHypothesisId(),
          sourceReceiptId: receipt.receiptId,
          sourceIntentVersion: receipt.sourceIntentVersion,
          targetIntentVersion: receipt.targetIntentVersion,
          baselineWindow: windows.baselineWindow,
          followupWindow: windows.followupWindow,
          baselineSummary,
          actorId: normalizedActorId,
          createdAt: startedAt.toISOString(),
          expiresAt: windows.expiresAt.toISOString(),
        },
      });
      const observation = normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationRow(insertedObservation);
      if (!observation) throw new Error('Policy-change outcome observation persistence returned an invalid row.');

      return Object.freeze({
        ...buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationReadModel({
          observation,
          now: startedAt,
        }),
        operationId: 'observation_started',
      });
    });
  }

  return Object.freeze({ getOutcomeObservation, startOutcomeObservation });
}
