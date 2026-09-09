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

import { describe, expect, jest, test } from '@jest/globals';
import {
  createDatabaseHealthTransitionObservationService,
} from '../../services/databaseHealthTransitionObservationService.mjs';

const RESET_AT = '2026-09-09T00:00:00.000Z';
const STABLE_SUMMARY = Object.freeze({
  statisticsResetAt: RESET_AT,
  io: Object.freeze({ readOperations: 'low', writeOperations: 'none', cacheHits: 'moderate' }),
  tableStatistics: Object.freeze({ estimatedDeadTuples: 'low', tablesWithDeadTuples: 'none' }),
});
const CHANGED_SUMMARY = Object.freeze({
  statisticsResetAt: RESET_AT,
  io: Object.freeze({ readOperations: 'moderate', writeOperations: 'none', cacheHits: 'high' }),
  tableStatistics: Object.freeze({ estimatedDeadTuples: 'low', tablesWithDeadTuples: 'none' }),
});

function storedState({ resetAt = RESET_AT, pending = null } = {}) {
  return {
    statistics_reset_at: resetAt,
    stable_read_operations: 'low',
    stable_write_operations: 'none',
    stable_cache_hits: 'moderate',
    stable_estimated_dead_tuples: 'low',
    stable_tables_with_dead_tuples: 'none',
    pending_read_operations: pending?.readOperations ?? null,
    pending_write_operations: pending?.writeOperations ?? null,
    pending_cache_hits: pending?.cacheHits ?? null,
    pending_estimated_dead_tuples: pending?.estimatedDeadTuples ?? null,
    pending_tables_with_dead_tuples: pending?.tablesWithDeadTuples ?? null,
    pending_observation_count: pending ? 1 : 0,
  };
}

function createService({ row = STABLE_SUMMARY, state = null } = {}) {
  const client = { query: jest.fn() };
  const transitionRepository = {
    lockState: jest.fn().mockResolvedValue(state),
    insertBaseline: jest.fn(),
    replaceBaseline: jest.fn(),
    setPendingObservation: jest.fn(),
    clearPendingObservation: jest.fn(),
    recordConfirmedTransition: jest.fn().mockResolvedValue({ id: 17 }),
  };
  const projectReceipt = jest.fn().mockReturnValue({ receiptId: '17' });
  const service = createDatabaseHealthTransitionObservationService({
    database: { withTransaction: async callback => callback(client) },
    loadSummary: jest.fn().mockResolvedValue(row),
    buildSummary: jest.fn(({ row: source }) => source),
    transitionRepository,
    projectReceipt,
    now: () => new Date('2026-09-09T12:00:00.000Z'),
  });
  return { service, client, transitionRepository, projectReceipt };
}

describe('databaseHealthTransitionObservationService', () => {
  test('establishes a baseline from the first ordinary observation without a receipt', async () => {
    const { service, transitionRepository, projectReceipt } = createService();

    await expect(service.observe()).resolves.toMatchObject({ status: { id: 'baseline_established' }, receipt: null });

    expect(transitionRepository.insertBaseline).toHaveBeenCalledWith(expect.any(Object), {
      statisticsResetAt: RESET_AT,
      state: expect.objectContaining({ readOperations: 'low', cacheHits: 'moderate' }),
    });
    expect(transitionRepository.recordConfirmedTransition).not.toHaveBeenCalled();
    expect(projectReceipt).not.toHaveBeenCalled();
  });

  test('resets rather than compares a baseline across PostgreSQL statistics periods', async () => {
    const { service, transitionRepository } = createService({
      state: storedState({ resetAt: '2026-09-08T00:00:00.000Z' }),
    });

    await expect(service.observe()).resolves.toMatchObject({ status: { id: 'baseline_reset' } });

    expect(transitionRepository.replaceBaseline).toHaveBeenCalledWith(expect.any(Object), {
      statisticsResetAt: RESET_AT,
      state: expect.objectContaining({ readOperations: 'low' }),
    });
    expect(transitionRepository.setPendingObservation).not.toHaveBeenCalled();
  });

  test('holds a changed state pending after one observation', async () => {
    const { service, transitionRepository } = createService({
      row: CHANGED_SUMMARY,
      state: storedState(),
    });

    await expect(service.observe()).resolves.toMatchObject({ status: { id: 'transition_pending' } });

    expect(transitionRepository.setPendingObservation).toHaveBeenCalledWith(expect.any(Object), {
      state: expect.objectContaining({ readOperations: 'moderate', cacheHits: 'high' }),
    });
    expect(transitionRepository.recordConfirmedTransition).not.toHaveBeenCalled();
  });

  test('records only the second matching changed observation as a transition receipt', async () => {
    const changed = {
      readOperations: 'moderate',
      writeOperations: 'none',
      cacheHits: 'high',
      estimatedDeadTuples: 'low',
      tablesWithDeadTuples: 'none',
    };
    const { service, transitionRepository, projectReceipt } = createService({
      row: CHANGED_SUMMARY,
      state: storedState({ pending: changed }),
    });

    await expect(service.observe()).resolves.toEqual(expect.objectContaining({
      status: { id: 'persistent_transition_recorded' },
      receipt: { receiptId: '17' },
    }));

    expect(transitionRepository.recordConfirmedTransition).toHaveBeenCalledWith(expect.any(Object), {
      statisticsResetAt: RESET_AT,
      before: expect.objectContaining({ readOperations: 'low' }),
      after: changed,
      confirmationObservationCount: 2,
    });
    expect(projectReceipt).toHaveBeenCalledWith({ id: 17 });
  });

  test('clears an abandoned candidate and fails closed on unavailable statistics', async () => {
    const pending = {
      readOperations: 'moderate', writeOperations: 'none', cacheHits: 'high',
      estimatedDeadTuples: 'low', tablesWithDeadTuples: 'none',
    };
    const stableRun = createService({ state: storedState({ pending }) });
    await expect(stableRun.service.observe()).resolves.toMatchObject({ status: { id: 'stable' } });
    expect(stableRun.transitionRepository.clearPendingObservation).toHaveBeenCalledTimes(1);

    const unavailableRun = createService({ row: { ...STABLE_SUMMARY, statisticsResetAt: null } });
    await expect(unavailableRun.service.observe()).resolves.toMatchObject({ status: { id: 'statistics_unavailable' } });
    expect(unavailableRun.transitionRepository.lockState).not.toHaveBeenCalled();
  });
});
