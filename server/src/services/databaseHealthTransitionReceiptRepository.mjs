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

const STATE_COLUMNS = Object.freeze([
  'readOperations',
  'writeOperations',
  'cacheHits',
  'estimatedDeadTuples',
  'tablesWithDeadTuples',
]);

function assertClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Database health transition receipt repository requires a query-capable client.');
  }
}

function stateValues(state) {
  if (!state || STATE_COLUMNS.some(column => typeof state[column] !== 'string')) {
    throw new TypeError('Database health transition receipt state is invalid.');
  }
  return STATE_COLUMNS.map(column => state[column]);
}

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

export async function lockDatabaseHealthTransitionState(client) {
  assertClient(client);
  const result = await client.query(`
    SELECT
      statistics_reset_at,
      stable_read_operations,
      stable_write_operations,
      stable_cache_hits,
      stable_estimated_dead_tuples,
      stable_tables_with_dead_tuples,
      pending_read_operations,
      pending_write_operations,
      pending_cache_hits,
      pending_estimated_dead_tuples,
      pending_tables_with_dead_tuples,
      pending_observation_count
    FROM database_health_transition_state
    WHERE singleton = 1
    FOR UPDATE
  `);
  return firstRow(result);
}

export async function insertDatabaseHealthTransitionBaseline(client, {
  statisticsResetAt,
  state,
} = {}) {
  assertClient(client);
  const result = await client.query(`
    INSERT INTO database_health_transition_state (
      singleton,
      statistics_reset_at,
      stable_read_operations,
      stable_write_operations,
      stable_cache_hits,
      stable_estimated_dead_tuples,
      stable_tables_with_dead_tuples
    )
    VALUES (1, $1::timestamptz, $2, $3, $4, $5, $6)
    ON CONFLICT (singleton) DO NOTHING
    RETURNING singleton
  `, [statisticsResetAt, ...stateValues(state)]);
  if (result.rowCount !== 1) {
    throw new Error('Database health transition baseline was concurrently initialized.');
  }
}

export async function replaceDatabaseHealthTransitionBaseline(client, {
  statisticsResetAt,
  state,
} = {}) {
  assertClient(client);
  const result = await client.query(`
    UPDATE database_health_transition_state
    SET statistics_reset_at = $1::timestamptz,
        stable_read_operations = $2,
        stable_write_operations = $3,
        stable_cache_hits = $4,
        stable_estimated_dead_tuples = $5,
        stable_tables_with_dead_tuples = $6,
        pending_read_operations = NULL,
        pending_write_operations = NULL,
        pending_cache_hits = NULL,
        pending_estimated_dead_tuples = NULL,
        pending_tables_with_dead_tuples = NULL,
        pending_observation_count = 0,
        updated_at = NOW()
    WHERE singleton = 1
    RETURNING singleton
  `, [statisticsResetAt, ...stateValues(state)]);
  if (result.rowCount !== 1) {
    throw new Error('Database health transition baseline reset did not find state.');
  }
}

export async function setDatabaseHealthTransitionPendingObservation(client, { state } = {}) {
  assertClient(client);
  const result = await client.query(`
    UPDATE database_health_transition_state
    SET pending_read_operations = $1,
        pending_write_operations = $2,
        pending_cache_hits = $3,
        pending_estimated_dead_tuples = $4,
        pending_tables_with_dead_tuples = $5,
        pending_observation_count = 1,
        updated_at = NOW()
    WHERE singleton = 1
    RETURNING singleton
  `, stateValues(state));
  if (result.rowCount !== 1) {
    throw new Error('Database health transition pending observation did not find state.');
  }
}

export async function clearDatabaseHealthTransitionPendingObservation(client) {
  assertClient(client);
  const result = await client.query(`
    UPDATE database_health_transition_state
    SET pending_read_operations = NULL,
        pending_write_operations = NULL,
        pending_cache_hits = NULL,
        pending_estimated_dead_tuples = NULL,
        pending_tables_with_dead_tuples = NULL,
        pending_observation_count = 0,
        updated_at = NOW()
    WHERE singleton = 1
    RETURNING singleton
  `);
  if (result.rowCount !== 1) {
    throw new Error('Database health transition pending state did not find state.');
  }
}

export async function recordConfirmedDatabaseHealthTransition(client, {
  statisticsResetAt,
  before,
  after,
  confirmationObservationCount,
} = {}) {
  assertClient(client);
  const receiptResult = await client.query(`
    INSERT INTO database_health_transition_receipts (
      statistics_reset_at,
      before_read_operations,
      before_write_operations,
      before_cache_hits,
      before_estimated_dead_tuples,
      before_tables_with_dead_tuples,
      after_read_operations,
      after_write_operations,
      after_cache_hits,
      after_estimated_dead_tuples,
      after_tables_with_dead_tuples,
      confirmation_observation_count
    )
    VALUES ($1::timestamptz, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING
      id,
      receipt_version,
      statistics_reset_at,
      before_read_operations,
      before_write_operations,
      before_cache_hits,
      before_estimated_dead_tuples,
      before_tables_with_dead_tuples,
      after_read_operations,
      after_write_operations,
      after_cache_hits,
      after_estimated_dead_tuples,
      after_tables_with_dead_tuples,
      confirmation_observation_count,
      recorded_at
  `, [
    statisticsResetAt,
    ...stateValues(before),
    ...stateValues(after),
    confirmationObservationCount,
  ]);
  const receipt = firstRow(receiptResult);
  if (!receipt) {
    throw new Error('Database health transition receipt was not recorded.');
  }

  const stateResult = await client.query(`
    UPDATE database_health_transition_state
    SET stable_read_operations = $1,
        stable_write_operations = $2,
        stable_cache_hits = $3,
        stable_estimated_dead_tuples = $4,
        stable_tables_with_dead_tuples = $5,
        pending_read_operations = NULL,
        pending_write_operations = NULL,
        pending_cache_hits = NULL,
        pending_estimated_dead_tuples = NULL,
        pending_tables_with_dead_tuples = NULL,
        pending_observation_count = 0,
        updated_at = NOW()
    WHERE singleton = 1
      AND statistics_reset_at = $6::timestamptz
    RETURNING singleton
  `, [...stateValues(after), statisticsResetAt]);
  if (stateResult.rowCount !== 1) {
    throw new Error('Database health transition confirmation did not match state.');
  }
  return receipt;
}

/**
 * Returns one current-period receipt only. A receipt from an earlier PostgreSQL
 * statistics period never appears as evidence for the current baseline.
 */
export async function loadLatestCurrentDatabaseHealthTransitionReceipt(client) {
  assertClient(client);
  const result = await client.query(`
    SELECT
      receipt.id,
      receipt.receipt_version,
      receipt.statistics_reset_at,
      receipt.before_read_operations,
      receipt.before_write_operations,
      receipt.before_cache_hits,
      receipt.before_estimated_dead_tuples,
      receipt.before_tables_with_dead_tuples,
      receipt.after_read_operations,
      receipt.after_write_operations,
      receipt.after_cache_hits,
      receipt.after_estimated_dead_tuples,
      receipt.after_tables_with_dead_tuples,
      receipt.confirmation_observation_count,
      receipt.recorded_at
    FROM database_health_transition_state AS state
    INNER JOIN LATERAL (
      SELECT *
      FROM database_health_transition_receipts
      WHERE statistics_reset_at = state.statistics_reset_at
      ORDER BY recorded_at DESC, id DESC
      LIMIT 1
    ) AS receipt ON TRUE
    WHERE state.singleton = 1
  `);
  return firstRow(result);
}

export const databaseHealthTransitionReceiptRepository = Object.freeze({
  lockState: lockDatabaseHealthTransitionState,
  insertBaseline: insertDatabaseHealthTransitionBaseline,
  replaceBaseline: replaceDatabaseHealthTransitionBaseline,
  setPendingObservation: setDatabaseHealthTransitionPendingObservation,
  clearPendingObservation: clearDatabaseHealthTransitionPendingObservation,
  recordConfirmedTransition: recordConfirmedDatabaseHealthTransition,
  loadLatestCurrentReceipt: loadLatestCurrentDatabaseHealthTransitionReceipt,
});
