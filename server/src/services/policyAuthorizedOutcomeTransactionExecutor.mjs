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
  buildPolicyAuthorizedOutcomePersistenceCommand,
} from './policyAuthorizedOutcomePersistenceCommand.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS,
  claimPolicyAuthorizedOutcomeSourceEventReceipt,
} from './policyAuthorizedOutcomeReceiptRepository.mjs';
import {
  persistPolicyAuthorizedFinalOutcome,
  writePolicyAuthorizedExactItemMemory,
} from './policyAuthorizedOutcomeExecutionEffects.mjs';
import {
  persistPolicyRefreshBackedEvidence,
} from './policyRefreshBackedEvidencePersistence.mjs';
import {
  lockPolicyAuthorizedOutcomeExecutionState,
} from './policyAuthorizedOutcomeExecutionState.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS,
  POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS,
  POLICY_AUTHORIZED_OUTCOME_EXECUTION_VERSION,
} from './policyAuthorizedOutcomeExecutionVocabulary.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
} from './policyAuthorizedOutcomePersistenceVocabulary.mjs';
import {
  validatePolicyLearningIntakeEvent,
} from './policyLearningIntakeContract.mjs';
import {
  asObject,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

function summarizeReceipt(receipt = {}) {
  const source = asObject(receipt);

  return {
    id: source.id || null,
    statusId: source.finalOutcomeStatusId || null,
    persistenceStatusId: source.persistenceStatusId || null,
  };
}

function summarizeCommand(command = {}) {
  const source = asObject(command);

  return {
    statusId: source.statusId || null,
    reasonCodes: Array.isArray(source.reasonCodes) ? source.reasonCodes : [],
  };
}

function buildExecutionResult({
  statusId,
  reasonCodes = [],
  command = null,
  receipt = null,
  finalOutcome = null,
  learning = null,
  profileRefresh = null,
} = {}) {
  return {
    version: POLICY_AUTHORIZED_OUTCOME_EXECUTION_VERSION,
    statusId,
    applied: statusId === POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS.APPLIED,
    replayed: statusId === POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS.REPLAYED,
    accepted: ![
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS.BLOCKED,
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS.SOURCE_EVENT_MISMATCH,
    ].includes(statusId),
    reasonCodes: [...new Set(reasonCodes.filter(Boolean))],
    command: command ? summarizeCommand(command) : null,
    receipt: receipt ? summarizeReceipt(receipt) : null,
    operations: {
      finalOutcome,
      learning,
      profileRefresh,
    },
  };
}

async function defaultRevalidateAuthorization() {
  return {
    revalidated: false,
    canRecordOutcome: false,
    canWriteLearning: false,
    authorizedSourceIds: [],
  };
}

class PolicyAuthorizedOutcomeTransactionExecutor {
  constructor({
    db = defaultDb,
    lockExecutionState = lockPolicyAuthorizedOutcomeExecutionState,
    revalidateAuthorization = defaultRevalidateAuthorization,
    buildCommand = buildPolicyAuthorizedOutcomePersistenceCommand,
    claimReceipt = claimPolicyAuthorizedOutcomeSourceEventReceipt,
    persistFinalOutcome = persistPolicyAuthorizedFinalOutcome,
    writeExactItemMemory = writePolicyAuthorizedExactItemMemory,
    persistRefreshBackedEvidence = persistPolicyRefreshBackedEvidence,
  } = {}) {
    this.db = db;
    this.lockExecutionState = lockExecutionState;
    this.revalidateAuthorization = revalidateAuthorization;
    this.buildCommand = buildCommand;
    this.claimReceipt = claimReceipt;
    this.persistFinalOutcome = persistFinalOutcome;
    this.writeExactItemMemory = writeExactItemMemory;
    this.persistRefreshBackedEvidence = persistRefreshBackedEvidence;
  }

  async execute({
    intake = {},
    learningDecision = {},
    authorizationContext = null,
    dbClient = this.db,
    client = null,
  } = {}) {
    const intakeAudit = validatePolicyLearningIntakeEvent(intake);
    if (!intakeAudit.ok) {
      return buildExecutionResult({
        statusId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS.BLOCKED,
        reasonCodes: [POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.INVALID_INTAKE],
      });
    }
    if (client) {
      return this.executeWithinTransaction({
        client,
        intake,
        learningDecision,
        authorizationContext,
      });
    }
    if (typeof dbClient?.withTransaction !== 'function') {
      throw new TypeError('Authorized outcome execution requires a transaction boundary.');
    }

    return dbClient.withTransaction(transactionClient => this.executeWithinTransaction({
      client: transactionClient,
      intake,
      learningDecision,
      authorizationContext,
    }));
  }

  async executeWithinTransaction({
    client,
    intake = {},
    learningDecision = {},
    authorizationContext = null,
  } = {}) {
    if (!client || typeof client.query !== 'function') {
      throw new TypeError('Authorized outcome execution requires a transaction client.');
    }
    const intakeAudit = validatePolicyLearningIntakeEvent(intake);
    if (!intakeAudit.ok) {
      return buildExecutionResult({
        statusId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS.BLOCKED,
        reasonCodes: [POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.INVALID_INTAKE],
      });
    }

    const executionState = await this.lockExecutionState({ client, intake });
    if (executionState?.ok !== true) {
      return buildExecutionResult({
        statusId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS.BLOCKED,
        reasonCodes: [executionState?.reasonId],
      });
    }

    const authorization = await this.revalidateAuthorization({
      client,
      intake,
      executionState,
      authorizationContext,
    });
    const command = this.buildCommand({
      intake,
      learningDecision,
      authorization,
      currentState: executionState.currentState,
    });
    if (command.ok !== true || command.audit?.ok !== true) {
      return buildExecutionResult({
        statusId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS.BLOCKED,
        reasonCodes: [
          POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.COMMAND_BLOCKED,
          ...(Array.isArray(command.reasonCodes) ? command.reasonCodes : []),
        ],
        command,
      });
    }

    const receiptClaim = await this.claimReceipt({ client, command });
    if (receiptClaim.statusId === POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS.REPLAYED) {
      return buildExecutionResult({
        statusId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS.REPLAYED,
        reasonCodes: [receiptClaim.reasonId],
        command,
        receipt: receiptClaim.receipt,
      });
    }
    if (receiptClaim.accepted !== true) {
      return buildExecutionResult({
        statusId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS.SOURCE_EVENT_MISMATCH,
        reasonCodes: [
          POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.SOURCE_EVENT_MISMATCH,
          receiptClaim.reasonId,
        ],
        command,
        receipt: receiptClaim.receipt,
      });
    }

    const finalOutcome = await this.persistFinalOutcome({
      client,
      command,
      executionState,
    });
    const executionEffects = await this.executeLearningOperation({
      client,
      command,
      executionState,
    });
    const learning = executionEffects?.learning || null;
    const profileRefresh = this.executeProfileRefreshOperation(command, executionEffects);

    return buildExecutionResult({
      statusId: POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS.APPLIED,
      reasonCodes: [receiptClaim.reasonId, finalOutcome.reasonId, learning?.reasonId],
      command,
      receipt: receiptClaim.receipt,
      finalOutcome,
      learning,
      profileRefresh,
    });
  }

  async executeLearningOperation({ client, command, executionState }) {
    const operation = command.operations?.learning;
    if (!operation) return null;

    if (operation.operationId ===
        POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_EXACT_ITEM_MEMORY) {
      return {
        learning: await this.writeExactItemMemory({ client, command, executionState }),
        profileRefresh: null,
      };
    }

    if ([
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_COMPATIBILITY_EVIDENCE,
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_IDENTITY_EVIDENCE,
    ].includes(operation.operationId)) {
      return this.persistRefreshBackedEvidence({ client, command, executionState });
    }

    throw new Error(
      `${POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.LEARNING_OPERATION_UNAVAILABLE}: ` +
      `${normalizeString(operation.operationId, 80) || 'unknown'}`,
    );
  }

  executeProfileRefreshOperation(command = {}, executionEffects = null) {
    if (!command.operations?.profileRefresh) return null;

    if (executionEffects?.profileRefresh?.operationId ===
        POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.QUEUE_PROFILE_REFRESH) {
      return executionEffects.profileRefresh;
    }

    throw new Error(POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.PROFILE_REFRESH_UNAVAILABLE);
  }
}

const policyAuthorizedOutcomeTransactionExecutor =
  new PolicyAuthorizedOutcomeTransactionExecutor();

export {
  PolicyAuthorizedOutcomeTransactionExecutor,
  buildExecutionResult,
  defaultRevalidateAuthorization,
  policyAuthorizedOutcomeTransactionExecutor,
  summarizeCommand,
  summarizeReceipt,
};
