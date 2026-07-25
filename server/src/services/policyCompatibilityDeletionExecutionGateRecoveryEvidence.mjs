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
  POLICY_BACKUP_RESTORE_VERIFICATION_EVIDENCE_VERSION,
  POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS,
  validatePolicyBackupRestoreVerificationEvidence,
} from './policyBackupRestoreVerificationEvidence.mjs';
import {
  validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
} from './policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidenceFingerprint,
  validatePolicyCompatibilityDeletionExecutionGateRecoveryEvidenceFingerprint,
} from './policyCompatibilityDeletionExecutionGateRecoveryEvidenceFingerprint.mjs';
import {
  MAX_FUTURE_TIMESTAMP_SKEW_MS,
  asArray,
  asObject,
  buildRisk,
  normalizeFingerprint,
  normalizeMaximumAge,
  parseTimestamp,
  resolveTimestamp,
} from './policyCompatibilityDeletionExecutionGateShared.mjs';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_VERSION =
  'policy.compatibility_deletion_execution_gate_recovery_evidence.v1';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_EXECUTION_ARTIFACT: 'blocked_by_execution_artifact',
  BLOCKED_BY_RECOVERY_VERIFICATION: 'blocked_by_recovery_verification',
  BLOCKED_BY_FRESHNESS: 'blocked_by_freshness',
  INVALID_EVIDENCE: 'invalid_evidence',
});

const POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS = Object.freeze({
  EXECUTION_PLAN_ARTIFACT_INVALID: 'execution_plan_artifact_invalid',
  EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISSING:
    'execution_plan_artifact_fingerprint_missing',
  EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISMATCH:
    'execution_plan_artifact_fingerprint_mismatch',
  RECOVERY_EVIDENCE_TIMESTAMP_INVALID: 'recovery_evidence_timestamp_invalid',
  RECOVERY_EVIDENCE_TIMESTAMP_STALE: 'recovery_evidence_timestamp_stale',
  RECOVERY_EVIDENCE_TIMESTAMP_FUTURE: 'recovery_evidence_timestamp_future',
  RECOVERY_EVIDENCE_PRECEDES_ARTIFACT: 'recovery_evidence_precedes_artifact',
  BACKUP_RESTORE_EVIDENCE_INVALID: 'backup_restore_evidence_invalid',
  BACKUP_RESTORE_EVIDENCE_NOT_VERIFIED: 'backup_restore_evidence_not_verified',
  BACKUP_RESTORE_EVIDENCE_TIMESTAMP_INVALID:
    'backup_restore_evidence_timestamp_invalid',
  BACKUP_RESTORE_EVIDENCE_PRECEDES_ARTIFACT:
    'backup_restore_evidence_precedes_artifact',
  BACKUP_RESTORE_EVIDENCE_POSTDATES_OBSERVATION:
    'backup_restore_evidence_postdates_observation',
  ARTIFACT_FINGERPRINT_INVALID: 'artifact_fingerprint_invalid',
  READY_STATE_MISMATCH: 'ready_state_mismatch',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
  SOURCE_MISMATCH: 'source_mismatch',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

function resolveGeneratedTimestamp({ generatedAt, now }) {
  if (generatedAt === null || generatedAt === undefined) {
    return resolveTimestamp(now);
  }

  const parsed = parseTimestamp(generatedAt);

  return {
    value: parsed?.value || String(generatedAt || ''),
    timestampMs: parsed?.timestampMs ?? null,
  };
}

function buildTimestampRisks({
  executionPlanArtifact,
  generatedTimestamp,
  backupRestoreVerificationEvidence,
  evaluationTime,
  maximumAgeMs,
}) {
  const risks = [];
  const artifactTimestamp = parseTimestamp(executionPlanArtifact.generatedAt);
  const sourceTimestamp = parseTimestamp(backupRestoreVerificationEvidence.generatedAt);

  if (!generatedTimestamp.timestampMs) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
        .RECOVERY_EVIDENCE_TIMESTAMP_INVALID,
      'Compatibility path deletion recovery evidence must record a valid observation timestamp.',
      { generatedAt: generatedTimestamp.value || null }
    ));
  } else {
    const ageMs = evaluationTime.timestampMs - generatedTimestamp.timestampMs;

    if (ageMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
          .RECOVERY_EVIDENCE_TIMESTAMP_FUTURE,
        'Compatibility path deletion recovery evidence cannot be observed after gate evaluation.',
        { generatedAt: generatedTimestamp.value, evaluatedAt: evaluationTime.value }
      ));
    } else if (ageMs > maximumAgeMs) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
          .RECOVERY_EVIDENCE_TIMESTAMP_STALE,
        'Compatibility path deletion recovery evidence must be refreshed immediately before execution.',
        { ageMs, maximumAgeMs }
      ));
    }

    if (
      artifactTimestamp &&
      generatedTimestamp.timestampMs < artifactTimestamp.timestampMs - MAX_FUTURE_TIMESTAMP_SKEW_MS
    ) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
          .RECOVERY_EVIDENCE_PRECEDES_ARTIFACT,
        'Compatibility path deletion recovery evidence must be observed after the bound execution-plan artifact.',
        { generatedAt: generatedTimestamp.value, executionPlanGeneratedAt: artifactTimestamp.value }
      ));
    }
  }

  if (!sourceTimestamp) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
        .BACKUP_RESTORE_EVIDENCE_TIMESTAMP_INVALID,
      'Database-owned backup/restore verification evidence must retain a valid read timestamp.'
    ));
  } else {
    if (
      artifactTimestamp &&
      sourceTimestamp.timestampMs < artifactTimestamp.timestampMs - MAX_FUTURE_TIMESTAMP_SKEW_MS
    ) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
          .BACKUP_RESTORE_EVIDENCE_PRECEDES_ARTIFACT,
        'Database-owned backup/restore verification evidence must be reread after the bound execution-plan artifact is generated.',
        { backupRestoreEvidenceGeneratedAt: sourceTimestamp.value, executionPlanGeneratedAt: artifactTimestamp.value }
      ));
    }
    if (
      generatedTimestamp.timestampMs &&
      sourceTimestamp.timestampMs > generatedTimestamp.timestampMs + MAX_FUTURE_TIMESTAMP_SKEW_MS
    ) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
          .BACKUP_RESTORE_EVIDENCE_POSTDATES_OBSERVATION,
        'Database-owned backup/restore verification evidence cannot postdate its recovery observation.',
        { backupRestoreEvidenceGeneratedAt: sourceTimestamp.value, generatedAt: generatedTimestamp.value }
      ));
    }
  }

  return risks;
}

function buildSourceRisks({ executionPlanArtifact, backupRestoreVerificationEvidence }) {
  const artifact = asObject(executionPlanArtifact);
  const source = asObject(backupRestoreVerificationEvidence);
  const risks = [];
  const artifactFingerprintValidation =
    validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact,
      artifactFingerprint: artifact.artifactFingerprint,
    });

  if (!artifactFingerprintValidation.ok) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_INVALID,
      'Compatibility path deletion recovery evidence requires an intact execution-plan artifact.',
      { issueCount: artifactFingerprintValidation.issueCount }
    ));
  }

  const expectedFingerprint = normalizeFingerprint(artifact.artifactFingerprint?.fingerprint);
  if (!expectedFingerprint) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISSING,
      'Compatibility path deletion recovery evidence requires an execution-plan artifact fingerprint.'
    ));
  }

  const sourceValidation = validatePolicyBackupRestoreVerificationEvidence(source);
  if (
    source.version !== POLICY_BACKUP_RESTORE_VERIFICATION_EVIDENCE_VERSION ||
    source.validation?.ok !== true ||
    !sourceValidation.ok
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
        .BACKUP_RESTORE_EVIDENCE_INVALID,
      'Compatibility path deletion requires a valid database-owned backup/restore verification evidence record.',
      { issueCount: sourceValidation.issueCount }
    ));
  }

  if (
    source.statusId !== POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS.VERIFIED ||
    source.backupRestoreVerified !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
        .BACKUP_RESTORE_EVIDENCE_NOT_VERIFIED,
      'Compatibility path deletion requires verified database-owned backup/restore evidence.',
      { statusId: source.statusId || null }
    ));
  }

  return risks;
}

function determineStatusId(risks = []) {
  const riskIds = new Set(asArray(risks).map(risk => risk?.riskId));

  if (riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
      .EXECUTION_PLAN_ARTIFACT_INVALID
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
      .EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISSING
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
      .EXECUTION_PLAN_ARTIFACT_FINGERPRINT_MISMATCH
  )) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_STATUS_IDS
      .BLOCKED_BY_EXECUTION_ARTIFACT;
  }
  if (riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
      .RECOVERY_EVIDENCE_TIMESTAMP_STALE
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
      .RECOVERY_EVIDENCE_TIMESTAMP_FUTURE
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
      .RECOVERY_EVIDENCE_PRECEDES_ARTIFACT
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
      .BACKUP_RESTORE_EVIDENCE_PRECEDES_ARTIFACT
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
      .BACKUP_RESTORE_EVIDENCE_POSTDATES_OBSERVATION
  )) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_STATUS_IDS
      .BLOCKED_BY_FRESHNESS;
  }
  if (riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
      .RECOVERY_EVIDENCE_TIMESTAMP_INVALID
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
      .BACKUP_RESTORE_EVIDENCE_TIMESTAMP_INVALID
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
      .BACKUP_RESTORE_EVIDENCE_INVALID
  )) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_STATUS_IDS
      .INVALID_EVIDENCE;
  }
  if (risks.length > 0) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_STATUS_IDS
      .BLOCKED_BY_RECOVERY_VERIFICATION;
  }

  return POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_STATUS_IDS.READY;
}

function buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidence({
  executionPlanArtifact = null,
  backupRestoreVerificationEvidence = null,
  generatedAt = null,
  now = null,
  maxEvidenceAgeMs = null,
} = {}) {
  const artifact = asObject(executionPlanArtifact);
  const source = asObject(backupRestoreVerificationEvidence);
  const generatedTimestamp = resolveGeneratedTimestamp({ generatedAt, now });
  const evaluationTime = resolveTimestamp(now || generatedAt);
  const maximumAgeMs = normalizeMaximumAge(maxEvidenceAgeMs);
  const risks = [
    ...buildSourceRisks({
      executionPlanArtifact: artifact,
      backupRestoreVerificationEvidence: source,
    }),
    ...buildTimestampRisks({
      executionPlanArtifact: artifact,
      generatedTimestamp,
      backupRestoreVerificationEvidence: source,
      evaluationTime,
      maximumAgeMs,
    }),
  ];
  const evidence = {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_VERSION,
    generatedAt: generatedTimestamp.value,
    statusId: determineStatusId(risks),
    ready: risks.length === 0,
    executionPlanArtifactFingerprint: artifact.artifactFingerprint?.fingerprint || null,
    source: {
      databaseOwned: true,
      sourceId: 'policy_backup_restore_verifications',
      actorRequired: false,
      rawBackupPayloadExposed: false,
      backupPathExposed: false,
    },
    backupRestoreVerificationEvidence: source,
    freshness: {
      maximumAgeMs,
      evaluatedAt: evaluationTime.value,
    },
    riskCount: risks.length,
    risks,
    sideEffects: {
      databaseMutated: false,
      restorePerformed: false,
      filesDeleted: false,
      storageChanged: false,
    },
  };
  const artifactFingerprint =
    buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidenceFingerprint({ evidence });
  const completeEvidence = { ...evidence, artifactFingerprint };

  return {
    ...completeEvidence,
    validation: validatePolicyCompatibilityDeletionExecutionGateRecoveryEvidence(completeEvidence),
  };
}

function validatePolicyCompatibilityDeletionExecutionGateRecoveryEvidence(evidence = {}) {
  const issues = [];
  const value = asObject(evidence);
  const source = asObject(value.source);

  if (value.version !== POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility path deletion recovery evidence version must be recognized.',
      { version: value.version || null }
    ));
  }
  if (!Object.values(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_STATUS_IDS)
    .includes(value.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility path deletion recovery evidence status must be known.'
    ));
  }
  if (value.riskCount !== asArray(value.risks).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS.RISK_COUNT_MISMATCH,
      'Compatibility path deletion recovery evidence risk count must match risk list length.'
    ));
  }
  if (value.ready !== (value.riskCount === 0)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS.READY_STATE_MISMATCH,
      'Compatibility path deletion recovery evidence readiness must match its risk count.'
    ));
  }
  if (
    source.databaseOwned !== true ||
    source.sourceId !== 'policy_backup_restore_verifications' ||
    source.actorRequired !== false ||
    source.rawBackupPayloadExposed !== false ||
    source.backupPathExposed !== false
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS.SOURCE_MISMATCH,
      'Compatibility path deletion recovery evidence must describe the bounded database-owned verification source.'
    ));
  }

  const fingerprintValidation =
    validatePolicyCompatibilityDeletionExecutionGateRecoveryEvidenceFingerprint({
      evidence: value,
      artifactFingerprint: value.artifactFingerprint,
    });
  if (!fingerprintValidation.ok) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
        .ARTIFACT_FINGERPRINT_INVALID,
      'Compatibility path deletion recovery evidence must retain an intact bounded fingerprint.',
      { issueCount: fingerprintValidation.issueCount }
    ));
  }

  Object.entries(asObject(value.sideEffects)).forEach(([key, performed]) => {
    if (performed === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
        `Compatibility path deletion recovery evidence cannot perform side effect "${key}".`
      ));
    }
  });

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_VERSION,
  buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidence,
  validatePolicyCompatibilityDeletionExecutionGateRecoveryEvidence,
};
