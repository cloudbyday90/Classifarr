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
  DEFAULT_POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_BATCH_SIZE,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_RISK_IDS,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS,
  buildObservedEvidenceProvenanceRetentionResult,
  buildRedactedObservedEvidenceProvenancePayload,
  normalizeRetentionBatchSize,
  normalizeTimestamp,
} from './policyObservedEvidenceProvenanceRetentionContract.mjs';
import {
  lockExpiredObservedEvidenceProvenanceSnapshots,
  redactObservedEvidenceProvenanceSnapshot,
  tryLockObservedEvidenceProvenanceRetention,
} from './policyObservedEvidenceProvenanceRetentionPersistence.mjs';

const POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_LOCK_KEY =
  defaultDb.DB_ADVISORY_LOCKS.POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION;

export class PolicyObservedEvidenceProvenanceRetentionService {
  constructor({
    db = defaultDb,
    logger = createLogger('PolicyObservedEvidenceProvenanceRetentionService'),
    lockKey = POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_LOCK_KEY,
  } = {}) {
    this.db = db;
    this.logger = logger;
    this.lockKey = lockKey;
  }

  async cleanup({
    now = new Date(),
    batchSize = DEFAULT_POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_BATCH_SIZE,
  } = {}) {
    const evaluatedAt = normalizeTimestamp(now);
    const normalizedBatchSize = normalizeRetentionBatchSize(batchSize);

    if (typeof this.db?.withTransaction !== 'function') {
      return buildObservedEvidenceProvenanceRetentionResult({
        statusId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS.TRANSACTION_BOUNDARY_REQUIRED,
        evaluatedAt,
        batchSize: normalizedBatchSize,
        riskId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_RISK_IDS.TRANSACTION_BOUNDARY_REQUIRED,
        message: 'Observed evidence provenance retention requires an atomic database transaction.',
      });
    }

    try {
      const result = await this.db.withTransaction(async client => {
        const acquired = await tryLockObservedEvidenceProvenanceRetention(client, this.lockKey);
        if (!acquired) {
          return buildObservedEvidenceProvenanceRetentionResult({
            statusId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS.CLEANUP_LOCKED,
            evaluatedAt,
            batchSize: normalizedBatchSize,
            riskId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_RISK_IDS.CLEANUP_LOCK_NOT_ACQUIRED,
            message: 'Observed evidence provenance retention is already running.',
          });
        }

        const snapshots = await lockExpiredObservedEvidenceProvenanceSnapshots({
          client,
          now: evaluatedAt.toISOString(),
          limit: normalizedBatchSize,
        });
        const redactedSnapshotIds = [];

        for (const snapshot of snapshots) {
          const marker = buildRedactedObservedEvidenceProvenancePayload({
            snapshot,
            now: evaluatedAt,
          });
          const redactedSnapshotId = await redactObservedEvidenceProvenanceSnapshot({
            client,
            snapshotId: snapshot.id,
            now: evaluatedAt.toISOString(),
            marker,
          });

          if (!redactedSnapshotId) {
            const error = new Error('Expired observed evidence provenance payload was not redacted.');
            error.riskId = POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_RISK_IDS
              .SNAPSHOT_REDACTION_NOT_APPLIED;
            throw error;
          }

          redactedSnapshotIds.push(redactedSnapshotId);
        }

        return buildObservedEvidenceProvenanceRetentionResult({
          statusId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS.COMPLETED,
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
      if (result.statusId === POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS.COMPLETED) {
        this.logger.info(
          result.redactedSnapshotCount > 0
            ? 'Observed evidence provenance retention cleanup completed'
            : 'Observed evidence provenance retention cleanup found no expired payloads',
          logContext
        );
      } else {
        this.logger.debug('Observed evidence provenance retention cleanup skipped', logContext);
      }

      return result;
    } catch (error) {
      const riskId = error?.riskId ||
        POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_RISK_IDS.TRANSACTION_FAILED;
      this.logger.error('Observed evidence provenance retention cleanup failed', {
        statusId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK,
        riskId,
      });
      return buildObservedEvidenceProvenanceRetentionResult({
        statusId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK,
        evaluatedAt,
        batchSize: normalizedBatchSize,
        riskId,
        message: 'Observed evidence provenance retention failed and the transaction was rolled back.',
      });
    }
  }
}

export const policyObservedEvidenceProvenanceRetentionService =
  new PolicyObservedEvidenceProvenanceRetentionService();

export {
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_LOCK_KEY,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_RISK_IDS,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS,
};
