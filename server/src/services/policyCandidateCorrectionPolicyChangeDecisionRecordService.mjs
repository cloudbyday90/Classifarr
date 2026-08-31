/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyCandidateCorrectionPolicyChangeDecisionRecordReadModel,
  normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordExpectedRevision,
  normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordInput,
  normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordRow,
} from './policyCandidateCorrectionPolicyChangeDecisionRecordContract.mjs';
import {
  insertPolicyCandidateCorrectionPolicyChangeDecisionRecord,
  readPolicyCandidateCorrectionPolicyChangeDecisionRecord,
  updatePolicyCandidateCorrectionPolicyChangeDecisionRecord,
} from './policyCandidateCorrectionPolicyChangeDecisionRecordPersistence.mjs';
import {
  recordPolicyCandidateCorrectionPolicyChangeReviewHistoryActivity,
} from './policyCandidateCorrectionPolicyChangeReviewHistorySummaryPersistence.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_ACTIVITY_IDS,
} from './policyCandidateCorrectionPolicyChangeReviewHistorySummaryContract.mjs';
import {
  acquirePolicyCandidateCorrectionPolicyChangeOutcomeObservationLock,
  readPolicyCandidateCorrectionPolicyChangeOutcomeObservation,
} from './policyCandidateCorrectionPolicyChangeOutcomeObservationPersistence.mjs';
import {
  normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationRow,
} from './policyCandidateCorrectionPolicyChangeOutcomeObservationContract.mjs';

export class PolicyCandidateCorrectionPolicyChangeDecisionRecordValidationError extends Error {
  constructor(message = 'Policy-change decision record request is invalid.') {
    super(message);
    this.name = 'PolicyCandidateCorrectionPolicyChangeDecisionRecordValidationError';
    this.code = 'POLICY_CHANGE_DECISION_RECORD_INVALID_REQUEST';
  }
}

export class PolicyCandidateCorrectionPolicyChangeDecisionRecordOutcomeNotReadyError extends Error {
  constructor() {
    super('Wait for the current policy-change follow-up to complete before recording a reviewed decision.');
    this.name = 'PolicyCandidateCorrectionPolicyChangeDecisionRecordOutcomeNotReadyError';
    this.code = 'POLICY_CHANGE_DECISION_RECORD_OUTCOME_NOT_READY';
  }
}

export class PolicyCandidateCorrectionPolicyChangeDecisionRecordExistsError extends Error {
  constructor() {
    super('A reviewed decision already exists for the current policy-change outcome. Revise that decision instead.');
    this.name = 'PolicyCandidateCorrectionPolicyChangeDecisionRecordExistsError';
    this.code = 'POLICY_CHANGE_DECISION_RECORD_EXISTS';
  }
}

export class PolicyCandidateCorrectionPolicyChangeDecisionRecordRevisionConflictError extends Error {
  constructor() {
    super('This reviewed decision changed before your update. Review the current decision and try again.');
    this.name = 'PolicyCandidateCorrectionPolicyChangeDecisionRecordRevisionConflictError';
    this.code = 'POLICY_CHANGE_DECISION_RECORD_REVISION_CONFLICT';
  }
}

function normalizeActorId(value) {
  const actorId = Number(value);
  return Number.isSafeInteger(actorId) && actorId > 0 ? actorId : null;
}

function normalizeNow(value) {
  const now = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(now.getTime()) ? null : now;
}

function createPersistence() {
  return Object.freeze({
    acquireObservationLock: acquirePolicyCandidateCorrectionPolicyChangeOutcomeObservationLock,
    readObservation: readPolicyCandidateCorrectionPolicyChangeOutcomeObservation,
    readDecisionRecord: readPolicyCandidateCorrectionPolicyChangeDecisionRecord,
    insertDecisionRecord: insertPolicyCandidateCorrectionPolicyChangeDecisionRecord,
    updateDecisionRecord: updatePolicyCandidateCorrectionPolicyChangeDecisionRecord,
    recordReviewHistoryActivity: recordPolicyCandidateCorrectionPolicyChangeReviewHistoryActivity,
  });
}

function hasCompletedReadableOutcome(observation, now) {
  return observation && observation.followupWindow.endAt <= now.toISOString() &&
    observation.expiresAt > now.toISOString();
}

/**
 * Owns one expiry-bound, fixed-choice operator conclusion. It never reads or
 * accepts policy, media, library, provider, AI, RAG, prompt, response, or
 * selector data, and it never invokes a policy or routing operation.
 */
export function createPolicyCandidateCorrectionPolicyChangeDecisionRecordService({
  db,
  persistence = createPersistence(),
} = {}) {
  function buildReadModel({ observation, decisionRecord, now }) {
    return buildPolicyCandidateCorrectionPolicyChangeDecisionRecordReadModel({
      observation,
      decisionRecord,
      now,
    });
  }

  async function getDecisionRecord({ actorId, now = new Date() } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    const observedAt = normalizeNow(now);
    if (!normalizedActorId || !observedAt || !db || typeof db.query !== 'function') {
      throw new PolicyCandidateCorrectionPolicyChangeDecisionRecordValidationError();
    }

    const observation = normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationRow(
      await persistence.readObservation({ dbClient: db }),
    );
    const decisionRecord = normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordRow(
      await persistence.readDecisionRecord({ dbClient: db }),
    );
    return buildReadModel({ observation, decisionRecord, now: observedAt });
  }

  async function createDecisionRecord({ actorId, decisionId, rationaleId, now = new Date() } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    const input = normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordInput({ decisionId, rationaleId });
    const recordedAt = normalizeNow(now);
    if (!normalizedActorId || !input || !recordedAt || !db || typeof db.withTransaction !== 'function') {
      throw new PolicyCandidateCorrectionPolicyChangeDecisionRecordValidationError();
    }

    return db.withTransaction(async client => {
      await persistence.acquireObservationLock({ client });
      const observation = normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationRow(
        await persistence.readObservation({ dbClient: client, lock: true }),
      );
      if (!hasCompletedReadableOutcome(observation, recordedAt)) {
        throw new PolicyCandidateCorrectionPolicyChangeDecisionRecordOutcomeNotReadyError();
      }
      const existingDecision = normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordRow(
        await persistence.readDecisionRecord({ dbClient: client, lock: true }),
      );
      if (existingDecision) throw new PolicyCandidateCorrectionPolicyChangeDecisionRecordExistsError();

      const inserted = normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordRow(
        await persistence.insertDecisionRecord({
          client,
          record: {
            observationHypothesisId: observation.hypothesisId,
            ...input,
            actorId: normalizedActorId,
            now: recordedAt.toISOString(),
            expiresAt: observation.expiresAt,
          },
        }),
      );
      if (!inserted) throw new Error('Policy-change decision record persistence returned an invalid row.');
      await persistence.recordReviewHistoryActivity({
        client,
        decisionId: inserted.decisionId,
        activityId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_ACTIVITY_IDS.RECORDED,
        now: recordedAt,
      });
      return buildReadModel({ observation, decisionRecord: inserted, now: recordedAt });
    });
  }

  async function reviseDecisionRecord({
    actorId,
    decisionId,
    rationaleId,
    expectedRevision,
    now = new Date(),
  } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    const input = normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordInput({ decisionId, rationaleId });
    const revision = normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordExpectedRevision(expectedRevision);
    const revisedAt = normalizeNow(now);
    if (!normalizedActorId || !input || !revision || !revisedAt || !db || typeof db.withTransaction !== 'function') {
      throw new PolicyCandidateCorrectionPolicyChangeDecisionRecordValidationError();
    }

    return db.withTransaction(async client => {
      await persistence.acquireObservationLock({ client });
      const observation = normalizePolicyCandidateCorrectionPolicyChangeOutcomeObservationRow(
        await persistence.readObservation({ dbClient: client, lock: true }),
      );
      if (!hasCompletedReadableOutcome(observation, revisedAt)) {
        throw new PolicyCandidateCorrectionPolicyChangeDecisionRecordOutcomeNotReadyError();
      }
      const existingDecision = normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordRow(
        await persistence.readDecisionRecord({ dbClient: client, lock: true }),
      );
      if (!existingDecision || existingDecision.observationHypothesisId !== observation.hypothesisId ||
          existingDecision.expiresAt !== observation.expiresAt || existingDecision.revision !== revision) {
        throw new PolicyCandidateCorrectionPolicyChangeDecisionRecordRevisionConflictError();
      }
      if (existingDecision.decisionId === input.decisionId && existingDecision.rationaleId === input.rationaleId) {
        return buildReadModel({ observation, decisionRecord: existingDecision, now: revisedAt });
      }

      const updated = normalizePolicyCandidateCorrectionPolicyChangeDecisionRecordRow(
        await persistence.updateDecisionRecord({
          client,
          expectedRevision: revision,
          record: {
            observationHypothesisId: observation.hypothesisId,
            ...input,
            actorId: normalizedActorId,
            now: revisedAt.toISOString(),
            expiresAt: observation.expiresAt,
          },
        }),
      );
      if (!updated) throw new PolicyCandidateCorrectionPolicyChangeDecisionRecordRevisionConflictError();
      await persistence.recordReviewHistoryActivity({
        client,
        decisionId: updated.decisionId,
        activityId: POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_ACTIVITY_IDS.REVISED,
        now: revisedAt,
      });
      return buildReadModel({ observation, decisionRecord: updated, now: revisedAt });
    });
  }

  return Object.freeze({ getDecisionRecord, createDecisionRecord, reviseDecisionRecord });
}
