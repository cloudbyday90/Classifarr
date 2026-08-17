/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_VERSION =
  'policy.native_intent_change_receipt_retention.v1';
export const POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_DAYS = 30;
export const POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_BATCH_SIZE = 100;
export const MAX_POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_BATCH_SIZE = 500;
export const POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_WARNING_ROWS = 10_000;
export const POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_CRITICAL_ROWS = 25_000;

export const POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS = Object.freeze({
  COMPLETED: 'completed',
  CLEANUP_LOCKED: 'cleanup_locked',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  FAILED_ROLLED_BACK: 'failed_rolled_back',
});

export const POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_RISK_IDS = Object.freeze({
  CLEANUP_LOCK_NOT_ACQUIRED: 'cleanup_lock_not_acquired',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  TRANSACTION_FAILED: 'transaction_failed',
});

export const POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_STATE_IDS = Object.freeze({
  WITHIN_CAPACITY: 'within_capacity',
  WARNING: 'capacity_warning',
  CRITICAL: 'capacity_critical',
});

function normalizePositiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

export function normalizeRetentionBatchSize(value) {
  return Math.min(
    MAX_POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_BATCH_SIZE,
    normalizePositiveInteger(value, POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_BATCH_SIZE),
  );
}

export function normalizeTimestamp(value, fallback = new Date()) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? fallback : timestamp;
}

export function normalizeReceiptCount(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
}

export function getPolicyNativeIntentChangeReceiptCapacityState(totalReceiptCount) {
  const count = normalizeReceiptCount(totalReceiptCount);
  if (count >= POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_CRITICAL_ROWS) {
    return POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_STATE_IDS.CRITICAL;
  }
  if (count >= POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_WARNING_ROWS) {
    return POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_STATE_IDS.WARNING;
  }
  return POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_STATE_IDS.WITHIN_CAPACITY;
}

export function buildPolicyNativeIntentChangeReceiptRetentionResult({
  statusId,
  evaluatedAt = new Date(),
  batchSize = POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_BATCH_SIZE,
  totalReceiptCount = 0,
  expiredReceiptCount = 0,
  deletedReceiptCount = 0,
  hasMore = false,
  riskId = null,
} = {}) {
  const knownStatusId = Object.values(POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS)
    .includes(statusId)
    ? statusId
    : POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK;
  const normalizedTotalReceiptCount = normalizeReceiptCount(totalReceiptCount);
  const normalizedExpiredReceiptCount = normalizeReceiptCount(expiredReceiptCount);
  const normalizedDeletedReceiptCount = normalizeReceiptCount(deletedReceiptCount);

  return {
    version: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_VERSION,
    statusId: knownStatusId,
    evaluatedAt: normalizeTimestamp(evaluatedAt).toISOString(),
    replayRetentionDays: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RETENTION_DAYS,
    batchSize: normalizeRetentionBatchSize(batchSize),
    totalReceiptCount: normalizedTotalReceiptCount,
    expiredReceiptCount: normalizedExpiredReceiptCount,
    deletedReceiptCount: normalizedDeletedReceiptCount,
    hasMore: hasMore === true,
    capacity: {
      stateId: getPolicyNativeIntentChangeReceiptCapacityState(normalizedTotalReceiptCount),
      warningThreshold: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_WARNING_ROWS,
      criticalThreshold: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_CAPACITY_CRITICAL_ROWS,
    },
    receiptIdsExposed: false,
    receiptHistoryExposed: false,
    idempotencyKeysExposed: false,
    commandValuesExposed: false,
    policyAuthorityChanged: false,
    routingChanged: false,
    aiInvoked: false,
    reason: riskId ? { reasonId: riskId } : null,
  };
}
