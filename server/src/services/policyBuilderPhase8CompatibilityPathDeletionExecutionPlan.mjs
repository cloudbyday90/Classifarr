import {
  PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS,
} from './policyBuilderPhase8LegacyCodeDeletionGates.mjs';
import {
  PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_STATUS_IDS,
  buildPolicyBuilderPhase8CompatibilityPathDeletionReadiness,
} from './policyBuilderPhase8CompatibilityPathDeletionReadiness.mjs';

const PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_PLAN_VERSION =
  'phase8r.compatibility_path_deletion_execution_plan.v1';

const PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_STATUS_IDS = Object.freeze({
  READY_FOR_EXECUTION_GATE: 'ready_for_execution_gate',
  BLOCKED_BY_READINESS: 'blocked_by_readiness',
  BLOCKED_BY_MANIFEST_EVIDENCE: 'blocked_by_manifest_evidence',
  BLOCKED_BY_APPROVAL: 'blocked_by_approval',
});

const PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS = Object.freeze({
  DELETE_FILE: 'delete_file',
  REPLACE_CODE_PATH: 'replace_code_path',
  REMOVE_TEST: 'remove_test',
});

const PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS = Object.freeze({
  READINESS_NOT_READY: 'readiness_not_ready',
  READINESS_VALIDATION_FAILED: 'readiness_validation_failed',
  MISSING_DELETION_CATEGORY: 'missing_deletion_category',
  MISSING_MANIFEST_ENTRY_PATH: 'missing_manifest_entry_path',
  MISSING_REPLACEMENT_EVIDENCE: 'missing_replacement_evidence',
  MISSING_ROLLBACK_STANCE: 'missing_rollback_stance',
  MISSING_SUPPORT_STANCE: 'missing_support_stance',
  MANIFEST_NOT_APPROVED: 'manifest_not_approved',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
});

const CATEGORY_ACTION_IDS = Object.freeze({
  [PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.CLIENT_BRIDGE_UI]:
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS.DELETE_FILE,
  [PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.LEGACY_SERIALIZER_DESERIALIZER]:
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS.REPLACE_CODE_PATH,
  [PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.CUSTOM_SIGNAL_MUTATION_HELPERS]:
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS.REPLACE_CODE_PATH,
  [PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.PRESET_AS_POLICY_RUNTIME]:
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS.REPLACE_CODE_PATH,
  [PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.OLD_PREVIEW_REPLAY_DIAGNOSTICS]:
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS.DELETE_FILE,
  [PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.STALE_COMPATIBILITY_TESTS]:
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS.REMOVE_TEST,
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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

function getEvidenceForPath({ path, categoryId, replacementEvidence = {} }) {
  const evidence = asObject(replacementEvidence);
  return evidence[path] || evidence[normalizePath(path)] || evidence[categoryId] || null;
}

function buildManifestEntries({ deletionGatePlan = {}, replacementEvidence = {} } = {}) {
  const gatePlan = asObject(deletionGatePlan);
  return asArray(gatePlan.categories)
    .flatMap(category => asArray(category.paths).map(path => {
      const normalizedPath = normalizePath(path);
      const evidence = getEvidenceForPath({
        path: normalizedPath,
        categoryId: category.categoryId,
        replacementEvidence,
      });

      return {
        categoryId: category.categoryId || null,
        actionId:
          CATEGORY_ACTION_IDS[category.categoryId] ||
          PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS.REPLACE_CODE_PATH,
        path: normalizedPath,
        deletionIntent: category.deletionIntent || null,
        replacementEvidence: evidence,
        ready: Boolean(normalizedPath) && Boolean(evidence),
      };
    }));
}

function evaluateReadiness(deletionReadiness) {
  const readiness = deletionReadiness || buildPolicyBuilderPhase8CompatibilityPathDeletionReadiness();
  const risks = [];

  if (
    readiness.statusId !==
    PHASE8R_COMPATIBILITY_PATH_DELETION_READINESS_STATUS_IDS.READY_FOR_DELETION_EXECUTION_PLAN ||
    readiness.readyForDeletionExecutionPlan !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.READINESS_NOT_READY,
      'Compatibility path deletion execution planning requires a ready Phase 8R.14 readiness report.',
      { statusId: readiness.statusId || null }
    ));
  }

  if (readiness.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.READINESS_VALIDATION_FAILED,
      'Compatibility path deletion readiness must validate before an execution plan can be approved.',
      { issueCount: readiness.validation?.issueCount ?? null }
    ));
  }

  return {
    readiness,
    risks,
  };
}

function evaluateManifestEntries(entries = []) {
  const risks = [];

  if (entries.length === 0) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.MISSING_DELETION_CATEGORY,
      'Compatibility path deletion execution planning requires at least one manifest entry.'
    ));
  }

  entries.forEach(entry => {
    if (!entry.path) {
      risks.push(buildRisk(
        PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.MISSING_MANIFEST_ENTRY_PATH,
        'Each compatibility deletion manifest entry requires an exact file or code path.',
        { categoryId: entry.categoryId }
      ));
    }

    if (!entry.replacementEvidence) {
      risks.push(buildRisk(
        PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.MISSING_REPLACEMENT_EVIDENCE,
        'Each compatibility deletion manifest entry requires replacement evidence before deletion can be planned.',
        {
          categoryId: entry.categoryId,
          path: entry.path,
        }
      ));
    }
  });

  return risks;
}

function evaluateApproval({
  rollbackStance,
  supportStance,
  manifestApproved,
} = {}) {
  const risks = [];

  if (!rollbackStance) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.MISSING_ROLLBACK_STANCE,
      'Compatibility path deletion execution planning requires a rollback or post-window recovery stance.'
    ));
  }

  if (!supportStance) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.MISSING_SUPPORT_STANCE,
      'Compatibility path deletion execution planning requires a support stance for converted native policies.'
    ));
  }

  if (manifestApproved !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.MANIFEST_NOT_APPROVED,
      'Compatibility path deletion execution planning requires explicit manifest approval.'
    ));
  }

  return risks;
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.READINESS_NOT_READY,
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.READINESS_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_STATUS_IDS.BLOCKED_BY_READINESS;
  }

  if (risks.some(risk => [
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.MISSING_DELETION_CATEGORY,
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.MISSING_MANIFEST_ENTRY_PATH,
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.MISSING_REPLACEMENT_EVIDENCE,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_STATUS_IDS
      .BLOCKED_BY_MANIFEST_EVIDENCE;
  }

  if (risks.some(risk => [
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.MISSING_ROLLBACK_STANCE,
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.MISSING_SUPPORT_STANCE,
    PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.MANIFEST_NOT_APPROVED,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_STATUS_IDS.BLOCKED_BY_APPROVAL;
  }

  return PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE;
}

function buildPolicyBuilderPhase8CompatibilityPathDeletionExecutionPlan({
  deletionReadiness = null,
  deletionGatePlan = null,
  replacementEvidence = {},
  rollbackStance = null,
  supportStance = null,
  manifestApproved = false,
  approvedBy = null,
} = {}) {
  const readiness = evaluateReadiness(deletionReadiness);
  const manifestEntries = buildManifestEntries({
    deletionGatePlan,
    replacementEvidence,
  });
  const risks = [
    ...readiness.risks,
    ...evaluateManifestEntries(manifestEntries),
    ...evaluateApproval({
      rollbackStance,
      supportStance,
      manifestApproved,
    }),
  ];
  const plan = {
    version: PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_PLAN_VERSION,
    statusId: determineStatusId(risks),
    readyForExecutionGate: risks.length === 0,
    readiness: {
      statusId: readiness.readiness.statusId || null,
      validationOk: readiness.readiness.validation?.ok === true,
      readyForDeletionExecutionPlan:
        readiness.readiness.readyForDeletionExecutionPlan === true,
    },
    manifest: {
      approved: manifestApproved === true,
      approvedBy,
      rollbackStance,
      supportStance,
      entryCount: manifestEntries.length,
      entries: manifestEntries,
    },
    riskCount: risks.length,
    risks,
    executionPolicy: {
      executeDeletionNow: false,
      requireSeparateExecutionGate: true,
      requireCleanWorktreeBeforeExecution: true,
      requireBackupRestoreEvidence: true,
      requireRollbackOrPostWindowSupport: true,
    },
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      manifestWritten: false,
    },
    nextPhase: {
      phaseId: '8r_16',
      label: 'Compatibility Path Deletion Execution Gate',
      reason:
        'The execution plan can now be reviewed; the next gate should verify worktree, backup, and operator approval immediately before deletion.',
    },
  };

  return {
    ...plan,
    validation: validatePolicyBuilderPhase8CompatibilityPathDeletionExecutionPlan(plan),
  };
}

function validatePolicyBuilderPhase8CompatibilityPathDeletionExecutionPlan(plan = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_STATUS_IDS)
    .includes(plan.statusId)) {
    issues.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility path deletion execution plan status must be known.'
    ));
  }

  if (plan.riskCount !== asArray(plan.risks).length) {
    issues.push(buildRisk(
      PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.RISK_COUNT_MISMATCH,
      'Compatibility path deletion execution plan risk count must match risk list length.'
    ));
  }

  Object.entries(plan.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Compatibility path deletion execution plan cannot perform side effect "${key}".`
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
  PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS,
  PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_PLAN_VERSION,
  PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_RISK_IDS,
  PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_STATUS_IDS,
  buildPolicyBuilderPhase8CompatibilityPathDeletionExecutionPlan,
  validatePolicyBuilderPhase8CompatibilityPathDeletionExecutionPlan,
};
