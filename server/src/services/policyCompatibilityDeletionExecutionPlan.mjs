import {
  POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS,
  buildPolicyCompatibilityDeletionReadiness,
} from './policyCompatibilityDeletionReadiness.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION,
} from './policyCompatibilityDeletionCurrentInventory.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from './policyCompatibilityDeletionExecutionActions.mjs';
import {
  getPolicyCompatibilityDeletionCategoryActionId,
} from './policyCompatibilityDeletionCategoryAction.mjs';
import {
  normalizePolicyCompatibilityDeletionExecutionManifestEntry,
  validatePolicyCompatibilityDeletionExecutionManifestEntry,
} from './policyCompatibilityDeletionExecutionManifestEntry.mjs';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION =
  'policy.compatibility_deletion_execution_plan.v2';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS = Object.freeze({
  READY_FOR_EXECUTION_GATE: 'ready_for_execution_gate',
  BLOCKED_BY_READINESS: 'blocked_by_readiness',
  BLOCKED_BY_MANIFEST_EVIDENCE: 'blocked_by_manifest_evidence',
  BLOCKED_BY_APPROVAL: 'blocked_by_approval',
});

const POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS = Object.freeze({
  READINESS_NOT_READY: 'readiness_not_ready',
  READINESS_VALIDATION_FAILED: 'readiness_validation_failed',
  CURRENT_POLICY_INVENTORY_NOT_READY: 'current_policy_inventory_not_ready',
  MISSING_DELETION_CATEGORY: 'missing_deletion_category',
  MISSING_MANIFEST_ENTRY_PATH: 'missing_manifest_entry_path',
  MISSING_REPLACEMENT_EVIDENCE: 'missing_replacement_evidence',
  INVALID_NAMED_TEST_SCOPE: 'invalid_named_test_scope',
  MISSING_ROLLBACK_STANCE: 'missing_rollback_stance',
  MISSING_SUPPORT_STANCE: 'missing_support_stance',
  MANIFEST_NOT_APPROVED: 'manifest_not_approved',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
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

function buildNamedTestScopeManifestEntries({
  namedTestScopeEntries = [],
  replacementEvidence = {},
} = {}) {
  return asArray(namedTestScopeEntries).map(entry => {
    const normalizedEntry = normalizePolicyCompatibilityDeletionExecutionManifestEntry(entry);
    const entryValidation = validatePolicyCompatibilityDeletionExecutionManifestEntry(
      normalizedEntry,
    );
    const evidence = normalizedEntry.replacementEvidence || getEvidenceForPath({
      path: normalizedEntry.path,
      categoryId: normalizedEntry.categoryId,
      replacementEvidence,
    });

    return {
      ...normalizedEntry,
      replacementEvidence: evidence,
      ready: entryValidation.ok && Boolean(evidence),
    };
  });
}

function buildManifestEntries({
  deletionGatePlan = {},
  replacementEvidence = {},
  namedTestScopeEntries = [],
} = {}) {
  const gatePlan = asObject(deletionGatePlan);
  const fileEntries = asArray(gatePlan.categories)
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
          getPolicyCompatibilityDeletionCategoryActionId(category.categoryId) ||
          POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REPLACE_CODE_PATH,
        path: normalizedPath,
        deletionIntent: category.deletionIntent || null,
        replacementEvidence: evidence,
        ready: Boolean(normalizedPath) && Boolean(evidence),
      };
    }));

  return [
    ...fileEntries,
    ...buildNamedTestScopeManifestEntries({
      namedTestScopeEntries,
      replacementEvidence,
    }),
  ];
}

function evaluateReadiness(deletionReadiness) {
  const readiness = deletionReadiness || buildPolicyCompatibilityDeletionReadiness();
  const risks = [];

  if (
    readiness.statusId !==
    POLICY_COMPATIBILITY_DELETION_READINESS_STATUS_IDS.READY_FOR_DELETION_EXECUTION_PLAN ||
    readiness.readyForDeletionExecutionPlan !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.READINESS_NOT_READY,
      'Compatibility path deletion execution planning requires a ready compatibility deletion readiness report.',
      { statusId: readiness.statusId || null }
    ));
  }

  if (readiness.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.READINESS_VALIDATION_FAILED,
      'Compatibility path deletion readiness must validate before an execution plan can be approved.',
      { issueCount: readiness.validation?.issueCount ?? null }
    ));
  }

  const inventory = readiness.currentPolicyInventory;
  if (
    !inventory ||
    inventory.version !== POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION ||
    inventory.statusId !==
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS.ALL_ENABLED_POLICIES_NATIVE ||
    inventory.allEnabledPoliciesNative !== true ||
    inventory.validationOk !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.CURRENT_POLICY_INVENTORY_NOT_READY,
      'Compatibility deletion execution planning requires current validated evidence that every enabled policy has one active native intent.',
      {
        inventoryStatusId: inventory?.statusId || null,
        unconvertedPolicyCount: inventory?.unconvertedPolicyCount ?? null,
      }
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
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_DELETION_CATEGORY,
      'Compatibility path deletion execution planning requires at least one manifest entry.'
    ));
  }

  entries.forEach(entry => {
    const entryValidation = validatePolicyCompatibilityDeletionExecutionManifestEntry(entry);

    if (!entryValidation.ok) {
      entryValidation.issues.forEach(issue => {
        risks.push(buildRisk(
          POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.INVALID_NAMED_TEST_SCOPE,
          'Named test-scope manifest entries must be exact and must prohibit whole-file deletion.',
          {
            categoryId: entry.categoryId,
            path: entry.path,
            entryRiskId: issue.riskId,
          }
        ));
      });
    }

    if (!entry.path) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_MANIFEST_ENTRY_PATH,
        'Each compatibility deletion manifest entry requires an exact file or code path.',
        { categoryId: entry.categoryId }
      ));
    }

    if (!entry.replacementEvidence) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_REPLACEMENT_EVIDENCE,
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
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_ROLLBACK_STANCE,
      'Compatibility path deletion execution planning requires a rollback or post-window recovery stance.'
    ));
  }

  if (!supportStance) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_SUPPORT_STANCE,
      'Compatibility path deletion execution planning requires a support stance for converted native policies.'
    ));
  }

  if (manifestApproved !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MANIFEST_NOT_APPROVED,
      'Compatibility path deletion execution planning requires explicit manifest approval.'
    ));
  }

  return risks;
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.READINESS_NOT_READY,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.READINESS_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.BLOCKED_BY_READINESS;
  }

  if (risks.some(risk => [
    POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_DELETION_CATEGORY,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_MANIFEST_ENTRY_PATH,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_REPLACEMENT_EVIDENCE,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.INVALID_NAMED_TEST_SCOPE,
  ].includes(risk.riskId))) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS
      .BLOCKED_BY_MANIFEST_EVIDENCE;
  }

  if (risks.some(risk => [
    POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_ROLLBACK_STANCE,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MISSING_SUPPORT_STANCE,
    POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.MANIFEST_NOT_APPROVED,
  ].includes(risk.riskId))) {
    return POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.BLOCKED_BY_APPROVAL;
  }

  return POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE;
}

function buildPolicyCompatibilityDeletionExecutionPlan({
  deletionReadiness = null,
  deletionGatePlan = null,
  replacementEvidence = {},
  namedTestScopeEntries = [],
  rollbackStance = null,
  supportStance = null,
  manifestApproved = false,
  approvedBy = null,
} = {}) {
  const readiness = evaluateReadiness(deletionReadiness);
  const manifestEntries = buildManifestEntries({
    deletionGatePlan,
    replacementEvidence,
    namedTestScopeEntries,
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
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
    statusId: determineStatusId(risks),
    readyForExecutionGate: risks.length === 0,
    readiness: {
      statusId: readiness.readiness.statusId || null,
      validationOk: readiness.readiness.validation?.ok === true,
      readyForDeletionExecutionPlan:
        readiness.readiness.readyForDeletionExecutionPlan === true,
      currentPolicyInventory: readiness.readiness.currentPolicyInventory
        ? {
          statusId: readiness.readiness.currentPolicyInventory.statusId || null,
          validationOk: readiness.readiness.currentPolicyInventory.validationOk === true,
          unconvertedPolicyCount:
            readiness.readiness.currentPolicyInventory.unconvertedPolicyCount ?? null,
        }
        : null,
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
    nextStep: {
      stepId: 'compatibility_deletion_execution_gate',
      label: 'Compatibility Path Deletion Execution Gate',
      reason:
        'The execution plan can now be reviewed; the next gate should verify worktree, backup, and operator approval immediately before deletion.',
    },
  };

  return {
    ...plan,
    validation: validatePolicyCompatibilityDeletionExecutionPlan(plan),
  };
}

function validatePolicyCompatibilityDeletionExecutionPlan(plan = {}) {
  const issues = [];

  if (!Object.values(POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS)
    .includes(plan.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility path deletion execution plan status must be known.'
    ));
  }

  if (plan.riskCount !== asArray(plan.risks).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.RISK_COUNT_MISMATCH,
      'Compatibility path deletion execution plan risk count must match risk list length.'
    ));
  }

  asArray(plan.manifest?.entries).forEach(entry => {
    const entryValidation = validatePolicyCompatibilityDeletionExecutionManifestEntry(entry);

    if (!entryValidation.ok) {
      entryValidation.issues.forEach(issue => {
        issues.push(buildRisk(
          POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.INVALID_NAMED_TEST_SCOPE,
          'Compatibility deletion execution plans must retain exact, non-file-deleting named test scopes.',
          {
            path: entry.path || null,
            entryRiskId: issue.riskId,
          }
        ));
      });
    }
  });

  Object.entries(plan.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.SIDE_EFFECT_PERFORMED,
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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionPlan,
  validatePolicyCompatibilityDeletionExecutionPlan,
};
