/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  acquirePolicyCandidateCorrectionPolicyChangeOutcomeObservationLock,
  deleteExpiredPolicyCandidateCorrectionPolicyChangeOutcomeObservation,
} from './policyCandidateCorrectionPolicyChangeOutcomeObservationPersistence.mjs';
import {
  deleteExpiredPolicyCandidateCorrectionPolicyChangeDecisionRecord,
} from './policyCandidateCorrectionPolicyChangeDecisionRecordPersistence.mjs';
import {
  deleteExpiredPolicyCandidateCorrectionPolicyChangeReviewHistoryAggregates,
} from './policyCandidateCorrectionPolicyChangeReviewHistorySummaryPersistence.mjs';
import {
  getPolicyCandidateCorrectionPolicyChangeReviewHistoryRetentionCutoff,
} from './policyCandidateCorrectionPolicyChangeReviewHistorySummaryContract.mjs';

function normalizeNow(value) {
  const now = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(now.getTime()) ? new Date() : now;
}

/** Owns deletion of the bounded, aggregate-only observation after expiry. */
export class PolicyCandidateCorrectionPolicyChangeOutcomeObservationRetentionService {
  constructor({
    db = defaultDb,
    logger = createLogger('PolicyChangeOutcomeObservationRetentionService'),
    persistence = {
      acquireLock: acquirePolicyCandidateCorrectionPolicyChangeOutcomeObservationLock,
      deleteExpiredReviewHistory: deleteExpiredPolicyCandidateCorrectionPolicyChangeReviewHistoryAggregates,
      deleteExpiredDecisionRecord: deleteExpiredPolicyCandidateCorrectionPolicyChangeDecisionRecord,
      deleteExpired: deleteExpiredPolicyCandidateCorrectionPolicyChangeOutcomeObservation,
    },
  } = {}) {
    this.db = db;
    this.logger = logger;
    this.persistence = persistence;
  }

  async cleanup({ now = new Date() } = {}) {
    const evaluatedAt = normalizeNow(now);
    if (typeof this.db?.withTransaction !== 'function') {
      return Object.freeze({
        statusId: 'transaction_boundary_required',
        deletedReviewHistoryCount: 0,
        deletedDecisionRecordCount: 0,
        deletedObservationCount: 0,
      });
    }

    try {
      const result = await this.db.withTransaction(async client => {
        await this.persistence.acquireLock({ client });
        const deletedReviewHistoryCount = await this.persistence.deleteExpiredReviewHistory({
          dbClient: client,
          beforePeriodStart: getPolicyCandidateCorrectionPolicyChangeReviewHistoryRetentionCutoff(evaluatedAt),
        });
        const deletedDecisionRecordCount = await this.persistence.deleteExpiredDecisionRecord({
          dbClient: client,
          now: evaluatedAt.toISOString(),
        });
        const deletedObservationCount = await this.persistence.deleteExpired({
          dbClient: client,
          now: evaluatedAt.toISOString(),
        });
        return Object.freeze({
          statusId: 'completed',
          deletedReviewHistoryCount,
          deletedDecisionRecordCount,
          deletedObservationCount,
        });
      });
      this.logger.info('Policy-change outcome observation retention cleanup completed', result);
      return result;
    } catch (error) {
      this.logger.error('Policy-change outcome observation retention cleanup failed', { error: error.message });
      return Object.freeze({
        statusId: 'failed_rolled_back',
        deletedReviewHistoryCount: 0,
        deletedDecisionRecordCount: 0,
        deletedObservationCount: 0,
      });
    }
  }
}

export const policyCandidateCorrectionPolicyChangeOutcomeObservationRetentionService =
  new PolicyCandidateCorrectionPolicyChangeOutcomeObservationRetentionService();
