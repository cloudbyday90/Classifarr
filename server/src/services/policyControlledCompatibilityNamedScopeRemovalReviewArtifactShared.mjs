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

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_VERSION =
  'policy.controlled_compatibility_named_scope_removal_review_artifact.v2';
const DEFAULT_MAX_SCOPE_REMOVAL_DRY_RUN_AGE_MS = 15 * 60 * 1000;
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS =
  Object.freeze({
    ALTERED_DRY_RUN_EDITS: 'altered_dry_run_edits',
    DUPLICATE_SCOPE_IDENTITY: 'duplicate_scope_identity',
    INVALID_DRY_RUN_TIMESTAMP: 'invalid_dry_run_timestamp',
    INVALID_REVIEW_TIMESTAMP: 'invalid_review_timestamp',
    INVALID_VALIDATION_TIMESTAMP: 'invalid_validation_timestamp',
    MALFORMED_REVIEW_ARTIFACT: 'malformed_review_artifact',
    MISSING_REVIEW_ARTIFACT: 'missing_review_artifact',
    MISSING_REVIEWER_CONTEXT: 'missing_reviewer_context',
    MISSING_SCOPE_REMOVAL_DRY_RUN: 'missing_scope_removal_dry_run',
    REVIEW_ARTIFACT_MISMATCH: 'review_artifact_mismatch',
    REVIEW_ARTIFACT_PROVENANCE_MISMATCH: 'review_artifact_provenance_mismatch',
    REVIEW_PRECEDES_DRY_RUN: 'review_precedes_dry_run',
    SCOPE_REMOVAL_DRY_RUN_INVALID: 'scope_removal_dry_run_invalid',
    SCOPE_REMOVAL_DRY_RUN_NOT_ACCEPTED: 'scope_removal_dry_run_not_accepted',
    STALE_SCOPE_REMOVAL_DRY_RUN: 'stale_scope_removal_dry_run',
  });

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTimestamp(value) {
  const timestamp = cleanString(value);
  const timestampMs = Date.parse(timestamp);

  return Number.isFinite(timestampMs) ? new Date(timestampMs).toISOString() : null;
}

function uniqueStrings(values = []) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))].sort();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(item => stableValue(item));
  if (!value || typeof value !== 'object') {
    return typeof value === 'bigint' ? value.toString() : value;
  }

  return Object.keys(value)
    .filter(key => !['function', 'symbol', 'undefined'].includes(typeof value[key]))
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = stableValue(value[key]);
      return normalized;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function isSha256Fingerprint(value) {
  return SHA256_FINGERPRINT_PATTERN.test(cleanString(value).toLowerCase());
}

function normalizeReviewMetadata(review = {}) {
  const value = asObject(review);

  return {
    reviewReason: cleanString(value.reviewReason) || null,
    reviewedAt: normalizeTimestamp(value.reviewedAt),
    reviewedBy: cleanString(value.reviewedBy) || null,
  };
}

function normalizeEdit(edit = {}) {
  const value = asObject(edit);

  return {
    endOffset: Number.isInteger(value.endOffset) ? value.endOffset : null,
    expectedTextFingerprint: cleanString(value.expectedTextFingerprint).toLowerCase() || null,
    startOffset: Number.isInteger(value.startOffset) ? value.startOffset : null,
    testName: cleanString(value.testName) || null,
  };
}

function normalizePreApplyVerification(verification = {}) {
  const value = asObject(verification);

  return {
    riskIds: uniqueStrings(value.riskIds),
    statusId: cleanString(value.statusId) || null,
    validationOk: value.validationOk === true,
    verified: value.verified === true,
  };
}

function hasExpectedReadOnlySideEffects(sideEffects = {}) {
  const value = asObject(sideEffects);

  return [
    'filesArchived',
    'filesDeleted',
    'gitCommandsRun',
    'manifestWritten',
    'routesRemoved',
    'sourceWritten',
    'storageChanged',
    'testsRemoved',
  ].every(sideEffectId => value[sideEffectId] === false);
}

export {
  DEFAULT_MAX_SCOPE_REMOVAL_DRY_RUN_AGE_MS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_REVIEW_ARTIFACT_VERSION,
  asArray,
  asObject,
  buildRisk,
  cleanString,
  hasExpectedReadOnlySideEffects,
  isSha256Fingerprint,
  normalizeEdit,
  normalizePreApplyVerification,
  normalizeReviewMetadata,
  normalizeTimestamp,
  stableStringify,
  stableValue,
  uniqueStrings,
};
