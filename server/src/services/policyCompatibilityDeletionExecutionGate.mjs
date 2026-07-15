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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION,
  buildPolicyCompatibilityDeletionExecutionPlanArtifact,
  validatePolicyCompatibilityDeletionExecutionPlanArtifact,
} from './policyCompatibilityDeletionExecutionPlanArtifact.mjs';
import {
  validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
} from './policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION,
} from './policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from './policyCompatibilityDeletionExecutionPlan.mjs';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_VERSION =
  'policy.compatibility_deletion_execution_gate.v2';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS = Object.freeze({
  READY_FOR_CONTROLLED_DELETION: 'ready_for_controlled_deletion',
  BLOCKED_BY_EXECUTION_ARTIFACT: 'blocked_by_execution_artifact',
  BLOCKED_BY_PREFLIGHT_EVIDENCE: 'blocked_by_preflight_evidence',
  BLOCKED_BY_WORKTREE: 'blocked_by_worktree',
  BLOCKED_BY_RECOVERY_EVIDENCE: 'blocked_by_recovery_evidence',
  BLOCKED_BY_APPROVAL: 'blocked_by_approval',
  BLOCKED_BY_MANIFEST_VERIFICATION: 'blocked_by_manifest_verification',
});

const POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS = Object.freeze({
  EXECUTION_PLAN_ARTIFACT_NOT_READY: 'execution_plan_artifact_not_ready',
  EXECUTION_PLAN_ARTIFACT_VALIDATION_FAILED: 'execution_plan_artifact_validation_failed',
  EXECUTION_PLAN_ARTIFACT_FINGERPRINT_INVALID:
    'execution_plan_artifact_fingerprint_invalid',
  EXECUTION_PLAN_ARTIFACT_TIMESTAMP_INVALID:
    'execution_plan_artifact_timestamp_invalid',
  EXECUTION_PLAN_ARTIFACT_TIMESTAMP_STALE:
    'execution_plan_artifact_timestamp_stale',
  EXECUTION_PLAN_ARTIFACT_EVIDENCE_MISMATCH:
    'execution_plan_artifact_evidence_mismatch',
  PREFLIGHT_EVIDENCE_MISSING: 'preflight_evidence_missing',
  PREFLIGHT_ARTIFACT_FINGERPRINT_MISSING:
    'preflight_artifact_fingerprint_missing',
  PREFLIGHT_ARTIFACT_FINGERPRINT_MISMATCH:
    'preflight_artifact_fingerprint_mismatch',
  PREFLIGHT_TIMESTAMP_MISSING: 'preflight_timestamp_missing',
  PREFLIGHT_TIMESTAMP_INVALID: 'preflight_timestamp_invalid',
  PREFLIGHT_TIMESTAMP_STALE: 'preflight_timestamp_stale',
  PREFLIGHT_TIMESTAMP_FUTURE: 'preflight_timestamp_future',
  PREFLIGHT_TIMESTAMP_PRECEDES_ARTIFACT:
    'preflight_timestamp_precedes_artifact',
  PREFLIGHT_ACTOR_MISSING: 'preflight_actor_missing',
  EXECUTION_GATE_TIMESTAMP_INVALID: 'execution_gate_timestamp_invalid',
  EXECUTION_GATE_EVIDENCE_RISK_MISMATCH: 'execution_gate_evidence_risk_mismatch',
  EXECUTION_GATE_STATUS_MISMATCH: 'execution_gate_status_mismatch',
  EXECUTION_POLICY_MISMATCH: 'execution_policy_mismatch',
  NEXT_STEP_MISMATCH: 'next_step_mismatch',
  WORKTREE_NOT_CLEAN: 'worktree_not_clean',
  BACKUP_RESTORE_NOT_VERIFIED: 'backup_restore_not_verified',
  OPERATOR_APPROVAL_MISSING: 'operator_approval_missing',
  ROLLBACK_STANCE_NOT_FINAL: 'rollback_stance_not_final',
  SUPPORT_STANCE_NOT_FINAL: 'support_stance_not_final',
  MANIFEST_NOT_CURRENT: 'manifest_not_current',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  ALLOW_STATE_MISMATCH: 'allow_state_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
});

const DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS = 5 * 60 * 1000;
const MAX_ARTIFACT_EVIDENCE_DELAY_MS = 30 * 1000;
const MAX_FUTURE_TIMESTAMP_SKEW_MS = 1000;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function parseTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { value: value.toISOString(), timestampMs: value.getTime() };
  }

  if (typeof value !== 'string' || !value.trim()) return null;

  const timestampMs = Date.parse(value);
  if (Number.isNaN(timestampMs)) return null;

  return { value: value.trim(), timestampMs };
}

function resolveTimestamp(value) {
  return parseTimestamp(value) || { value: new Date().toISOString(), timestampMs: Date.now() };
}

function normalizeFingerprint(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeMaximumAge(value) {
  const normalized = Number(value);

  if (
    Number.isInteger(normalized) &&
    normalized > 0 &&
    normalized <= DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS
  ) {
    return normalized;
  }

  return DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS;
}

function evaluateExecutionPlanArtifact({ executionPlanArtifact, now, maxEvidenceAgeMs }) {
  const artifact = executionPlanArtifact || buildPolicyCompatibilityDeletionExecutionPlanArtifact();
  const risks = [];
  const evaluationTime = resolveTimestamp(now);
  const maximumAgeMs = normalizeMaximumAge(maxEvidenceAgeMs);
  const artifactValidation = validatePolicyCompatibilityDeletionExecutionPlanArtifact(artifact);
  const fingerprintValidation = validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
    artifact,
    artifactFingerprint: artifact.artifactFingerprint,
  });

  if (
    artifact.version !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION ||
    artifact.statusId !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.READY ||
    artifact.ready !== true ||
    artifact.executionPlan?.statusId !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE ||
    artifact.executionPlan?.readyForExecutionGate !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.EXECUTION_PLAN_ARTIFACT_NOT_READY,
      'Compatibility path deletion requires a ready versioned execution-plan artifact.',
      { statusId: artifact.statusId || null }
    ));
  }

  if (artifact.validation?.ok !== true || artifactValidation.ok !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_VALIDATION_FAILED,
      'Compatibility path deletion execution-plan artifact must validate before the execution gate can pass.',
      { issueCount: artifactValidation.issueCount }
    ));
  }

  if (!fingerprintValidation.ok) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_FINGERPRINT_INVALID,
      'Compatibility path deletion execution-plan artifact must have an intact deterministic fingerprint.',
      { issueCount: fingerprintValidation.issueCount }
    ));
  }

  const artifactTimestamp = parseTimestamp(artifact.generatedAt);
  const evidenceTimestamp = parseTimestamp(artifact.evidenceBundle?.generatedAt);

  if (!artifactTimestamp || !evidenceTimestamp) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_TIMESTAMP_INVALID,
      'Compatibility path deletion execution-plan artifact and its evidence bundle require valid timestamps.',
      {
        artifactGeneratedAt: artifact.generatedAt || null,
        evidenceBundleGeneratedAt: artifact.evidenceBundle?.generatedAt || null,
      }
    ));
  } else {
    const artifactAgeMs = evaluationTime.timestampMs - artifactTimestamp.timestampMs;
    const evidenceAgeMs = evaluationTime.timestampMs - evidenceTimestamp.timestampMs;

    if (
      artifactAgeMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS ||
      evidenceAgeMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS
    ) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
          .EXECUTION_PLAN_ARTIFACT_TIMESTAMP_INVALID,
        'Compatibility path deletion execution evidence cannot be collected after the gate evaluation time.'
      ));
    } else if (artifactAgeMs > maximumAgeMs || evidenceAgeMs > maximumAgeMs) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
          .EXECUTION_PLAN_ARTIFACT_TIMESTAMP_STALE,
        'Compatibility path deletion requires a freshly generated execution-plan artifact and evidence bundle.',
        { artifactAgeMs, evidenceAgeMs, maximumAgeMs }
      ));
    }

    const evidenceToArtifactDelayMs = artifactTimestamp.timestampMs - evidenceTimestamp.timestampMs;
    if (
      evidenceToArtifactDelayMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS ||
      evidenceToArtifactDelayMs > MAX_ARTIFACT_EVIDENCE_DELAY_MS
    ) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
          .EXECUTION_PLAN_ARTIFACT_EVIDENCE_MISMATCH,
        'Compatibility path deletion execution-plan artifact must be generated from its evidence bundle in one bounded window.',
        { evidenceToArtifactDelayMs, maximumDelayMs: MAX_ARTIFACT_EVIDENCE_DELAY_MS }
      ));
    }
  }

  if (
    artifact.evidenceBundle?.version !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION ||
    artifact.evidenceBundle?.statusId !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS.READY ||
    artifact.evidenceBundle?.validationOk !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.EXECUTION_PLAN_ARTIFACT_NOT_READY,
      'Compatibility path deletion execution-plan artifact must retain a ready, valid evidence-bundle reference.',
      { evidenceBundleStatusId: artifact.evidenceBundle?.statusId || null }
    ));
  }

  return { artifact, artifactTimestamp, evaluationTime, maximumAgeMs, risks };
}

function evaluateTimestampedPreflightRecord({
  record,
  scope,
  timestampField,
  actorField,
  artifactTimestamp,
  evaluationTime,
  maximumAgeMs,
}) {
  const value = asObject(record);
  const risks = [];
  const timestampValue = value[timestampField];
  const timestamp = parseTimestamp(timestampValue);

  if (!timestampValue) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_TIMESTAMP_MISSING,
      'Compatibility path deletion preflight evidence must record when each check was observed.',
      { scope, timestampField }
    ));
  } else if (!timestamp) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_TIMESTAMP_INVALID,
      'Compatibility path deletion preflight timestamps must be valid ISO timestamps.',
      { scope, timestampField, timestampValue }
    ));
  } else {
    const ageMs = evaluationTime.timestampMs - timestamp.timestampMs;
    if (ageMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_TIMESTAMP_FUTURE,
        'Compatibility path deletion preflight evidence cannot be observed after gate evaluation.',
        { scope, timestampField, observedAt: timestamp.value }
      ));
    } else if (ageMs > maximumAgeMs) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_TIMESTAMP_STALE,
        'Compatibility path deletion preflight evidence must be refreshed immediately before execution.',
        { scope, timestampField, ageMs, maximumAgeMs }
      ));
    }

    if (
      artifactTimestamp &&
      timestamp.timestampMs < artifactTimestamp.timestampMs - MAX_FUTURE_TIMESTAMP_SKEW_MS
    ) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
          .PREFLIGHT_TIMESTAMP_PRECEDES_ARTIFACT,
        'Compatibility path deletion preflight evidence must be observed after the bound execution-plan artifact is generated.',
        { scope, timestampField, observedAt: timestamp.value }
      ));
    }
  }

  if (!String(value[actorField] || '').trim()) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_ACTOR_MISSING,
      'Compatibility path deletion preflight evidence must identify the actor who made the check.',
      { scope, actorField }
    ));
  }

  return risks;
}

function evaluatePreflightEvidence({
  preflightEvidence,
  artifactFingerprint,
  artifactTimestamp,
  evaluationTime,
  maximumAgeMs,
}) {
  const value = asObject(preflightEvidence);
  const risks = [];
  const expectedFingerprint = normalizeFingerprint(artifactFingerprint?.fingerprint);
  const providedFingerprint = normalizeFingerprint(value.executionPlanArtifactFingerprint);

  if (Object.keys(value).length === 0) {
    return [buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_EVIDENCE_MISSING,
      'Compatibility path deletion requires timestamped preflight evidence bound to the current execution-plan artifact.'
    )];
  }

  if (!providedFingerprint) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
        .PREFLIGHT_ARTIFACT_FINGERPRINT_MISSING,
      'Compatibility path deletion preflight evidence must identify the execution-plan artifact it verifies.'
    ));
  } else if (!expectedFingerprint || providedFingerprint !== expectedFingerprint) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
        .PREFLIGHT_ARTIFACT_FINGERPRINT_MISMATCH,
      'Compatibility path deletion preflight evidence must match the exact current execution-plan artifact.',
      {
        expectedArtifactFingerprint: expectedFingerprint || null,
        providedArtifactFingerprint: providedFingerprint,
      }
    ));
  }

  const recordDefinitions = [
    {
      scope: 'worktree', value: value.worktree, timestampField: 'observedAt', actorField: 'checkedBy',
      condition: record => record.clean === true,
      riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.WORKTREE_NOT_CLEAN,
      message: 'Compatibility path deletion requires a clean worktree immediately before execution.',
    },
    {
      scope: 'recovery', value: value.recovery, timestampField: 'verifiedAt', actorField: 'verifiedBy',
      condition: record => record.backupRestoreVerified === true,
      riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.BACKUP_RESTORE_NOT_VERIFIED,
      message: 'Compatibility path deletion requires verified and fresh backup/restore evidence.',
    },
    {
      scope: 'approval', value: value.approval, timestampField: 'approvedAt', actorField: 'approvedBy',
      condition: record => record.approved === true,
      riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.OPERATOR_APPROVAL_MISSING,
      message: 'Compatibility path deletion requires explicit operator approval at execution time.',
    },
    {
      scope: 'stances', value: value.stances, timestampField: 'confirmedAt', actorField: 'confirmedBy',
      condition: record => record.rollbackStanceFinal === true,
      riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.ROLLBACK_STANCE_NOT_FINAL,
      message: 'Compatibility path deletion requires a final rollback or post-window recovery stance.',
    },
    {
      scope: 'stances', value: value.stances, timestampField: 'confirmedAt', actorField: 'confirmedBy',
      condition: record => record.supportStanceFinal === true,
      riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.SUPPORT_STANCE_NOT_FINAL,
      message: 'Compatibility path deletion requires a final support stance for converted native policies.',
    },
    {
      scope: 'manifest', value: value.manifest, timestampField: 'verifiedAt', actorField: 'verifiedBy',
      condition: record => record.matchesExecutionPlan === true,
      riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.MANIFEST_NOT_CURRENT,
      message: 'Compatibility path deletion manifest must match the bound current execution-plan artifact.',
    },
  ];
  const checkedScopes = new Set();

  recordDefinitions.forEach(definition => {
    const record = asObject(definition.value);

    if (!checkedScopes.has(definition.scope)) {
      risks.push(...evaluateTimestampedPreflightRecord({
        record,
        scope: definition.scope,
        timestampField: definition.timestampField,
        actorField: definition.actorField,
        artifactTimestamp,
        evaluationTime,
        maximumAgeMs,
      }));
      checkedScopes.add(definition.scope);
    }

    if (!definition.condition(record)) {
      risks.push(buildRisk(definition.riskId, definition.message, { scope: definition.scope }));
    }
  });

  return risks;
}

function determineStatusId(risks = []) {
  const riskIds = new Set(risks.map(risk => risk.riskId));
  const preflightRiskIds = new Set([
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_EVIDENCE_MISSING,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
      .PREFLIGHT_ARTIFACT_FINGERPRINT_MISSING,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
      .PREFLIGHT_ARTIFACT_FINGERPRINT_MISMATCH,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_TIMESTAMP_MISSING,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_TIMESTAMP_INVALID,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_TIMESTAMP_STALE,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_TIMESTAMP_FUTURE,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
      .PREFLIGHT_TIMESTAMP_PRECEDES_ARTIFACT,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.PREFLIGHT_ACTOR_MISSING,
  ]);
  const executionArtifactRiskIds = new Set([
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.EXECUTION_PLAN_ARTIFACT_NOT_READY,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
      .EXECUTION_PLAN_ARTIFACT_VALIDATION_FAILED,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
      .EXECUTION_PLAN_ARTIFACT_FINGERPRINT_INVALID,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
      .EXECUTION_PLAN_ARTIFACT_TIMESTAMP_INVALID,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
      .EXECUTION_PLAN_ARTIFACT_TIMESTAMP_STALE,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
      .EXECUTION_PLAN_ARTIFACT_EVIDENCE_MISMATCH,
  ]);

  if (risks.some(risk => executionArtifactRiskIds.has(risk.riskId))) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
      .BLOCKED_BY_EXECUTION_ARTIFACT;
  }
  if (risks.some(risk => preflightRiskIds.has(risk.riskId))) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
      .BLOCKED_BY_PREFLIGHT_EVIDENCE;
  }
  if (riskIds.has(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.WORKTREE_NOT_CLEAN)) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS.BLOCKED_BY_WORKTREE;
  }
  if (riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.BACKUP_RESTORE_NOT_VERIFIED
  )) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
      .BLOCKED_BY_RECOVERY_EVIDENCE;
  }
  if (riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.OPERATOR_APPROVAL_MISSING
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.ROLLBACK_STANCE_NOT_FINAL
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.SUPPORT_STANCE_NOT_FINAL
  )) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS.BLOCKED_BY_APPROVAL;
  }
  if (riskIds.has(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.MANIFEST_NOT_CURRENT)) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
      .BLOCKED_BY_MANIFEST_VERIFICATION;
  }

  return POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
    .READY_FOR_CONTROLLED_DELETION;
}

function summarizePreflightEvidence(preflightEvidence = {}) {
  const value = asObject(preflightEvidence);

  return {
    executionPlanArtifactFingerprint: value.executionPlanArtifactFingerprint || null,
    worktree: {
      clean: value.worktree?.clean === true,
      observedAt: value.worktree?.observedAt || null,
      checkedBy: value.worktree?.checkedBy || null,
    },
    recovery: {
      backupRestoreVerified: value.recovery?.backupRestoreVerified === true,
      verifiedAt: value.recovery?.verifiedAt || null,
      verifiedBy: value.recovery?.verifiedBy || null,
    },
    approval: {
      approved: value.approval?.approved === true,
      approvedAt: value.approval?.approvedAt || null,
      approvedBy: value.approval?.approvedBy || null,
    },
    stances: {
      rollbackStanceFinal: value.stances?.rollbackStanceFinal === true,
      supportStanceFinal: value.stances?.supportStanceFinal === true,
      confirmedAt: value.stances?.confirmedAt || null,
      confirmedBy: value.stances?.confirmedBy || null,
    },
    manifest: {
      matchesExecutionPlan: value.manifest?.matchesExecutionPlan === true,
      verifiedAt: value.manifest?.verifiedAt || null,
      verifiedBy: value.manifest?.verifiedBy || null,
    },
  };
}

function countRiskIds(risks = []) {
  return asArray(risks).reduce((counts, risk) => {
    const riskId = String(risk?.riskId || '').trim();

    if (riskId) {
      counts[riskId] = (counts[riskId] || 0) + 1;
    }

    return counts;
  }, {});
}

function riskIdCountsMatch(left = {}, right = {}) {
  const riskIds = new Set([...Object.keys(left), ...Object.keys(right)]);

  return [...riskIds].every(riskId => left[riskId] === right[riskId]);
}

function evaluateSerializedGateEvidence(gate = {}) {
  const gateTimestamp = parseTimestamp(gate.generatedAt);

  if (!gateTimestamp) {
    return {
      gateTimestamp: null,
      risks: [],
      statusId: null,
    };
  }

  const maximumAgeMs = normalizeMaximumAge(gate.executionPolicy?.maxEvidenceAgeMs);
  const artifactEvaluation = evaluateExecutionPlanArtifact({
    executionPlanArtifact: gate.executionPlanArtifact,
    now: gateTimestamp.value,
    maxEvidenceAgeMs: maximumAgeMs,
  });
  const risks = [
    ...artifactEvaluation.risks,
    ...evaluatePreflightEvidence({
      preflightEvidence: gate.preflightEvidence,
      artifactFingerprint: artifactEvaluation.artifact.artifactFingerprint,
      artifactTimestamp: artifactEvaluation.artifactTimestamp,
      evaluationTime: artifactEvaluation.evaluationTime,
      maximumAgeMs: artifactEvaluation.maximumAgeMs,
    }),
  ];

  return {
    gateTimestamp,
    risks,
    statusId: determineStatusId(risks),
  };
}

function buildPolicyCompatibilityDeletionExecutionGate({
  executionPlanArtifact = null,
  preflightEvidence = null,
  generatedAt = null,
  now = null,
  maxEvidenceAgeMs = null,
} = {}) {
  const artifactEvaluation = evaluateExecutionPlanArtifact({
    executionPlanArtifact,
    now: now || generatedAt,
    maxEvidenceAgeMs,
  });
  const risks = [
    ...artifactEvaluation.risks,
    ...evaluatePreflightEvidence({
      preflightEvidence,
      artifactFingerprint: artifactEvaluation.artifact.artifactFingerprint,
      artifactTimestamp: artifactEvaluation.artifactTimestamp,
      evaluationTime: artifactEvaluation.evaluationTime,
      maximumAgeMs: artifactEvaluation.maximumAgeMs,
    }),
  ];
  const resolvedGeneratedAt = resolveTimestamp(generatedAt || now);
  const gate = {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_VERSION,
    generatedAt: resolvedGeneratedAt.value,
    statusId: determineStatusId(risks),
    allowControlledDeletion: risks.length === 0,
    executionPlanArtifact: artifactEvaluation.artifact,
    executionPlan: {
      statusId: artifactEvaluation.artifact.executionPlan?.statusId || null,
      validationOk: artifactEvaluation.artifact.executionPlan?.validation?.ok === true,
      readyForExecutionGate:
        artifactEvaluation.artifact.executionPlan?.readyForExecutionGate === true,
      manifestEntryCount:
        artifactEvaluation.artifact.executionPlan?.manifest?.entryCount ?? null,
      artifactFingerprint:
        artifactEvaluation.artifact.artifactFingerprint?.fingerprint || null,
    },
    preflightEvidence: summarizePreflightEvidence(preflightEvidence),
    riskCount: risks.length,
    risks,
    executionPolicy: {
      executeDeletionNow: false,
      requireSeparateControlledDeletionStep: true,
      requireBoundExecutionPlanArtifact: true,
      requireFreshExecutionEvidence: true,
      requireTimestampedPreflightEvidence: true,
      requireCleanWorktree: true,
      requireFreshBackupRestoreEvidence: true,
      requireOperatorApproval: true,
      requireManifestVerification: true,
      maxEvidenceAgeMs: artifactEvaluation.maximumAgeMs,
    },
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      manifestWritten: false,
      gitCommandsRun: false,
    },
    nextStep: {
      stepId: 'controlled_compatibility_path_removal',
      label: 'Controlled Compatibility Path Removal',
      reason:
        'The final execution gate is bound to current evidence and may now approve a separate controlled deletion step; deletion still must not happen inside the gate evaluator.',
    },
  };

  return {
    ...gate,
    validation: validatePolicyCompatibilityDeletionExecutionGate(gate),
  };
}

function validatePolicyCompatibilityDeletionExecutionGate(gate = {}) {
  const issues = [];

  if (gate.version !== POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility path deletion execution gate version must be recognized.',
      { version: gate.version || null }
    ));
  }
  if (!Object.values(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS)
    .includes(gate.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility path deletion execution gate status must be known.'
    ));
  }
  if (gate.riskCount !== asArray(gate.risks).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.RISK_COUNT_MISMATCH,
      'Compatibility path deletion execution gate risk count must match risk list length.'
    ));
  }
  if (gate.allowControlledDeletion !== (gate.riskCount === 0)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.ALLOW_STATE_MISMATCH,
      'Compatibility path deletion execution gate allow state must match its risks.'
    ));
  }

  const serializedEvidence = evaluateSerializedGateEvidence(gate);

  if (!serializedEvidence.gateTimestamp) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.EXECUTION_GATE_TIMESTAMP_INVALID,
      'Compatibility path deletion execution gate must retain a valid generation timestamp.'
    ));
  } else {
    const expectedRiskCounts = countRiskIds(serializedEvidence.risks);
    const actualRiskCounts = countRiskIds(gate.risks);

    if (!riskIdCountsMatch(actualRiskCounts, expectedRiskCounts)) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS
          .EXECUTION_GATE_EVIDENCE_RISK_MISMATCH,
        'Compatibility path deletion execution gate risks must be derived from its embedded artifact and preflight evidence.',
        {
          expectedRiskCounts,
          actualRiskCounts,
        }
      ));
    }

    if (gate.statusId !== serializedEvidence.statusId) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.EXECUTION_GATE_STATUS_MISMATCH,
        'Compatibility path deletion execution gate status must match its embedded artifact and preflight evidence.',
        {
          expectedStatusId: serializedEvidence.statusId,
          actualStatusId: gate.statusId || null,
        }
      ));
    }
  }

  const executionPolicy = asObject(gate.executionPolicy);

  if (
    executionPolicy.executeDeletionNow !== false ||
    executionPolicy.requireSeparateControlledDeletionStep !== true ||
    executionPolicy.requireBoundExecutionPlanArtifact !== true ||
    executionPolicy.requireFreshExecutionEvidence !== true ||
    executionPolicy.requireTimestampedPreflightEvidence !== true ||
    executionPolicy.requireCleanWorktree !== true ||
    executionPolicy.requireFreshBackupRestoreEvidence !== true ||
    executionPolicy.requireOperatorApproval !== true ||
    executionPolicy.requireManifestVerification !== true ||
    executionPolicy.maxEvidenceAgeMs !== normalizeMaximumAge(executionPolicy.maxEvidenceAgeMs)
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.EXECUTION_POLICY_MISMATCH,
      'Compatibility path deletion execution gate must remain side-effect-free and retain its required preflight policy.'
    ));
  }

  if (
    gate.nextStep?.stepId !== 'controlled_compatibility_path_removal' ||
    gate.nextStep?.label !== 'Controlled Compatibility Path Removal'
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.NEXT_STEP_MISMATCH,
      'Compatibility path deletion execution gate must hand off only to controlled compatibility path removal.'
    ));
  }

  Object.entries(gate.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Compatibility path deletion execution gate cannot perform side effect "${key}".`
      ));
    }
  });

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_VERSION,
  buildPolicyCompatibilityDeletionExecutionGate,
  validatePolicyCompatibilityDeletionExecutionGate,
};
