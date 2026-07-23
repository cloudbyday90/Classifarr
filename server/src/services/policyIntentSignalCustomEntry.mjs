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
  POLICY_AUTHORING_OPTION_SOURCE_IDS,
} from './policyAuthoringComponentSystem.mjs';
import {
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
} from './policyAuthoringDestinationFlow.mjs';

const POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_VERSION = 'policy.intent_signal_custom_entry.v1';
const MAX_CUSTOM_VALUE_LENGTH = 160;
const MAX_CUSTOM_EXPLANATION_LENGTH = 320;

const POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_SIGNAL_TYPES = Object.freeze([
  Object.freeze({ id: 'genres', label: 'Genre' }),
  Object.freeze({ id: 'keywords', label: 'Keyword' }),
  Object.freeze({ id: 'studios', label: 'Studio' }),
]);

const CUSTOM_ENTRY_SIGNAL_TYPE_IDS = new Set(
  POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_SIGNAL_TYPES.map(signalType => signalType.id),
);
const ALLOWED_REQUEST_FIELDS = new Set(['signalType', 'value', 'explanation']);

const POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: 'POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_INVALID_REQUEST',
  INVALID_SIGNAL_TYPE: 'POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_INVALID_SIGNAL_TYPE',
  INVALID_VALUE: 'POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_INVALID_VALUE',
  INVALID_EXPLANATION: 'POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_INVALID_EXPLANATION',
});

export class PolicyIntentSignalCustomEntryValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PolicyIntentSignalCustomEntryValidationError';
    this.code = code;
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function hasControlCharacters(value) {
  return /[\u0000-\u001F\u007F-\u009F]/u.test(value);
}

function normalizeCustomText(value, {
  maximumLength,
  fieldName,
  errorCode,
} = {}) {
  if (typeof value !== 'string') {
    throw new PolicyIntentSignalCustomEntryValidationError(
      `${fieldName} must be a text value.`,
      errorCode,
    );
  }

  const canonicalValue = value.normalize('NFKC');
  if (hasControlCharacters(canonicalValue)) {
    throw new PolicyIntentSignalCustomEntryValidationError(
      `${fieldName} cannot contain control characters.`,
      errorCode,
    );
  }

  const normalizedValue = canonicalValue.replace(/\s+/gu, ' ').trim();
  if (!normalizedValue) {
    throw new PolicyIntentSignalCustomEntryValidationError(
      `${fieldName} is required.`,
      errorCode,
    );
  }

  if (normalizedValue.length > maximumLength) {
    throw new PolicyIntentSignalCustomEntryValidationError(
      `${fieldName} must be ${maximumLength} characters or fewer.`,
      errorCode,
    );
  }

  return normalizedValue;
}

function normalizeCustomSignalType(value) {
  const signalType = normalizeCustomText(value, {
    maximumLength: 40,
    fieldName: 'Signal type',
    errorCode: POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES.INVALID_SIGNAL_TYPE,
  }).toLowerCase();

  if (!CUSTOM_ENTRY_SIGNAL_TYPE_IDS.has(signalType)) {
    throw new PolicyIntentSignalCustomEntryValidationError(
      'Signal type must be genre, keyword, or studio.',
      POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES.INVALID_SIGNAL_TYPE,
    );
  }

  return signalType;
}

function listPolicyIntentSignalCustomEntrySignalTypes() {
  return POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_SIGNAL_TYPES;
}

function isPolicyIntentSignalCustomEntrySignalType(value) {
  return typeof value === 'string' && CUSTOM_ENTRY_SIGNAL_TYPE_IDS.has(value);
}

function getPolicyIntentSignalCustomEntryInputContract() {
  return {
    version: POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_VERSION,
    enabled: true,
    signalTypes: listPolicyIntentSignalCustomEntrySignalTypes(),
    valueMaximumLength: MAX_CUSTOM_VALUE_LENGTH,
    explanationMaximumLength: MAX_CUSTOM_EXPLANATION_LENGTH,
    requiresExplanation: true,
  };
}

function isPolicyIntentSignalCustomEntryInputContract(value) {
  const source = asObject(value);
  if (!source || source.version !== POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_VERSION || source.enabled !== true) {
    return false;
  }

  if (
    source.valueMaximumLength !== MAX_CUSTOM_VALUE_LENGTH ||
    source.explanationMaximumLength !== MAX_CUSTOM_EXPLANATION_LENGTH ||
    source.requiresExplanation !== true ||
    !Array.isArray(source.signalTypes)
  ) {
    return false;
  }

  return source.signalTypes.length === POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_SIGNAL_TYPES.length &&
    source.signalTypes.every((signalType, index) => (
      signalType?.id === POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_SIGNAL_TYPES[index].id &&
      signalType?.label === POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_SIGNAL_TYPES[index].label
    ));
}

function buildPolicyIntentSignalCustomEntryCandidate(request = {}) {
  const payload = asObject(request);
  if (!payload) {
    throw new PolicyIntentSignalCustomEntryValidationError(
      'Custom intent-signal input must be an object.',
      POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES.INVALID_REQUEST,
    );
  }

  const unexpectedFields = Object.keys(payload).filter(field => !ALLOWED_REQUEST_FIELDS.has(field));
  if (unexpectedFields.length > 0) {
    throw new PolicyIntentSignalCustomEntryValidationError(
      'Custom intent-signal input contains unsupported fields.',
      POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES.INVALID_REQUEST,
    );
  }

  const signalType = normalizeCustomSignalType(payload.signalType);
  const value = normalizeCustomText(payload.value, {
    maximumLength: MAX_CUSTOM_VALUE_LENGTH,
    fieldName: 'Value',
    errorCode: POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES.INVALID_VALUE,
  });
  const explanation = normalizeCustomText(payload.explanation, {
    maximumLength: MAX_CUSTOM_EXPLANATION_LENGTH,
    fieldName: 'Explanation',
    errorCode: POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES.INVALID_EXPLANATION,
  });

  return {
    sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
    signalType,
    value,
    label: value,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    operator: 'require_any',
    explanation,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
  };
}

function getPolicyIntentSignalCustomEntryCandidateKey(candidate = {}) {
  const signalType = isPolicyIntentSignalCustomEntrySignalType(candidate?.signalType)
    ? candidate.signalType
    : '';
  const value = typeof candidate?.value === 'string'
    ? candidate.value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase()
    : '';

  return signalType && value ? `${signalType}:${value}` : '';
}

export {
  MAX_CUSTOM_EXPLANATION_LENGTH,
  MAX_CUSTOM_VALUE_LENGTH,
  POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_ERROR_CODES,
  POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_SIGNAL_TYPES,
  POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_VERSION,
  buildPolicyIntentSignalCustomEntryCandidate,
  getPolicyIntentSignalCustomEntryCandidateKey,
  getPolicyIntentSignalCustomEntryInputContract,
  isPolicyIntentSignalCustomEntryInputContract,
  isPolicyIntentSignalCustomEntrySignalType,
  listPolicyIntentSignalCustomEntrySignalTypes,
};
