import {
  POLICY_COMPATIBILITY_DELETION_GATES_VERSION,
  POLICY_COMPATIBILITY_DELETION_STATUS_IDS,
  buildPolicyCompatibilityDeletionGates,
} from './policyCompatibilityDeletionGates.mjs';
import {
  POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
  POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS,
  buildPolicyNativeRuntimeCutoverVerification,
} from './policyNativeRuntimeCutoverVerification.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION,
} from './policyCompatibilityDeletionCurrentInventory.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION,
} from './policyCompatibilityDeletionReconciliationStateInventory.mjs';

const POLICY_COMPATIBILITY_DELETION_READINESS_VERSION =
  'policy.compatibility_deletion_readiness.v1';

const POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS = Object.freeze({
  READY_FOR_DELETION_EXECUTION_PLAN: 'ready_for_deletion_execution_plan',
  BLOCKED_BY_RUNTIME_CUTOVER: 'blocked_by_runtime_cutover',
  BLOCKED_BY_CURRENT_POLICY_INVENTORY: 'blocked_by_current_policy_inventory',
  BLOCKED_BY_RECONCILIATION_STATE_INVENTORY: 'blocked_by_reconciliation_state_inventory',
  BLOCKED_BY_DELETION_GATES: 'blocked_by_deletion_gates',
  BLOCKED_BY_RESIDUAL_COMPATIBILITY_REFERENCES: 'blocked_by_residual_compatibility_references',
  BLOCKED_BY_SAFETY_CONFIRMATION: 'blocked_by_safety_confirmation',
});

const POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS = Object.freeze({
  CUTOVER_NOT_READY: 'cutover_not_ready',
  CUTOVER_VALIDATION_FAILED: 'cutover_validation_failed',
  CURRENT_POLICY_INVENTORY_MISSING: 'current_policy_inventory_missing',
  CURRENT_POLICY_INVENTORY_NOT_READY: 'current_policy_inventory_not_ready',
  CURRENT_POLICY_INVENTORY_VALIDATION_FAILED: 'current_policy_inventory_validation_failed',
  RECONCILIATION_STATE_INVENTORY_MISSING: 'reconciliation_state_inventory_missing',
  RECONCILIATION_STATE_INVENTORY_NOT_READY: 'reconciliation_state_inventory_not_ready',
  RECONCILIATION_STATE_INVENTORY_VALIDATION_FAILED: 'reconciliation_state_inventory_validation_failed',
  RECONCILIATION_STATE_GATE_COUNT_MISMATCH: 'reconciliation_state_gate_count_mismatch',
  DELETION_GATES_NOT_READY: 'deletion_gates_not_ready',
  DELETION_GATES_VALIDATION_FAILED: 'deletion_gates_validation_failed',
  RESIDUAL_COMPATIBILITY_REFERENCE: 'residual_compatibility_reference',
  BACKUP_RESTORE_NOT_VERIFIED: 'backup_restore_not_verified',
  ROLLBACK_SUPPORT_NOT_VERIFIED: 'rollback_support_not_verified',
  SUPPORT_DIAGNOSTICS_NOT_VERIFIED: 'support_diagnostics_not_verified',
  DELETION_MANIFEST_NOT_APPROVED: 'deletion_manifest_not_approved',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
  VERSION_MISMATCH: 'version_mismatch',
  DERIVED_STATUS_MISMATCH: 'derived_status_mismatch',
  READY_STATE_MISMATCH: 'ready_state_mismatch',
  READY_CURRENT_POLICY_INVENTORY_INVALID: 'ready_current_policy_inventory_invalid',
  READY_RECONCILIATION_STATE_INVENTORY_INVALID:
    'ready_reconciliation_state_inventory_invalid',
  READY_RUNTIME_CUTOVER_INVALID: 'ready_runtime_cutover_invalid',
  READY_DELETION_GATES_INVALID: 'ready_deletion_gates_invalid',
  READY_RECONCILIATION_STATE_GATE_MISMATCH:
    'ready_reconciliation_state_gate_mismatch',
  READY_RESIDUAL_REFERENCES_INVALID: 'ready_residual_references_invalid',
  READY_SAFETY_CONFIRMATIONS_INVALID: 'ready_safety_confirmations_invalid',
  DELETION_POLICY_MISMATCH: 'deletion_policy_mismatch',
  NEXT_STEP_MISMATCH: 'next_step_mismatch',
});

const REQUIRED_DELETION_POLICY = Object.freeze({
  executeDeletionNow: false,
  requireExecutionPlan: true,
  requireRollbackOrPostWindowSupport: true,
  requireNoResidualCompatibilityReferences: true,
  requireSupportDiagnostics: true,
  requireZeroRequiresMaintenanceStates: true,
});

const REQUIRED_NEXT_STEP = Object.freeze({
  stepId: 'compatibility_deletion_execution_plan',
  label: 'Compatibility Path Deletion Execution Plan',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function buildDefaultCutoverVerification() {
  return buildPolicyNativeRuntimeCutoverVerification();
}

function buildDefaultDeletionGatePlan() {
  return buildPolicyCompatibilityDeletionGates();
}

function evaluateCurrentPolicyInventory(currentPolicyInventory) {
  const inventory = currentPolicyInventory && typeof currentPolicyInventory === 'object'
    ? currentPolicyInventory
    : null;
  const risks = [];

  if (!inventory) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.CURRENT_POLICY_INVENTORY_MISSING,
      'Compatibility deletion readiness requires a current read-only inventory of every enabled policy.'
    ));
    return { currentPolicyInventory: null, risks };
  }

  if (
    inventory.version !== POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION ||
    inventory.statusId !==
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS.ALL_ENABLED_POLICIES_NATIVE ||
    inventory.allEnabledPoliciesNative !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.CURRENT_POLICY_INVENTORY_NOT_READY,
      'Compatibility deletion readiness requires every enabled policy to have one valid active native intent.',
      {
        version: inventory.version || null,
        statusId: inventory.statusId || null,
        unconvertedPolicyCount: inventory.policyCounts?.unconvertedPolicyCount ?? null,
      }
    ));
  }

  if (inventory.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.CURRENT_POLICY_INVENTORY_VALIDATION_FAILED,
      'Current policy inventory must validate before compatibility deletion readiness can pass.',
      { issueCount: inventory.validation?.issueCount ?? null }
    ));
  }

  return { currentPolicyInventory: inventory, risks };
}

function evaluateReconciliationStateInventory(reconciliationStateInventory) {
  const inventory = reconciliationStateInventory &&
    typeof reconciliationStateInventory === 'object'
    ? reconciliationStateInventory
    : null;
  const risks = [];

  if (!inventory) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
        .RECONCILIATION_STATE_INVENTORY_MISSING,
      'Compatibility deletion readiness requires a current read-only count of unresolved requires-maintenance reconciliation states.'
    ));
    return { reconciliationStateInventory: null, risks };
  }

  if (
    inventory.version !== POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION ||
    inventory.statusId !== POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS
      .NO_REQUIRES_MAINTENANCE_STATES ||
    inventory.hasNoRequiresMaintenanceStates !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
        .RECONCILIATION_STATE_INVENTORY_NOT_READY,
      'Compatibility deletion readiness requires zero unresolved requires-maintenance reconciliation states.',
      {
        version: inventory.version || null,
        statusId: inventory.statusId || null,
        requiresMaintenanceStateCount: inventory.requiresMaintenanceStateCount ?? null,
      }
    ));
  }

  if (inventory.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
        .RECONCILIATION_STATE_INVENTORY_VALIDATION_FAILED,
      'Reconciliation-state inventory must validate before compatibility deletion readiness can pass.',
      { issueCount: inventory.validation?.issueCount ?? null }
    ));
  }

  return { reconciliationStateInventory: inventory, risks };
}

function normalizeResidualReferences(references = []) {
  return asArray(references)
    .map(reference => {
      if (typeof reference === 'string') {
        return {
          path: reference,
          reason: 'Compatibility reference still needs owner review.',
        };
      }

      return {
        path: reference?.path || 'unknown',
        reason: reference?.reason || 'Compatibility reference still needs owner review.',
        owner: reference?.owner || null,
        replacement: reference?.replacement || null,
      };
    });
}

function evaluateCutover(cutoverVerification) {
  const risks = [];
  const verification = cutoverVerification || buildDefaultCutoverVerification();

  if (
    verification.statusId !==
    POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.READY_FOR_CUTOVER_MONITORING
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.CUTOVER_NOT_READY,
      'Compatibility deletion requires converted policies to read native intent and unconverted policies to stay on compatibility fallback.',
      { statusId: verification.statusId || null }
    ));
  }

  if (verification.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.CUTOVER_VALIDATION_FAILED,
      'Native runtime cutover verification must validate before compatibility deletion readiness can pass.',
      { issueCount: verification.validation?.issueCount ?? null }
    ));
  }

  return {
    cutoverVerification: verification,
    risks,
  };
}

function evaluateDeletionGates(deletionGatePlan) {
  const risks = [];
  const plan = deletionGatePlan || buildDefaultDeletionGatePlan();

  if (plan.statusId !== POLICY_COMPATIBILITY_DELETION_STATUS_IDS.READY_TO_DELETE) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.DELETION_GATES_NOT_READY,
      'Legacy code deletion gates must be ready before compatibility path deletion can proceed.',
      { statusId: plan.statusId || null }
    ));
  }

  if (plan.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.DELETION_GATES_VALIDATION_FAILED,
      'Legacy code deletion gates must validate before compatibility path deletion can proceed.',
      { issueCount: plan.validation?.issueCount ?? null }
    ));
  }

  return {
    deletionGatePlan: plan,
    risks,
  };
}

function evaluateReconciliationStateGateBinding({
  reconciliationStateInventory,
  deletionGatePlan,
}) {
  const inventoryCount = reconciliationStateInventory?.requiresMaintenanceStateCount;
  const gateCount = deletionGatePlan?.requiresMaintenanceStateCount;

  if (inventoryCount === gateCount) {
    return [];
  }

  return [buildRisk(
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
      .RECONCILIATION_STATE_GATE_COUNT_MISMATCH,
    'Compatibility deletion gates must use the current measured requires-maintenance reconciliation-state count.',
    {
      inventoryRequiresMaintenanceStateCount: inventoryCount ?? null,
      deletionGateRequiresMaintenanceStateCount: gateCount ?? null,
    }
  )];
}

function evaluateResidualReferences(residualCompatibilityReferences = []) {
  const references = normalizeResidualReferences(residualCompatibilityReferences);

  return {
    residualCompatibilityReferences: references,
    risks: references.map(reference => buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.RESIDUAL_COMPATIBILITY_REFERENCE,
      'Compatibility path deletion requires every residual reference to be replaced or intentionally retained outside normal flow.',
      reference
    )),
  };
}

function evaluateSafetyConfirmations({
  backupRestoreVerified,
  rollbackSupportVerified,
  supportDiagnosticsVerified,
  deletionManifestApproved,
}) {
  const risks = [];

  if (backupRestoreVerified !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.BACKUP_RESTORE_NOT_VERIFIED,
      'Compatibility path deletion requires verified backup and restore coverage.'
    ));
  }

  if (rollbackSupportVerified !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.ROLLBACK_SUPPORT_NOT_VERIFIED,
      'Compatibility path deletion requires verified rollback support or an approved post-window stance.'
    ));
  }

  if (supportDiagnosticsVerified !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.SUPPORT_DIAGNOSTICS_NOT_VERIFIED,
      'Compatibility path deletion requires bounded support diagnostics for converted native intent.'
    ));
  }

  if (deletionManifestApproved !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.DELETION_MANIFEST_NOT_APPROVED,
      'Compatibility path deletion requires an approved deletion manifest before execution planning.'
    ));
  }

  return risks;
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.CURRENT_POLICY_INVENTORY_MISSING,
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.CURRENT_POLICY_INVENTORY_NOT_READY,
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.CURRENT_POLICY_INVENTORY_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS.BLOCKED_BY_CURRENT_POLICY_INVENTORY;
  }

  if (risks.some(risk => [
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
      .RECONCILIATION_STATE_INVENTORY_MISSING,
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
      .RECONCILIATION_STATE_INVENTORY_NOT_READY,
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
      .RECONCILIATION_STATE_INVENTORY_VALIDATION_FAILED,
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
      .RECONCILIATION_STATE_GATE_COUNT_MISMATCH,
  ].includes(risk.riskId))) {
    return POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS
      .BLOCKED_BY_RECONCILIATION_STATE_INVENTORY;
  }

  if (risks.some(risk => [
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.CUTOVER_NOT_READY,
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.CUTOVER_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS.BLOCKED_BY_RUNTIME_CUTOVER;
  }

  if (risks.some(risk => [
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.DELETION_GATES_NOT_READY,
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.DELETION_GATES_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS.BLOCKED_BY_DELETION_GATES;
  }

  if (risks.some(risk =>
    risk.riskId ===
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.RESIDUAL_COMPATIBILITY_REFERENCE
  )) {
    return POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS
      .BLOCKED_BY_RESIDUAL_COMPATIBILITY_REFERENCES;
  }

  if (risks.some(risk => [
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.BACKUP_RESTORE_NOT_VERIFIED,
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.ROLLBACK_SUPPORT_NOT_VERIFIED,
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.SUPPORT_DIAGNOSTICS_NOT_VERIFIED,
    POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.DELETION_MANIFEST_NOT_APPROVED,
  ].includes(risk.riskId))) {
    return POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS
      .BLOCKED_BY_SAFETY_CONFIRMATION;
  }

  return POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS.READY_FOR_DELETION_EXECUTION_PLAN;
}

function buildPolicyCompatibilityDeletionReadiness({
  currentPolicyInventory = null,
  reconciliationStateInventory = null,
  cutoverVerification = null,
  deletionGatePlan = null,
  residualCompatibilityReferences = [],
  backupRestoreVerified = false,
  rollbackSupportVerified = false,
  supportDiagnosticsVerified = false,
  deletionManifestApproved = false,
} = {}) {
  const inventory = evaluateCurrentPolicyInventory(currentPolicyInventory);
  const reconciliationState = evaluateReconciliationStateInventory(
    reconciliationStateInventory
  );
  const cutover = evaluateCutover(cutoverVerification);
  const deletionGates = evaluateDeletionGates(deletionGatePlan);
  const residual = evaluateResidualReferences(residualCompatibilityReferences);
  const safetyRisks = evaluateSafetyConfirmations({
    backupRestoreVerified,
    rollbackSupportVerified,
    supportDiagnosticsVerified,
    deletionManifestApproved,
  });
  const risks = [
    ...inventory.risks,
    ...reconciliationState.risks,
    ...cutover.risks,
    ...deletionGates.risks,
    ...evaluateReconciliationStateGateBinding({
      reconciliationStateInventory: reconciliationState.reconciliationStateInventory,
      deletionGatePlan: deletionGates.deletionGatePlan,
    }),
    ...residual.risks,
    ...safetyRisks,
  ];
  const readiness = {
    version: POLICY_COMPATIBILITY_DELETION_READINESS_VERSION,
    statusId: determineStatusId(risks),
    readyForDeletionExecutionPlan: risks.length === 0,
    currentPolicyInventory: inventory.currentPolicyInventory
      ? {
        version: inventory.currentPolicyInventory.version || null,
        generatedAt: inventory.currentPolicyInventory.generatedAt || null,
        statusId: inventory.currentPolicyInventory.statusId || null,
        allEnabledPoliciesNative:
          inventory.currentPolicyInventory.allEnabledPoliciesNative === true,
        validationOk: inventory.currentPolicyInventory.validation?.ok === true,
        unconvertedPolicyCount:
          inventory.currentPolicyInventory.policyCounts?.unconvertedPolicyCount ?? null,
      }
      : null,
    reconciliationStateInventory: reconciliationState.reconciliationStateInventory
      ? {
        version: reconciliationState.reconciliationStateInventory.version || null,
        generatedAt: reconciliationState.reconciliationStateInventory.generatedAt || null,
        statusId: reconciliationState.reconciliationStateInventory.statusId || null,
        hasNoRequiresMaintenanceStates:
          reconciliationState.reconciliationStateInventory
            .hasNoRequiresMaintenanceStates === true,
        validationOk:
          reconciliationState.reconciliationStateInventory.validation?.ok === true,
        requiresMaintenanceStateCount:
          reconciliationState.reconciliationStateInventory
            .requiresMaintenanceStateCount ?? null,
      }
      : null,
    cutover: {
      version: cutover.cutoverVerification.version || null,
      generatedAt: cutover.cutoverVerification.generatedAt || null,
      statusId: cutover.cutoverVerification.statusId || null,
      validationOk: cutover.cutoverVerification.validation?.ok === true,
      riskCount: cutover.cutoverVerification.riskCount ?? null,
    },
    deletionGates: {
      version: deletionGates.deletionGatePlan.version || null,
      generatedAt: deletionGates.deletionGatePlan.generatedAt || null,
      statusId: deletionGates.deletionGatePlan.statusId || null,
      readyToDelete: deletionGates.deletionGatePlan.readyToDelete === true,
      validationOk: deletionGates.deletionGatePlan.validation?.ok === true,
      blockerCount: asArray(deletionGates.deletionGatePlan.blockers).length,
      unconvertedPolicyCount:
        deletionGates.deletionGatePlan.unconvertedPolicyCount ?? null,
      requiresMaintenanceStateCount:
        deletionGates.deletionGatePlan.requiresMaintenanceStateCount ?? null,
    },
    residualCompatibilityReferences: residual.residualCompatibilityReferences,
    safetyConfirmations: {
      backupRestoreVerified: backupRestoreVerified === true,
      rollbackSupportVerified: rollbackSupportVerified === true,
      supportDiagnosticsVerified: supportDiagnosticsVerified === true,
      deletionManifestApproved: deletionManifestApproved === true,
    },
    riskCount: risks.length,
    risks,
    deletionPolicy: { ...REQUIRED_DELETION_POLICY },
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      deletionManifestWritten: false,
    },
    nextStep: {
      ...REQUIRED_NEXT_STEP,
      reason:
        'Deletion readiness can now be evaluated; the next step is an explicit execution manifest before any compatibility path is removed.',
    },
  };

  return {
    ...readiness,
    validation: validatePolicyCompatibilityDeletionReadiness(readiness),
  };
}

function isReadyCurrentPolicyInventorySummary(inventory = {}) {
  return inventory?.version === POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION &&
    inventory.statusId === POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS
      .ALL_ENABLED_POLICIES_NATIVE &&
    inventory.allEnabledPoliciesNative === true &&
    inventory.validationOk === true &&
    inventory.unconvertedPolicyCount === 0;
}

function isReadyReconciliationStateInventorySummary(inventory = {}) {
  return inventory?.version ===
    POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION &&
    inventory.statusId ===
      POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS
        .NO_REQUIRES_MAINTENANCE_STATES &&
    inventory.hasNoRequiresMaintenanceStates === true &&
    inventory.validationOk === true &&
    inventory.requiresMaintenanceStateCount === 0;
}

function isReadyCutoverSummary(cutover = {}) {
  return cutover?.version === POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION &&
    cutover.statusId === POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS
    .READY_FOR_CUTOVER_MONITORING &&
    cutover.validationOk === true &&
    (cutover.riskCount === null || cutover.riskCount === 0);
}

function isReadyDeletionGateSummary(deletionGates = {}) {
  return deletionGates?.version === POLICY_COMPATIBILITY_DELETION_GATES_VERSION &&
    deletionGates.statusId === POLICY_COMPATIBILITY_DELETION_STATUS_IDS
    .READY_TO_DELETE &&
    deletionGates.readyToDelete === true &&
    deletionGates.validationOk === true &&
    deletionGates.blockerCount === 0 &&
    deletionGates.unconvertedPolicyCount === 0 &&
    deletionGates.requiresMaintenanceStateCount === 0;
}

function validateReadyEvidenceSummaries(readiness, issues) {
  const isReadyClaim = readiness.statusId ===
    POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS.READY_FOR_DELETION_EXECUTION_PLAN ||
    readiness.readyForDeletionExecutionPlan === true;

  if (!isReadyClaim) return;

  if (!isReadyCurrentPolicyInventorySummary(readiness.currentPolicyInventory)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
        .READY_CURRENT_POLICY_INVENTORY_INVALID,
      'A ready compatibility deletion report requires one validated active native intent for every enabled policy.'
    ));
  }

  if (!isReadyReconciliationStateInventorySummary(readiness.reconciliationStateInventory)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
        .READY_RECONCILIATION_STATE_INVENTORY_INVALID,
      'A ready compatibility deletion report requires zero unresolved requires-maintenance reconciliation states.'
    ));
  }

  if (!isReadyCutoverSummary(readiness.cutover)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.READY_RUNTIME_CUTOVER_INVALID,
      'A ready compatibility deletion report requires a validated native runtime cutover with no risks.'
    ));
  }

  if (!isReadyDeletionGateSummary(readiness.deletionGates)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.READY_DELETION_GATES_INVALID,
      'A ready compatibility deletion report requires validated ready compatibility deletion gates.'
    ));
  }

  if (
    readiness.reconciliationStateInventory?.requiresMaintenanceStateCount !==
    readiness.deletionGates?.requiresMaintenanceStateCount
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
        .READY_RECONCILIATION_STATE_GATE_MISMATCH,
      'A ready compatibility deletion report must bind deletion gates to the same reconciliation-state count.'
    ));
  }

  if (
    !Array.isArray(readiness.residualCompatibilityReferences) ||
    readiness.residualCompatibilityReferences.length !== 0
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.READY_RESIDUAL_REFERENCES_INVALID,
      'A ready compatibility deletion report cannot retain residual compatibility references.'
    ));
  }

  const safety = readiness.safetyConfirmations || {};
  if (
    safety.backupRestoreVerified !== true ||
    safety.rollbackSupportVerified !== true ||
    safety.supportDiagnosticsVerified !== true ||
    safety.deletionManifestApproved !== true
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS
        .READY_SAFETY_CONFIRMATIONS_INVALID,
      'A ready compatibility deletion report requires verified recovery, support, and manifest confirmations.'
    ));
  }
}

function validateImmutableReadinessPolicy(readiness, issues) {
  Object.entries(REQUIRED_DELETION_POLICY).forEach(([key, expected]) => {
    if (readiness.deletionPolicy?.[key] !== expected) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.DELETION_POLICY_MISMATCH,
        'Compatibility deletion readiness must retain its non-destructive execution policy.',
        { key, expected, actual: readiness.deletionPolicy?.[key] ?? null }
      ));
    }
  });

  if (
    readiness.nextStep?.stepId !== REQUIRED_NEXT_STEP.stepId ||
    readiness.nextStep?.label !== REQUIRED_NEXT_STEP.label
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.NEXT_STEP_MISMATCH,
      'Compatibility deletion readiness can advance only to the execution-plan step.'
    ));
  }
}

function validatePolicyCompatibilityDeletionReadiness(readiness = {}) {
  const issues = [];

  if (readiness.version !== POLICY_COMPATIBILITY_DELETION_READINESS_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.VERSION_MISMATCH,
      'Compatibility path deletion readiness must use the current contract version.',
      { expected: POLICY_COMPATIBILITY_DELETION_READINESS_VERSION, actual: readiness.version || null }
    ));
  }

  if (!Object.values(POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS)
    .includes(readiness.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility path deletion readiness status must be known.'
    ));
  }

  if (readiness.riskCount !== asArray(readiness.risks).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.RISK_COUNT_MISMATCH,
      'Compatibility path deletion readiness risk count must match risk list length.'
    ));
  }

  const derivedStatusId = determineStatusId(asArray(readiness.risks));
  if (readiness.statusId !== derivedStatusId) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.DERIVED_STATUS_MISMATCH,
      'Compatibility path deletion readiness status must be derived from its retained risks.',
      { expected: derivedStatusId, actual: readiness.statusId || null }
    ));
  }

  const expectedReady = asArray(readiness.risks).length === 0 &&
    derivedStatusId ===
      POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS.READY_FOR_DELETION_EXECUTION_PLAN;
  if (readiness.readyForDeletionExecutionPlan !== expectedReady) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.READY_STATE_MISMATCH,
      'Compatibility path deletion readiness must derive its ready state from the retained risks.',
      { expected: expectedReady, actual: readiness.readyForDeletionExecutionPlan === true }
    ));
  }

  validateReadyEvidenceSummaries(readiness, issues);
  validateImmutableReadinessPolicy(readiness, issues);

  Object.entries(readiness.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Compatibility path deletion readiness cannot perform side effect "${key}".`
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_COMPATIBILITY_DELETION_READINESS_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_READINESS_VERSION,
  buildPolicyCompatibilityDeletionReadiness,
  validatePolicyCompatibilityDeletionReadiness,
};
