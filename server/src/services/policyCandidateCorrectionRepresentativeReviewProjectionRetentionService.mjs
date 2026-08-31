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
import { createLogger } from '../utils/logger.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_AUDIT_ACTION_IDS,
} from './policyCandidateCorrectionRepresentativeReviewProjectionContract.mjs';
import {
  deletePolicyCandidateCorrectionRepresentativeReviewProjection,
  insertPolicyCandidateCorrectionRepresentativeReviewProjectionAuditEvent,
  lockExpiredPolicyCandidateCorrectionRepresentativeReviewProjections,
  tryLockPolicyCandidateCorrectionRepresentativeReviewProjectionRetention,
} from './policyCandidateCorrectionRepresentativeReviewProjectionPersistence.mjs';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_RETENTION_BATCH_SIZE = 100;
const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_RETENTION_LOCK_KEY =
  defaultDb.DB_ADVISORY_LOCKS.POLICY_CANDIDATE_CORRECTION_REVIEW_PROJECTION_RETENTION;

function normalizeNow(value) {
  const now = value instanceof Date ? value : new Date(value);
  return Number.isNaN(now.getTime()) ? new Date() : now;
}

function normalizeBatchSize(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 && numeric <= 1000
    ? numeric
    : POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_RETENTION_BATCH_SIZE;
}

export class PolicyCandidateCorrectionRepresentativeReviewProjectionRetentionService {
  constructor({
    db = defaultDb,
    logger = createLogger('PolicyCandidateCorrectionRepresentativeReviewProjectionRetentionService'),
    lockKey = POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_RETENTION_LOCK_KEY,
    persistence = {
      tryLock: tryLockPolicyCandidateCorrectionRepresentativeReviewProjectionRetention,
      lockExpired: lockExpiredPolicyCandidateCorrectionRepresentativeReviewProjections,
      deleteProjection: deletePolicyCandidateCorrectionRepresentativeReviewProjection,
      insertAuditEvent: insertPolicyCandidateCorrectionRepresentativeReviewProjectionAuditEvent,
    },
  } = {}) {
    this.db = db;
    this.logger = logger;
    this.lockKey = lockKey;
    this.persistence = persistence;
  }

  async cleanup({ now = new Date(), batchSize } = {}) {
    const evaluatedAt = normalizeNow(now);
    const normalizedBatchSize = normalizeBatchSize(batchSize);
    if (typeof this.db?.withTransaction !== 'function') {
      return Object.freeze({ statusId: 'transaction_boundary_required', deletedProjectionCount: 0 });
    }

    try {
      const result = await this.db.withTransaction(async client => {
        const acquired = await this.persistence.tryLock({ client, lockKey: this.lockKey });
        if (!acquired) return Object.freeze({ statusId: 'cleanup_locked', deletedProjectionCount: 0 });

        const expired = await this.persistence.lockExpired({
          client,
          now: evaluatedAt.toISOString(),
          limit: normalizedBatchSize,
        });
        let deletedProjectionCount = 0;
        for (const projection of expired) {
          const deleted = await this.persistence.deleteProjection({
            client,
            snapshotId: projection.snapshot_id,
          });
          if (!deleted) throw new Error('Expired review projection was not deleted.');

          await this.persistence.insertAuditEvent({
            client,
            event: {
              actionId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_AUDIT_ACTION_IDS.PROJECTION_EXPIRED,
              actorId: null,
              projectionCreatedAt: projection.created_at,
              configurationRevision: projection.configuration_revision,
              itemCount: projection.item_count,
              occurredAt: evaluatedAt.toISOString(),
            },
          });
          deletedProjectionCount += 1;
        }

        return Object.freeze({
          statusId: 'completed',
          deletedProjectionCount,
          hasMore: expired.length === normalizedBatchSize,
        });
      });
      this.logger.info('Representative review projection retention cleanup completed', result);
      return result;
    } catch (error) {
      this.logger.error('Representative review projection retention cleanup failed', { error: error.message });
      return Object.freeze({ statusId: 'failed_rolled_back', deletedProjectionCount: 0 });
    }
  }
}

export const policyCandidateCorrectionRepresentativeReviewProjectionRetentionService =
  new PolicyCandidateCorrectionRepresentativeReviewProjectionRetentionService();

export {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_RETENTION_LOCK_KEY,
};
