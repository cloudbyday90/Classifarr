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
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_AUDIT_ACTION_IDS,
} from './policyCandidateCorrectionRepresentativeReviewCorpusCaptureContract.mjs';
import {
  deletePolicyCandidateCorrectionRepresentativeReviewCorpusCapture,
  insertPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureAuditEvent,
  lockExpiredPolicyCandidateCorrectionRepresentativeReviewCorpusCaptures,
  tryLockPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetention,
} from './policyCandidateCorrectionRepresentativeReviewCorpusCapturePersistence.mjs';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_RETENTION_BATCH_SIZE = 100;
const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_RETENTION_LOCK_KEY =
  defaultDb.DB_ADVISORY_LOCKS.POLICY_CANDIDATE_CORRECTION_REVIEW_CORPUS_CAPTURE_RETENTION;

function normalizeNow(value) {
  const now = value instanceof Date ? value : new Date(value);
  return Number.isNaN(now.getTime()) ? new Date() : now;
}

function normalizeBatchSize(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 && numeric <= 1000
    ? numeric
    : POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_RETENTION_BATCH_SIZE;
}

export class PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionService {
  constructor({
    db = defaultDb,
    logger = createLogger('PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionService'),
    lockKey = POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_RETENTION_LOCK_KEY,
    persistence = {
      tryLock: tryLockPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetention,
      lockExpired: lockExpiredPolicyCandidateCorrectionRepresentativeReviewCorpusCaptures,
      deleteCapture: deletePolicyCandidateCorrectionRepresentativeReviewCorpusCapture,
      insertAuditEvent: insertPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureAuditEvent,
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
      return Object.freeze({ statusId: 'transaction_boundary_required', deletedCaptureCount: 0 });
    }

    try {
      const result = await this.db.withTransaction(async client => {
        const acquired = await this.persistence.tryLock({ client, lockKey: this.lockKey });
        if (!acquired) return Object.freeze({ statusId: 'cleanup_locked', deletedCaptureCount: 0 });

        const expired = await this.persistence.lockExpired({
          client,
          now: evaluatedAt.toISOString(),
          limit: normalizedBatchSize,
        });
        let deletedCaptureCount = 0;
        for (const capture of expired) {
          const deleted = await this.persistence.deleteCapture({
            client,
            captureId: capture.capture_id,
          });
          if (!deleted) throw new Error('Expired review-corpus capture was not deleted.');

          await this.persistence.insertAuditEvent({
            client,
            event: {
              actionId: POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_AUDIT_ACTION_IDS.CAPTURE_EXPIRED,
              actorId: null,
              captureId: capture.capture_id,
              captureRecordedAt: capture.captured_at,
              configurationRevision: capture.configuration_revision,
              occurredAt: evaluatedAt.toISOString(),
            },
          });
          deletedCaptureCount += 1;
        }

        return Object.freeze({
          statusId: 'completed',
          deletedCaptureCount,
          hasMore: expired.length === normalizedBatchSize,
        });
      });
      this.logger.info('Representative review-corpus capture retention cleanup completed', result);
      return result;
    } catch (error) {
      this.logger.error('Representative review-corpus capture retention cleanup failed', {
        error: error.message,
      });
      return Object.freeze({ statusId: 'failed_rolled_back', deletedCaptureCount: 0 });
    }
  }
}

export const policyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionService =
  new PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionService();

export {
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_RETENTION_LOCK_KEY,
};
