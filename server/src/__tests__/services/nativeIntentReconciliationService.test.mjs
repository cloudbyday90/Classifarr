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

function readyControlService() {
  return {
    getExecutionEligibility: jest.fn().mockResolvedValue({
      allowed: true,
      control: {
        automationEnabled: true,
        circuitState: 'closed',
        rawPayloadExposed: false,
      },
    }),
    recordExecutionResult: jest.fn().mockResolvedValue({
      changed: false,
      control: {
        automationEnabled: true,
        circuitState: 'closed',
        rawPayloadExposed: false,
      },
    }),
    recordExecutionError: jest.fn().mockResolvedValue({ changed: false }),
  };
}

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
    const ledgerService = {
      record: jest.fn().mockResolvedValue({
        statusId: 'persisted',
        runId: 44,
        rawPayloadExposed: false,
      }),
    };
    const service = new NativeIntentReconciliationService({
      dbClient,
      runApplyGate,
      ledgerService,
      controlService: readyControlService(),
      now: () => new Date('2026-07-15T12:00:00.000Z'),
      loggerInstance: logger,
    });

    const result = await service.run();

    expect(runApplyGate).toHaveBeenCalledWith(expect.objectContaining({
      dbClient,
      maxPolicies: NATIVE_INTENT_RECONCILIATION_BATCH_SIZE,
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
        respectsActiveReversionHolds: true,
      }),
      counts: {
        attemptedPolicyCount: 2,
        appliedPolicyCount: 2,
        alreadyConvertedCount: 0,
      },
    }));
    expect(result).not.toHaveProperty('results');
    expect(JSON.stringify(result)).not.toContain('must not escape');
    expect(ledgerService.record).toHaveBeenCalledWith(expect.objectContaining({
      applyGate: expect.objectContaining({ statusId: 'applied' }),
      startedAt: '2026-07-15T12:00:00.000Z',
      finishedAt: expect.any(String),
    }));
    expect(logger.info).toHaveBeenCalledWith(
      'Native intent reconciliation completed',
      expect.objectContaining({ statusId: 'applied' }),
    );
  });

  test('records a sanitized, correlated failed run when the conversion gate throws', async () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    const ledgerService = {
      record: jest.fn().mockResolvedValue({
        statusId: 'persisted',
        runId: 45,
        rawPayloadExposed: false,
      }),
    };
    const failure = new Error('database password should not be exposed');
    failure.code = '42P01';
    const service = new NativeIntentReconciliationService({
      runApplyGate: jest.fn().mockRejectedValue(failure),
      ledgerService,
      controlService: readyControlService(),
      now: () => new Date('2026-07-15T12:00:00.000Z'),
      loggerInstance: logger,
    });

    const result = await service.run();

    expect(result).toEqual(expect.objectContaining({
      statusId: 'failed',
      applied: false,
      operatorErrorIds: ['reconciliation_execution_orchestration_failed'],
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      failure: {
        stageId: 'execution_orchestration',
        reasonId: 'reconciliation_execution_orchestration_failed',
        categoryId: 'schema_incompatible',
        systemFailureCategory: 'schema_incompatible',
        rawPayloadExposed: false,
      },
      ledger: expect.objectContaining({ statusId: 'persisted', runId: 45 }),
    }));
    expect(JSON.stringify(result)).not.toContain('password');
    expect(logger.error).toHaveBeenCalledWith(
      'Native intent reconciliation failed',
      expect.objectContaining({
        correlationId: result.correlationId,
        statusId: 'failed',
        failureStageId: 'execution_orchestration',
        failureReasonId: 'reconciliation_execution_orchestration_failed',
        failureCategory: 'schema_incompatible',
        ledgerStatusId: 'persisted',
        rawPayloadExposed: false,
      }),
      { persistStack: false },
    );
    expect(ledgerService.record).toHaveBeenCalledWith(expect.objectContaining({
      applyGate: expect.objectContaining({
        statusId: 'failed',
        operatorErrorIds: ['reconciliation_execution_orchestration_failed'],
      }),
      runKey: result.correlationId,
    }));
  });

  test('attributes operational-control failure before the execution gate starts', async () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    const controlService = readyControlService();
    const failure = new Error('connection password must not escape');
    failure.code = 'ETIMEDOUT';
    controlService.getExecutionEligibility.mockRejectedValue(failure);
    const runApplyGate = jest.fn();
    const service = new NativeIntentReconciliationService({
      runApplyGate,
      controlService,
      ledgerService: { record: jest.fn().mockResolvedValue({ statusId: 'persisted' }) },
      now: () => new Date('2026-07-15T12:00:00.000Z'),
      loggerInstance: logger,
    });

    const result = await service.run();

    expect(runApplyGate).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      statusId: 'failed',
      failure: {
        stageId: 'control_eligibility',
        reasonId: 'reconciliation_control_eligibility_failed',
        categoryId: 'transient_database',
        systemFailureCategory: 'transient_database',
      },
    });
    expect(JSON.stringify(result)).not.toContain('password');
  });

  test('does not re-label a committed conversion as failed when the ledger write fails', async () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    const service = new NativeIntentReconciliationService({
      runApplyGate: jest.fn().mockResolvedValue({
        statusId: 'applied',
        applied: true,
        readyPolicyIds: [18],
        appliedPolicyCount: 1,
      }),
      ledgerService: {
        record: jest.fn().mockRejectedValue(new Error('sensitive storage details')),
      },
      controlService: readyControlService(),
      now: () => new Date('2026-07-15T12:00:00.000Z'),
      loggerInstance: logger,
    });

    const result = await service.run();

    expect(result).toMatchObject({
      statusId: 'applied',
      applied: true,
      ledger: {
        statusId: 'failed',
        reasonId: 'ledger_write_failed',
        rawPayloadExposed: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('sensitive storage details');
    expect(logger.error).toHaveBeenCalledWith(
      'Native intent reconciliation ledger write failed',
      expect.objectContaining({
        statusId: 'applied',
        failureCategory: 'ledger_write',
        rawPayloadExposed: false,
      }),
      { persistStack: false },
    );
  });

  test('does not re-label a committed conversion when circuit state recording fails', async () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    const controlService = readyControlService();
    controlService.recordExecutionResult.mockRejectedValue(
      new Error('control storage details must not escape'),
    );
    const service = new NativeIntentReconciliationService({
      runApplyGate: jest.fn().mockResolvedValue({
        statusId: 'applied',
        applied: true,
        readyPolicyIds: [18],
        appliedPolicyCount: 1,
      }),
      ledgerService: { record: jest.fn().mockResolvedValue({ statusId: 'persisted' }) },
      controlService,
      now: () => new Date('2026-07-15T12:00:00.000Z'),
      loggerInstance: logger,
    });

    const result = await service.run();

    expect(result).toMatchObject({
      statusId: 'applied',
      applied: true,
      control: {
        statusId: 'unavailable',
        rawPayloadExposed: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('storage details');
    expect(logger.error).toHaveBeenCalledWith(
      'Native intent reconciliation control write failed',
      expect.objectContaining({
        statusId: 'applied',
        failureCategory: 'control_state',
        rawPayloadExposed: false,
      }),
      { persistStack: false },
    );
  });

  test('keeps a committed conversion when a ledger implementation returns no status', async () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    const service = new NativeIntentReconciliationService({
      runApplyGate: jest.fn().mockResolvedValue({
        statusId: 'applied',
        applied: true,
        readyPolicyIds: [18],
        appliedPolicyCount: 1,
      }),
      ledgerService: { record: jest.fn().mockResolvedValue(undefined) },
      controlService: readyControlService(),
      now: () => new Date('2026-07-15T12:00:00.000Z'),
      loggerInstance: logger,
    });

    const result = await service.run();

    expect(result).toMatchObject({
      statusId: 'applied',
      applied: true,
      ledger: {
        statusId: 'failed',
        reasonId: 'ledger_write_invalid_result',
        rawPayloadExposed: false,
      },
    });
  });

  test('stops before the apply gate when the emergency control disables automation', async () => {
    const runApplyGate = jest.fn();
    const controlService = readyControlService();
    controlService.getExecutionEligibility.mockResolvedValue({
      allowed: false,
      statusId: 'deferred_by_reconciliation_emergency_stop',
      reasonId: 'operator_incident',
      control: {
        automationEnabled: false,
        circuitState: 'closed',
        rawPayloadExposed: false,
      },
    });
    const service = new NativeIntentReconciliationService({
      dbClient: {},
      runApplyGate,
      ledgerService: { record: jest.fn() },
      controlService,
      now: () => new Date('2026-07-15T12:00:00.000Z'),
      loggerInstance: { info: jest.fn(), error: jest.fn() },
    });

    const result = await service.run();

    expect(runApplyGate).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      statusId: 'deferred_by_reconciliation_emergency_stop',
      applied: false,
      operatorErrorIds: ['operator_incident'],
      control: expect.objectContaining({ automationEnabled: false }),
    }));
  });
});
