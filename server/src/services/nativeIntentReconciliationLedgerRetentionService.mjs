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
  NATIVE_INTENT_RECONCILIATION_OUTCOME_RETENTION_DAYS,
  NATIVE_INTENT_RECONCILIATION_RUN_RETENTION_DAYS,
  normalizeRetentionBatchSize,
  normalizeTimestamp,
} from './nativeIntentReconciliationLedgerContract.mjs';
import {
  deleteExpiredNativeIntentReconciliationOutcomes,
  deleteExpiredNativeIntentReconciliationRuns,
  tryLockNativeIntentReconciliationLedgerRetention,
} from './nativeIntentReconciliationLedgerPersistence.mjs';

const logger = createLogger('NativeIntentReconciliationLedgerRetentionService');

function cutoffFromDays(now, days) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return cutoff.toISOString();
}

export class NativeIntentReconciliationLedgerRetentionService {
  constructor({
    db = defaultDb,
    loggerInstance = logger,
    lockKey = defaultDb.DB_ADVISORY_LOCKS.NATIVE_INTENT_RECONCILIATION_LEDGER_RETENTION,
  } = {}) {
    this.db = db;
    this.logger = loggerInstance;
    this.lockKey = lockKey;
  }

  async cleanup({ now = new Date(), batchSize } = {}) {
    const evaluatedAt = normalizeTimestamp(now);
    const normalizedBatchSize = normalizeRetentionBatchSize(batchSize);

    if (typeof this.db?.withTransaction !== 'function') {
      return {
        statusId: 'transaction_boundary_required',
        evaluatedAt,
        outcomeDeletedCount: 0,
        runDeletedCount: 0,
        rawPayloadExposed: false,
      };
    }

    try {
      const result = await this.db.withTransaction(async client => {
        const acquired = await tryLockNativeIntentReconciliationLedgerRetention(
          client,
          this.lockKey,
        );
        if (!acquired) {
          return {
            statusId: 'cleanup_locked',
            evaluatedAt,
            outcomeDeletedCount: 0,
            runDeletedCount: 0,
            rawPayloadExposed: false,
          };
        }

        const outcomeIds = await deleteExpiredNativeIntentReconciliationOutcomes({
          client,
          cutoff: cutoffFromDays(evaluatedAt, NATIVE_INTENT_RECONCILIATION_OUTCOME_RETENTION_DAYS),
          limit: normalizedBatchSize,
        });
        const runIds = await deleteExpiredNativeIntentReconciliationRuns({
          client,
          cutoff: cutoffFromDays(evaluatedAt, NATIVE_INTENT_RECONCILIATION_RUN_RETENTION_DAYS),
          limit: normalizedBatchSize,
        });

        return {
          statusId: 'completed',
          evaluatedAt,
          outcomeDeletedCount: outcomeIds.length,
          runDeletedCount: runIds.length,
          rawPayloadExposed: false,
        };
      });

      this.logger.info('Native intent reconciliation ledger retention completed', result);
      return result;
    } catch {
      this.logger.error('Native intent reconciliation ledger retention failed', {
        statusId: 'failed_rolled_back',
      });
      return {
        statusId: 'failed_rolled_back',
        evaluatedAt,
        outcomeDeletedCount: 0,
        runDeletedCount: 0,
        rawPayloadExposed: false,
      };
    }
  }
}

export const nativeIntentReconciliationLedgerRetentionService =
  new NativeIntentReconciliationLedgerRetentionService();
