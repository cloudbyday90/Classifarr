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
  persistPolicyManualCorrectionFinalOutcome,
} from './policyManualCorrectionExecutionEffects.mjs';
import {
  POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS,
  applyPolicyManualCorrectionLifecycle,
} from './policyManualCorrectionExecutionLifecycle.mjs';
import {
  revalidatePolicyManualCorrectionExecutionAuthorization,
} from './policyManualCorrectionExecutionAuthorization.mjs';
import {
  policyManualCorrectionLearningService,
} from './policyManualCorrectionLearning.mjs';

class PolicyManualCorrectionTransactionError extends Error {
  constructor(reasonId) {
    super(reasonId);
    this.name = 'PolicyManualCorrectionTransactionError';
    this.reasonId = reasonId;
  }
}

class PolicyManualCorrectionTransactionService {
  constructor({
    db = defaultDb,
    applyLifecycle = applyPolicyManualCorrectionLifecycle,
    learningService = policyManualCorrectionLearningService,
    revalidateAuthorization = revalidatePolicyManualCorrectionExecutionAuthorization,
    persistFinalOutcome = persistPolicyManualCorrectionFinalOutcome,
    executor = null,
  } = {}) {
    this.db = db;
    this.applyLifecycle = applyLifecycle;
    this.learningService = learningService;
    this.executor = executor || new PolicyAuthorizedOutcomeTransactionExecutor({
      db,
      revalidateAuthorization,
      persistFinalOutcome,
    });
  }

  async execute({
    classificationId,
    destinationLibraryId,
    actorId,
    authorizationContext,
  } = {}) {
    if (typeof this.db?.withTransaction !== 'function') {
      throw new TypeError('Manual correction execution requires a transaction boundary.');
    }

    return this.db.withTransaction(async client => {
      const lifecycle = await this.applyLifecycle({
        client,
        classificationId,
        destinationLibraryId,
        actorId,
      });
      if (lifecycle?.ok !== true) {
        throw new PolicyManualCorrectionTransactionError(lifecycle?.reasonId);
      }

      const learning = this.learningService.build({
        classification: lifecycle.classification,
        destination: {
          libraryId: lifecycle.destination.id,
          libraryName: lifecycle.destination.name,
        },
        finalOutcomeRecorded: true,
        sourceEventId: lifecycle.sourceEventId,
        actorId,
      });
      if (learning.audit?.ok !== true) {
        throw new PolicyManualCorrectionTransactionError(
          POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.LEARNING_ADMISSION_INVALID,
        );
      }

      const execution = await this.executor.execute({
        client,
        intake: learning.intake,
        learningDecision: learning.decision,
        authorizationContext,
      });
      if (execution.applied !== true) {
        throw new PolicyManualCorrectionTransactionError(
          POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.EXECUTION_BLOCKED,
        );
      }

      return {
        correction: lifecycle.correction,
        learning,
        execution,
      };
    });
  }
}

const policyManualCorrectionTransactionService =
  new PolicyManualCorrectionTransactionService();

export {
  PolicyManualCorrectionTransactionError,
  PolicyManualCorrectionTransactionService,
  policyManualCorrectionTransactionService,
};
