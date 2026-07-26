/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_LEARNING_DECISION_IDS,
  buildPolicyLearningGuardAudit,
} from './policyLearningGuard.mjs';
import {
  validatePolicyLearningIntakeEvent,
} from './policyLearningIntakeContract.mjs';
import {
  LEARNING_OPERATION_BY_TIER,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_ACTOR_TYPE_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_COMMAND_VERSION,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS,
} from './policyAuthorizedOutcomePersistenceVocabulary.mjs';
import {
  asObject,
  buildCompactCandidate,
  buildSideEffects,
  candidateIsComplete,
  hasMatchingFinalOutcome,
  normalizeAuthorization,
  normalizeCurrentState,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';
import {
  buildPolicyAuthorizedOutcomePersistenceCommandAudit,
} from './policyAuthorizedOutcomePersistenceCommandAudit.mjs';

function buildBlockedCommand({
  intake,
  learningDecision,
  authorization,
  currentState,
  reasonCodes,
}) {
  const command = {
    version: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_COMMAND_VERSION,
    ok: false,
    statusId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.BLOCKED,
    sourceId: intake.sourceId || null,
    sourceEventId: intake.sourceEventId || null,
    authorization,
    currentState,
    finalOutcome: asObject(learningDecision).finalOutcome || intake.finalOutcome || null,
    operations: {
      finalOutcome: null,
      learning: null,
      profileRefresh: null,
    },
    reasonCodes: [...new Set(reasonCodes)],
    sideEffects: buildSideEffects(),
  };

  return {
    ...command,
    audit: buildPolicyAuthorizedOutcomePersistenceCommandAudit(command),
  };
}

function buildPolicyAuthorizedOutcomePersistenceCommand({
  intake: inputIntake = {},
  learningDecision: inputLearningDecision = {},
  authorization: inputAuthorization = {},
  currentState: inputCurrentState = {},
} = {}) {
  const intake = asObject(inputIntake);
  const learningDecision = asObject(inputLearningDecision);
  const authorization = normalizeAuthorization(inputAuthorization);
  const currentState = normalizeCurrentState(inputCurrentState);
  const reasonCodes = [];
  const intakeAudit = validatePolicyLearningIntakeEvent(intake);
  const guardAudit = buildPolicyLearningGuardAudit(learningDecision);
  const finalOutcome = asObject(learningDecision.finalOutcome);
  const learning = asObject(learningDecision.learning);

  if (!intakeAudit.ok) {
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.INVALID_INTAKE);
  }
  if (!guardAudit.ok) {
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.INVALID_GUARD_DECISION);
  }
  if (intake.sourceId !== learningDecision.sourceId || intake.sourceId !== finalOutcome.sourceId) {
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.SOURCE_MISMATCH);
  }
  if (!hasMatchingFinalOutcome(intake, learningDecision)) {
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.FINAL_OUTCOME_MISMATCH);
  }
  if (!currentState.classificationId || !currentState.sourceEventId) {
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.CURRENT_STATE_MISSING);
  }
  if (currentState.locked !== true) {
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.TRANSACTION_LOCK_REQUIRED);
  }
  if (currentState.sourceEventId !== intake.sourceEventId ||
      currentState.classificationId !== normalizeIdentifier(finalOutcome.itemId) ||
      currentState.destinationLibraryId !== normalizeIdentifier(finalOutcome.destinationLibraryId) ||
      currentState.destinationLibraryName !== normalizeString(finalOutcome.destinationLibraryName)) {
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.CURRENT_STATE_MISMATCH);
  }
  if (authorization.revalidated !== true || !authorization.actorTypeId || !authorization.actorId) {
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.AUTHORIZATION_REVALIDATION_REQUIRED);
  }
  if (authorization.canRecordOutcome !== true) {
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.OUTCOME_NOT_AUTHORIZED);
  }
  if (!authorization.authorizedSourceIds.includes(intake.sourceId)) {
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.SOURCE_NOT_AUTHORIZED);
  }
  if (intake.actorId && authorization.actorId !== intake.actorId) {
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.ACTOR_MISMATCH);
  }

  if (reasonCodes.length > 0) {
    return buildBlockedCommand({
      intake,
      learningDecision,
      authorization,
      currentState,
      reasonCodes,
    });
  }

  const operations = {
    finalOutcome: {
      operationId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.RECORD_FINAL_OUTCOME,
      sourceId: intake.sourceId,
      sourceEventId: intake.sourceEventId,
      itemId: normalizeIdentifier(finalOutcome.itemId),
      destinationLibraryId: normalizeIdentifier(finalOutcome.destinationLibraryId),
      destinationLibraryName: normalizeString(finalOutcome.destinationLibraryName) || null,
      reasonCodes: [POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.OUTCOME_AUTHORIZED],
    },
    learning: null,
    profileRefresh: null,
  };
  reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.OUTCOME_AUTHORIZED);

  const learningOperationId = LEARNING_OPERATION_BY_TIER[learning.tierId] || null;
  const learningRequested = learning.decisionId === POLICY_LEARNING_DECISION_IDS.CANDIDATE &&
    learning.canWriteLearning === true;

  if (learningRequested && !learningOperationId) {
    return buildBlockedCommand({
      intake,
      learningDecision,
      authorization,
      currentState,
      reasonCodes: [
        ...reasonCodes,
        POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.UNSUPPORTED_LEARNING_TIER,
      ],
    });
  }

  if (learningRequested && !candidateIsComplete(learning.candidate)) {
    return buildBlockedCommand({
      intake,
      learningDecision,
      authorization,
      currentState,
      reasonCodes: [
        ...reasonCodes,
        POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.LEARNING_CANDIDATE_MISSING,
      ],
    });
  }

  if (learningRequested &&
      (normalizeIdentifier(learning.candidate?.destinationLibraryId) !==
        normalizeIdentifier(finalOutcome.destinationLibraryId) ||
       normalizeString(learning.candidate?.destinationLibraryName) !==
        normalizeString(finalOutcome.destinationLibraryName))) {
    return buildBlockedCommand({
      intake,
      learningDecision,
      authorization,
      currentState,
      reasonCodes: [
        ...reasonCodes,
        POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.LEARNING_DESTINATION_MISMATCH,
      ],
    });
  }

  if (learningRequested && authorization.canWriteLearning === true) {
    operations.learning = {
      operationId: learningOperationId,
      tierId: learning.tierId,
      candidate: buildCompactCandidate(learning.candidate),
      reasonCodes: [...new Set(learning.reasonCodes || [])],
    };
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.LEARNING_AUTHORIZED);

    if (learningDecision.profileRefresh?.queue === true) {
      operations.profileRefresh = {
        operationId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.QUEUE_PROFILE_REFRESH,
        destinationLibraryId: normalizeIdentifier(finalOutcome.destinationLibraryId),
        reasonCodes: [...new Set(learningDecision.profileRefresh.reasonCodes || [])],
      };
      reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.PROFILE_REFRESH_AUTHORIZED);
    }
  } else if (learningRequested) {
    reasonCodes.push(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS.LEARNING_NOT_AUTHORIZED);
  }

  const command = {
    version: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_COMMAND_VERSION,
    ok: true,
    statusId: operations.learning
      ? POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.READY
      : POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.OUTCOME_ONLY,
    sourceId: intake.sourceId,
    sourceEventId: intake.sourceEventId,
    authorization,
    currentState,
    finalOutcome,
    operations,
    reasonCodes: [...new Set(reasonCodes)],
    sideEffects: buildSideEffects(),
  };

  return {
    ...command,
    audit: buildPolicyAuthorizedOutcomePersistenceCommandAudit(command),
  };
}

const policyAuthorizedOutcomePersistenceCommandService = Object.freeze({
  build: buildPolicyAuthorizedOutcomePersistenceCommand,
  audit: buildPolicyAuthorizedOutcomePersistenceCommandAudit,
});

export {
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_ACTOR_TYPE_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_COMMAND_VERSION,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS,
  buildPolicyAuthorizedOutcomePersistenceCommand,
  buildPolicyAuthorizedOutcomePersistenceCommandAudit,
  policyAuthorizedOutcomePersistenceCommandService,
};
