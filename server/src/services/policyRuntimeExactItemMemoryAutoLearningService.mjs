/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createLogger } from '../utils/logger.mjs';
import {
  PolicyRuntimeExactItemMemoryCommandError,
  PolicyRuntimeExactItemMemoryCommandService,
} from './policyRuntimeExactItemMemoryCommandService.mjs';
import {
  buildPolicyRuntimeExactItemMemoryAuthorizationContext,
} from './policyRuntimeExactItemMemoryExecutionAuthorization.mjs';
import {
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
} from './policyRuntimeQuestionAnswerContract.mjs';

const POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_VERSION =
  'policy.runtime_exact_item_memory_auto_learning.v1';

const POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS = Object.freeze({
  RECORDED: 'recorded',
  ALREADY_RECORDED: 'already_recorded',
  NOT_APPLICABLE: 'not_applicable',
  NOT_ELIGIBLE: 'not_eligible',
  UNAVAILABLE: 'unavailable',
});

const POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS = Object.freeze({
  RESOLUTION_NOT_COMPLETED: 'runtime_exact_item_memory_auto_learning_resolution_not_completed',
  ACTION_NOT_ELIGIBLE: 'runtime_exact_item_memory_auto_learning_action_not_eligible',
  ACTOR_NOT_AUTHENTICATED: 'runtime_exact_item_memory_auto_learning_actor_not_authenticated',
  NOT_ADMITTED: 'runtime_exact_item_memory_auto_learning_not_admitted',
  UNAVAILABLE: 'runtime_exact_item_memory_auto_learning_unavailable',
});

const LEARNING_ACTION_IDS = new Set([
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CHANGE_DESTINATION,
]);

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function buildResult({
  statusId,
  recorded = false,
  reasonCodes = [],
} = {}) {
  return {
    version: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_VERSION,
    statusId,
    exactItemMemoryRecorded: recorded === true,
    reasonCodes: Array.isArray(reasonCodes) ? reasonCodes.filter(Boolean) : [],
  };
}

function summarizeCommandResult(result = {}) {
  const execution = result.execution || {};
  const learning = execution.operations?.learning || {};

  if (learning.persisted === true) {
    return buildResult({
      statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.RECORDED,
      recorded: true,
      reasonCodes: execution.reasonCodes,
    });
  }

  return buildResult({
    statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.ALREADY_RECORDED,
    reasonCodes: execution.reasonCodes,
  });
}

function createPolicyRuntimeExactItemMemoryAutoLearningService({
  commandService = new PolicyRuntimeExactItemMemoryCommandService(),
  logger = createLogger('PolicyRuntimeExactItemMemoryAutoLearning'),
} = {}) {
  async function record({
    classificationId,
    actorId,
    authenticated = false,
    answerActionId,
    resolutionSucceeded = false,
  } = {}) {
    const normalizedClassificationId = normalizePositiveInteger(classificationId);
    if (resolutionSucceeded !== true || !normalizedClassificationId) {
      return buildResult({
        statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.NOT_APPLICABLE,
        reasonCodes: [
          POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS.RESOLUTION_NOT_COMPLETED,
        ],
      });
    }
    if (!LEARNING_ACTION_IDS.has(answerActionId)) {
      return buildResult({
        statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.NOT_APPLICABLE,
        reasonCodes: [
          POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS.ACTION_NOT_ELIGIBLE,
        ],
      });
    }
    if (authenticated !== true) {
      return buildResult({
        statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.NOT_APPLICABLE,
        reasonCodes: [
          POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS.ACTOR_NOT_AUTHENTICATED,
        ],
      });
    }

    try {
      const result = await commandService.execute({
        classificationId: normalizedClassificationId,
        actorId,
        authorizationContext: buildPolicyRuntimeExactItemMemoryAuthorizationContext({
          actorId,
          authenticated,
        }),
      });

      return summarizeCommandResult(result);
    } catch (error) {
      if (error instanceof PolicyRuntimeExactItemMemoryCommandError) {
        return buildResult({
          statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.NOT_ELIGIBLE,
          reasonCodes: [
            POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS.NOT_ADMITTED,
          ],
        });
      }

      logger.warn('Automatic runtime exact-item learning was unavailable', {
        classificationId: normalizedClassificationId,
        reasonCode: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS.UNAVAILABLE,
      });
      return buildResult({
        statusId: POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS.UNAVAILABLE,
        reasonCodes: [
          POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS.UNAVAILABLE,
        ],
      });
    }
  }

  return Object.freeze({ record });
}

const policyRuntimeExactItemMemoryAutoLearningService =
  createPolicyRuntimeExactItemMemoryAutoLearningService();

export {
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_REASON_IDS,
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_STATUS_IDS,
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_AUTO_LEARNING_VERSION,
  createPolicyRuntimeExactItemMemoryAutoLearningService,
  policyRuntimeExactItemMemoryAutoLearningService,
  summarizeCommandResult,
};
