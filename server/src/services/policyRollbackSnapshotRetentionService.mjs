/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  DEFAULT_POLICY_ROLLBACK_SNAPSHOT_RETENTION_BATCH_SIZE,
  POLICY_ROLLBACK_SNAPSHOT_RETENTION_RISK_IDS,
  POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS,
  buildPolicyRollbackSnapshotRetentionResult,
  buildRedactedRollbackSnapshotPayload,
  normalizeRetentionBatchSize,
  normalizeTimestamp,
} from './policyRollbackSnapshotRetentionContract.mjs';
import {
  findRollbackSnapshotAuditEvent,
  insertRollbackSnapshotRetentionEvent,
  lockExpiredRollbackSnapshotsForRetention,
  redactRollbackSnapshotPayload,
  tryLockPolicyRollbackSnapshotRetention,
} from './policyRollbackSnapshotRetentionPersistence.mjs';

const POLICY_ROLLBACK_SNAPSHOT_RETENTION_LOCK_KEY =
  defaultDb.DB_ADVISORY_LOCKS.POLICY_ROLLBACK_SNAPSHOT_RETENTION;

export class PolicyRollbackSnapshotRetentionService {
  constructor({
    db = defaultDb,
    logger = createLogger('PolicyRollbackSnapshotRetentionService'),
    lockKey = POLICY_ROLLBACK_SNAPSHOT_RETENTION_LOCK_KEY,
  } = {}) {
    this.db = db;
    this.logger = logger;
    this.lockKey = lockKey;
  }

  async cleanup({
    now = new Date(),
    batchSize = DEFAULT_POLICY_ROLLBACK_SNAPSHOT_RETENTION_BATCH_SIZE,
  } = {}) {
    const evaluatedAt = normalizeTimestamp(now);
    const normalizedBatchSize = normalizeRetentionBatchSize(batchSize);

    if (typeof this.db?.withTransaction !== 'function') {
      return buildPolicyRollbackSnapshotRetentionResult({
        statusId: POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS.TRANSACTION_BOUNDARY_REQUIRED,
        evaluatedAt,
        batchSize: normalizedBatchSize,
        riskId: POLICY_ROLLBACK_SNAPSHOT_RETENTION_RISK_IDS.TRANSACTION_BOUNDARY_REQUIRED,
        message: 'Rollback snapshot retention requires an atomic database transaction.',
      });
    }

    try {
      const result = await this.db.withTransaction(async client => {
        const acquired = await tryLockPolicyRollbackSnapshotRetention(client, this.lockKey);
        if (!acquired) {
          return buildPolicyRollbackSnapshotRetentionResult({
            statusId: POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS.CLEANUP_LOCKED,
            evaluatedAt,
            batchSize: normalizedBatchSize,
            riskId: POLICY_ROLLBACK_SNAPSHOT_RETENTION_RISK_IDS.CLEANUP_LOCK_NOT_ACQUIRED,
            message: 'Rollback snapshot retention is already running.',
          });
        }

        const snapshots = await lockExpiredRollbackSnapshotsForRetention({
          client,
          now: evaluatedAt.toISOString(),
          limit: normalizedBatchSize,
        });
        const redactedSnapshotIds = [];

        for (const snapshot of snapshots) {
          const sourceEvent = await findRollbackSnapshotAuditEvent({ client, snapshot });
          const marker = buildRedactedRollbackSnapshotPayload({
            snapshot,
            sourceEvent,
            now: evaluatedAt,
          });
          const redactedSnapshotId = await redactRollbackSnapshotPayload({
            client,
            snapshotId: snapshot.id,
            now: evaluatedAt.toISOString(),
            marker,
          });

          if (!redactedSnapshotId) {
            const error = new Error('Expired rollback snapshot payload was not redacted.');
            error.riskId = POLICY_ROLLBACK_SNAPSHOT_RETENTION_RISK_IDS.SNAPSHOT_REDACTION_NOT_APPLIED;
            throw error;
          }

          const eventId = await insertRollbackSnapshotRetentionEvent({
            client,
            snapshot,
            marker,
          });
          if (!eventId) {
            const error = new Error('Rollback snapshot retention audit event was not written.');
            error.riskId = POLICY_ROLLBACK_SNAPSHOT_RETENTION_RISK_IDS.AUDIT_EVENT_NOT_WRITTEN;
            throw error;
          }

          redactedSnapshotIds.push(redactedSnapshotId);
        }

        return buildPolicyRollbackSnapshotRetentionResult({
          statusId: POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS.COMPLETED,
          evaluatedAt,
          batchSize: normalizedBatchSize,
          redactedSnapshotIds,
          hasMore: snapshots.length === normalizedBatchSize,
        });
      });

      const logContext = {
        statusId: result.statusId,
        redactedSnapshotCount: result.redactedSnapshotCount,
        hasMore: result.hasMore,
      };
      if (result.statusId === POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS.COMPLETED) {
        const message = result.redactedSnapshotCount > 0
          ? 'Policy rollback snapshot retention cleanup completed'
          : 'Policy rollback snapshot retention cleanup found no expired payloads';
        this.logger.info(message, logContext);
      } else {
        this.logger.debug('Policy rollback snapshot retention cleanup skipped', logContext);
      }

      return result;
    } catch (error) {
      const riskId = error?.riskId || POLICY_ROLLBACK_SNAPSHOT_RETENTION_RISK_IDS.TRANSACTION_FAILED;
      this.logger.error('Policy rollback snapshot retention cleanup failed', {
        statusId: POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK,
        riskId,
      });
      return buildPolicyRollbackSnapshotRetentionResult({
        statusId: POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK,
        evaluatedAt,
        batchSize: normalizedBatchSize,
        riskId,
        message: 'Rollback snapshot retention failed and the transaction was rolled back.',
      });
    }
  }
}

export const policyRollbackSnapshotRetentionService =
  new PolicyRollbackSnapshotRetentionService();

export {
  POLICY_ROLLBACK_SNAPSHOT_RETENTION_RISK_IDS,
  POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS,
  POLICY_ROLLBACK_SNAPSHOT_RETENTION_LOCK_KEY,
};
