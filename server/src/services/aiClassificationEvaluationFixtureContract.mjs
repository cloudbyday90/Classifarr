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

import {
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
} from './aiClassificationEvaluationContractShared.mjs';

function validateExpectedOutcome(value, index, issues) {
  const path = `expected.outcomes[${index}]`;
  if (!isRecord(value)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_OBSERVATION, path, 'Expected outcome must be an object.'));
    return;
  }
  hasOnlyKeys(value, ['confidence', 'decisionKind', 'historyStatuses', 'library', 'methods'], path, issues);
  const hasDecisionKind = requireOwnField(value, 'decisionKind', path, issues);
  const hasMethods = requireOwnField(value, 'methods', path, issues);
  const hasHistoryStatuses = requireOwnField(value, 'historyStatuses', path, issues);
  if (hasDecisionKind && !AI_CLASSIFICATION_EVALUATION_DECISION_KINDS.includes(value.decisionKind)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_DECISION_KIND, `${path}.decisionKind`, 'Decision kind must be classified, clarification, or retry.'));
  }
  if (hasMethods) validateStringIdentifierList(value.methods, `${path}.methods`, issues, METHOD_ID_PATTERN, AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_METHOD, MAX_OUTCOMES);
  if (hasHistoryStatuses) {
    if (!Array.isArray(value.historyStatuses) || value.historyStatuses.length === 0 || value.historyStatuses.length > MAX_OUTCOMES) {
      issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_HISTORY_STATUS, `${path}.historyStatuses`, `Value must be a non-empty array with at most ${MAX_OUTCOMES} entries.`));
    } else {
      const seen = new Set();
      for (let statusIndex = 0; statusIndex < value.historyStatuses.length; statusIndex += 1) {
        const status = value.historyStatuses[statusIndex];
        if (!AI_CLASSIFICATION_EVALUATION_HISTORY_STATUSES.includes(status) || seen.has(status)) {
          issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_HISTORY_STATUS, `${path}.historyStatuses[${statusIndex}]`, 'History status must be a unique supported terminal or pending classification status.'));
        }
        seen.add(status);
      }
    }
  }
  if (value.decisionKind === 'classified') {
    const hasLibrary = requireOwnField(value, 'library', path, issues);
    const hasConfidence = requireOwnField(value, 'confidence', path, issues);
    if (hasLibrary) validateLibrarySelector(value.library, `${path}.library`, issues);
    if (hasConfidence) validateConfidence(value.confidence, `${path}.confidence`, issues);
    return;
  }
  for (const prohibitedField of ['confidence', 'library']) {
    if (Object.hasOwn(value, prohibitedField)) {
      issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.OUTCOME_CONSTRAINT_MISMATCH, `${path}.${prohibitedField}`, `${prohibitedField} is only valid for a classified expected outcome.`));
    }
  }
}

function validateRequest(value, issues) {
  const path = 'fixture.request';
  if (!isRecord(value)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_REQUEST, path, 'Request must be an object.'));
    return;
  }
  hasOnlyKeys(value, ['mediaType', 'title', 'tmdbId'], path, issues);
  const hasTmdbId = requireOwnField(value, 'tmdbId', path, issues);
  const hasMediaType = requireOwnField(value, 'mediaType', path, issues);
  const hasTitle = requireOwnField(value, 'title', path, issues);
  if (hasTmdbId) validatePositiveInteger(value.tmdbId, `${path}.tmdbId`, issues);
  if (hasMediaType && !['movie', 'tv'].includes(value.mediaType)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_MEDIA_TYPE, `${path}.mediaType`, 'Media type must be movie or tv.'));
  }
  if (hasTitle) validateBoundedText(value.title, `${path}.title`, issues, MAX_TITLE_LENGTH);
}

function validateExpected(value, issues) {
  const path = 'fixture.expected';
  if (!isRecord(value)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_OBSERVATION, path, 'Expected value must be an object.'));
    return;
  }
  hasOnlyKeys(value, ['fallbackAllowed', 'outcomes'], path, issues);
  const hasFallbackAllowed = requireOwnField(value, 'fallbackAllowed', path, issues);
  const hasOutcomes = requireOwnField(value, 'outcomes', path, issues);
  if (hasFallbackAllowed && typeof value.fallbackAllowed !== 'boolean') {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_OBSERVATION, `${path}.fallbackAllowed`, 'fallbackAllowed must be boolean.'));
  }
  if (!hasOutcomes) return;
  if (!Array.isArray(value.outcomes) || value.outcomes.length === 0 || value.outcomes.length > MAX_OUTCOMES) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_OBSERVATION, `${path}.outcomes`, `Expected outcomes must be a non-empty array with at most ${MAX_OUTCOMES} entries.`));
    return;
  }
  value.outcomes.forEach((outcome, index) => validateExpectedOutcome(outcome, index, issues));
}

function validateAiClassificationEvaluationFixture(fixture) {
  const issues = [];
  if (!isRecord(fixture)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_OBSERVATION, 'fixture', 'Evaluation fixture must be a JSON object.'));
    return { ok: false, issues };
  }
  hasOnlyKeys(fixture, ['expected', 'id', 'name', 'request', 'tags', 'version'], 'fixture', issues);
  const hasVersion = requireOwnField(fixture, 'version', 'fixture', issues);
  const hasId = requireOwnField(fixture, 'id', 'fixture', issues);
  const hasName = requireOwnField(fixture, 'name', 'fixture', issues);
  const hasTags = requireOwnField(fixture, 'tags', 'fixture', issues);
  const hasRequest = requireOwnField(fixture, 'request', 'fixture', issues);
  const hasExpected = requireOwnField(fixture, 'expected', 'fixture', issues);
  if (hasVersion && fixture.version !== AI_CLASSIFICATION_EVALUATION_FIXTURE_VERSION) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_FIXTURE_VERSION, 'fixture.version', 'Fixture must declare the current evaluation fixture contract version.'));
  }
  if (hasId) validateIdentifier(fixture.id, 'fixture.id', issues, FIXTURE_ID_PATTERN, AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_FIXTURE_ID);
  if (hasName) validateBoundedText(fixture.name, 'fixture.name', issues, MAX_TITLE_LENGTH);
  if (hasTags) validateStringIdentifierList(fixture.tags, 'fixture.tags', issues, TAG_ID_PATTERN, AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_FIXTURE_ID, MAX_TAGS);
  if (hasRequest) validateRequest(fixture.request, issues);
  if (hasExpected) validateExpected(fixture.expected, issues);
  return { ok: issues.length === 0, issues };
}

export {
  AI_CLASSIFICATION_EVALUATION_FIXTURE_VERSION,
  AI_CLASSIFICATION_EVALUATION_RISK_IDS,
  validateAiClassificationEvaluationFixture,
};
