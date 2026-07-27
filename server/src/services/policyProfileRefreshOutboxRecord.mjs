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
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
} from './policyAuthorizedOutcomePersistenceVocabulary.mjs';
import {
  POLICY_LEARNING_REASON_IDS,
} from './policyLearningGuard.mjs';
import {
  POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS,
} from './policyProfileRefreshCommand.mjs';
import {
  asObject,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';
import {
  POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_SOURCE_SYSTEM_IDS,
} from './policyProfileRefreshOutboxVocabulary.mjs';

const POLICY_PROFILE_REFRESH_OUTBOX_RECORD_VERSION =
  'policy.profile_refresh_outbox_record.v1';

const POLICY_PROFILE_REFRESH_OUTBOX_RECORD_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_PROFILE_REFRESH_OUTBOX_RECORD_REASON_IDS = Object.freeze({
  INVALID_REFRESH_COMMAND: 'profile_refresh_outbox_invalid_refresh_command',
  INVALID_IDENTIFIERS: 'profile_refresh_outbox_invalid_identifiers',
  INVALID_LEARNING_OPERATION: 'profile_refresh_outbox_invalid_learning_operation',
  INVALID_REFRESH_REASON: 'profile_refresh_outbox_invalid_refresh_reason',
});

const POLICY_PROFILE_REFRESH_OUTBOX_SOURCE_SYSTEM =
  POLICY_PROFILE_REFRESH_OUTBOX_SOURCE_SYSTEM_IDS.LEARNING_EVIDENCE;

function buildResult({ statusId, reasonCodes = [], record = null } = {}) {
  return {
    version: POLICY_PROFILE_REFRESH_OUTBOX_RECORD_VERSION,
    statusId,
    ready: statusId === POLICY_PROFILE_REFRESH_OUTBOX_RECORD_STATUS_IDS.READY,
    reasonCodes: [...new Set(reasonCodes.filter(Boolean))],
    record,
  };
}

function buildPolicyProfileRefreshOutboxRecord(refreshCommand = {}) {
  const source = asObject(refreshCommand);
  const command = asObject(source.command);
  const sourceId = normalizeString(command.sourceId, 80);
  const sourceEventId = normalizeString(command.sourceEventId, 160);
  const classificationId = normalizeIdentifier(command.classificationId);
  const libraryId = normalizeIdentifier(command.destinationLibraryId);
  const learningOperationId = normalizeString(command.learningOperationId, 80);
  const learningTierId = normalizeString(command.learningTierId, 40);
  const candidateKey = normalizeString(command.candidateKey, 160);
  const refreshReasonId = normalizeString(command.refreshReasonId, 80);

  if (source.statusId !== POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS.READY ||
      source.ready !== true) {
    return buildResult({
      statusId: POLICY_PROFILE_REFRESH_OUTBOX_RECORD_STATUS_IDS.BLOCKED,
      reasonCodes: [
        POLICY_PROFILE_REFRESH_OUTBOX_RECORD_REASON_IDS.INVALID_REFRESH_COMMAND,
      ],
    });
  }
  if (!sourceId || !sourceEventId || !classificationId || !libraryId || !candidateKey) {
    return buildResult({
      statusId: POLICY_PROFILE_REFRESH_OUTBOX_RECORD_STATUS_IDS.BLOCKED,
      reasonCodes: [POLICY_PROFILE_REFRESH_OUTBOX_RECORD_REASON_IDS.INVALID_IDENTIFIERS],
    });
  }
  const validLearningPair = (
    learningOperationId ===
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_COMPATIBILITY_EVIDENCE &&
    learningTierId === 'compatibility_evidence'
  ) || (
    learningOperationId ===
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_IDENTITY_EVIDENCE &&
    learningTierId === 'identity_evidence'
  );
  if (!validLearningPair) {
    return buildResult({
      statusId: POLICY_PROFILE_REFRESH_OUTBOX_RECORD_STATUS_IDS.BLOCKED,
      reasonCodes: [
        POLICY_PROFILE_REFRESH_OUTBOX_RECORD_REASON_IDS.INVALID_LEARNING_OPERATION,
      ],
    });
  }
  if (refreshReasonId !== POLICY_LEARNING_REASON_IDS.PROFILE_REFRESH_REQUIRED) {
    return buildResult({
      statusId: POLICY_PROFILE_REFRESH_OUTBOX_RECORD_STATUS_IDS.BLOCKED,
      reasonCodes: [POLICY_PROFILE_REFRESH_OUTBOX_RECORD_REASON_IDS.INVALID_REFRESH_REASON],
    });
  }

  return buildResult({
    statusId: POLICY_PROFILE_REFRESH_OUTBOX_RECORD_STATUS_IDS.READY,
    record: {
      sourceId,
      sourceEventId,
      classificationId,
      libraryId,
      learningOperationId,
      learningTierId,
      candidateKey,
      refreshReasonId,
      requestType: POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS.LEARNING_EVIDENCE,
      sourceSystem: POLICY_PROFILE_REFRESH_OUTBOX_SOURCE_SYSTEM,
    },
  });
}

export {
  POLICY_PROFILE_REFRESH_OUTBOX_RECORD_REASON_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_RECORD_STATUS_IDS,
  POLICY_PROFILE_REFRESH_OUTBOX_RECORD_VERSION,
  POLICY_PROFILE_REFRESH_OUTBOX_SOURCE_SYSTEM,
  buildPolicyProfileRefreshOutboxRecord,
};
