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
  POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_DAYS,
  POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_RISK_IDS,
  POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS,
  buildPolicyNativeIntentChangeReceiptRetentionResult,
  normalizeRetentionBatchSize,
  normalizeTimestamp,
} from './policyNativeIntentChangeReceiptRetentionContract.mjs';
import {
  deleteExpiredPolicyNativeIntentChangeReceipts,
  grantPolicyNativeIntentChangeReceiptRetentionPermit,
  loadPolicyNativeIntentChangeReceiptRetentionSummary,
  tryLockPolicyNativeIntentChangeReceiptRetention,
} from './policyNativeIntentChangeReceiptRetentionPersistence.mjs';

const POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_LOCK_KEY =
  defaultDb.DB_ADVISORY_LOCKS.POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION;

function cutoffFromDays(now, days) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return cutoff.toISOString();
}

export class PolicyNativeIntentChangeReceiptRetentionService {
  constructor({
    db = defaultDb,
    logger = createLogger('PolicyNativeIntentChangeReceiptRetentionService'),
    lockKey = POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_LOCK_KEY,
  } = {}) {
    this.db = db;
    this.logger = logger;
    this.lockKey = lockKey;
  }

  async cleanup({ now = new Date(), batchSize } = {}) {
    const evaluatedAt = normalizeTimestamp(now);
    const normalizedBatchSize = normalizeRetentionBatchSize(batchSize);
    const cutoff = cutoffFromDays(evaluatedAt, POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_DAYS);

    if (typeof this.db?.withTransaction !== 'function') {
      return buildPolicyNativeIntentChangeReceiptRetentionResult({
        statusId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS
          .TRANSACTION_BOUNDARY_REQUIRED,
        evaluatedAt,
        batchSize: normalizedBatchSize,
        riskId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_RISK_IDS
          .TRANSACTION_BOUNDARY_REQUIRED,
      });
    }

    try {
      const result = await this.db.withTransaction(async client => {
        const acquired = await tryLockPolicyNativeIntentChangeReceiptRetention(client, this.lockKey);
        if (!acquired) {
          return buildPolicyNativeIntentChangeReceiptRetentionResult({
            statusId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS.CLEANUP_LOCKED,
            evaluatedAt,
            batchSize: normalizedBatchSize,
            riskId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_RISK_IDS
              .CLEANUP_LOCK_NOT_ACQUIRED,
          });
        }

        const before = await loadPolicyNativeIntentChangeReceiptRetentionSummary({ client, cutoff });
        let deletedReceiptCount = 0;
        if (before.expiredReceiptCount > 0) {
          await grantPolicyNativeIntentChangeReceiptRetentionPermit(client);
          deletedReceiptCount = await deleteExpiredPolicyNativeIntentChangeReceipts({
            client,
            cutoff,
            limit: normalizedBatchSize,
          });
        }

        const after = deletedReceiptCount > 0
          ? await loadPolicyNativeIntentChangeReceiptRetentionSummary({ client, cutoff })
          : before;

        return buildPolicyNativeIntentChangeReceiptRetentionResult({
          statusId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS.COMPLETED,
          evaluatedAt,
          batchSize: normalizedBatchSize,
          totalReceiptCount: after.totalReceiptCount,
          expiredReceiptCount: after.expiredReceiptCount,
          deletedReceiptCount,
          hasMore: after.expiredReceiptCount > 0,
        });
      });

      const logContext = {
        statusId: result.statusId,
        totalReceiptCount: result.totalReceiptCount,
        expiredReceiptCount: result.expiredReceiptCount,
        deletedReceiptCount: result.deletedReceiptCount,
        hasMore: result.hasMore,
        capacityStateId: result.capacity.stateId,
      };
      if (result.statusId !== POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS.COMPLETED) {
        this.logger.debug('Native intent change receipt retention cleanup skipped', logContext);
      } else if (result.capacity.stateId !== 'within_capacity') {
        this.logger.warn('Native intent change receipt capacity pressure remains protected', logContext);
      } else if (result.deletedReceiptCount > 0) {
        this.logger.info('Native intent change receipt retention cleanup completed', logContext);
      } else {
        this.logger.debug('Native intent change receipt retention cleanup found no expired receipts', logContext);
      }
      return result;
    } catch {
      this.logger.error('Native intent change receipt retention cleanup failed', {
        statusId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK,
        riskId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_RISK_IDS.TRANSACTION_FAILED,
      });
      return buildPolicyNativeIntentChangeReceiptRetentionResult({
        statusId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK,
        evaluatedAt,
        batchSize: normalizedBatchSize,
        riskId: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_RISK_IDS.TRANSACTION_FAILED,
      });
    }
  }
}

export const policyNativeIntentChangeReceiptRetentionService =
  new PolicyNativeIntentChangeReceiptRetentionService();

export {
  POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_LOCK_KEY,
};
