/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_RECEIPT_VERSION =
  'policy.runtime_historic_route_safety_refresh_receipt.v1';

export const POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_RECONCILIATION_VERSION =
  'policy.runtime_historic_route_safety_refresh_reconciliation.v1';

export const POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_RECENT_RECEIPT_DISCOVERY_VERSION =
  'policy.runtime_historic_route_safety_refresh_recent_receipt_discovery.v1';

export const POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_RECENT_RECEIPT_MAX_AGE_SECONDS = 3600;

export const HISTORIC_ROUTE_SAFETY_REFRESH_RECEIPT_ITEM_STATUS_IDS = Object.freeze({
  REQUESTED: 'requested',
  QUEUED: 'queued',
  SKIPPED: 'skipped',
  FAILED: 'failed',
});

export const HISTORIC_ROUTE_SAFETY_REFRESH_RECONCILIATION_STATUS_IDS = Object.freeze({
  EXECUTION_INCOMPLETE: 'execution_incomplete',
  NOT_QUEUED: 'not_queued',
  RETRY_FAILED: 'retry_failed',
  QUEUE_PENDING: 'queue_pending',
  QUEUE_PROCESSING: 'queue_processing',
  QUEUE_FAILED: 'queue_failed',
  QUEUE_CANCELLED: 'queue_cancelled',
  RUNTIME_AWAITING_DECISION: 'runtime_awaiting_decision',
  RUNTIME_PENDING: 'runtime_pending',
  RUNTIME_PENDING_RETRY: 'runtime_pending_retry',
  RUNTIME_RECLASSIFYING: 'runtime_reclassifying',
  RUNTIME_COMPLETED: 'runtime_completed',
  RUNTIME_CORRECTED: 'runtime_corrected',
  RUNTIME_VERIFIED: 'runtime_verified',
  RUNTIME_ROUTED: 'runtime_routed',
  RUNTIME_FAILED: 'runtime_failed',
  CURRENT_RUNTIME_NOT_OBSERVED: 'current_runtime_not_observed',
  SOURCE_RECORD_UNAVAILABLE: 'source_record_unavailable',
  RUNTIME_STATE_UNKNOWN: 'runtime_state_unknown',
});

const RECEIPT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isHistoricRouteSafetyRefreshReceiptId(value) {
  return typeof value === 'string' && RECEIPT_ID_PATTERN.test(value.trim());
}
