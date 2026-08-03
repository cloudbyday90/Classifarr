/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';

import {
  getRuntimeQuestionNormalizationStatus,
} from './policyRuntimeQuestionNormalizer.mjs';
import {
  buildNativePendingQuestionPresentation,
} from './policyNativePendingQuestionPresentation.mjs';
import {
  isPolicyRuntimeQuestionPersistenceEnvelope,
} from './policyRuntimeQuestionPersistenceContract.mjs';

const POLICY_RUNTIME_QUESTION_ANSWER_CONTRACT_VERSION =
  'policy.runtime_question_answer.v1';

const POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS = Object.freeze({
  CONFIRM_DESTINATION: 'confirm_destination',
  CHANGE_DESTINATION: 'change_destination',
  ROUTE_NOT_APPLICABLE: 'route_not_applicable',
  RETRY_CLASSIFICATION: 'retry_classification',
  MARK_EXACT_ITEM_MEMORY: 'mark_exact_item_memory',
  REQUEST_POLICY_EDIT: 'request_policy_edit',
});

const POLICY_RUNTIME_QUESTION_ANSWER_ACTION_CODES = Object.freeze({
  [POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION]: 'c',
  [POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.ROUTE_NOT_APPLICABLE]: 'n',
});

const POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS = Object.freeze({
  INVALID_ANSWER: 'invalid_runtime_question_answer',
  UNSUPPORTED_CONTRACT_VERSION: 'unsupported_runtime_question_answer_version',
  STALE_QUESTION: 'stale_runtime_question_answer',
  INVALID_QUESTION: 'invalid_runtime_question_answer_question',
  CONTRACT_FINGERPRINT_MISMATCH: 'runtime_question_answer_fingerprint_mismatch',
  UNSUPPORTED_ACTION: 'unsupported_runtime_question_answer_action',
  ACTION_UNAVAILABLE: 'runtime_question_answer_action_unavailable',
  DESTINATION_REQUIRED: 'runtime_question_answer_destination_required',
  DESTINATION_NOT_CANDIDATE: 'runtime_question_answer_destination_not_candidate',
  UNEXPECTED_DESTINATION: 'runtime_question_answer_unexpected_destination',
});

const DESTINATION_REQUIRED_ACTION_IDS = new Set([
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CHANGE_DESTINATION,
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.ROUTE_NOT_APPLICABLE,
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.MARK_EXACT_ITEM_MEMORY,
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.REQUEST_POLICY_EDIT,
]);

const RESOLUTION_ACTION_IDS = new Set([
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CHANGE_DESTINATION,
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.ROUTE_NOT_APPLICABLE,
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value, maximumLength = 160) {
  if (typeof value !== 'string') return null;

  const normalized = value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized && normalized.length <= maximumLength ? normalized : null;
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${stableSerialize(value[key])}`
    )).join(',')}}`;
  }

  return JSON.stringify(value);
}

function buildContractFingerprint(value) {
  return createHash('sha256')
    .update(stableSerialize(value))
    .digest('base64url')
    .slice(0, 22);
}

function normalizeCandidateDestination(value = {}) {
  const source = asObject(value);
  const libraryId = normalizePositiveInteger(source.library_id ?? source.libraryId ?? source.id);
  const libraryName = normalizeString(source.library_name ?? source.libraryName ?? source.name);

  return libraryId && libraryName
    ? { library_id: libraryId, library_name: libraryName }
    : null;
}

function uniqueCandidateDestinations(destinations = []) {
  const seen = new Set();

  return destinations
    .map(normalizeCandidateDestination)
    .filter(destination => {
      if (!destination || seen.has(destination.library_id)) return false;
      seen.add(destination.library_id);
      return true;
    });
}

function buildNormalizedQuestionProjection(question) {
  const source = asObject(question);
  const normalization = asObject(source.meta?.runtime_question_normalization);

  return {
    type: 'normalized_runtime_question',
    uncertainty_type: normalizeString(normalization.uncertainty_type, 80) || 'manual_selection_needed',
    text: normalizeString(source.question, 280) || 'Choose a destination for this item.',
    why_uncertain: normalizeString(source.why_uncertain, 280) ||
      'Current evidence is not sufficient to select a destination automatically.',
    candidate_destinations: uniqueCandidateDestinations(source.options),
  };
}

function buildNativeQuestionProjection(question) {
  const source = asObject(question);
  const runtimeQuestion = asObject(source.runtimeQuestion);
  const presentation = buildNativePendingQuestionPresentation(source);

  if (!presentation) return null;

  return {
    type: 'native_runtime_question',
    uncertainty_type: normalizeString(runtimeQuestion.frameId, 80) || 'native_persistence',
    text: 'Confirm or change the destination for this item.',
    why_uncertain: 'The runtime decision requires a bounded operator outcome.',
    candidate_destinations: uniqueCandidateDestinations([presentation.destination]),
  };
}

function buildQuestionProjection(question) {
  if (isPolicyRuntimeQuestionPersistenceEnvelope(question)) {
    return buildNativeQuestionProjection(question);
  }

  return buildNormalizedQuestionProjection(question);
}

function buildCandidateItem(classification = {}) {
  const source = asObject(classification);
  const year = Number(source.year);

  return {
    classification_id: normalizePositiveInteger(source.id),
    title: normalizeString(source.title, 280),
    year: Number.isInteger(year) && year >= 1870 && year <= 9999 ? year : null,
    media_type: normalizeString(source.media_type, 32)?.toLowerCase() || null,
  };
}

function buildAction({ id, available, destinationRequired, destinationScope, unavailableReason = null }) {
  return {
    id,
    available: available === true,
    destination_required: destinationRequired === true,
    destination_scope: destinationScope || 'none',
    unavailable_reason: unavailableReason,
  };
}

function buildActions({ candidateDestinations, isStale }) {
  const canConfirm = !isStale && candidateDestinations.length > 0;
  const canChooseDestination = !isStale;
  const blockedReason = isStale ? 'question_stale' : null;

  return [
    buildAction({
      id: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
      available: canConfirm,
      destinationRequired: true,
      destinationScope: 'candidate_destinations',
      unavailableReason: canConfirm ? null : (blockedReason || 'candidate_destination_required'),
    }),
    buildAction({
      id: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CHANGE_DESTINATION,
      available: canChooseDestination,
      destinationRequired: true,
      destinationScope: 'active_matching_media_type',
      unavailableReason: blockedReason,
    }),
    buildAction({
      id: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.ROUTE_NOT_APPLICABLE,
      available: canChooseDestination,
      destinationRequired: true,
      destinationScope: 'active_matching_media_type',
      unavailableReason: blockedReason,
    }),
    buildAction({
      id: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.RETRY_CLASSIFICATION,
      available: true,
      destinationRequired: false,
      destinationScope: 'none',
    }),
    buildAction({
      id: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.MARK_EXACT_ITEM_MEMORY,
      available: false,
      destinationRequired: true,
      destinationScope: 'active_matching_media_type',
      unavailableReason: 'learning_guard_required',
    }),
    buildAction({
      id: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.REQUEST_POLICY_EDIT,
      available: false,
      destinationRequired: true,
      destinationScope: 'active_matching_media_type',
      unavailableReason: 'policy_edit_admission_required',
    }),
  ];
}

function buildPolicyRuntimeQuestionAnswerContract({
  classification = {},
  question = null,
  isStale = false,
  currentContextVersion = null,
} = {}) {
  const normalizationStatus = getRuntimeQuestionNormalizationStatus(question);
  const candidateItem = buildCandidateItem(classification);
  if (!candidateItem.classification_id || !normalizationStatus.actionable) {
    return null;
  }

  const questionProjection = buildQuestionProjection(question);
  if (!questionProjection) return null;

  const actions = buildActions({
    candidateDestinations: questionProjection.candidate_destinations,
    isStale,
  });
  const fingerprint = buildContractFingerprint({
    version: POLICY_RUNTIME_QUESTION_ANSWER_CONTRACT_VERSION,
    classification_id: candidateItem.classification_id,
    media_type: candidateItem.media_type,
    question_contract: normalizationStatus.contract,
    question: questionProjection,
  });

  return {
    version: POLICY_RUNTIME_QUESTION_ANSWER_CONTRACT_VERSION,
    fingerprint,
    question: {
      type: questionProjection.type,
      uncertainty_type: questionProjection.uncertainty_type,
      text: questionProjection.text,
      why_uncertain: questionProjection.why_uncertain,
    },
    candidate_item: candidateItem,
    candidate_destinations: questionProjection.candidate_destinations,
    allowed_actions: actions,
    selected_option_requirements: {
      values_are_server_ids: true,
      free_form_labels_accepted: false,
      active_matching_media_type_required_for_changes: true,
    },
    learning: {
      eligible: false,
      tier: 'blocked',
      can_authorize_learning: false,
      reason: 'learning_guard_required',
    },
    freshness: {
      status: isStale ? 'stale' : 'current',
      current_context_version: normalizeString(currentContextVersion, 80),
    },
  };
}

function parsePolicyRuntimeQuestionAnswer(value = {}) {
  const source = asObject(value);
  const forbiddenLegacyFields = [
    'selected_option',
    'library_id',
    'resolved_by',
    'generate_rule',
  ];
  if (forbiddenLegacyFields.some(field => Object.hasOwn(source, field))) {
    return { ok: false, reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.INVALID_ANSWER };
  }
  const contractVersion = normalizeString(source.contract_version, 120);
  const contractFingerprint = normalizeString(source.contract_fingerprint, 80);
  const actionId = normalizeString(source.action_id, 80);
  const destinationLibraryId = source.destination_library_id === undefined || source.destination_library_id === null
    ? null
    : normalizePositiveInteger(source.destination_library_id);

  if (!contractVersion || !contractFingerprint || !actionId ||
      !Object.values(POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS).includes(actionId)) {
    return { ok: false, reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.INVALID_ANSWER };
  }

  if (DESTINATION_REQUIRED_ACTION_IDS.has(actionId) && !destinationLibraryId) {
    return { ok: false, reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.DESTINATION_REQUIRED };
  }

  if (!DESTINATION_REQUIRED_ACTION_IDS.has(actionId) && source.destination_library_id !== undefined) {
    return { ok: false, reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.UNEXPECTED_DESTINATION };
  }

  return {
    ok: true,
    answer: {
      contractVersion,
      contractFingerprint,
      actionId,
      destinationLibraryId,
    },
  };
}

function getAction(contract, actionId) {
  return asArray(contract?.allowed_actions).find(action => action?.id === actionId) || null;
}

function validatePolicyRuntimeQuestionAnswer({
  classification = {},
  question = null,
  answer = {},
  isStale = false,
  currentContextVersion = null,
} = {}) {
  const parsedAnswer = answer?.actionId
    ? { ok: true, answer }
    : parsePolicyRuntimeQuestionAnswer(answer);
  if (!parsedAnswer.ok) return parsedAnswer;

  const contract = buildPolicyRuntimeQuestionAnswerContract({
    classification,
    question,
    isStale,
    currentContextVersion,
  });
  if (!contract) {
    return { ok: false, reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.INVALID_QUESTION };
  }
  if (parsedAnswer.answer.contractVersion !== contract.version) {
    return { ok: false, reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.UNSUPPORTED_CONTRACT_VERSION };
  }
  if (parsedAnswer.answer.contractFingerprint !== contract.fingerprint) {
    return { ok: false, reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.CONTRACT_FINGERPRINT_MISMATCH };
  }
  if (contract.freshness.status !== 'current') {
    return { ok: false, reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.STALE_QUESTION };
  }

  const action = getAction(contract, parsedAnswer.answer.actionId);
  if (!action) {
    return { ok: false, reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.UNSUPPORTED_ACTION };
  }
  if (action.available !== true) {
    return {
      ok: false,
      reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.ACTION_UNAVAILABLE,
      unavailableReason: action.unavailable_reason || null,
    };
  }
  if (action.destination_required === true && !parsedAnswer.answer.destinationLibraryId) {
    return { ok: false, reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.DESTINATION_REQUIRED };
  }
  if (action.destination_scope === 'candidate_destinations') {
    const candidateIds = new Set(contract.candidate_destinations.map(destination => destination.library_id));
    if (!candidateIds.has(parsedAnswer.answer.destinationLibraryId)) {
      return { ok: false, reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.DESTINATION_NOT_CANDIDATE };
    }
  }

  return {
    ok: true,
    answer: parsedAnswer.answer,
    action,
    contract,
  };
}

function isPolicyRuntimeQuestionResolutionAction(actionId) {
  return RESOLUTION_ACTION_IDS.has(actionId);
}

function getPolicyRuntimeQuestionAnswerActionCode(actionId) {
  return POLICY_RUNTIME_QUESTION_ANSWER_ACTION_CODES[actionId] || null;
}

function getPolicyRuntimeQuestionAnswerActionIdFromCode(actionCode) {
  const normalizedCode = normalizeString(actionCode, 8);
  return Object.entries(POLICY_RUNTIME_QUESTION_ANSWER_ACTION_CODES)
    .find(([, code]) => code === normalizedCode)?.[0] || null;
}

function buildPolicyRuntimeQuestionAnswerOutcome(answer = {}) {
  return {
    contract_version: answer.contractVersion || null,
    contract_fingerprint: answer.contractFingerprint || null,
    action_id: answer.actionId || null,
    destination_library_id: normalizePositiveInteger(answer.destinationLibraryId),
  };
}

function getPolicyRuntimeQuestionAnswerSelectedOption({
  question = null,
  answer = {},
} = {}) {
  const actionId = answer.actionId;
  if (!isPolicyRuntimeQuestionPersistenceEnvelope(question)) {
    return actionId || null;
  }

  const presentation = buildNativePendingQuestionPresentation(question);
  if (!presentation) return null;

  const selectedDestinationId = normalizePositiveInteger(answer.destinationLibraryId);
  if (selectedDestinationId !== presentation.destination.libraryId) {
    return presentation.alternativeDestination.selectedOptionLabel;
  }

  const preferredOutcomeId = actionId === POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.ROUTE_NOT_APPLICABLE
    ? 'do_not_learn'
    : 'resolve_current_item';
  return presentation.actions.find(action => action.id === preferredOutcomeId)?.selectedOptionLabel || null;
}

export {
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_CODES,
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
  POLICY_RUNTIME_QUESTION_ANSWER_CONTRACT_VERSION,
  POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS,
  buildPolicyRuntimeQuestionAnswerContract,
  buildPolicyRuntimeQuestionAnswerOutcome,
  getPolicyRuntimeQuestionAnswerActionCode,
  getPolicyRuntimeQuestionAnswerActionIdFromCode,
  getPolicyRuntimeQuestionAnswerSelectedOption,
  isPolicyRuntimeQuestionResolutionAction,
  parsePolicyRuntimeQuestionAnswer,
  validatePolicyRuntimeQuestionAnswer,
};
