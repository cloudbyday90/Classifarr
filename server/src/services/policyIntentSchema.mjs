/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_INTENT_CONTRACT_SCHEMA_VERSION = 1;

export const POLICY_INTENT_SOURCES = Object.freeze({
  EMPTY: 'empty',
  LEGACY_PRESETS: 'legacy_presets',
});

export const POLICY_INTENT_INFERENCE_STATES = Object.freeze({
  EMPTY: 'empty',
  INFERRED: 'inferred',
  PARTIAL: 'partial',
});

export const POLICY_INTENT_ROLES = Object.freeze({
  PURPOSE: 'purpose',
  HARD_LIMIT: 'hard_limit',
  HELPFUL_HINT: 'helpful_hint',
  AVOID: 'avoid',
});

export const POLICY_INTENT_COLLECTIONS = Object.freeze({
  PURPOSE: 'purpose',
  HARD_LIMITS: 'hard_limits',
  HELPFUL_HINTS: 'helpful_hints',
  AVOID: 'avoid',
});

const COLLECTION_ROLE_MAP = Object.freeze({
  [POLICY_INTENT_COLLECTIONS.PURPOSE]: POLICY_INTENT_ROLES.PURPOSE,
  [POLICY_INTENT_COLLECTIONS.HARD_LIMITS]: POLICY_INTENT_ROLES.HARD_LIMIT,
  [POLICY_INTENT_COLLECTIONS.HELPFUL_HINTS]: POLICY_INTENT_ROLES.HELPFUL_HINT,
  [POLICY_INTENT_COLLECTIONS.AVOID]: POLICY_INTENT_ROLES.AVOID,
});

export const SUPPORTED_POLICY_INTENT_SIGNAL_TYPES = Object.freeze([
  'genres',
  'keywords',
  'studios',
  'language',
  'media_type',
  'certifications',
  'release_year',
  'vote_average',
  'runtime',
]);

export const SUPPORTED_POLICY_INTENT_OPERATORS = Object.freeze([
  'require_all',
  'require_any',
  'prefer',
  'include',
  'exclude',
  'max',
  'range',
  'runtime_range',
  'configured',
]);

const PURPOSE_SIGNAL_TYPES = new Set(['genres', 'keywords', 'studios', 'media_type']);
const VALID_SOURCES = new Set(Object.values(POLICY_INTENT_SOURCES));
const VALID_INFERENCE_STATES = new Set(Object.values(POLICY_INTENT_INFERENCE_STATES));
const VALID_ROLES = new Set(Object.values(POLICY_INTENT_ROLES));
const VALID_SIGNAL_TYPES = new Set(SUPPORTED_POLICY_INTENT_SIGNAL_TYPES);
const VALID_OPERATORS = new Set(SUPPORTED_POLICY_INTENT_OPERATORS);
const VALID_CONSTRAINT_MODES = new Set(['strict', 'advisory', null, undefined]);
const VALID_SEMANTICS = new Set(['identity', 'compatibility', null, undefined]);

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function addIssue(issues, code, path, message) {
  issues.push({ code, path, message });
}

function validateRequiredArray(contract, collection, errors) {
  const value = contract?.[collection];
  if (!Array.isArray(value)) {
    addIssue(errors, 'invalid_collection', collection, `${collection} must be an array.`);
    return [];
  }

  return value;
}

function validateEntry(collection, entry, index, errors, warnings) {
  const path = `${collection}[${index}]`;
  const expectedRole = COLLECTION_ROLE_MAP[collection];

  if (!isPlainObject(entry)) {
    addIssue(errors, 'invalid_entry', path, 'Intent entries must be objects.');
    return;
  }

  if (entry.intent_role !== expectedRole) {
    addIssue(errors, 'invalid_role_for_collection', `${path}.intent_role`, `${collection} entries must use role ${expectedRole}.`);
  }

  if (!VALID_ROLES.has(entry.intent_role)) {
    addIssue(errors, 'unknown_intent_role', `${path}.intent_role`, 'Intent role is not supported by this schema version.');
  }

  if (!VALID_SIGNAL_TYPES.has(entry.signal_type)) {
    addIssue(errors, 'unknown_signal_type', `${path}.signal_type`, 'Signal type is not supported by this schema version.');
  }

  if (!VALID_OPERATORS.has(entry.operator)) {
    addIssue(errors, 'unknown_operator', `${path}.operator`, 'Operator is not supported by this schema version.');
  }

  if (!isPlainObject(entry.values)) {
    addIssue(errors, 'invalid_values', `${path}.values`, 'Entry values must be an object.');
  }

  if (!VALID_CONSTRAINT_MODES.has(entry.constraint_mode)) {
    addIssue(errors, 'unknown_constraint_mode', `${path}.constraint_mode`, 'Constraint mode is not supported by this schema version.');
  }

  if (!VALID_SEMANTICS.has(entry.semantics)) {
    addIssue(errors, 'unknown_semantics', `${path}.semantics`, 'Semantics value is not supported by this schema version.');
  }

  if (collection === POLICY_INTENT_COLLECTIONS.PURPOSE && !PURPOSE_SIGNAL_TYPES.has(entry.signal_type)) {
    addIssue(errors, 'purpose_requires_identity_capable_signal', `${path}.signal_type`, 'Purpose entries must use identity-capable signal types.');
  }

  if (collection === POLICY_INTENT_COLLECTIONS.HARD_LIMITS && entry.constraint_mode !== 'strict') {
    addIssue(errors, 'hard_limit_requires_strict_constraint', `${path}.constraint_mode`, 'Hard limits must be strict constraints.');
  }

  if (collection === POLICY_INTENT_COLLECTIONS.HELPFUL_HINTS && entry.constraint_mode === 'strict') {
    addIssue(errors, 'helpful_hint_cannot_be_strict', `${path}.constraint_mode`, 'Helpful hints cannot be strict constraints.');
  }

  if (collection === POLICY_INTENT_COLLECTIONS.AVOID && entry.operator !== 'exclude') {
    addIssue(warnings, 'avoid_should_be_exclusion', `${path}.operator`, 'Avoid entries should identify exclusion-style evidence.');
  }
}

export function validatePolicyIntentContract(contract = {}) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(contract)) {
    return {
      valid: false,
      error_count: 1,
      warning_count: 0,
      errors: [{
        code: 'invalid_contract',
        path: '',
        message: 'Policy intent contract must be an object.',
      }],
      warnings,
    };
  }

  if (contract.schema_version !== POLICY_INTENT_CONTRACT_SCHEMA_VERSION) {
    addIssue(errors, 'unsupported_schema_version', 'schema_version', `Expected schema version ${POLICY_INTENT_CONTRACT_SCHEMA_VERSION}.`);
  }

  if (!VALID_SOURCES.has(contract.source)) {
    addIssue(errors, 'unknown_source', 'source', 'Policy intent source is not supported by this schema version.');
  }

  if (!VALID_INFERENCE_STATES.has(contract.inference_state)) {
    addIssue(errors, 'unknown_inference_state', 'inference_state', 'Inference state is not supported by this schema version.');
  }

  for (const collection of Object.values(POLICY_INTENT_COLLECTIONS)) {
    const entries = validateRequiredArray(contract, collection, errors);
    entries.forEach((entry, index) => validateEntry(collection, entry, index, errors, warnings));
  }

  if (!isPlainObject(contract.review_behavior)) {
    addIssue(errors, 'invalid_review_behavior', 'review_behavior', 'Review behavior must be an object.');
  }

  if (!Array.isArray(contract.template_links)) {
    addIssue(errors, 'invalid_template_links', 'template_links', 'Template links must be an array.');
  }

  if (!Array.isArray(contract.warnings)) {
    addIssue(errors, 'invalid_warnings', 'warnings', 'Warnings must be an array.');
  }

  if (!Array.isArray(contract.unsupported_signals)) {
    addIssue(errors, 'invalid_unsupported_signals', 'unsupported_signals', 'Unsupported signals must be an array.');
  }

  return {
    valid: errors.length === 0,
    error_count: errors.length,
    warning_count: warnings.length,
    errors,
    warnings,
  };
}
