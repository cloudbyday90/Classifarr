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
  AI_CLASSIFICATION_EVALUATION_HISTORY_STATUSES,
  AI_CLASSIFICATION_EVALUATION_RISK_IDS,
  METHOD_ID_PATTERN,
  buildIssue,
  hasOnlyKeys,
  isRecord,
  requireOwnField,
  validateIdentifier,
  validateLibrarySelector,
} from './aiClassificationEvaluationContractShared.mjs';

function validateObservedConfidence(value, path, issues) {
  const isValid = Number.isFinite(value) && value >= 0 && value <= 100;
  if (!isValid) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_CONFIDENCE_RANGE, path, 'Observed confidence must be finite and between 0 and 100.'));
  }
  return isValid;
}

function validateClassification(value, issues) {
  const path = 'observation.classification';
  if (!isRecord(value)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_OBSERVATION, path, 'Classification observation must be an object.'));
    return;
  }
  hasOnlyKeys(value, ['confidence', 'library', 'method', 'needsClarification', 'needsRetry'], path, issues);
  const hasMethod = requireOwnField(value, 'method', path, issues);
  const hasConfidence = requireOwnField(value, 'confidence', path, issues);
  const hasLibrary = requireOwnField(value, 'library', path, issues);
  const hasClarification = requireOwnField(value, 'needsClarification', path, issues);
  const hasRetry = requireOwnField(value, 'needsRetry', path, issues);
  if (hasMethod) validateIdentifier(value.method, `${path}.method`, issues, METHOD_ID_PATTERN, AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_METHOD);
  if (hasConfidence) validateObservedConfidence(value.confidence, `${path}.confidence`, issues);
  if (hasLibrary && value.library !== null) validateLibrarySelector(value.library, `${path}.library`, issues);
  if (hasClarification && typeof value.needsClarification !== 'boolean') {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_OBSERVATION, `${path}.needsClarification`, 'needsClarification must be boolean.'));
  }
  if (hasRetry && typeof value.needsRetry !== 'boolean') {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_OBSERVATION, `${path}.needsRetry`, 'needsRetry must be boolean.'));
  }
}

function validateHistory(value, issues) {
  const path = 'observation.history';
  if (!isRecord(value)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_OBSERVATION, path, 'History observation must be an object.'));
    return;
  }
  hasOnlyKeys(value, ['confidence', 'library', 'method', 'status'], path, issues);
  const hasMethod = requireOwnField(value, 'method', path, issues);
  const hasStatus = requireOwnField(value, 'status', path, issues);
  const hasConfidence = requireOwnField(value, 'confidence', path, issues);
  const hasLibrary = requireOwnField(value, 'library', path, issues);
  if (hasMethod) validateIdentifier(value.method, `${path}.method`, issues, METHOD_ID_PATTERN, AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_METHOD);
  if (hasStatus && !AI_CLASSIFICATION_EVALUATION_HISTORY_STATUSES.includes(value.status)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_HISTORY_STATUS, `${path}.status`, 'History status must be a supported terminal or pending classification status.'));
  }
  if (hasConfidence) validateObservedConfidence(value.confidence, `${path}.confidence`, issues);
  if (hasLibrary && value.library !== null) validateLibrarySelector(value.library, `${path}.library`, issues);
}

function validateAiClassificationEvaluationObservation(observation) {
  const issues = [];
  if (!isRecord(observation)) {
    issues.push(buildIssue(AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_OBSERVATION, 'observation', 'Evaluation observation must be a JSON object.'));
    return { ok: false, issues };
  }
  hasOnlyKeys(observation, ['classification', 'history'], 'observation', issues);
  const hasClassification = requireOwnField(observation, 'classification', 'observation', issues);
  const hasHistory = requireOwnField(observation, 'history', 'observation', issues);
  if (hasClassification) validateClassification(observation.classification, issues);
  if (hasHistory) validateHistory(observation.history, issues);
  return { ok: issues.length === 0, issues };
}

export { validateAiClassificationEvaluationObservation };
