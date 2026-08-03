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
  PolicyRuntimeExactItemMemoryCommandError,
  PolicyRuntimeExactItemMemoryCommandService,
  buildRuntimeExactItemMemoryCommand,
} from '../../services/policyRuntimeExactItemMemoryCommandService.mjs';
import {
  PolicyAuthorizedOutcomeTransactionExecutor,
} from '../../services/policyAuthorizedOutcomeTransactionExecutor.mjs';
import {
  buildPolicyRuntimeExactItemMemoryAdmission,
} from '../../services/policyRuntimeExactItemMemoryAdmission.mjs';
import {
  buildPolicyRuntimeExactItemMemoryAuthorizationContext,
  revalidatePolicyRuntimeExactItemMemoryAuthorization,
} from '../../services/policyRuntimeExactItemMemoryExecutionAuthorization.mjs';
import {
  verifyPolicyRuntimeExactItemMemoryFinalOutcome,
} from '../../services/policyRuntimeExactItemMemoryExecutionEffects.mjs';

function lockedState() {
  return {
    ok: true,
    classification: { id: '42', tmdbId: '872', mediaType: 'movie' },
    destination: { id: '8', name: 'Animated Movies', mediaType: 'movie', active: true },
    resolution: {
      finalOutcomeRecorded: true,
      sourceEventId: `runtime_exact_item_memory:42:${'a'.repeat(22)}`,
    },
    currentState: {
      classificationId: '42',
      destinationLibraryId: '8',
      destinationLibraryName: 'Animated Movies',
      sourceEventId: `runtime_exact_item_memory:42:${'a'.repeat(22)}`,
      locked: true,
    },
  };
}

function createService(overrides = {}) {
  const client = { query: jest.fn() };
  const db = { withTransaction: jest.fn(async work => work(client)) };
  const lockExecutionState = jest.fn().mockResolvedValue(lockedState());
  const admissionService = { build: jest.fn(args => buildPolicyRuntimeExactItemMemoryAdmission(args)) };
  const executor = {
    execute: jest.fn().mockResolvedValue({
      applied: true,
      replayed: false,
      statusId: 'applied',
      operations: { learning: { persisted: true } },
    }),
  };
  const service = new PolicyRuntimeExactItemMemoryCommandService({
    db,
    lockExecutionState,
    admissionService,
    executor,
    ...overrides,
  });

  return { client, db, lockExecutionState, admissionService, executor, service };
}

describe('PolicyRuntimeExactItemMemoryCommandService', () => {
  test('uses one transaction and supplies only server-derived admission to the executor', async () => {
    const { client, db, lockExecutionState, admissionService, executor, service } = createService();

    const result = await service.execute({
      classificationId: 42,
      actorId: 'operator-7',
      authorizationContext: { authenticated: true },
    });

    expect(result.execution).toMatchObject({ applied: true });
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(lockExecutionState).toHaveBeenCalledWith({ client, classificationId: 42 });
    expect(admissionService.build).toHaveBeenCalledWith(expect.objectContaining({
      executionState: lockedState(),
      actorId: 'operator-7',
    }));
    expect(executor.execute).toHaveBeenCalledWith(expect.objectContaining({
      client,
      authorizationContext: { authenticated: true },
      intake: expect.objectContaining({ sourceId: 'operator_confirmation' }),
    }));
  });

  test('does not admit or execute a stale classification state', async () => {
    const { admissionService, executor, service } = createService({
      lockExecutionState: jest.fn().mockResolvedValue({
        ok: false,
        reasonId: 'runtime_exact_item_memory_classification_state_invalid',
      }),
    });

    await expect(service.execute({ classificationId: 42 })).rejects.toEqual(expect.objectContaining({
      name: PolicyRuntimeExactItemMemoryCommandError.name,
      reasonId: 'runtime_exact_item_memory_classification_state_invalid',
    }));
    expect(admissionService.build).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  test('returns durable executor replay without trying to write again', async () => {
    const { service } = createService({
      executor: {
        execute: jest.fn().mockResolvedValue({
          applied: false,
          replayed: true,
          statusId: 'replayed',
          operations: { learning: null },
        }),
      },
    });

    const result = await service.execute({ classificationId: 42, actorId: 'operator-7' });

    expect(result.execution).toMatchObject({ replayed: true, statusId: 'replayed' });
  });

  test('builds an admitted command that verifies rather than rewrites the final outcome', () => {
    const admission = buildPolicyRuntimeExactItemMemoryAdmission({
      executionState: lockedState(),
      actorId: 'operator-7',
    });
    const command = buildRuntimeExactItemMemoryCommand({
      intake: admission.intake,
      learningDecision: admission.decision,
      authorization: {
        actorTypeId: 'operator',
        actorId: 'operator-7',
        revalidated: true,
        canRecordOutcome: true,
        canWriteLearning: true,
        authorizedSourceIds: ['operator_confirmation'],
      },
      currentState: lockedState().currentState,
    });

    expect(command).toMatchObject({
      ok: true,
      statusId: 'ready',
      operations: {
        finalOutcome: { operationId: 'verify_recorded_final_outcome' },
        learning: { operationId: 'write_exact_item_memory' },
        profileRefresh: null,
      },
      audit: { ok: true },
    });
  });

  test('claims the receipt, verifies the locked outcome, and writes only exact-item memory', async () => {
    const client = { query: jest.fn() };
    const db = { withTransaction: jest.fn(async work => work(client)) };
    const lockExecutionState = jest.fn().mockResolvedValue(lockedState());
    const claimReceipt = jest.fn().mockResolvedValue({
      statusId: 'claimed',
      accepted: true,
      reasonId: 'authorized_outcome_source_event_claimed',
      receipt: { id: '77', finalOutcomeStatusId: 'resolved', persistenceStatusId: 'ready' },
    });
    const persistFinalOutcome = jest.fn(verifyPolicyRuntimeExactItemMemoryFinalOutcome);
    const writeExactItemMemory = jest.fn().mockResolvedValue({
      operationId: 'write_exact_item_memory',
      persisted: true,
      reasonId: 'authorized_outcome_execution_exact_item_memory_persisted',
    });
    const executor = new PolicyAuthorizedOutcomeTransactionExecutor({
      db,
      lockExecutionState,
      revalidateAuthorization: revalidatePolicyRuntimeExactItemMemoryAuthorization,
      buildCommand: buildRuntimeExactItemMemoryCommand,
      claimReceipt,
      persistFinalOutcome,
      writeExactItemMemory,
    });
    const service = new PolicyRuntimeExactItemMemoryCommandService({
      db,
      lockExecutionState,
      executor,
    });
    const authorizationContext = buildPolicyRuntimeExactItemMemoryAuthorizationContext({
      actorId: 'operator-7',
      authenticated: true,
    });

    const result = await service.execute({
      classificationId: 42,
      actorId: 'operator-7',
      authorizationContext,
    });

    expect(result.execution).toMatchObject({ statusId: 'applied', applied: true });
    expect(claimReceipt).toHaveBeenCalledTimes(1);
    expect(persistFinalOutcome).toHaveBeenCalledWith(expect.objectContaining({
      client,
      command: expect.objectContaining({
        operations: expect.objectContaining({
          finalOutcome: expect.objectContaining({ operationId: 'verify_recorded_final_outcome' }),
        }),
      }),
    }));
    expect(writeExactItemMemory).toHaveBeenCalledTimes(1);
    expect(result.execution.operations.finalOutcome).toMatchObject({
      verified: true,
      persisted: false,
    });
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
  });
});
