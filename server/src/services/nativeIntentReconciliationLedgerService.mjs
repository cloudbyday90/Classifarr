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
  buildNativeIntentReconciliationLedgerRecord,
  normalizeTimestamp,
} from './nativeIntentReconciliationLedgerContract.mjs';
import {
  insertNativeIntentReconciliationOutcome,
  insertNativeIntentReconciliationRun,
} from './nativeIntentReconciliationLedgerPersistence.mjs';

const logger = createLogger('NativeIntentReconciliationLedgerService');

export class NativeIntentReconciliationLedgerService {
  constructor({
    db = defaultDb,
    loggerInstance = logger,
    now = () => new Date(),
    buildRecord = buildNativeIntentReconciliationLedgerRecord,
  } = {}) {
    this.db = db;
    this.logger = loggerInstance;
    this.now = now;
    this.buildRecord = buildRecord;
  }

  async record({ applyGate, startedAt, finishedAt = this.now() } = {}) {
    if (typeof this.db?.withTransaction !== 'function') {
      throw new TypeError('Native intent reconciliation ledger requires a transaction boundary.');
    }

    const record = this.buildRecord({
      applyGate,
      startedAt,
      finishedAt: normalizeTimestamp(finishedAt),
    });

    const persisted = await this.db.withTransaction(async client => {
      const runId = await insertNativeIntentReconciliationRun({ client, run: record.run });
      if (!runId) {
        throw new Error('Native intent reconciliation ledger run was not written.');
      }

      for (const outcome of record.outcomes) {
        await insertNativeIntentReconciliationOutcome({
          client,
          runId,
          outcome,
          evaluatedAt: record.run.finishedAt,
        });
      }

      return { runId };
    });

    const result = {
      statusId: 'persisted',
      runId: persisted.runId,
      runState: record.run.runState,
      reasonId: record.run.reasonId,
      counts: {
        candidateCount: record.run.candidateCount,
        convertedCount: record.run.convertedCount,
        alreadyNativeCount: record.run.alreadyNativeCount,
        deferredCount: record.run.deferredCount,
        blockedCount: record.run.blockedCount,
        failedCount: record.run.failedCount,
      },
      rawPayloadExposed: false,
    };

    this.logger.info('Native intent reconciliation ledger persisted', {
      runId: result.runId,
      runState: result.runState,
      reasonId: result.reasonId,
      counts: result.counts,
    });

    return result;
  }
}

export const nativeIntentReconciliationLedgerService =
  new NativeIntentReconciliationLedgerService();
