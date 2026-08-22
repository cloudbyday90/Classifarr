/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const AI_CLASSIFICATION_EVALUATION_FIXTURE_VERSION =
  'classifarr.ai_classification_evaluation_fixture.v1';
const AI_CLASSIFICATION_EVALUATION_DECISION_KINDS = Object.freeze([
  'classified', 'clarification', 'retry',
]);
const AI_CLASSIFICATION_EVALUATION_HISTORY_STATUSES = Object.freeze([
  'awaiting_decision', 'completed', 'pending_retry',
]);
const AI_CLASSIFICATION_EVALUATION_RISK_IDS = Object.freeze({
  INVALID_CONFIDENCE_RANGE: 'invalid_confidence_range',
  INVALID_DECISION_KIND: 'invalid_decision_kind',
  INVALID_FIXTURE_ID: 'invalid_fixture_id',
  INVALID_FIXTURE_VERSION: 'invalid_fixture_version',
  INVALID_HISTORY_STATUS: 'invalid_history_status',
  INVALID_LIBRARY_SELECTOR: 'invalid_library_selector',
  INVALID_MEDIA_TYPE: 'invalid_media_type',
  INVALID_METHOD: 'invalid_method',
  INVALID_OBSERVATION: 'invalid_observation',
  INVALID_REQUEST: 'invalid_request',
  INVALID_STRING: 'invalid_string',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  OUTCOME_CONSTRAINT_MISMATCH: 'outcome_constraint_mismatch',
  UNKNOWN_FIELD: 'unknown_field',
});
const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const METHOD_ID_PATTERN = /^[a-z][a-z0-9_]{0,79}$/u;
const TAG_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,47}$/u;
const MAX_OUTCOMES = 4;
const MAX_TAGS = 8;
const MAX_TEXT_LENGTH = 255;
const MAX_TITLE_LENGTH = 240;

function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function buildIssue(riskId, path, message) {
  return { riskId, path, message };
}

function hasOnlyKeys(value, allowedKeys, path, issues) {
  if (!isRecord(value)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_OBSERVATION, path, 'Value must be a JSON object.'));
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.UNKNOWN_FIELD, `${path}.${key}`, 'Field is not allowed by this evaluation contract.'));
    }
  }
  return true;
}

function requireOwnField(value, key, path, issues) {
  if (Object.hasOwn(value, key)) return true;
  issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.MISSING_REQUIRED_FIELD, `${path}.${key}`, 'Field is required by this evaluation contract.'));
  return false;
}

function validateBoundedText(value, path, issues, maximumLength = MAX_TEXT_LENGTH) {
  const isValid = typeof value === 'string' && value.trim().length > 0 &&
    value.length <= maximumLength && !/[\u0000-\u001F\u007F]/u.test(value);
  if (!isValid) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_STRING, path, `Value must be non-empty, at most ${maximumLength} characters, and contain no control characters.`));
  }
  return isValid;
}

function validateIdentifier(value, path, issues, pattern, riskId) {
  const isValid = typeof value === 'string' && pattern.test(value);
  if (!isValid) {
    issues.push(buildIssue(riskId, path, 'Value must be a lower-case, bounded identifier using only letters, numbers, dots, underscores, or hyphens.'));
  }
  return isValid;
}

function validatePositiveInteger(value, path, issues) {
  const isValid = Number.isSafeInteger(value) && value >= 1 && value <= 2147483647;
  if (!isValid) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_REQUEST, path, 'Value must be a positive 32-bit integer.'));
  }
  return isValid;
}

function validateLibrarySelector(value, path, issues) {
  if (!isRecord(value)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_LIBRARY_SELECTOR, path, 'Library selector must be an object containing an id, a name, or both.'));
    return false;
  }
  hasOnlyKeys(value, ['id', 'name'], path, issues);
  const hasId = Object.hasOwn(value, 'id');
  const hasName = Object.hasOwn(value, 'name');
  if (!hasId && !hasName) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_LIBRARY_SELECTOR, path, 'Library selector requires an id, a name, or both.'));
    return false;
  }
  if (hasId) validatePositiveInteger(value.id, `${path}.id`, issues);
  if (hasName) validateBoundedText(value.name, `${path}.name`, issues);
  return true;
}

function validateStringIdentifierList(value, path, issues, pattern, riskId, maximumLength) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumLength) {
    issues.push(buildIssue(riskId, path, `Value must be a non-empty array with at most ${maximumLength} entries.`));
    return false;
  }
  const seen = new Set();
  for (let index = 0; index < value.length; index += 1) {
    validateIdentifier(value[index], `${path}[${index}]`, issues, pattern, riskId);
    if (seen.has(value[index])) issues.push(buildIssue(riskId, `${path}[${index}]`, 'Array entries must be unique.'));
    seen.add(value[index]);
  }
  return true;
}

function validateConfidence(value, path, issues) {
  if (!isRecord(value)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_CONFIDENCE_RANGE, path, 'Confidence expectation must be an object.'));
    return false;
  }
  hasOnlyKeys(value, ['maximum', 'minimum'], path, issues);
  const hasMinimum = requireOwnField(value, 'minimum', path, issues);
  const hasMaximum = requireOwnField(value, 'maximum', path, issues);
  if (!hasMinimum || !hasMaximum) return false;
  const isValid = Number.isFinite(value.minimum) && Number.isFinite(value.maximum) &&
    value.minimum >= 0 && value.maximum <= 100 && value.minimum <= value.maximum;
  if (!isValid) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_CONFIDENCE_RANGE, path, 'Confidence range must be finite, inclusive, between 0 and 100, and have minimum <= maximum.'));
  }
  return isValid;
}

export {
  AI_CLASSIFICATION_EVALUATION_DECISION_KINDS,
  AI_CLASSIFICATION_EVALUATION_FIXTURE_VERSION,
  AI_CLASSIFICATION_EVALUATION_HISTORY_STATUSES,
  AI_CLASSIFICATION_EVALUATION_RISK_IDS,
  FIXTURE_ID_PATTERN,
  MAX_OUTCOMES,
  MAX_TAGS,
  MAX_TITLE_LENGTH,
  METHOD_ID_PATTERN,
  TAG_ID_PATTERN,
  buildIssue,
  hasOnlyKeys,
  isRecord,
  requireOwnField,
  validateBoundedText,
  validateConfidence,
  validateIdentifier,
  validateLibrarySelector,
  validatePositiveInteger,
  validateStringIdentifierList,
};
