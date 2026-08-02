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

const POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_VERSION =
  'policy.compatibility_deletion_preflight_evidence_artifact.v3';

const POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS = Object.freeze({
  OBSERVED: 'observed',
  MISSING: 'missing',
  STALE: 'stale',
  INVALID: 'invalid',
});

const POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS = Object.freeze({
  UNKNOWN_VERSION: 'unknown_version',
  UNKNOWN_STATUS: 'unknown_status',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  STATUS_MISMATCH: 'status_mismatch',
  ARTIFACT_MISSING: 'artifact_missing',
  ARTIFACT_INVALID: 'artifact_invalid',
  ARTIFACT_FINGERPRINT_INVALID: 'artifact_fingerprint_invalid',
  PREFLIGHT_ARTIFACT_FINGERPRINT_INVALID: 'preflight_artifact_fingerprint_invalid',
  ARTIFACT_NOT_APPROVED: 'artifact_not_approved',
  ARTIFACT_TIMESTAMP_INVALID: 'artifact_timestamp_invalid',
  ARTIFACT_TIMESTAMP_STALE: 'artifact_timestamp_stale',
  ARTIFACT_TIMESTAMP_FUTURE: 'artifact_timestamp_future',
  CHECKOUT_INVALID: 'checkout_invalid',
  CHECKOUT_NOT_CLEAN: 'checkout_not_clean',
  MANIFEST_MISSING: 'manifest_missing',
  MANIFEST_INVALID: 'manifest_invalid',
  MANIFEST_DUPLICATE_ENTRY_IDENTITY: 'manifest_duplicate_entry_identity',
  RUNTIME_EVIDENCE_MISSING: 'runtime_evidence_missing',
  RUNTIME_EVIDENCE_INVALID: 'runtime_evidence_invalid',
  RUNTIME_EVIDENCE_STALE: 'runtime_evidence_stale',
  RUNTIME_EVIDENCE_ESCALATION_MISMATCH: 'runtime_evidence_escalation_mismatch',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
});

const OBSERVATION_STATUS_IDS = new Set(
  Object.values(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS)
);
const REVISION_PATTERN = /^[a-f0-9]{40,64}$/u;
const MAX_MANIFEST_ENTRY_COUNT = 256;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function normalizeStatusId(value) {
  return OBSERVATION_STATUS_IDS.has(value)
    ? value
    : POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID;
}

function parseTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { value: value.toISOString(), timestampMs: value.getTime() };
  }
  if (typeof value !== 'string' || !value.trim()) return null;

  const timestampMs = Date.parse(value);
  return Number.isNaN(timestampMs) ? null : { value: value.trim(), timestampMs };
}

function resolveTimestamp(value) {
  return parseTimestamp(value) || { value: new Date().toISOString(), timestampMs: Date.now() };
}

export {
  MAX_MANIFEST_ENTRY_COUNT,
  OBSERVATION_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_VERSION,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS,
  REVISION_PATTERN,
  asArray,
  asObject,
  buildRisk,
  normalizeStatusId,
  parseTimestamp,
  resolveTimestamp,
};
