/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import {
  buildPolicyRuntimeQuestionAnswerOutcome,
  getPolicyRuntimeQuestionAnswerSelectedOption,
  isPolicyRuntimeQuestionResolutionAction,
  parsePolicyRuntimeQuestionAnswer,
  validatePolicyRuntimeQuestionAnswer,
} from './policyRuntimeQuestionAnswerContract.mjs';
import {
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS,
} from './policyRuntimePendingQuestionCleanupPlan.mjs';
import { parsePersistedObject } from './policyRuntimePendingQuestionCleanupContext.mjs';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getRecordedRuntimeQuestionAnswer(metadata) {
  return asObject(asObject(asObject(metadata).classification_details).outcome_link)
    .runtime_question_answer || null;
}

function buildRetryRequiredResult(reasonId) {
  return {
    resolved: false,
    retryRequired: true,
    reasonId,
  };
}

async function loadActiveMatchingDestination({
  client,
  classification,
  destinationLibraryId,
} = {}) {
  const result = await client.query(
    `SELECT id, name, media_type, is_active
     FROM libraries
     WHERE id = $1
     FOR UPDATE`,
    [destinationLibraryId],
  );
  const destination = result.rows?.[0] || null;
  if (!destination || destination.is_active !== true) return null;

  const classificationMediaType = String(classification.media_type || '').toLowerCase();
  const destinationMediaType = String(destination.media_type || '').toLowerCase();
  if (!classificationMediaType || classificationMediaType !== destinationMediaType) return null;

  return destination;
}

async function replayRecordedRuntimeQuestionAnswer({
  client,
  classification = {},
  currentContextVersion = null,
  actorId,
  outcomeService = classificationOutcomeService,
} = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Pending-question cleanup outcome replay requires a transaction client.');
  }

  const metadata = parsePersistedObject(classification.metadata);
  const recordedAnswer = getRecordedRuntimeQuestionAnswer(metadata);
  const parsedAnswer = parsePolicyRuntimeQuestionAnswer(recordedAnswer);
  if (!parsedAnswer.ok) {
    return buildRetryRequiredResult(
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RUNTIME_ANSWER_INVALID_CURRENT_STATE,
    );
  }

  const question = parsePersistedObject(classification.policy_question ?? classification.policyQuestion);
  const validation = validatePolicyRuntimeQuestionAnswer({
    classification,
    question,
    answer: parsedAnswer.answer,
    isStale: false,
    currentContextVersion,
  });
  if (!validation.ok || !isPolicyRuntimeQuestionResolutionAction(validation.answer.actionId)) {
    return buildRetryRequiredResult(
      validation.ok
        ? POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RUNTIME_ANSWER_REQUIRES_RETRY
        : POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RUNTIME_ANSWER_INVALID_CURRENT_STATE,
    );
  }

  const destination = await loadActiveMatchingDestination({
    client,
    classification,
    destinationLibraryId: validation.answer.destinationLibraryId,
  });
  if (!destination) {
    return buildRetryRequiredResult(
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RUNTIME_ANSWER_INVALID_CURRENT_STATE,
    );
  }

  const selectedOption = getPolicyRuntimeQuestionAnswerSelectedOption({
    question,
    answer: validation.answer,
  });
  if (!selectedOption) {
    return buildRetryRequiredResult(
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RUNTIME_ANSWER_INVALID_CURRENT_STATE,
    );
  }

  await client.query('DELETE FROM clarification_responses WHERE classification_id = $1', [classification.id]);
  await client.query(
    `UPDATE classification_history
     SET status = 'completed',
         library_id = $2,
         library_name = $3,
         confidence = 100,
         method = 'manual_classification',
         reason = 'Resolved recorded runtime answer by pending-question cleanup',
         pending_reason = NULL,
         policy_question = NULL,
         clarification_response = NULL
     WHERE id = $1`,
    [classification.id, destination.id, destination.name],
  );

  const outcomeWrite = await outcomeService.recordOutcome(classification.id, {
    type: 'resolved',
    source: 'pending_question_cleanup',
    actor: actorId,
    selected_option: selectedOption,
    final_library_id: destination.id,
    final_library_name: destination.name,
    runtime_question_answer: buildPolicyRuntimeQuestionAnswerOutcome(validation.answer),
  }, { client });
  if (outcomeWrite.updated !== true) {
    throw new Error('Could not persist the recorded runtime-question outcome.');
  }

  return {
    resolved: true,
    retryRequired: false,
    reasonId: null,
  };
}

export {
  getRecordedRuntimeQuestionAnswer,
  replayRecordedRuntimeQuestionAnswer,
};
