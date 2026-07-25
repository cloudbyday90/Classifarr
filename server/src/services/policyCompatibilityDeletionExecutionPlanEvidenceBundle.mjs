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
  POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS,
  POLICY_COMPATIBILITY_DELETION_GATES_VERSION,
  POLICY_COMPATIBILITY_DELETION_STATUS_IDS,
  buildPolicyCompatibilityDeletionGates,
} from './policyCompatibilityDeletionGates.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION,
  loadPolicyCompatibilityDeletionCurrentInventory,
} from './policyCompatibilityDeletionCurrentInventory.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION,
  loadPolicyCompatibilityDeletionReconciliationStateInventory,
} from './policyCompatibilityDeletionReconciliationStateInventory.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_READINESS_VERSION,
  buildPolicyCompatibilityDeletionReadiness,
} from './policyCompatibilityDeletionReadiness.mjs';
import {
  POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS,
  POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
} from './policyNativeRuntimeCutoverVerification.mjs';
import {
  loadPolicyNativeRuntimeCutoverVerification,
} from './policyNativeRuntimeCutoverEvidence.mjs';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION =
  'policy.compatibility_deletion_execution_plan_evidence_bundle.v1';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_CURRENT_POLICY_INVENTORY: 'blocked_by_current_policy_inventory',
  BLOCKED_BY_RECONCILIATION_STATE_INVENTORY: 'blocked_by_reconciliation_state_inventory',
  BLOCKED_BY_RUNTIME_CUTOVER: 'blocked_by_runtime_cutover',
  BLOCKED_BY_DELETION_GATES: 'blocked_by_deletion_gates',
  BLOCKED_BY_READINESS: 'blocked_by_readiness',
  BLOCKED_BY_EVIDENCE_FRESHNESS: 'blocked_by_evidence_freshness',
  INVALID_EVIDENCE: 'invalid_evidence',
});

const POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS = Object.freeze({
  CURRENT_POLICY_INVENTORY_NOT_READY: 'current_policy_inventory_not_ready',
  RECONCILIATION_STATE_INVENTORY_NOT_READY: 'reconciliation_state_inventory_not_ready',
  RUNTIME_CUTOVER_NOT_READY: 'runtime_cutover_not_ready',
  DELETION_GATES_NOT_READY: 'deletion_gates_not_ready',
  READINESS_NOT_READY: 'readiness_not_ready',
  EVIDENCE_TIMESTAMP_MISSING: 'evidence_timestamp_missing',
  EVIDENCE_TIMESTAMP_INVALID: 'evidence_timestamp_invalid',
  EVIDENCE_TIMESTAMP_STALE: 'evidence_timestamp_stale',
  EVIDENCE_TIMESTAMP_FUTURE: 'evidence_timestamp_future',
  EVIDENCE_TIMESTAMP_MISMATCH: 'evidence_timestamp_mismatch',
  INVENTORY_GATE_COUNT_MISMATCH: 'inventory_gate_count_mismatch',
  RECONCILIATION_STATE_GATE_COUNT_MISMATCH: 'reconciliation_state_gate_count_mismatch',
  READINESS_INVENTORY_MISMATCH: 'readiness_inventory_mismatch',
  READINESS_RECONCILIATION_STATE_INVENTORY_MISMATCH:
    'readiness_reconciliation_state_inventory_mismatch',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  READY_STATE_MISMATCH: 'ready_state_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

const DEFAULT_MAX_EVIDENCE_AGE_MS = 5 * 60 * 1000;
const MAX_EVIDENCE_TIMESTAMP_SKEW_MS = 30 * 1000;
const MAX_FUTURE_TIMESTAMP_SKEW_MS = 1000;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function parseTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      value: value.toISOString(),
      timestampMs: value.getTime(),
    };
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const timestampMs = Date.parse(value);
  if (Number.isNaN(timestampMs)) {
    return null;
  }

  return {
    value: value.trim(),
    timestampMs,
  };
}

function resolveTimestamp(value) {
  return parseTimestamp(value) || {
    value: new Date().toISOString(),
    timestampMs: Date.now(),
  };
}

function normalizeMaximumEvidenceAge(value) {
  const normalized = Number(value);

  if (
    Number.isInteger(normalized) &&
    normalized > 0 &&
    normalized <= DEFAULT_MAX_EVIDENCE_AGE_MS
  ) {
    return normalized;
  }

  return DEFAULT_MAX_EVIDENCE_AGE_MS;
}

function buildEvidenceSummary(evidence = {}) {
  const value = asObject(evidence);

  return {
    version: value.version || null,
    generatedAt: value.generatedAt || null,
    statusId: value.statusId || null,
    validationOk: value.validation?.ok === true,
    unconvertedPolicyCount:
      value.policyCounts?.unconvertedPolicyCount ?? value.unconvertedPolicyCount ?? null,
    requiresMaintenanceStateCount: value.requiresMaintenanceStateCount ?? null,
    convertedReadAssessedPolicyCount: value.convertedRead?.assessedPolicyCount ?? null,
    convertedReadInvalidPolicyCount: value.convertedRead?.invalidPolicyCount ?? null,
    unconvertedReadAssessedPolicyCount: value.unconvertedRead?.assessedPolicyCount ?? null,
    unconvertedReadInvalidPolicyCount: value.unconvertedRead?.invalidPolicyCount ?? null,
  };
}

function buildTimestampRisks({
  generatedAt,
  now,
  currentPolicyInventory,
  reconciliationStateInventory,
  cutoverVerification,
  deletionGatePlan,
  maxEvidenceAgeMs,
}) {
  const risks = [];
  const collectionTimestamp = parseTimestamp(generatedAt);
  const evaluationTimestamp = resolveTimestamp(now);
  const evidenceEntries = [
    ['currentPolicyInventory', currentPolicyInventory],
    ['reconciliationStateInventory', reconciliationStateInventory],
    ['cutoverVerification', cutoverVerification],
    ['deletionGatePlan', deletionGatePlan],
  ];

  if (!collectionTimestamp) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .EVIDENCE_TIMESTAMP_INVALID,
      'Execution-plan evidence collection time must be a valid ISO timestamp.',
      { generatedAt: generatedAt || null }
    ));
  }

  evidenceEntries.forEach(([evidenceType, evidence]) => {
    const timestamp = parseTimestamp(asObject(evidence).generatedAt);

    if (!asObject(evidence).generatedAt) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .EVIDENCE_TIMESTAMP_MISSING,
        'Execution-plan evidence must report when it was collected.',
        { evidenceType }
      ));
      return;
    }

    if (!timestamp) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .EVIDENCE_TIMESTAMP_INVALID,
        'Execution-plan evidence timestamp must be a valid ISO timestamp.',
        { evidenceType, generatedAt: asObject(evidence).generatedAt }
      ));
      return;
    }

    const ageMs = evaluationTimestamp.timestampMs - timestamp.timestampMs;
    if (ageMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .EVIDENCE_TIMESTAMP_FUTURE,
        'Execution-plan evidence cannot be collected after the evaluation time.',
        { evidenceType, generatedAt: timestamp.value, evaluatedAt: evaluationTimestamp.value }
      ));
    } else if (ageMs > maxEvidenceAgeMs) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .EVIDENCE_TIMESTAMP_STALE,
        'Execution-plan evidence must be recollected before planning compatibility deletion.',
        {
          evidenceType,
          ageMs,
          maxEvidenceAgeMs,
        }
      ));
    }

    if (
      collectionTimestamp &&
      Math.abs(collectionTimestamp.timestampMs - timestamp.timestampMs) >
        MAX_EVIDENCE_TIMESTAMP_SKEW_MS
    ) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .EVIDENCE_TIMESTAMP_MISMATCH,
        'Execution-plan evidence must be collected in one bounded observation window.',
        {
          evidenceType,
          generatedAt: timestamp.value,
          collectionGeneratedAt: collectionTimestamp.value,
          maximumSkewMs: MAX_EVIDENCE_TIMESTAMP_SKEW_MS,
        }
      ));
    }
  });

  return risks;
}

function buildSourceRisks({
  currentPolicyInventory,
  reconciliationStateInventory,
  cutoverVerification,
  deletionGatePlan,
  deletionReadiness,
}) {
  const risks = [];
  const inventory = asObject(currentPolicyInventory);
  const reconciliationState = asObject(reconciliationStateInventory);
  const cutover = asObject(cutoverVerification);
  const gates = asObject(deletionGatePlan);
  const readiness = asObject(deletionReadiness);

  if (
    inventory.version !== POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION ||
    inventory.statusId !==
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS
        .ALL_ENABLED_POLICIES_NATIVE ||
    inventory.allEnabledPoliciesNative !== true ||
    inventory.validation?.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .CURRENT_POLICY_INVENTORY_NOT_READY,
      'Execution planning requires current validated evidence that every enabled policy has one active native intent.',
      {
        statusId: inventory.statusId || null,
        unconvertedPolicyCount: inventory.policyCounts?.unconvertedPolicyCount ?? null,
      }
    ));
  }

  if (
    reconciliationState.version !==
      POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION ||
    reconciliationState.statusId !==
      POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS
        .NO_REQUIRES_MAINTENANCE_STATES ||
    reconciliationState.hasNoRequiresMaintenanceStates !== true ||
    reconciliationState.validation?.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .RECONCILIATION_STATE_INVENTORY_NOT_READY,
      'Execution planning requires current validated evidence that no unresolved requires-maintenance reconciliation states remain.',
      {
        statusId: reconciliationState.statusId || null,
        requiresMaintenanceStateCount:
          reconciliationState.requiresMaintenanceStateCount ?? null,
      }
    ));
  }

  if (
    cutover.version !== POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION ||
    cutover.statusId !==
      POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.READY_FOR_CUTOVER_MONITORING ||
    cutover.validation?.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .RUNTIME_CUTOVER_NOT_READY,
      'Execution planning requires a current valid native-runtime cutover verification.',
      { statusId: cutover.statusId || null }
    ));
  }

  if (
    gates.requiresMaintenanceStateCount !==
      reconciliationState.requiresMaintenanceStateCount
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .RECONCILIATION_STATE_GATE_COUNT_MISMATCH,
      'Compatibility deletion gates must use the current unresolved requires-maintenance reconciliation-state count.',
      {
        inventoryRequiresMaintenanceStateCount:
          reconciliationState.requiresMaintenanceStateCount ?? null,
        deletionGateRequiresMaintenanceStateCount:
          gates.requiresMaintenanceStateCount ?? null,
      }
    ));
  }

  if (
    gates.version !== POLICY_COMPATIBILITY_DELETION_GATES_VERSION ||
    gates.statusId !== POLICY_COMPATIBILITY_DELETION_STATUS_IDS.READY_TO_DELETE ||
    gates.readyToDelete !== true ||
    gates.validation?.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .DELETION_GATES_NOT_READY,
      'Execution planning requires current valid compatibility-deletion gates.',
      { statusId: gates.statusId || null }
    ));
  }

  if (
    readiness.reconciliationStateInventory?.generatedAt !==
      reconciliationState.generatedAt ||
    readiness.reconciliationStateInventory?.requiresMaintenanceStateCount !==
      reconciliationState.requiresMaintenanceStateCount
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .READINESS_RECONCILIATION_STATE_INVENTORY_MISMATCH,
      'Deletion readiness must describe the same reconciliation-state inventory as its evidence bundle.',
      {
        inventoryGeneratedAt: reconciliationState.generatedAt || null,
        readinessInventoryGeneratedAt:
          readiness.reconciliationStateInventory?.generatedAt || null,
      }
    ));
  }

  if (
    gates.unconvertedPolicyCount !== inventory.policyCounts?.unconvertedPolicyCount
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .INVENTORY_GATE_COUNT_MISMATCH,
      'Compatibility deletion gates must use the current inventory conversion count.',
      {
        inventoryUnconvertedPolicyCount:
          inventory.policyCounts?.unconvertedPolicyCount ?? null,
        deletionGateUnconvertedPolicyCount: gates.unconvertedPolicyCount ?? null,
      }
    ));
  }

  if (
    readiness.version !== POLICY_COMPATIBILITY_DELETION_READINESS_VERSION ||
    readiness.statusId !==
      POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS
        .READY_FOR_DELETION_EXECUTION_PLAN ||
    readiness.readyForDeletionExecutionPlan !== true ||
    readiness.validation?.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .READINESS_NOT_READY,
      'Execution planning requires a ready deletion-readiness report composed from the current evidence bundle.',
      { statusId: readiness.statusId || null }
    ));
  }

  if (
    readiness.currentPolicyInventory?.generatedAt !== inventory.generatedAt ||
    readiness.currentPolicyInventory?.unconvertedPolicyCount !==
      inventory.policyCounts?.unconvertedPolicyCount
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .READINESS_INVENTORY_MISMATCH,
      'Deletion readiness must describe the same current policy inventory as its evidence bundle.',
      {
        inventoryGeneratedAt: inventory.generatedAt || null,
        readinessInventoryGeneratedAt:
          readiness.currentPolicyInventory?.generatedAt || null,
      }
    ));
  }

  return risks;
}

function determineStatusId(risks = []) {
  const riskIds = new Set(risks.map(risk => risk.riskId));

  if (riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .EVIDENCE_TIMESTAMP_MISSING
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .EVIDENCE_TIMESTAMP_INVALID
  )) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
      .INVALID_EVIDENCE;
  }

  if (riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .RECONCILIATION_STATE_INVENTORY_NOT_READY
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .RECONCILIATION_STATE_GATE_COUNT_MISMATCH
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .READINESS_RECONCILIATION_STATE_INVENTORY_MISMATCH
  )) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
      .BLOCKED_BY_RECONCILIATION_STATE_INVENTORY;
  }

  if (riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .EVIDENCE_TIMESTAMP_STALE
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .EVIDENCE_TIMESTAMP_FUTURE
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .EVIDENCE_TIMESTAMP_MISMATCH
  )) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
      .BLOCKED_BY_EVIDENCE_FRESHNESS;
  }

  if (riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .CURRENT_POLICY_INVENTORY_NOT_READY
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .INVENTORY_GATE_COUNT_MISMATCH
  ) || riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .READINESS_INVENTORY_MISMATCH
  )) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
      .BLOCKED_BY_CURRENT_POLICY_INVENTORY;
  }

  if (riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .RUNTIME_CUTOVER_NOT_READY
  )) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
      .BLOCKED_BY_RUNTIME_CUTOVER;
  }

  if (riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .DELETION_GATES_NOT_READY
  )) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
      .BLOCKED_BY_DELETION_GATES;
  }

  if (riskIds.has(
    POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
      .READINESS_NOT_READY
  )) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS
      .BLOCKED_BY_READINESS;
  }

  return POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS.READY;
}

function buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle({
  currentPolicyInventory = null,
  reconciliationStateInventory = null,
  cutoverVerification = null,
  deletionGatePlan = null,
  residualCompatibilityReferences = [],
  backupRestoreVerified = false,
  rollbackSupportVerified = false,
  supportDiagnosticsVerified = false,
  deletionManifestApproved = false,
  generatedAt = null,
  now = null,
  maxEvidenceAgeMs = DEFAULT_MAX_EVIDENCE_AGE_MS,
} = {}) {
  const suppliedGeneratedTimestamp = parseTimestamp(generatedAt);
  const generatedTimestamp = generatedAt === null
    ? resolveTimestamp(now)
    : {
      value: suppliedGeneratedTimestamp?.value || String(generatedAt || ''),
      timestampMs: suppliedGeneratedTimestamp?.timestampMs ?? null,
    };
  const maximumEvidenceAgeMs = normalizeMaximumEvidenceAge(maxEvidenceAgeMs);
  const readiness = buildPolicyCompatibilityDeletionReadiness({
    currentPolicyInventory,
    reconciliationStateInventory,
    cutoverVerification,
    deletionGatePlan,
    residualCompatibilityReferences,
    backupRestoreVerified,
    rollbackSupportVerified,
    supportDiagnosticsVerified,
    deletionManifestApproved,
  });
  const risks = [
    ...buildTimestampRisks({
      generatedAt: generatedTimestamp.value,
      now,
      currentPolicyInventory,
      reconciliationStateInventory,
      cutoverVerification,
      deletionGatePlan,
      maxEvidenceAgeMs: maximumEvidenceAgeMs,
    }),
    ...buildSourceRisks({
      currentPolicyInventory,
      reconciliationStateInventory,
      cutoverVerification,
      deletionGatePlan,
      deletionReadiness: readiness,
    }),
  ];
  const bundle = {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION,
    generatedAt: generatedTimestamp.value,
    statusId: determineStatusId(risks),
    readyForExecutionPlan: risks.length === 0,
    freshness: {
      maximumEvidenceAgeMs,
      maximumTimestampSkewMs: MAX_EVIDENCE_TIMESTAMP_SKEW_MS,
      evaluatedAt: resolveTimestamp(now).value,
    },
    evidence: {
      currentPolicyInventory: buildEvidenceSummary(currentPolicyInventory),
      reconciliationStateInventory: buildEvidenceSummary(reconciliationStateInventory),
      cutoverVerification: buildEvidenceSummary(cutoverVerification),
      deletionGatePlan: buildEvidenceSummary(deletionGatePlan),
    },
    deletionReadiness: readiness,
    deletionGatePlan: asObject(deletionGatePlan),
    riskCount: risks.length,
    risks,
    collectionPolicy: {
      collectsCurrentPolicyInventory: true,
      collectsReconciliationStateInventory: true,
      constructsCutoverAndDeletionGatesInOneWindow: true,
      usesReadOnlyRepeatableReadSnapshot: true,
      requiresBoundedEvidenceFreshness: true,
      writesDatabase: false,
      deletesData: false,
    },
    sideEffects: {
      writesDatabase: false,
      writesFiles: false,
      deletesData: false,
      removesCompatibilityPaths: false,
    },
    nextStep: {
      stepId: risks.length === 0
        ? 'compatibility_deletion_execution_plan'
        : 'refresh_compatibility_deletion_execution_plan_evidence',
      label: risks.length === 0
        ? 'Compatibility Path Deletion Execution Plan'
        : 'Refresh Compatibility Deletion Evidence',
      reason: risks.length === 0
        ? 'Current policy and reconciliation-state inventories, runtime cutover, deletion gates, and readiness agree in one bounded evidence window.'
        : 'Compatibility deletion planning requires a current, consistent, valid evidence bundle.',
    },
  };

  return {
    ...bundle,
    validation: validatePolicyCompatibilityDeletionExecutionPlanEvidenceBundle(bundle),
  };
}

function validatePolicyCompatibilityDeletionExecutionPlanEvidenceBundle(bundle = {}) {
  const issues = [];
  const evidence = asObject(bundle.evidence);
  const inventory = asObject(evidence.currentPolicyInventory);
  const reconciliationStateInventory = asObject(evidence.reconciliationStateInventory);
  const cutover = asObject(evidence.cutoverVerification);
  const gateEvidence = asObject(evidence.deletionGatePlan);
  const gates = asObject(bundle.deletionGatePlan);
  const readiness = asObject(bundle.deletionReadiness);

  if (!Object.values(POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS)
    .includes(bundle.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility deletion execution-plan evidence-bundle status must be known.'
    ));
  }

  if (bundle.riskCount !== (Array.isArray(bundle.risks) ? bundle.risks.length : 0)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS.RISK_COUNT_MISMATCH,
      'Compatibility deletion execution-plan evidence-bundle risk count must match its risk list.'
    ));
  }

  if (bundle.readyForExecutionPlan !== (bundle.riskCount === 0)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS.READY_STATE_MISMATCH,
      'Execution-plan evidence-bundle readiness must agree with its risk count.'
    ));
  }

  if (!parseTimestamp(bundle.generatedAt)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .EVIDENCE_TIMESTAMP_INVALID,
      'Execution-plan evidence bundle must report a valid collection timestamp.'
    ));
  }

  const sourceContracts = [
    {
      evidence: inventory,
      version: POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION,
      statusId:
        POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS
          .ALL_ENABLED_POLICIES_NATIVE,
      riskId:
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .CURRENT_POLICY_INVENTORY_NOT_READY,
      label: 'Current policy inventory',
    },
    {
      evidence: reconciliationStateInventory,
      version: POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION,
      statusId:
        POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS
          .NO_REQUIRES_MAINTENANCE_STATES,
      riskId:
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .RECONCILIATION_STATE_INVENTORY_NOT_READY,
      label: 'Reconciliation-state inventory',
    },
    {
      evidence: cutover,
      version: POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
      statusId:
        POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.READY_FOR_CUTOVER_MONITORING,
      riskId:
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .RUNTIME_CUTOVER_NOT_READY,
      label: 'Native runtime cutover verification',
    },
    {
      evidence: gateEvidence,
      version: POLICY_COMPATIBILITY_DELETION_GATES_VERSION,
      statusId: POLICY_COMPATIBILITY_DELETION_STATUS_IDS.READY_TO_DELETE,
      riskId:
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .DELETION_GATES_NOT_READY,
      label: 'Compatibility deletion gates',
    },
  ];

  sourceContracts.forEach(({ evidence: source, version, statusId, riskId, label }) => {
    if (
      source.version !== version ||
      source.statusId !== statusId ||
      source.validationOk !== true
    ) {
      issues.push(buildRisk(
        riskId,
        `${label} summary must retain its ready, valid source contract.`
      ));
    }

    if (!parseTimestamp(source.generatedAt)) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .EVIDENCE_TIMESTAMP_INVALID,
        `${label} summary must retain a valid collection timestamp.`
      ));
    }
  });

  if (
    readiness.version !== POLICY_COMPATIBILITY_DELETION_READINESS_VERSION ||
    readiness.statusId !==
      POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS
        .READY_FOR_DELETION_EXECUTION_PLAN ||
    readiness.readyForDeletionExecutionPlan !== true ||
    readiness.validation?.ok !== true
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .READINESS_NOT_READY,
      'Execution-plan evidence bundle must retain a ready, valid deletion-readiness report.'
    ));
  }

  if (
    gates.unconvertedPolicyCount !== inventory.unconvertedPolicyCount ||
    readiness.currentPolicyInventory?.unconvertedPolicyCount !==
      inventory.unconvertedPolicyCount
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .INVENTORY_GATE_COUNT_MISMATCH,
      'Execution-plan evidence bundle must preserve the measured conversion count across gates and readiness.'
    ));
  }

  if (
    gates.requiresMaintenanceStateCount !==
      reconciliationStateInventory.requiresMaintenanceStateCount ||
    readiness.reconciliationStateInventory?.requiresMaintenanceStateCount !==
      reconciliationStateInventory.requiresMaintenanceStateCount
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
        .RECONCILIATION_STATE_GATE_COUNT_MISMATCH,
      'Execution-plan evidence bundle must preserve the measured requires-maintenance reconciliation-state count across gates and readiness.'
    ));
  }

  Object.entries(asObject(bundle.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
        `Compatibility deletion execution-plan evidence bundle cannot perform side effect "${key}".`
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

async function loadPolicyCompatibilityDeletionExecutionPlanEvidenceBundle(dbClient, {
  compatibilityModules = undefined,
  compatibilityDeletionGates = undefined,
  coverage = {},
  residualCompatibilityReferences = [],
  backupRestoreVerified = false,
  rollbackSupportVerified = false,
  supportDiagnosticsVerified = false,
  deletionManifestApproved = false,
  generatedAt = null,
  now = null,
  maxEvidenceAgeMs = DEFAULT_MAX_EVIDENCE_AGE_MS,
} = {}) {
  const suppliedGeneratedTimestamp = parseTimestamp(generatedAt);
  const collectionTimestamp = generatedAt === null
    ? resolveTimestamp(now).value
    : suppliedGeneratedTimestamp?.value || String(generatedAt || '');
  if (
    !dbClient ||
    typeof dbClient.query !== 'function' ||
    typeof dbClient.withTransaction !== 'function'
  ) {
    throw new TypeError(
      'A database client with query(text) and withTransaction(fn) is required.'
    );
  }

  const collectInventories = async client => {
    const currentPolicyInventory = await loadPolicyCompatibilityDeletionCurrentInventory(client, {
      generatedAt: collectionTimestamp,
    });
    const reconciliationStateInventory =
      await loadPolicyCompatibilityDeletionReconciliationStateInventory(client, {
        generatedAt: collectionTimestamp,
      });
    const cutoverVerification = await loadPolicyNativeRuntimeCutoverVerification(client, {
      generatedAt: collectionTimestamp,
    });

    return {
      currentPolicyInventory,
      reconciliationStateInventory,
      cutoverVerification,
    };
  };
  const inventories = await dbClient.withTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    return collectInventories(client);
  });
  const {
    currentPolicyInventory,
    reconciliationStateInventory,
    cutoverVerification,
  } = inventories;
  const deletionGatePlan = buildPolicyCompatibilityDeletionGates({
    compatibilityModules,
    compatibilityDeletionGates,
    coverage,
    unconvertedPolicyCount:
      currentPolicyInventory.policyCounts?.unconvertedPolicyCount ?? null,
    requiresMaintenanceStateCount:
      reconciliationStateInventory.requiresMaintenanceStateCount ?? null,
    supportStanceId: POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.BLOCK_DELETION,
    generatedAt: collectionTimestamp,
  });

  return buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle({
    currentPolicyInventory,
    reconciliationStateInventory,
    cutoverVerification,
    deletionGatePlan,
    residualCompatibilityReferences,
    backupRestoreVerified,
    rollbackSupportVerified,
    supportDiagnosticsVerified,
    deletionManifestApproved,
    generatedAt: collectionTimestamp,
    now,
    maxEvidenceAgeMs,
  });
}

export {
  DEFAULT_MAX_EVIDENCE_AGE_MS,
  MAX_EVIDENCE_TIMESTAMP_SKEW_MS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION,
  buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
  loadPolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
  validatePolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
};
