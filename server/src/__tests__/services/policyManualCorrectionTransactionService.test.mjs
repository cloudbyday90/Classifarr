/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

import {
  POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS,
} from '../../services/policyManualCorrectionExecutionLifecycle.mjs';
import {
  PolicyManualCorrectionTransactionError,
  PolicyManualCorrectionTransactionService,
} from '../../services/policyManualCorrectionTransactionService.mjs';

function learning() {
  return {
    audit: { ok: true },
    intake: { sourceEventId: 'classification_correction:991' },
    decision: { learning: { decisionId: 'candidate' } },
    statusId: 'ready',
  };
}

function lifecycle() {
  return {
    ok: true,
    sourceEventId: 'classification_correction:991',
    classification: { id: '42', tmdbId: '872', mediaType: 'movie' },
    destination: { id: '8', name: 'Animated Movies' },
    correction: { id: 991, classification_id: 42 },
  };
}

function createService(overrides = {}) {
  const client = { query: jest.fn() };
  const db = { withTransaction: jest.fn(async work => work(client)) };
  const applyLifecycle = jest.fn().mockResolvedValue(lifecycle());
  const learningService = { build: jest.fn(() => learning()) };
  const executor = {
    execute: jest.fn().mockResolvedValue({
      applied: true,
      statusId: 'applied',
      operations: { learning: { persisted: true } },
    }),
  };
  const service = new PolicyManualCorrectionTransactionService({
    db,
    applyLifecycle,
    learningService,
    executor,
    ...overrides,
  });

  return { client, db, applyLifecycle, learningService, executor, service };
}

describe('PolicyManualCorrectionTransactionService', () => {
  test('keeps lifecycle, outcome execution, and exact-item learning in one transaction', async () => {
    const { client, db, applyLifecycle, learningService, executor, service } = createService();

    const result = await service.execute({
      classificationId: 42,
      destinationLibraryId: 8,
      actorId: 'operator-7',
      authorizationContext: { authenticated: true },
    });

    expect(result).toEqual(expect.objectContaining({ correction: expect.objectContaining({ id: 991 }) }));
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(applyLifecycle).toHaveBeenCalledWith(expect.objectContaining({ client }));
    expect(learningService.build).toHaveBeenCalledWith(expect.objectContaining({
      finalOutcomeRecorded: true,
      sourceEventId: 'classification_correction:991',
    }));
    expect(executor.execute).toHaveBeenCalledWith(expect.objectContaining({ client }));
  });

  test('rejects and rolls back the correction lifecycle when the executor blocks', async () => {
    const { service } = createService({
      executor: {
        execute: jest.fn().mockResolvedValue({
          applied: false,
          statusId: 'blocked',
          operations: {},
        }),
      },
    });

    await expect(service.execute({
      classificationId: 42,
      destinationLibraryId: 8,
      actorId: 'operator-7',
      authorizationContext: { authenticated: true },
    })).rejects.toEqual(expect.objectContaining({
      name: PolicyManualCorrectionTransactionError.name,
      reasonId: POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.EXECUTION_BLOCKED,
    }));
  });
});
