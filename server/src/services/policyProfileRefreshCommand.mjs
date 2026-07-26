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
  buildPolicyAuthorizedOutcomePersistenceCommandAudit,
} from './policyAuthorizedOutcomePersistenceCommandAudit.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS,
} from './policyAuthorizedOutcomePersistenceVocabulary.mjs';
import {
  POLICY_LEARNING_REASON_IDS,
} from './policyLearningGuard.mjs';
import {
  asObject,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

const POLICY_PROFILE_REFRESH_COMMAND_VERSION = 'policy.profile_refresh_command.v1';

const POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS = Object.freeze({
  READY: 'ready',
  NOT_REQUESTED: 'not_requested',
  BLOCKED: 'blocked',
});

const POLICY_PROFILE_REFRESH_COMMAND_REASON_IDS = Object.freeze({
  NOT_REQUESTED: 'profile_refresh_not_requested',
  INVALID_AUTHORIZED_COMMAND: 'profile_refresh_invalid_authorized_command',
  INVALID_REFRESH_OPERATION: 'profile_refresh_invalid_refresh_operation',
});

function buildProfileRefreshCommandResult({
  statusId,
  reasonCodes = [],
  command = null,
} = {}) {
  return {
    version: POLICY_PROFILE_REFRESH_COMMAND_VERSION,
    statusId,
    ready: statusId === POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS.READY,
    reasonCodes: [...new Set(reasonCodes.filter(Boolean))],
    command,
  };
}

function buildPolicyProfileRefreshCommand(authorizedCommand = {}) {
  const source = asObject(authorizedCommand);
  const operations = asObject(source.operations);
  const refreshOperation = operations.profileRefresh === null
    ? null
    : asObject(operations.profileRefresh);

  if (!refreshOperation) {
    return buildProfileRefreshCommandResult({
      statusId: POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS.NOT_REQUESTED,
      reasonCodes: [POLICY_PROFILE_REFRESH_COMMAND_REASON_IDS.NOT_REQUESTED],
    });
  }

  const audit = buildPolicyAuthorizedOutcomePersistenceCommandAudit(source);
  if (source.ok !== true || audit.ok !== true) {
    return buildProfileRefreshCommandResult({
      statusId: POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS.BLOCKED,
      reasonCodes: [POLICY_PROFILE_REFRESH_COMMAND_REASON_IDS.INVALID_AUTHORIZED_COMMAND],
    });
  }

  const learningOperation = asObject(operations.learning);
  const supportedLearningOperation = [
    POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_COMPATIBILITY_EVIDENCE,
    POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_IDENTITY_EVIDENCE,
  ].includes(learningOperation.operationId);
  if (source.statusId !== POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.READY ||
      refreshOperation.operationId !==
        POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.QUEUE_PROFILE_REFRESH ||
      !supportedLearningOperation) {
    return buildProfileRefreshCommandResult({
      statusId: POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS.BLOCKED,
      reasonCodes: [POLICY_PROFILE_REFRESH_COMMAND_REASON_IDS.INVALID_REFRESH_OPERATION],
    });
  }

  const currentState = asObject(source.currentState);
  const candidate = asObject(learningOperation.candidate);
  const refreshReasonId = refreshOperation.reasonCodes.find(reasonId => (
    reasonId === POLICY_LEARNING_REASON_IDS.PROFILE_REFRESH_REQUIRED
  ));
  return buildProfileRefreshCommandResult({
    statusId: POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS.READY,
    reasonCodes: refreshOperation.reasonCodes,
    command: {
      sourceId: normalizeString(source.sourceId, 80) || null,
      sourceEventId: normalizeString(source.sourceEventId, 160) || null,
      classificationId: normalizeIdentifier(currentState.classificationId),
      destinationLibraryId: normalizeIdentifier(refreshOperation.destinationLibraryId),
      learningOperationId: learningOperation.operationId,
      learningTierId: normalizeString(learningOperation.tierId, 40) || null,
      candidateKey: normalizeString(candidate.key, 160) || null,
      refreshReasonId: normalizeString(refreshReasonId, 80) || null,
    },
  });
}

export {
  POLICY_PROFILE_REFRESH_COMMAND_REASON_IDS,
  POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS,
  POLICY_PROFILE_REFRESH_COMMAND_VERSION,
  buildPolicyProfileRefreshCommand,
  buildProfileRefreshCommandResult,
};
