/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { NotFoundError, ValidationError } from '../utils/appError.mjs';
import {
  HISTORIC_ROUTE_SAFETY_REFRESH_RECEIPT_ITEM_STATUS_IDS,
  HISTORIC_ROUTE_SAFETY_REFRESH_RECONCILIATION_STATUS_IDS,
  POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_RECONCILIATION_VERSION,
  isHistoricRouteSafetyRefreshReceiptId,
} from './policyRuntimeHistoricRouteSafetyRefreshReceiptContract.mjs';
import {
  isHistoricRouteSafetyRefreshActorId,
} from './policyRuntimeHistoricRouteSafetyRefreshActorIdentity.mjs';

const {
  REQUESTED,
  QUEUED,
  SKIPPED,
  FAILED,
} = HISTORIC_ROUTE_SAFETY_REFRESH_RECEIPT_ITEM_STATUS_IDS;
const STATUS = HISTORIC_ROUTE_SAFETY_REFRESH_RECONCILIATION_STATUS_IDS;

const RUNTIME_STATUS_MAP = new Map([
  ['awaiting_decision', STATUS.RUNTIME_AWAITING_DECISION],
  ['pending', STATUS.RUNTIME_PENDING],
  ['pending_retry', STATUS.RUNTIME_PENDING_RETRY],
  ['reclassified', STATUS.RUNTIME_RECLASSIFYING],
  ['completed', STATUS.RUNTIME_COMPLETED],
  ['corrected', STATUS.RUNTIME_CORRECTED],
  ['verified', STATUS.RUNTIME_VERIFIED],
  ['routed', STATUS.RUNTIME_ROUTED],
  ['failed', STATUS.RUNTIME_FAILED],
]);

const QUEUE_STATUS_MAP = new Map([
  ['pending', STATUS.QUEUE_PENDING],
  ['processing', STATUS.QUEUE_PROCESSING],
  ['failed', STATUS.QUEUE_FAILED],
  ['cancelled', STATUS.QUEUE_CANCELLED],
]);

const FINAL_RUNTIME_STATUS_IDS = new Set([
  STATUS.RUNTIME_COMPLETED,
  STATUS.RUNTIME_CORRECTED,
  STATUS.RUNTIME_VERIFIED,
  STATUS.RUNTIME_ROUTED,
]);

function asPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function asIsoTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;

  seen.add(value);
  Object.values(value).forEach(child => deepFreeze(child, seen));
  return Object.freeze(value);
}

export function deriveHistoricRouteSafetyRefreshReconciliationStatus(item = {}) {
  if (item.execution_status === REQUESTED) return STATUS.EXECUTION_INCOMPLETE;
  if (item.execution_status === SKIPPED) return STATUS.NOT_QUEUED;
  if (item.execution_status === FAILED) return STATUS.RETRY_FAILED;
  if (item.execution_status !== QUEUED) return STATUS.EXECUTION_INCOMPLETE;

  const runtimeStatus = RUNTIME_STATUS_MAP.get(item.runtime_status);
  const runtimeDepth = Number(item.lineage_depth);
  if (runtimeStatus && (runtimeDepth > 0 || item.source_status !== 'reclassified')) {
    return runtimeStatus;
  }

  const queueStatus = QUEUE_STATUS_MAP.get(item.queue_status);
  if (queueStatus) return queueStatus;
  if (item.source_record_found !== true) return STATUS.SOURCE_RECORD_UNAVAILABLE;
  if (item.queue_status === 'completed') return STATUS.CURRENT_RUNTIME_NOT_OBSERVED;
  if (runtimeStatus) return runtimeStatus;
  if (item.runtime_classification_id) return STATUS.RUNTIME_STATE_UNKNOWN;
  return STATUS.CURRENT_RUNTIME_NOT_OBSERVED;
}

function summarizeRecords(records) {
  return records.reduce((summary, record) => {
    summary[record.executionStatusId] += 1;
    if (record.reconciliationStatusId === STATUS.EXECUTION_INCOMPLETE) {
      summary.executionIncomplete += 1;
    } else if (record.reconciliationStatusId === STATUS.RETRY_FAILED) {
      summary.runtimeFailed += 1;
    } else if (FINAL_RUNTIME_STATUS_IDS.has(record.reconciliationStatusId)) {
      summary.runtimeFinal += 1;
    } else if (record.reconciliationStatusId === STATUS.NOT_QUEUED) {
      summary.notQueued += 1;
    } else if (
      record.reconciliationStatusId === STATUS.QUEUE_FAILED ||
      record.reconciliationStatusId === STATUS.QUEUE_CANCELLED ||
      record.reconciliationStatusId === STATUS.RUNTIME_FAILED
    ) {
      summary.runtimeFailed += 1;
    } else if (
      record.reconciliationStatusId === STATUS.QUEUE_PENDING ||
      record.reconciliationStatusId === STATUS.QUEUE_PROCESSING ||
      record.reconciliationStatusId === STATUS.RUNTIME_AWAITING_DECISION ||
      record.reconciliationStatusId === STATUS.RUNTIME_PENDING ||
      record.reconciliationStatusId === STATUS.RUNTIME_PENDING_RETRY ||
      record.reconciliationStatusId === STATUS.RUNTIME_RECLASSIFYING
    ) {
      summary.runtimePending += 1;
    } else {
      summary.runtimeUnavailable += 1;
    }
    return summary;
  }, {
    [REQUESTED]: 0,
    [QUEUED]: 0,
    [SKIPPED]: 0,
    [FAILED]: 0,
    executionIncomplete: 0,
    notQueued: 0,
    runtimePending: 0,
    runtimeFinal: 0,
    runtimeFailed: 0,
    runtimeUnavailable: 0,
  });
}

export function buildHistoricRouteSafetyRefreshReceiptReconciliationReport({
  receipt = {},
  items = [],
} = {}) {
  const records = (Array.isArray(items) ? items : []).map((item) => ({
    classificationId: asPositiveInteger(item.classification_id),
    executionStatusId: item.execution_status,
    executionReasonId: item.reason_id || null,
    reconciliationStatusId: deriveHistoricRouteSafetyRefreshReconciliationStatus(item),
  }));
  const summary = summarizeRecords(records);
  const requestedRecordCount = asPositiveInteger(receipt.requested_record_count) || records.length;
  const executionFinalizedAt = asIsoTimestamp(receipt.execution_finalized_at);

  return deepFreeze({
    version: POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_RECONCILIATION_VERSION,
    mode: 'read_only',
    receipt: {
      retryReceipt: receipt.receipt_id,
      createdAt: asIsoTimestamp(receipt.created_at),
      executionFinalizedAt,
      executionStatusId: executionFinalizedAt ? 'finalized' : 'incomplete',
      requestedRecordCount,
    },
    records,
    summary,
    sideEffects: {
      classificationRowsMutated: false,
      retryCommandsExecuted: false,
      routesExecuted: false,
      learningWritten: false,
    },
  });
}

export class PolicyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService {
  constructor({ db, receiptRepository } = {}) {
    if (!db || typeof db.withTransaction !== 'function') {
      throw new TypeError('Historic route-safety refresh receipt reconciliation requires a transaction-capable database.');
    }
    if (typeof receiptRepository?.loadReceipt !== 'function') {
      throw new TypeError('Historic route-safety refresh receipt reconciliation requires a receipt repository.');
    }

    this.db = db;
    this.receiptRepository = receiptRepository;
  }

  async run({ receiptId, actorId } = {}) {
    if (!isHistoricRouteSafetyRefreshReceiptId(receiptId)) {
      throw new ValidationError('retryReceipt must be a canonical UUID.');
    }
    if (!isHistoricRouteSafetyRefreshActorId(actorId)) {
      throw new ValidationError('Historic route-safety refresh receipt actor identity is invalid.');
    }

    return this.db.withTransaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const { receipt, items } = await this.receiptRepository.loadReceipt(client, { receiptId, actorId });
      if (!receipt) {
        throw new NotFoundError('Historic route-safety refresh receipt was not found.', {
          code: 'historic_route_safety_refresh_receipt_not_found',
        });
      }

      return buildHistoricRouteSafetyRefreshReceiptReconciliationReport({ receipt, items });
    });
  }
}
