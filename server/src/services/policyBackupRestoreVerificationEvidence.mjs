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

const POLICY_BACKUP_RESTORE_VERIFICATION_EVIDENCE_VERSION =
  'policy.backup_restore_verification_evidence.v1';
const DEFAULT_MAX_BACKUP_RESTORE_VERIFICATION_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_TIMESTAMP_SKEW_MS = 1000;

const POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS = Object.freeze({
  VERIFIED: 'verified',
  BLOCKED_BY_MISSING_VERIFICATION: 'blocked_by_missing_verification',
  BLOCKED_BY_RESTORE_GATE: 'blocked_by_restore_gate',
  BLOCKED_BY_STALE_VERIFICATION: 'blocked_by_stale_verification',
  INVALID_EVIDENCE: 'invalid_evidence',
});

const POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS = Object.freeze({
  VERIFICATION_MISSING: 'verification_missing',
  VERIFICATION_RECORD_INVALID: 'verification_record_invalid',
  VERIFICATION_TIMESTAMP_INVALID: 'verification_timestamp_invalid',
  VERIFICATION_TIMESTAMP_FUTURE: 'verification_timestamp_future',
  VERIFICATION_STALE: 'verification_stale',
  RESTORE_GATE_NOT_READY: 'restore_gate_not_ready',
  RESTORE_GATE_TIMESTAMP_INVALID: 'restore_gate_timestamp_invalid',
  RESTORE_GATE_VERIFICATION_MISMATCH: 'restore_gate_verification_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
  VERIFICATION_AVAILABILITY_MISMATCH: 'verification_availability_mismatch',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstRow(result) {
  return asArray(result?.rows)[0] || null;
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

function normalizeMaximumEvidenceAge(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 &&
    normalized <= DEFAULT_MAX_BACKUP_RESTORE_VERIFICATION_AGE_MS
    ? normalized
    : DEFAULT_MAX_BACKUP_RESTORE_VERIFICATION_AGE_MS;
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function isVerificationRecordValid(record = {}) {
  return Number(record.verification_version) === 1 &&
    record.verification_status === 'verified' &&
    ['replace', 'merge'].includes(record.restore_mode) &&
    typeof record.backup_version === 'string' &&
    record.backup_version.trim().length > 0 &&
    record.schema_parity_verified === true &&
    record.native_authority_verified === true &&
    Number(record.policy_library_mismatch_count) === 0;
}

function isRestoreGateReady(record = {}) {
  return record.restore_gate_state === 'ready' &&
    record.restore_gate_reason_id === 'restore_verified';
}

export function buildPolicyBackupRestoreVerificationEvidence({
  record = null,
  generatedAt = null,
  maxVerificationAgeMs = DEFAULT_MAX_BACKUP_RESTORE_VERIFICATION_AGE_MS,
} = {}) {
  const evaluationTime = resolveTimestamp(generatedAt);
  const maximumVerificationAgeMs = normalizeMaximumEvidenceAge(maxVerificationAgeMs);
  const source = asObject(record);
  const verificationTimestamp = parseTimestamp(source.verified_at);
  const restoreGateTimestamp = parseTimestamp(source.restore_gate_verified_at);
  const risks = [];

  if (!record || typeof record !== 'object') {
    risks.push(buildRisk(
      POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.VERIFICATION_MISSING,
      'Compatibility deletion requires one persisted verified backup restore record.'
    ));
  } else {
    if (!isVerificationRecordValid(source)) {
      risks.push(buildRisk(
        POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.VERIFICATION_RECORD_INVALID,
        'Backup restore verification must record a successful schema and native-authority validation.'
      ));
    }

    if (!verificationTimestamp) {
      risks.push(buildRisk(
        POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.VERIFICATION_TIMESTAMP_INVALID,
        'Backup restore verification must include a valid verification timestamp.'
      ));
    } else {
      const ageMs = evaluationTime.timestampMs - verificationTimestamp.timestampMs;
      if (ageMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS) {
        risks.push(buildRisk(
          POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.VERIFICATION_TIMESTAMP_FUTURE,
          'Backup restore verification cannot be dated after the evidence evaluation time.'
        ));
      } else if (ageMs > maximumVerificationAgeMs) {
        risks.push(buildRisk(
          POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.VERIFICATION_STALE,
          'Backup restore verification must be renewed before compatibility deletion planning.',
          { ageMs, maxVerificationAgeMs: maximumVerificationAgeMs }
        ));
      }
    }

    if (!isRestoreGateReady(source)) {
      risks.push(buildRisk(
        POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.RESTORE_GATE_NOT_READY,
        'The native reconciliation restore gate must be ready after the verified backup restore.'
      ));
    }

    if (!restoreGateTimestamp) {
      risks.push(buildRisk(
        POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.RESTORE_GATE_TIMESTAMP_INVALID,
        'The native reconciliation restore gate must retain its verification timestamp.'
      ));
    } else if (
      verificationTimestamp &&
      restoreGateTimestamp.timestampMs !== verificationTimestamp.timestampMs
    ) {
      risks.push(buildRisk(
        POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.RESTORE_GATE_VERIFICATION_MISMATCH,
        'The current native reconciliation restore gate must match the latest verified backup restore.'
      ));
    }
  }

  const backupRestoreVerified = risks.length === 0;
  const statusId = risks.some(risk => [
    POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.VERIFICATION_RECORD_INVALID,
    POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.VERIFICATION_TIMESTAMP_INVALID,
    POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.RESTORE_GATE_TIMESTAMP_INVALID,
  ].includes(risk.riskId))
    ? POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS.INVALID_EVIDENCE
    : risks.some(risk => risk.riskId ===
      POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.VERIFICATION_MISSING)
      ? POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS.BLOCKED_BY_MISSING_VERIFICATION
      : risks.some(risk => risk.riskId ===
        POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.VERIFICATION_STALE)
        ? POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS.BLOCKED_BY_STALE_VERIFICATION
        : risks.some(risk => [
          POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.RESTORE_GATE_NOT_READY,
          POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.RESTORE_GATE_VERIFICATION_MISMATCH,
          POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.VERIFICATION_TIMESTAMP_FUTURE,
        ].includes(risk.riskId))
          ? POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS.BLOCKED_BY_RESTORE_GATE
          : POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS.VERIFIED;

  const evidence = {
    version: POLICY_BACKUP_RESTORE_VERIFICATION_EVIDENCE_VERSION,
    generatedAt: evaluationTime.value,
    statusId,
    backupRestoreVerified,
    verification: {
      latestVerifiedAt: verificationTimestamp?.value || null,
      maximumVerificationAgeMs,
      rawBackupPayloadExposed: false,
      backupPathExposed: false,
      backupFilenameExposed: false,
    },
    riskCount: risks.length,
    risks,
    sideEffects: {
      databaseMutated: false,
      backupRead: false,
      restorePerformed: false,
      rawBackupPayloadReadIntoReport: false,
    },
  };

  return {
    ...evidence,
    validation: validatePolicyBackupRestoreVerificationEvidence(evidence),
  };
}

export function validatePolicyBackupRestoreVerificationEvidence(evidence = {}) {
  const issues = [];
  const expectedStatusId = evidence.backupRestoreVerified === true
    ? POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS.VERIFIED
    : null;

  if (!Object.values(POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS).includes(evidence.statusId)) {
    issues.push(buildRisk(
      POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.UNKNOWN_STATUS,
      'Backup restore verification evidence status must be known.'
    ));
  }

  if (expectedStatusId && evidence.statusId !== expectedStatusId) {
    issues.push(buildRisk(
      POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.VERIFICATION_AVAILABILITY_MISMATCH,
      'Backup restore verification status must agree with measured availability.'
    ));
  }

  if (evidence.riskCount !== (Array.isArray(evidence.risks) ? evidence.risks.length : 0)) {
    issues.push(buildRisk(
      POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.RISK_COUNT_MISMATCH,
      'Backup restore verification evidence risk count must match its risk list.'
    ));
  }

  Object.entries(asObject(evidence.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Backup restore verification evidence cannot perform side effect "${key}".`
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export async function fetchLatestPolicyBackupRestoreVerificationRecord(dbClient) {
  if (!dbClient || typeof dbClient.query !== 'function') {
    throw new TypeError('A database client with query(text) is required.');
  }

  const result = await dbClient.query(
    `SELECT
       verification.verification_version,
       verification.restore_mode,
       verification.backup_version,
       verification.verification_status,
       verification.schema_parity_verified,
       verification.native_authority_verified,
       verification.policy_library_mismatch_count,
       verification.verified_at,
       restore_gate.gate_state AS restore_gate_state,
       restore_gate.reason_id AS restore_gate_reason_id,
       restore_gate.verified_at AS restore_gate_verified_at
     FROM policy_backup_restore_verifications verification
     LEFT JOIN policy_native_intent_reconciliation_restore_gates restore_gate
       ON restore_gate.gate_id = 1
     ORDER BY verification.verified_at DESC, verification.id DESC
     LIMIT 1`,
  );

  return firstRow(result);
}

export async function loadPolicyBackupRestoreVerificationEvidence(dbClient, {
  generatedAt = null,
  maxVerificationAgeMs = DEFAULT_MAX_BACKUP_RESTORE_VERIFICATION_AGE_MS,
} = {}) {
  const record = await fetchLatestPolicyBackupRestoreVerificationRecord(dbClient);

  return buildPolicyBackupRestoreVerificationEvidence({
    record,
    generatedAt,
    maxVerificationAgeMs,
  });
}

export {
  DEFAULT_MAX_BACKUP_RESTORE_VERIFICATION_AGE_MS,
  POLICY_BACKUP_RESTORE_VERIFICATION_EVIDENCE_VERSION,
  POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS,
  POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS,
  isRestoreGateReady,
  isVerificationRecordValid,
};
