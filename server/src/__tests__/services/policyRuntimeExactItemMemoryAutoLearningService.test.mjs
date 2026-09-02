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
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS,
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS,
  createPolicyRuntimeExactItemMemoryAutoLearningService,
} from '../../services/policyRuntimeExactItemMemoryAutoLearningService.mjs';
import {
  PolicyRuntimeExactItemMemoryCommandError,
} from '../../services/policyRuntimeExactItemMemoryCommandService.mjs';

function createService({ execute = jest.fn(), logger = { warn: jest.fn() } } = {}) {
  const commandService = { execute };
  const service = createPolicyRuntimeExactItemMemoryAutoLearningService({
    commandService,
    logger,
  });

  return { commandService, execute, logger, service };
}

const confirmationInput = Object.freeze({
  classificationId: 42,
  actorId: 'operator-7',
  authenticated: true,
  answerActionId: 'confirm_destination',
  resolutionSucceeded: true,
});

describe('PolicyRuntimeExactItemMemoryAutoLearningService', () => {
  test('records an eligible authenticated confirmation through the existing guarded command', async () => {
    const { execute, service } = createService({
      execute: jest.fn().mockResolvedValue({
        execution: {
          applied: true,
          replayed: false,
          reasonCodes: ['authorized_outcome_execution_exact_item_memory_persisted'],
          operations: { learning: { persisted: true } },
        },
      }),
    });

    const result = await service.record(confirmationInput);

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.RECORDED,
      exactItemMemoryRecorded: true,
    }));
    expect(execute).toHaveBeenCalledWith({
      classificationId: 42,
      actorId: 'operator-7',
      authorizationContext: expect.objectContaining({
        actorId: 'operator-7',
        authenticated: true,
      }),
    });
  });

  test('accepts an idempotent repeat without writing a second memory record', async () => {
    const { execute, service } = createService({
      execute: jest.fn().mockResolvedValue({
        execution: {
          applied: false,
          replayed: true,
          operations: { learning: null },
        },
      }),
    });

    const result = await service.record({
      ...confirmationInput,
      answerActionId: 'change_destination',
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.ALREADY_RECORDED,
      exactItemMemoryRecorded: false,
    }));
    expect(execute).toHaveBeenCalledTimes(1);
  });

  test('does not learn from a non-routing action or an unauthenticated actor', async () => {
    const { execute, service } = createService();

    await expect(service.record({
      ...confirmationInput,
      answerActionId: 'route_not_applicable',
    })).resolves.toEqual(expect.objectContaining({
      statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.NOT_APPLICABLE,
      reasonCodes: [
        POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS.ACTION_NOT_ELIGIBLE,
      ],
    }));
    await expect(service.record({
      ...confirmationInput,
      authenticated: false,
    })).resolves.toEqual(expect.objectContaining({
      statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.NOT_APPLICABLE,
      reasonCodes: [
        POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS.ACTOR_NOT_AUTHENTICATED,
      ],
    }));

    expect(execute).not.toHaveBeenCalled();
  });

  test('keeps the resolved route intact when guarded admission declines learning', async () => {
    const { logger, service } = createService({
      execute: jest.fn().mockRejectedValue(new PolicyRuntimeExactItemMemoryCommandError(
        'runtime_exact_item_memory_classification_state_invalid',
      )),
    });

    await expect(service.record(confirmationInput)).resolves.toEqual(expect.objectContaining({
      statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.NOT_ELIGIBLE,
      exactItemMemoryRecorded: false,
      reasonCodes: [
        POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS.NOT_ADMITTED,
      ],
    }));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('contains an unexpected persistence failure and reports only a bounded status', async () => {
    const { logger, service } = createService({
      execute: jest.fn().mockRejectedValue(new Error('database endpoint unavailable')),
    });

    await expect(service.record(confirmationInput)).resolves.toEqual(expect.objectContaining({
      statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.UNAVAILABLE,
      exactItemMemoryRecorded: false,
      reasonCodes: [
        POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS.UNAVAILABLE,
      ],
    }));
    expect(logger.warn).toHaveBeenCalledWith(
      'Automatic runtime exact-item learning was unavailable',
      expect.objectContaining({ classificationId: 42 }),
    );
  });
});
