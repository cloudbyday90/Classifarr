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
  NATIVE_INTENT_RECONCILIATION_BATCH_SIZE,
  NATIVE_INTENT_RECONCILIATION_MAX_ELAPSED_MS,
  NativeIntentReconciliationService,
} from '../../services/nativeIntentReconciliationService.mjs';

describe('NativeIntentReconciliationService', () => {
  test('uses a fixed unconverted-only batch and returns compact execution evidence', async () => {
    const dbClient = { query: jest.fn() };
    const runApplyGate = jest.fn().mockResolvedValue({
      statusId: 'applied',
      applied: true,
      readyPolicyIds: [18, 19],
      appliedPolicyCount: 2,
      alreadyConvertedCount: 0,
      results: [{ policyId: 18, sensitivePayload: 'must not escape' }],
      operatorErrorIds: [],
    });
    const logger = { info: jest.fn(), error: jest.fn() };
    const service = new NativeIntentReconciliationService({
      dbClient,
      runApplyGate,
      now: () => new Date('2026-07-15T12:00:00.000Z'),
      loggerInstance: logger,
    });

    const result = await service.run();

    expect(runApplyGate).toHaveBeenCalledWith(expect.objectContaining({
      dbClient,
      maxPolicies: NATIVE_INTENT_RECONCILIATION_BATCH_SIZE,
      unconvertedOnly: true,
      excludeRevertedPolicies: true,
      action: expect.objectContaining({
        actorSourceId: 'native_intent_reconciliation',
        reasonCode: 'native_intent_reconciliation',
      }),
      executionDeadlineAt: '2026-07-15T12:00:20.000Z',
    }));
    expect(result).toEqual(expect.objectContaining({
      statusId: 'applied',
      applied: true,
      scope: expect.objectContaining({
        batchSize: NATIVE_INTENT_RECONCILIATION_BATCH_SIZE,
        maxElapsedMs: NATIVE_INTENT_RECONCILIATION_MAX_ELAPSED_MS,
        currentStateOnly: true,
        unconvertedOnly: true,
        excludesRevertedPolicies: true,
      }),
      counts: {
        attemptedPolicyCount: 2,
        appliedPolicyCount: 2,
        alreadyConvertedCount: 0,
      },
    }));
    expect(result).not.toHaveProperty('results');
    expect(JSON.stringify(result)).not.toContain('must not escape');
    expect(logger.info).toHaveBeenCalledWith(
      'Native intent reconciliation completed',
      expect.objectContaining({ statusId: 'applied' }),
    );
  });

  test('returns a sanitized failure result when the conversion gate throws', async () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    const service = new NativeIntentReconciliationService({
      runApplyGate: jest.fn().mockRejectedValue(new Error('database password should not be exposed')),
      now: () => new Date('2026-07-15T12:00:00.000Z'),
      loggerInstance: logger,
    });

    const result = await service.run();

    expect(result).toEqual(expect.objectContaining({
      statusId: 'failed',
      applied: false,
      operatorErrorIds: ['native_intent_reconciliation_failed'],
    }));
    expect(JSON.stringify(result)).not.toContain('password');
    expect(logger.error).toHaveBeenCalledWith(
      'Native intent reconciliation failed',
      { statusId: 'failed', failureCategory: 'execution' },
    );
  });
});
