/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import {
  PolicyAuthorizedOutcomeTransactionExecutor,
} from './policyAuthorizedOutcomeTransactionExecutor.mjs';
import {
  buildPolicyAuthorizedOutcomePersistenceCommand,
} from './policyAuthorizedOutcomePersistenceCommand.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
} from './policyAuthorizedOutcomePersistenceVocabulary.mjs';
import {
  policyRuntimeExactItemMemoryAdmissionService,
} from './policyRuntimeExactItemMemoryAdmission.mjs';
import {
  revalidatePolicyRuntimeExactItemMemoryAuthorization,
} from './policyRuntimeExactItemMemoryExecutionAuthorization.mjs';
import {
  verifyPolicyRuntimeExactItemMemoryFinalOutcome,
} from './policyRuntimeExactItemMemoryExecutionEffects.mjs';
import {
  lockPolicyRuntimeExactItemMemoryExecutionState,
} from './policyRuntimeExactItemMemoryExecutionState.mjs';

const POLICY_RUNTIME_EXACT_ITEM_MEMORY_COMMAND_REASON_IDS = Object.freeze({
  ADMISSION_BLOCKED: 'runtime_exact_item_memory_admission_blocked',
  EXECUTION_BLOCKED: 'runtime_exact_item_memory_execution_blocked',
});

class PolicyRuntimeExactItemMemoryCommandError extends Error {
  constructor(reasonId, execution = null) {
    super(reasonId);
    this.name = 'PolicyRuntimeExactItemMemoryCommandError';
    this.reasonId = reasonId;
    this.execution = execution;
  }
}

function buildRuntimeExactItemMemoryCommand(commandInput = {}) {
  return buildPolicyAuthorizedOutcomePersistenceCommand({
    ...commandInput,
    finalOutcomeOperationId:
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.VERIFY_RECORDED_FINAL_OUTCOME,
  });
}

class PolicyRuntimeExactItemMemoryCommandService {
  constructor({
    db = defaultDb,
    lockExecutionState = lockPolicyRuntimeExactItemMemoryExecutionState,
    admissionService = policyRuntimeExactItemMemoryAdmissionService,
    executor = null,
  } = {}) {
    this.db = db;
    this.lockExecutionState = lockExecutionState;
    this.admissionService = admissionService;
    this.executor = executor || new PolicyAuthorizedOutcomeTransactionExecutor({
      db,
      lockExecutionState,
      revalidateAuthorization: revalidatePolicyRuntimeExactItemMemoryAuthorization,
      buildCommand: buildRuntimeExactItemMemoryCommand,
      persistFinalOutcome: verifyPolicyRuntimeExactItemMemoryFinalOutcome,
    });
  }

  async execute({ classificationId, actorId, authorizationContext } = {}) {
    if (typeof this.db?.withTransaction !== 'function') {
      throw new TypeError('Runtime exact-item memory requires a transaction boundary.');
    }

    return this.db.withTransaction(async client => {
      const lockedState = await this.lockExecutionState({ client, classificationId });
      if (lockedState?.ok !== true) {
        throw new PolicyRuntimeExactItemMemoryCommandError(lockedState?.reasonId);
      }

      const admission = this.admissionService.build({
        executionState: lockedState,
        actorId,
      });
      if (admission.audit?.ok !== true || admission.ok !== true) {
        throw new PolicyRuntimeExactItemMemoryCommandError(
          POLICY_RUNTIME_EXACT_ITEM_MEMORY_COMMAND_REASON_IDS.ADMISSION_BLOCKED,
        );
      }

      const execution = await this.executor.execute({
        client,
        intake: admission.intake,
        learningDecision: admission.decision,
        authorizationContext,
      });
      if (execution.applied !== true && execution.replayed !== true) {
        throw new PolicyRuntimeExactItemMemoryCommandError(
          POLICY_RUNTIME_EXACT_ITEM_MEMORY_COMMAND_REASON_IDS.EXECUTION_BLOCKED,
          execution,
        );
      }

      return { admission, execution };
    });
  }
}

export {
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_COMMAND_REASON_IDS,
  PolicyRuntimeExactItemMemoryCommandError,
  PolicyRuntimeExactItemMemoryCommandService,
  buildRuntimeExactItemMemoryCommand,
};
