/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


import {
  DATABASE_HEALTH_TRANSITION_CONFIRMATION_OBSERVATION_COUNT,
  getDatabaseHealthTransitionResetAt,
  normalizeStoredDatabaseHealthTransitionState,
  projectDatabaseHealthTransitionBucketState,
} from './databaseHealthTransitionState.mjs';
export const DATABASE_HEALTH_TRANSITION_RECEIPT_VERSION =
  'database.health_transition_receipt.v1';
export const DATABASE_HEALTH_TRANSITION_RECEIPT_SUMMARY_VERSION =
  'database.health_transition_receipt_summary.v1';

const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;

function toIsoTimestamp(value, message) {
  if (!value) throw new TypeError(message);
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw new TypeError(message);
  return timestamp.toISOString();
}

function normalizeReceiptId(value) {
  const receiptId = String(value ?? '').trim();
  if (!POSITIVE_INTEGER_PATTERN.test(receiptId)) {
    throw new TypeError('Database health transition receipt ID is invalid.');
  }
  return receiptId;
}

function normalizeReceiptVersion(value) {
  if (Number(value) !== 1) {
    throw new TypeError('Database health transition receipt version is invalid.');
  }
  return DATABASE_HEALTH_TRANSITION_RECEIPT_VERSION;
}

function toStoredState(row, prefix) {
  return normalizeStoredDatabaseHealthTransitionState({
    statistics_reset_at: row?.statistics_reset_at,
    stable_read_operations: row?.[`${prefix}_read_operations`],
    stable_write_operations: row?.[`${prefix}_write_operations`],
    stable_cache_hits: row?.[`${prefix}_cache_hits`],
    stable_estimated_dead_tuples: row?.[`${prefix}_estimated_dead_tuples`],
    stable_tables_with_dead_tuples: row?.[`${prefix}_tables_with_dead_tuples`],
    pending_observation_count: 0,
  }).stable;
}

/**
 * Projects a trusted row from the append-only receipt table. This deliberately
 * keeps receipt provenance limited to reset time, coarse before/after states,
 * a fixed confirmation count, and record time.
 */
export function projectDatabaseHealthTransitionReceipt(row = {}) {
  const confirmationObservationCount = Number(
    row.confirmation_observation_count ?? row.confirmationObservationCount,
  );
  if (confirmationObservationCount !== DATABASE_HEALTH_TRANSITION_CONFIRMATION_OBSERVATION_COUNT) {
    throw new TypeError('Database health transition receipt confirmation is invalid.');
  }

  const statisticsResetAt = getDatabaseHealthTransitionResetAt({
    statisticsResetAt: row.statistics_reset_at ?? row.statisticsResetAt,
  });
  if (!statisticsResetAt) {
    throw new TypeError('Database health transition receipt reset timestamp is invalid.');
  }

  return Object.freeze({
    receiptId: normalizeReceiptId(row.id ?? row.receiptId),
    version: normalizeReceiptVersion(row.receipt_version ?? row.receiptVersion),
    statisticsResetAt,
    before: projectDatabaseHealthTransitionBucketState(toStoredState(row, 'before')),
    after: projectDatabaseHealthTransitionBucketState(toStoredState(row, 'after')),
    confirmationObservationCount,
    recordedAt: toIsoTimestamp(row.recorded_at ?? row.recordedAt, 'Database health transition receipt timestamp is invalid.'),
  });
}

export function buildDatabaseHealthTransitionReceiptSummary(row = null) {
  if (!row) {
    return Object.freeze({
      version: DATABASE_HEALTH_TRANSITION_RECEIPT_SUMMARY_VERSION,
      status: Object.freeze({ id: 'no_persistent_transition' }),
      receipt: null,
      sideEffects: Object.freeze({
        maintenanceScheduled: false,
        configurationChanged: false,
        policyChanged: false,
        aiChanged: false,
        semanticSelectionChanged: false,
        labelChanged: false,
        routingChanged: false,
      }),
    });
  }

  return Object.freeze({
    version: DATABASE_HEALTH_TRANSITION_RECEIPT_SUMMARY_VERSION,
    status: Object.freeze({ id: 'persistent_transition_recorded' }),
    receipt: projectDatabaseHealthTransitionReceipt(row),
    sideEffects: Object.freeze({
      maintenanceScheduled: false,
      configurationChanged: false,
      policyChanged: false,
      aiChanged: false,
      semanticSelectionChanged: false,
      labelChanged: false,
      routingChanged: false,
    }),
  });
}
