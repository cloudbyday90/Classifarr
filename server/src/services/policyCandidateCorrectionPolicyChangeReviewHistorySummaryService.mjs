/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryReadModel,
  getPolicyCandidateCorrectionPolicyChangeReviewHistoryCompletedPeriods,
  normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryControlRow,
} from './policyCandidateCorrectionPolicyChangeReviewHistorySummaryContract.mjs';
import {
  readPolicyCandidateCorrectionPolicyChangeReviewHistoryAggregates,
  readPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryControl,
} from './policyCandidateCorrectionPolicyChangeReviewHistorySummaryPersistence.mjs';

export class PolicyCandidateCorrectionPolicyChangeReviewHistorySummaryValidationError extends Error {
  constructor(message = 'Policy-change review history summary request is invalid.') {
    super(message);
    this.name = 'PolicyCandidateCorrectionPolicyChangeReviewHistorySummaryValidationError';
    this.code = 'POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_INVALID_REQUEST';
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
    readControl: readPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryControl,
    readAggregates: readPolicyCandidateCorrectionPolicyChangeReviewHistoryAggregates,
  });
}

/**
 * Owns selector-free reading of bounded completed-period activity. It has no
 * write, policy, AI/RAG, learning, retry, provider, or routing capability.
 */
export function createPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryService({
  db,
  persistence = createPersistence(),
} = {}) {
  async function getReviewHistorySummary({ actorId, now = new Date() } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    const observedAt = normalizeNow(now);
    if (!normalizedActorId || !observedAt || !db || typeof db.query !== 'function') {
      throw new PolicyCandidateCorrectionPolicyChangeReviewHistorySummaryValidationError();
    }

    const control = normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryControlRow(
      await persistence.readControl({ dbClient: db }),
    );
    if (!control) {
      throw new PolicyCandidateCorrectionPolicyChangeReviewHistorySummaryValidationError(
        'Policy-change review history summary is not initialized.',
      );
    }

    const periods = getPolicyCandidateCorrectionPolicyChangeReviewHistoryCompletedPeriods({
      startedAt: control.startedAt,
      now: observedAt,
    });
    const aggregateRows = await persistence.readAggregates({
      dbClient: db,
      periodStarts: periods.map(period => period.periodStart),
    });
    return buildPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryReadModel({
      control,
      aggregateRows,
      now: observedAt,
    });
  }

  return Object.freeze({ getReviewHistorySummary });
}
