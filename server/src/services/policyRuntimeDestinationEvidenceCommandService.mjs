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
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
} from './policyAuthorizedOutcomePersistenceCommand.mjs';
import {
  policyRuntimeDestinationEvidenceAdmissionService,
} from './policyRuntimeDestinationEvidenceAdmission.mjs';
import {
  revalidatePolicyRuntimeDestinationEvidenceAuthorization,
} from './policyRuntimeDestinationEvidenceExecutionAuthorization.mjs';
import {
  verifyPolicyRuntimeDestinationEvidenceFinalOutcome,
} from './policyRuntimeDestinationEvidenceExecutionEffects.mjs';
import {
  lockPolicyRuntimeDestinationEvidenceExecutionState,
} from './policyRuntimeDestinationEvidenceExecutionState.mjs';
import {
  buildPolicyRuntimeDestinationEvidenceProvenance,
} from './policyRuntimeDestinationEvidenceProvenance.mjs';

const POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_VERSION =
  'policy.runtime_destination_evidence_command.v1';

const POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_STATUS_IDS = Object.freeze({
  APPLIED: 'applied',
  REPLAYED: 'replayed',
  NOT_ADMITTED: 'not_admitted',
});

const POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_REASON_IDS = Object.freeze({
  EXECUTION_BLOCKED: 'runtime_destination_evidence_execution_blocked',
});

class PolicyRuntimeDestinationEvidenceCommandError extends Error {
  constructor(reasonId, execution = null) {
    super(reasonId);
    this.name = 'PolicyRuntimeDestinationEvidenceCommandError';
    this.reasonId = reasonId;
    this.execution = execution;
  }
}

function buildRuntimeDestinationEvidenceCommand(commandInput = {}) {
  return buildPolicyAuthorizedOutcomePersistenceCommand({
    ...commandInput,
    finalOutcomeOperationId:
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.VERIFY_RECORDED_FINAL_OUTCOME,
  });
}

function summarizeAdmission(admission = {}) {
  return {
    statusId: admission.statusId || null,
    reasonCodes: Array.isArray(admission.reasonCodes) ? admission.reasonCodes : [],
    tierId: admission.references?.tierId || null,
  };
}

function summarizeProvenance(provenance = {}) {
  return {
    statusId: provenance.statusId || null,
    reasonCodes: Array.isArray(provenance.reasonCodes) ? provenance.reasonCodes : [],
    nativeIntentId: provenance.provenance?.nativeIntentId || null,
    profileStale: provenance.provenance?.profileFreshness?.stale === true,
  };
}

class PolicyRuntimeDestinationEvidenceCommandService {
  constructor({
    db = defaultDb,
    lockExecutionState = lockPolicyRuntimeDestinationEvidenceExecutionState,
    buildProvenance = buildPolicyRuntimeDestinationEvidenceProvenance,
    admissionService = policyRuntimeDestinationEvidenceAdmissionService,
    executor = null,
  } = {}) {
    this.db = db;
    this.lockExecutionState = lockExecutionState;
    this.buildProvenance = buildProvenance;
    this.admissionService = admissionService;
    this.executor = executor || new PolicyAuthorizedOutcomeTransactionExecutor({
      db,
      lockExecutionState,
      revalidateAuthorization: revalidatePolicyRuntimeDestinationEvidenceAuthorization,
      buildCommand: buildRuntimeDestinationEvidenceCommand,
      persistFinalOutcome: verifyPolicyRuntimeDestinationEvidenceFinalOutcome,
    });
  }

  async execute({
    classificationId,
    actorId,
    authorizationContext,
    client = null,
    now = Date.now(),
  } = {}) {
    if (client) {
      return this.executeWithinTransaction({
        client,
        classificationId,
        actorId,
        authorizationContext,
        now,
      });
    }
    if (typeof this.db?.withTransaction !== 'function') {
      throw new TypeError('Runtime destination evidence requires a transaction boundary.');
    }

    return this.db.withTransaction(transactionClient => this.executeWithinTransaction({
      client: transactionClient,
      classificationId,
      actorId,
      authorizationContext,
      now,
    }));
  }

  async executeWithinTransaction({
    client,
    classificationId,
    actorId,
    authorizationContext,
    now = Date.now(),
  } = {}) {
    if (!client || typeof client.query !== 'function') {
      throw new TypeError('Runtime destination evidence requires a transaction client.');
    }

    const executionState = await this.lockExecutionState({ client, classificationId });
    if (executionState?.ok !== true) {
      return {
        version: POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_VERSION,
        statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_STATUS_IDS.NOT_ADMITTED,
        reasonCodes: [executionState?.reasonId].filter(Boolean),
        provenance: null,
        admission: null,
        execution: null,
      };
    }

    const provenance = await this.buildProvenance({
      client,
      executionState,
      now,
    });
    const admission = this.admissionService.build({
      executionState,
      provenance,
      actorId,
    });
    if (admission.ok !== true || admission.audit?.ok !== true) {
      return {
        version: POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_VERSION,
        statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_STATUS_IDS.NOT_ADMITTED,
        reasonCodes: admission.reasonCodes,
        provenance: summarizeProvenance(provenance),
        admission: summarizeAdmission(admission),
        execution: null,
      };
    }

    const execution = await this.executor.execute({
      client,
      intake: admission.intake,
      learningDecision: admission.decision,
      authorizationContext,
    });
    if (execution.applied !== true && execution.replayed !== true) {
      throw new PolicyRuntimeDestinationEvidenceCommandError(
        POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_REASON_IDS.EXECUTION_BLOCKED,
        execution,
      );
    }

    return {
      version: POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_VERSION,
      statusId: execution.replayed === true
        ? POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_STATUS_IDS.REPLAYED
        : POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_STATUS_IDS.APPLIED,
      reasonCodes: execution.reasonCodes,
      provenance: summarizeProvenance(provenance),
      admission: summarizeAdmission(admission),
      execution,
    };
  }
}

const policyRuntimeDestinationEvidenceCommandService =
  new PolicyRuntimeDestinationEvidenceCommandService();

export {
  POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_REASON_IDS,
  POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_STATUS_IDS,
  POLICY_RUNTIME_DESTINATION_EVIDENCE_COMMAND_VERSION,
  PolicyRuntimeDestinationEvidenceCommandError,
  PolicyRuntimeDestinationEvidenceCommandService,
  buildRuntimeDestinationEvidenceCommand,
  policyRuntimeDestinationEvidenceCommandService,
  summarizeAdmission,
  summarizeProvenance,
};
