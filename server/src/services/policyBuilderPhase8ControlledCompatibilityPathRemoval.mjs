import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionPlan,
} from './policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionGate,
} from './policyCompatibilityDeletionExecutionGate.mjs';

const PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_VERSION =
  'phase8r.controlled_compatibility_path_removal.v1';

const PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS = Object.freeze({
  READY_FOR_REMOVAL_REVIEW: 'ready_for_removal_review',
  BLOCKED_BY_EXECUTION_PLAN: 'blocked_by_execution_plan',
  BLOCKED_BY_EXECUTION_GATE: 'blocked_by_execution_gate',
  BLOCKED_BY_SELECTION: 'blocked_by_selection',
  BLOCKED_BY_SCOPE: 'blocked_by_scope',
  BLOCKED_BY_APPROVAL: 'blocked_by_approval',
});

const PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS = Object.freeze({
  EXECUTION_PLAN_NOT_READY: 'execution_plan_not_ready',
  EXECUTION_PLAN_VALIDATION_FAILED: 'execution_plan_validation_failed',
  EXECUTION_GATE_NOT_READY: 'execution_gate_not_ready',
  EXECUTION_GATE_VALIDATION_FAILED: 'execution_gate_validation_failed',
  NO_PATHS_SELECTED: 'no_paths_selected',
  SELECTED_PATH_NOT_IN_MANIFEST: 'selected_path_not_in_manifest',
  SELECTED_ENTRY_NOT_READY: 'selected_entry_not_ready',
  REMOVAL_SCOPE_TOO_BROAD: 'removal_scope_too_broad',
  MISSING_REVIEW_REASON: 'missing_review_reason',
  MISSING_REVIEWER: 'missing_reviewer',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function uniqueNormalizedPaths(paths = []) {
  return [...new Set(asArray(paths).map(normalizePath).filter(Boolean))];
}

function evaluateExecutionPlan(executionPlan) {
  const plan = executionPlan || buildPolicyCompatibilityDeletionExecutionPlan();
  const risks = [];

  if (
    plan.statusId !==
    POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE ||
    plan.readyForExecutionGate !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_PLAN_NOT_READY,
      'Controlled compatibility path removal requires a ready Phase 8R.15 execution plan.',
      { statusId: plan.statusId || null }
    ));
  }

  if (plan.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_PLAN_VALIDATION_FAILED,
      'Controlled compatibility path removal requires a valid execution plan.',
      { issueCount: plan.validation?.issueCount ?? null }
    ));
  }

  return {
    plan,
    risks,
  };
}

function evaluateExecutionGate(executionGate) {
  const gate = executionGate || buildPolicyCompatibilityDeletionExecutionGate();
  const risks = [];

  if (
    gate.statusId !==
    POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS.READY_FOR_CONTROLLED_DELETION ||
    gate.allowControlledDeletion !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_NOT_READY,
      'Controlled compatibility path removal requires a ready Phase 8R.16 execution gate.',
      { statusId: gate.statusId || null }
    ));
  }

  if (gate.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_VALIDATION_FAILED,
      'Controlled compatibility path removal requires a valid execution gate.',
      { issueCount: gate.validation?.issueCount ?? null }
    ));
  }

  return {
    gate,
    risks,
  };
}

function buildSelectedEntries({
  manifestEntries = [],
  selectedPaths = [],
}) {
  const entryByPath = new Map(
    manifestEntries.map(entry => [normalizePath(entry.path), entry])
  );
  const normalizedPaths = uniqueNormalizedPaths(selectedPaths);

  return {
    normalizedPaths,
    entries: normalizedPaths
      .map(path => entryByPath.get(path))
      .filter(Boolean),
    missingPaths: normalizedPaths.filter(path => !entryByPath.has(path)),
  };
}

function evaluateSelection({
  selectedEntries = [],
  selectedPaths = [],
  missingPaths = [],
  maxBatchSize,
}) {
  const risks = [];

  if (selectedPaths.length === 0) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.NO_PATHS_SELECTED,
      'Controlled compatibility path removal requires at least one selected manifest path.'
    ));
  }

  missingPaths.forEach(path => {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SELECTED_PATH_NOT_IN_MANIFEST,
      'Controlled compatibility path removal can only target paths from the approved manifest.',
      { path }
    ));
  });

  selectedEntries.forEach(entry => {
    if (entry.ready !== true) {
      risks.push(buildRisk(
        PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SELECTED_ENTRY_NOT_READY,
        'Selected compatibility path removal entries must include replacement evidence.',
        {
          path: entry.path,
          categoryId: entry.categoryId,
        }
      ));
    }
  });

  if (selectedPaths.length > maxBatchSize) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.REMOVAL_SCOPE_TOO_BROAD,
      'Controlled compatibility path removal requires a narrow, reviewable batch.',
      {
        selectedCount: selectedPaths.length,
        maxBatchSize,
      }
    ));
  }

  return risks;
}

function evaluateReviewMetadata({
  removalReason,
  reviewedBy,
}) {
  const risks = [];

  if (!String(removalReason || '').trim()) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MISSING_REVIEW_REASON,
      'Controlled compatibility path removal requires a review reason.'
    ));
  }

  if (!String(reviewedBy || '').trim()) {
    risks.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MISSING_REVIEWER,
      'Controlled compatibility path removal requires a reviewing actor.'
    ));
  }

  return risks;
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_PLAN_NOT_READY,
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_PLAN_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
      .BLOCKED_BY_EXECUTION_PLAN;
  }

  if (risks.some(risk => [
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_NOT_READY,
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.EXECUTION_GATE_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
      .BLOCKED_BY_EXECUTION_GATE;
  }

  if (risks.some(risk => [
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.NO_PATHS_SELECTED,
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SELECTED_PATH_NOT_IN_MANIFEST,
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SELECTED_ENTRY_NOT_READY,
  ].includes(risk.riskId))) {
    return PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SELECTION;
  }

  if (risks.some(risk =>
    risk.riskId ===
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.REMOVAL_SCOPE_TOO_BROAD
  )) {
    return PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SCOPE;
  }

  if (risks.some(risk => [
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MISSING_REVIEW_REASON,
    PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.MISSING_REVIEWER,
  ].includes(risk.riskId))) {
    return PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_APPROVAL;
  }

  return PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.READY_FOR_REMOVAL_REVIEW;
}

function buildRemovalBatchEntries(entries = []) {
  return entries.map(entry => ({
    categoryId: entry.categoryId,
    actionId: entry.actionId,
    path: entry.path,
    deletionIntent: entry.deletionIntent,
    replacementEvidence: entry.replacementEvidence,
  }));
}

function buildPolicyBuilderPhase8ControlledCompatibilityPathRemoval({
  executionPlan = null,
  executionGate = null,
  selectedPaths = [],
  maxBatchSize = 3,
  removalReason = null,
  reviewedBy = null,
} = {}) {
  const planEvaluation = evaluateExecutionPlan(executionPlan);
  const gateEvaluation = evaluateExecutionGate(executionGate);
  const selected = buildSelectedEntries({
    manifestEntries: planEvaluation.plan.manifest?.entries,
    selectedPaths,
  });
  const boundedMaxBatchSize = Number.isFinite(Number(maxBatchSize))
    ? Math.max(1, Number(maxBatchSize))
    : 3;
  const risks = [
    ...planEvaluation.risks,
    ...gateEvaluation.risks,
    ...evaluateSelection({
      selectedEntries: selected.entries,
      selectedPaths: selected.normalizedPaths,
      missingPaths: selected.missingPaths,
      maxBatchSize: boundedMaxBatchSize,
    }),
    ...evaluateReviewMetadata({
      removalReason,
      reviewedBy,
    }),
  ];
  const removal = {
    version: PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_VERSION,
    statusId: determineStatusId(risks),
    readyForRemovalReview: risks.length === 0,
    executionPlan: {
      statusId: planEvaluation.plan.statusId || null,
      validationOk: planEvaluation.plan.validation?.ok === true,
      readyForExecutionGate: planEvaluation.plan.readyForExecutionGate === true,
      manifestEntryCount: planEvaluation.plan.manifest?.entryCount ?? null,
    },
    executionGate: {
      statusId: gateEvaluation.gate.statusId || null,
      validationOk: gateEvaluation.gate.validation?.ok === true,
      allowControlledDeletion: gateEvaluation.gate.allowControlledDeletion === true,
    },
    removalBatch: {
      selectedCount: selected.entries.length,
      requestedPathCount: selected.normalizedPaths.length,
      maxBatchSize: boundedMaxBatchSize,
      removalReason: removalReason || null,
      reviewedBy: reviewedBy || null,
      missingPaths: selected.missingPaths,
      entries: buildRemovalBatchEntries(selected.entries),
    },
    riskCount: risks.length,
    risks,
    executionPolicy: {
      executeDeletionNow: false,
      requireManualApplyStep: true,
      requireFreshGateForApply: true,
      requireSmallBatch: true,
      requireApprovedManifestPath: true,
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
    nextPhase: {
      phaseId: '8r_18',
      label: 'Controlled Compatibility Path Removal Apply',
      reason:
        'The selected removal batch can be reviewed separately before any file, route, test, or storage removal is applied.',
    },
  };

  return {
    ...removal,
    validation: validatePolicyBuilderPhase8ControlledCompatibilityPathRemoval(removal),
  };
}

function validatePolicyBuilderPhase8ControlledCompatibilityPathRemoval(removal = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS)
    .includes(removal.statusId)) {
    issues.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.UNKNOWN_STATUS,
      'Controlled compatibility path removal status must be known.'
    ));
  }

  if (removal.riskCount !== asArray(removal.risks).length) {
    issues.push(buildRisk(
      PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.RISK_COUNT_MISMATCH,
      'Controlled compatibility path removal risk count must match risk list length.'
    ));
  }

  Object.entries(removal.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Controlled compatibility path removal cannot perform side effect "${key}".`
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
  PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS,
  PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
  PHASE8R_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_VERSION,
  buildPolicyBuilderPhase8ControlledCompatibilityPathRemoval,
  validatePolicyBuilderPhase8ControlledCompatibilityPathRemoval,
};
