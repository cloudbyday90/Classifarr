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
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
  POLICY_RUNTIME_QUESTION_ANSWER_CONTRACT_VERSION,
  isPolicyRuntimeQuestionResolutionAction,
} from './policyRuntimeQuestionAnswerContract.mjs';
import {
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS,
} from './policyAuthorizedOutcomeExecutionVocabulary.mjs';
import {
  safeParseJsonObject,
} from '../utils/classificationRetryPayloads.mjs';

const POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS = Object.freeze({
  FINAL_OUTCOME_MISSING: 'runtime_exact_item_memory_final_outcome_missing',
  FINAL_OUTCOME_NOT_RUNTIME_RESOLUTION:
    'runtime_exact_item_memory_final_outcome_not_runtime_resolution',
  FINAL_OUTCOME_DESTINATION_MISMATCH:
    'runtime_exact_item_memory_final_outcome_destination_mismatch',
  INVALID_RUNTIME_ANSWER: 'runtime_exact_item_memory_invalid_runtime_answer',
  SOURCE_EVENT_IDENTITY_MISMATCH:
    'runtime_exact_item_memory_source_event_identity_mismatch',
  CLASSIFICATION_STATE_INVALID: 'runtime_exact_item_memory_classification_state_invalid',
  TMDB_REFERENCE_MISSING: 'runtime_exact_item_memory_tmdb_reference_missing',
});

const RESOLVED_CLASSIFICATION_STATUS_IDS = new Set(['completed', 'routed']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

function normalizeMediaType(value) {
  const mediaType = normalizeString(value, 20).toLowerCase();
  return ['movie', 'tv'].includes(mediaType) ? mediaType : null;
}

function normalizeOutcomeDestinationId(value) {
  return normalizeIdentifier(value);
}

function buildPolicyRuntimeExactItemMemorySourceEventId({
  classificationId,
  contractFingerprint,
} = {}) {
  const normalizedClassificationId = normalizeIdentifier(classificationId);
  const fingerprint = normalizeString(contractFingerprint, 64);

  return normalizedClassificationId && fingerprint
    ? `runtime_exact_item_memory:${normalizedClassificationId}:${fingerprint}`
    : null;
}

function buildBlockedExecutionState(reasonId) {
  return {
    ok: false,
    reasonId,
    classification: null,
    destination: null,
    resolution: null,
    currentState: null,
  };
}

function normalizeLockedClassification(row = {}) {
  const source = asObject(row);

  return {
    id: normalizeIdentifier(source.id),
    tmdbId: normalizeIdentifier(source.tmdb_id ?? source.tmdbId),
    mediaType: normalizeMediaType(source.media_type ?? source.mediaType),
    status: normalizeString(source.status, 40) || null,
    currentDestinationLibraryId: normalizeIdentifier(source.library_id ?? source.libraryId),
    currentDestinationLibraryName: normalizeString(source.library_name ?? source.libraryName, 255) || null,
    metadata: safeParseJsonObject(source.metadata, {}),
  };
}

function normalizeLockedDestination(row = {}) {
  const source = asObject(row);

  return {
    id: normalizeIdentifier(source.id),
    name: normalizeString(source.name, 255) || null,
    mediaType: normalizeMediaType(source.media_type ?? source.mediaType),
    active: source.is_active === true || source.active === true,
  };
}

function normalizeRuntimeResolution(classification = {}) {
  const source = asObject(classification);
  const details = asObject(asObject(source.metadata).classification_details);
  const outcome = asObject(details.outcome_link);
  const answer = asObject(outcome.runtime_question_answer);
  const actionId = normalizeString(answer.action_id, 80);
  const contractVersion = normalizeString(answer.contract_version, 80);
  const contractFingerprint = normalizeString(answer.contract_fingerprint, 64);
  const finalDestinationLibraryId = normalizeOutcomeDestinationId(outcome.final_library_id);
  const finalDestinationLibraryName = normalizeString(outcome.final_library_name, 255) || null;
  const sourceEventId = buildPolicyRuntimeExactItemMemorySourceEventId({
    classificationId: source.id,
    contractFingerprint,
  });
  const validAnswer = contractVersion === POLICY_RUNTIME_QUESTION_ANSWER_CONTRACT_VERSION &&
    /^[A-Za-z0-9_-]{22}$/.test(contractFingerprint) &&
    isPolicyRuntimeQuestionResolutionAction(actionId) &&
    actionId !== POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.MARK_EXACT_ITEM_MEMORY &&
    normalizeOutcomeDestinationId(answer.destination_library_id) === finalDestinationLibraryId;

  return {
    finalOutcomeRecorded: outcome.type === 'resolved' && outcome.source === 'policy_question',
    finalDestinationLibraryId,
    finalDestinationLibraryName,
    contractVersion: contractVersion || null,
    contractFingerprint: contractFingerprint || null,
    actionId: actionId || null,
    sourceEventId,
    validAnswer,
  };
}

function expectedClassificationId(intake = {}, classificationId = null) {
  return normalizeIdentifier(asObject(intake).finalOutcome?.itemId) ||
    normalizeIdentifier(classificationId);
}

async function lockPolicyRuntimeExactItemMemoryExecutionState({
  client,
  intake = {},
  classificationId = null,
} = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Runtime exact-item memory requires a transaction client.');
  }

  const lockedClassificationId = expectedClassificationId(intake, classificationId);
  if (!lockedClassificationId) {
    return buildBlockedExecutionState(
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.CLASSIFICATION_NOT_FOUND,
    );
  }

  const classification = normalizeLockedClassification(firstRow(await client.query(
    `SELECT id, tmdb_id, media_type, status, library_id, library_name, metadata
     FROM classification_history
     WHERE id = $1
     FOR UPDATE`,
    [lockedClassificationId],
  )));
  if (!classification.id || !classification.mediaType) {
    return buildBlockedExecutionState(
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.CLASSIFICATION_NOT_FOUND,
    );
  }
  if (!classification.tmdbId) {
    return buildBlockedExecutionState(
      POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.TMDB_REFERENCE_MISSING,
    );
  }
  if (!RESOLVED_CLASSIFICATION_STATUS_IDS.has(classification.status)) {
    return buildBlockedExecutionState(
      POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.CLASSIFICATION_STATE_INVALID,
    );
  }

  const resolution = normalizeRuntimeResolution(classification);
  if (!resolution.finalOutcomeRecorded) {
    return buildBlockedExecutionState(
      POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.FINAL_OUTCOME_NOT_RUNTIME_RESOLUTION,
    );
  }
  if (!resolution.finalDestinationLibraryId || !resolution.finalDestinationLibraryName) {
    return buildBlockedExecutionState(
      POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.FINAL_OUTCOME_MISSING,
    );
  }
  if (!resolution.validAnswer || !resolution.sourceEventId) {
    return buildBlockedExecutionState(
      POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.INVALID_RUNTIME_ANSWER,
    );
  }
  if (resolution.finalDestinationLibraryId !== classification.currentDestinationLibraryId ||
      resolution.finalDestinationLibraryName !== classification.currentDestinationLibraryName) {
    return buildBlockedExecutionState(
      POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.FINAL_OUTCOME_DESTINATION_MISMATCH,
    );
  }

  const destination = normalizeLockedDestination(firstRow(await client.query(
    `SELECT id, name, media_type, is_active
     FROM libraries
     WHERE id = $1
     FOR UPDATE`,
    [classification.currentDestinationLibraryId],
  )));
  if (!destination.id || !destination.name || !destination.mediaType) {
    return buildBlockedExecutionState(
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.DESTINATION_NOT_FOUND,
    );
  }
  if (!destination.active) {
    return buildBlockedExecutionState(
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.DESTINATION_INACTIVE,
    );
  }
  if (destination.mediaType !== classification.mediaType) {
    return buildBlockedExecutionState(
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.DESTINATION_MEDIA_TYPE_MISMATCH,
    );
  }

  const expectedIntake = asObject(intake);
  const expectedOutcome = asObject(expectedIntake.finalOutcome);
  if (expectedOutcome.itemId && normalizeIdentifier(expectedOutcome.itemId) !== classification.id ||
      expectedOutcome.destinationLibraryId &&
        normalizeIdentifier(expectedOutcome.destinationLibraryId) !== destination.id ||
      expectedOutcome.destinationLibraryName &&
        normalizeString(expectedOutcome.destinationLibraryName, 255) !== destination.name ||
      expectedIntake.sourceEventId &&
        normalizeString(expectedIntake.sourceEventId, 160) !== resolution.sourceEventId) {
    return buildBlockedExecutionState(
      POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS.SOURCE_EVENT_IDENTITY_MISMATCH,
    );
  }

  return {
    ok: true,
    reasonId: null,
    classification,
    destination,
    resolution,
    currentState: {
      classificationId: classification.id,
      sourceEventId: resolution.sourceEventId,
      destinationLibraryId: destination.id,
      destinationLibraryName: destination.name,
      locked: true,
    },
  };
}

export {
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_STATE_REASON_IDS,
  RESOLVED_CLASSIFICATION_STATUS_IDS,
  buildBlockedExecutionState,
  buildPolicyRuntimeExactItemMemorySourceEventId,
  lockPolicyRuntimeExactItemMemoryExecutionState,
  normalizeLockedClassification,
  normalizeLockedDestination,
  normalizeRuntimeResolution,
};
