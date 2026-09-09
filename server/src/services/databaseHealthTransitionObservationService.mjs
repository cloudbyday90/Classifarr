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
  getDatabaseHealthTransitionBucketState,
  normalizeStoredDatabaseHealthTransitionState,
  areDatabaseHealthTransitionBucketStatesEqual,
} from './databaseHealthTransitionState.mjs';

export const DATABASE_HEALTH_TRANSITION_OBSERVATION_VERSION =
  'database.health_transition_observation.v1';

function status(id) {
  return Object.freeze({ id });
}

function buildResult(statusId, { receipt = null } = {}) {
  return Object.freeze({
    version: DATABASE_HEALTH_TRANSITION_OBSERVATION_VERSION,
    status: status(statusId),
    receipt,
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

/**
 * Owns the passive, transaction-bound observation protocol. It reads the same
 * fixed PostgreSQL aggregate as the health endpoint, establishes a baseline,
 * and appends a receipt only after the same changed bucket state appears in two
 * ordinary observations. PostgreSQL statistics resets deliberately discard the
 * prior comparison baseline.
 */
export function createDatabaseHealthTransitionObservationService({
  database,
  loadSummary,
  buildSummary,
  transitionRepository,
  projectReceipt,
  now = () => new Date(),
} = {}) {
  if (!database || typeof database.withTransaction !== 'function') {
    throw new TypeError('Database health transition observation requires a transaction-capable database.');
  }
  if (typeof loadSummary !== 'function' || typeof buildSummary !== 'function') {
    throw new TypeError('Database health transition observation requires summary readers.');
  }
  if (!transitionRepository || typeof transitionRepository.lockState !== 'function') {
    throw new TypeError('Database health transition observation requires a state repository.');
  }
  if (typeof projectReceipt !== 'function') {
    throw new TypeError('Database health transition observation requires a receipt projection.');
  }

  return Object.freeze({
    async observe() {
      return database.withTransaction(async (client) => {
        const row = await loadSummary(client);
        const summary = buildSummary({ row, observedAt: now() });
        const observedState = getDatabaseHealthTransitionBucketState(summary);
        const statisticsResetAt = getDatabaseHealthTransitionResetAt(summary);

        if (!observedState || !statisticsResetAt) {
          return buildResult('statistics_unavailable');
        }

        const storedRow = await transitionRepository.lockState(client);
        if (!storedRow) {
          await transitionRepository.insertBaseline(client, { statisticsResetAt, state: observedState });
          return buildResult('baseline_established');
        }

        const storedState = normalizeStoredDatabaseHealthTransitionState(storedRow);
        if (storedState.statisticsResetAt !== statisticsResetAt) {
          await transitionRepository.replaceBaseline(client, { statisticsResetAt, state: observedState });
          return buildResult('baseline_reset');
        }

        if (areDatabaseHealthTransitionBucketStatesEqual(storedState.stable, observedState)) {
          if (storedState.pending) {
            await transitionRepository.clearPendingObservation(client);
          }
          return buildResult('stable');
        }

        if (!storedState.pending || !areDatabaseHealthTransitionBucketStatesEqual(storedState.pending, observedState)) {
          await transitionRepository.setPendingObservation(client, { state: observedState });
          return buildResult('transition_pending');
        }

        const receiptRow = await transitionRepository.recordConfirmedTransition(client, {
          statisticsResetAt,
          before: storedState.stable,
          after: observedState,
          confirmationObservationCount: DATABASE_HEALTH_TRANSITION_CONFIRMATION_OBSERVATION_COUNT,
        });
        return buildResult('persistent_transition_recorded', {
          receipt: projectReceipt(receiptRow),
        });
      });
    },
  });
}
