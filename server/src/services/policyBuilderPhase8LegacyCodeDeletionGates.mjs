import {
  listLegacyCompatibilityDeletionGates,
  listLegacyCompatibilityModuleRecords,
} from './policyBuilderLegacyCompatibilityBoundary.mjs';

const PHASE8R_LEGACY_CODE_DELETION_GATES_VERSION = 'phase8r.legacy_code_deletion_gates.v1';

const PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS = Object.freeze({
  CLIENT_BRIDGE_UI: 'client_bridge_ui',
  LEGACY_SERIALIZER_DESERIALIZER: 'legacy_serializer_deserializer',
  CUSTOM_SIGNAL_MUTATION_HELPERS: 'custom_signal_mutation_helpers',
  PRESET_AS_POLICY_RUNTIME: 'preset_as_policy_runtime',
  OLD_PREVIEW_REPLAY_DIAGNOSTICS: 'old_preview_replay_diagnostics',
  STALE_COMPATIBILITY_TESTS: 'stale_compatibility_tests',
});

const PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS = Object.freeze({
  NATIVE_READ_WRITE_TESTS: 'native_read_write_tests',
  RUNTIME_NATIVE_DECISION_TESTS: 'runtime_native_decision_tests',
  CONVERSION_REVERSION_TESTS: 'conversion_reversion_tests',
  BACKUP_RESTORE_TESTS: 'backup_restore_tests',
  POST_UPGRADE_DRY_RUN_APPLY_TESTS: 'post_upgrade_dry_run_apply_tests',
  DELETION_GATE_TESTS: 'deletion_gate_tests',
});

const PHASE8R_LEGACY_CODE_DELETION_SUPPORT_STANCE_IDS = Object.freeze({
  BLOCK_DELETION: 'block_deletion',
  COMPATIBILITY_UNTIL_CONVERTED: 'compatibility_until_converted',
  SUPPORTED_TIME_BOUND: 'supported_time_bound',
  UNSUPPORTED_AFTER_WINDOW: 'unsupported_after_window',
});

const PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS = Object.freeze({
  BLOCKED_BY_UNCONVERTED_POLICIES: 'blocked_by_unconverted_policies',
  BLOCKED_BY_SUPPORT_STANCE: 'blocked_by_support_stance',
  BLOCKED_BY_MISSING_COVERAGE: 'blocked_by_missing_coverage',
  READY_TO_DELETE: 'ready_to_delete',
});

const PHASE8R_LEGACY_CODE_DELETION_RISK_IDS = Object.freeze({
  MISSING_DELETION_CATEGORY: 'missing_deletion_category',
  MISSING_COVERAGE_REQUIREMENT: 'missing_coverage_requirement',
  MISSING_COMPATIBILITY_INVENTORY: 'missing_compatibility_inventory',
  DELETE_WITH_UNCONVERTED_POLICIES: 'delete_with_unconverted_policies',
  DELETE_WITHOUT_SUPPORT_STANCE: 'delete_without_support_stance',
  DELETE_WITHOUT_COVERAGE: 'delete_without_coverage',
  PRESERVE_REPLACED_CODE_PERMANENTLY: 'preserve_replaced_code_permanently',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  MISSING_REASON: 'missing_reason',
});

const PHASE8R_LEGACY_CODE_DELETION_REASON_IDS = Object.freeze({
  COMPATIBILITY_INVENTORY_CONSUMED: 'compatibility_inventory_consumed',
  DELETION_CATEGORIES_DEFINED: 'deletion_categories_defined',
  COVERAGE_REQUIREMENTS_DEFINED: 'coverage_requirements_defined',
  UNCONVERTED_POLICIES_TRACKED: 'unconverted_policies_tracked',
  SUPPORT_STANCE_REQUIRED: 'support_stance_required',
  DELETION_BLOCKED_UNTIL_GATES_PASS: 'deletion_blocked_until_gates_pass',
  DELETE_REPLACED_CODE_NOT_HIDE: 'delete_replaced_code_not_hide',
  SIDE_EFFECTS_DISABLED: 'side_effects_disabled',
});

const DELETION_CATEGORY_DEFINITIONS = Object.freeze([
  {
    categoryId: PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.CLIENT_BRIDGE_UI,
    label: 'Client bridge-only UI surfaces',
    paths: [
      'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
      'client/src/components/policies/PolicyStarterTemplateDetails.vue',
      'client/src/components/policies/PolicyCombinedSignalsSummary.vue',
    ],
    deletionIntent:
      'Delete or replace UI that only explains starter-template compatibility.',
  },
  {
    categoryId: PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.LEGACY_SERIALIZER_DESERIALIZER,
    label: 'Legacy serializer/deserializer paths',
    paths: [
      'client/src/utils/policyIntentDraftBridge.js',
      'client/src/composables/usePolicyIntentDraft.js',
      'client/src/composables/usePolicyBuilderState.js',
      'server/src/services/policyIntentRequestValidator.mjs',
    ],
    deletionIntent:
      'Delete draft-to-legacy serialization once native intent is authoritative.',
  },
  {
    categoryId: PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.CUSTOM_SIGNAL_MUTATION_HELPERS,
    label: 'Custom-signal mutation helpers',
    paths: [
      'server/src/services/autoLearningPreferenceWriters.mjs',
      'server/src/services/autoLearningQueries.mjs',
      'server/src/routes/policiesRoutePolicyPresets.mjs',
      'server/src/routes/policiesRoutePolicyWrite.mjs',
    ],
    deletionIntent:
      'Delete code that mutates custom signals as policy behavior authority.',
  },
  {
    categoryId: PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.PRESET_AS_POLICY_RUNTIME,
    label: 'Preset-as-policy runtime behavior',
    paths: [
      'server/src/routes/policiesRoutePolicyRead.mjs',
      'server/src/routes/policiesRouteHelpers.mjs',
      'server/src/services/policyIntentMapper.mjs',
      'server/src/services/policyConfigurationView.mjs',
    ],
    deletionIntent:
      'Delete behavior that treats preset attachments as the durable policy model.',
  },
  {
    categoryId: PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.OLD_PREVIEW_REPLAY_DIAGNOSTICS,
    label: 'Old preview/replay diagnostic UI',
    paths: [
      'server/src/services/policyIntentImpactPreview.mjs',
      'server/src/services/policyIntentReplayPreview.mjs',
      'server/src/services/policyIntentReplayScoring.mjs',
      'server/src/services/policyIntentReplaySampleDiagnostics.mjs',
    ],
    deletionIntent:
      'Delete or move replay/impact diagnostics after native migration verifiers exist.',
  },
  {
    categoryId: PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.STALE_COMPATIBILITY_TESTS,
    label: 'Stale compatibility tests',
    paths: [
      'client/src/__tests__/PolicyBuilderModal.test.js',
      'client/src/__tests__/composables/usePolicyIntentDraft.test.js',
      'server/src/__tests__/services/policyIntentRequestValidator.test.mjs',
    ],
    deletionIntent:
      'Remove tests that only preserve abandoned legacy behavior after replacements pass.',
  },
]);

const COVERAGE_REQUIREMENTS = Object.freeze([
  {
    coverageId: PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS.NATIVE_READ_WRITE_TESTS,
    label: 'Native read/write tests',
  },
  {
    coverageId: PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS.RUNTIME_NATIVE_DECISION_TESTS,
    label: 'Runtime native decision tests',
  },
  {
    coverageId: PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS.CONVERSION_REVERSION_TESTS,
    label: 'Conversion/reversion tests',
  },
  {
    coverageId: PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS.BACKUP_RESTORE_TESTS,
    label: 'Backup/restore tests',
  },
  {
    coverageId: PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS.POST_UPGRADE_DRY_RUN_APPLY_TESTS,
    label: 'Post-upgrade dry-run/apply tests',
  },
  {
    coverageId: PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS.DELETION_GATE_TESTS,
    label: 'Deletion-gate tests',
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').toLowerCase();
}

function isExplicitSupportStance(supportStanceId) {
  return [
    PHASE8R_LEGACY_CODE_DELETION_SUPPORT_STANCE_IDS.COMPATIBILITY_UNTIL_CONVERTED,
    PHASE8R_LEGACY_CODE_DELETION_SUPPORT_STANCE_IDS.SUPPORTED_TIME_BOUND,
    PHASE8R_LEGACY_CODE_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
  ].includes(supportStanceId);
}

function normalizeUnconvertedPolicyCount(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.trunc(numeric));
}

function buildDeletionCategories(moduleRecords = listLegacyCompatibilityModuleRecords()) {
  const knownPaths = new Set(asArray(moduleRecords).map(record => normalizePath(record.path)));

  return DELETION_CATEGORY_DEFINITIONS.map(category => ({
    ...category,
    inventoryMatchedPathCount: category.paths
      .filter(path => knownPaths.has(normalizePath(path)))
      .length,
    deleteAfterGatesPass: true,
    preservePermanently: false,
  }));
}

function normalizeCoverageRequirements(coverage = {}) {
  return COVERAGE_REQUIREMENTS.map(requirement => ({
    ...requirement,
    required: true,
    provided: coverage[requirement.coverageId] === true,
    evidence: coverage[`${requirement.coverageId}_evidence`] || null,
  }));
}

function getMissingCoverageIds(coverageRequirements = []) {
  return asArray(coverageRequirements)
    .filter(requirement => requirement.required === true && requirement.provided !== true)
    .map(requirement => requirement.coverageId);
}

function buildReason(reasonId, message) {
  return { reasonId, message };
}

function determineDeletionStatus({
  unconvertedPolicyCount,
  supportStanceId,
  missingCoverageIds,
}) {
  if (unconvertedPolicyCount === null || unconvertedPolicyCount > 0) {
    return PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS.BLOCKED_BY_UNCONVERTED_POLICIES;
  }

  if (!isExplicitSupportStance(supportStanceId)) {
    return PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS.BLOCKED_BY_SUPPORT_STANCE;
  }

  if (missingCoverageIds.length > 0) {
    return PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS.BLOCKED_BY_MISSING_COVERAGE;
  }

  return PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS.READY_TO_DELETE;
}

function buildBlockers({ unconvertedPolicyCount, supportStanceId, missingCoverageIds }) {
  const blockers = [];

  if (unconvertedPolicyCount === null) {
    blockers.push({
      blockerId: 'unconverted_policy_count_unknown',
      message: 'Deletion requires a measured count of remaining unconverted policies.',
    });
  } else if (unconvertedPolicyCount > 0) {
    blockers.push({
      blockerId: 'unconverted_policies_remaining',
      count: unconvertedPolicyCount,
      message: 'Deletion is blocked while unconverted policies remain.',
    });
  }

  if (!isExplicitSupportStance(supportStanceId)) {
    blockers.push({
      blockerId: 'support_stance_not_explicit',
      supportStanceId,
      message: 'Deletion requires an explicit support stance for remaining compatibility.',
    });
  }

  missingCoverageIds.forEach(coverageId => {
    blockers.push({
      blockerId: 'missing_coverage',
      coverageId,
      message: `Deletion requires passing coverage for ${coverageId}.`,
    });
  });

  return blockers;
}

function buildPolicyBuilderPhase8LegacyCodeDeletionGates({
  compatibilityModules = listLegacyCompatibilityModuleRecords(),
  compatibilityDeletionGates = listLegacyCompatibilityDeletionGates(),
  coverage = {},
  unconvertedPolicyCount = null,
  supportStanceId = PHASE8R_LEGACY_CODE_DELETION_SUPPORT_STANCE_IDS.BLOCK_DELETION,
} = {}) {
  const normalizedUnconvertedPolicyCount =
    normalizeUnconvertedPolicyCount(unconvertedPolicyCount);
  const categories = buildDeletionCategories(compatibilityModules);
  const coverageRequirements = normalizeCoverageRequirements(coverage);
  const missingCoverageIds = getMissingCoverageIds(coverageRequirements);
  const statusId = determineDeletionStatus({
    unconvertedPolicyCount: normalizedUnconvertedPolicyCount,
    supportStanceId,
    missingCoverageIds,
  });
  const readyToDelete =
    statusId === PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS.READY_TO_DELETE;

  const plan = {
    version: PHASE8R_LEGACY_CODE_DELETION_GATES_VERSION,
    statusId,
    readyToDelete,
    supportStanceId,
    unconvertedPolicyCount: normalizedUnconvertedPolicyCount,
    categories,
    coverageRequirements,
    compatibilityDeletionGates: asArray(compatibilityDeletionGates),
    blockers: buildBlockers({
      unconvertedPolicyCount: normalizedUnconvertedPolicyCount,
      supportStanceId,
      missingCoverageIds,
    }),
    deletionPolicy: {
      deleteReplacedCode: readyToDelete,
      hideOrArchiveReplacedCode: false,
      allowPermanentDualModel: false,
      requireExplicitSupportStance: true,
      requireZeroUnconvertedPolicies: true,
    },
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
    },
    reasons: [
      buildReason(
        PHASE8R_LEGACY_CODE_DELETION_REASON_IDS.COMPATIBILITY_INVENTORY_CONSUMED,
        'The deletion plan consumes the declared compatibility inventory.'
      ),
      buildReason(
        PHASE8R_LEGACY_CODE_DELETION_REASON_IDS.DELETION_CATEGORIES_DEFINED,
        'Every required deletion category is represented explicitly.'
      ),
      buildReason(
        PHASE8R_LEGACY_CODE_DELETION_REASON_IDS.COVERAGE_REQUIREMENTS_DEFINED,
        'Replacement coverage is required before deletion.'
      ),
      buildReason(
        PHASE8R_LEGACY_CODE_DELETION_REASON_IDS.UNCONVERTED_POLICIES_TRACKED,
        'Deletion readiness tracks remaining unconverted policies.'
      ),
      buildReason(
        PHASE8R_LEGACY_CODE_DELETION_REASON_IDS.SUPPORT_STANCE_REQUIRED,
        'Remaining compatibility requires an explicit support stance.'
      ),
      buildReason(
        PHASE8R_LEGACY_CODE_DELETION_REASON_IDS.DELETION_BLOCKED_UNTIL_GATES_PASS,
        'Deletion is blocked until required gates and coverage pass.'
      ),
      buildReason(
        PHASE8R_LEGACY_CODE_DELETION_REASON_IDS.DELETE_REPLACED_CODE_NOT_HIDE,
        'Replaced compatibility code is deleted after gates, not hidden.'
      ),
      buildReason(
        PHASE8R_LEGACY_CODE_DELETION_REASON_IDS.SIDE_EFFECTS_DISABLED,
        'This contract plans deletion gates but performs no deletion.'
      ),
    ],
    nextPhase: {
      phaseId: '8r_8',
      label: 'Backup, Restore, And Post-Upgrade Safety',
      reason:
        'Deletion gates now require backup, restore, and post-upgrade proof before legacy code can be removed.',
    },
  };

  return {
    ...plan,
    validation: validatePolicyBuilderPhase8LegacyCodeDeletionGates(plan),
  };
}

function validatePolicyBuilderPhase8LegacyCodeDeletionGates(plan = {}) {
  const issues = [];
  const categories = asArray(plan.categories);
  const coverageRequirements = asArray(plan.coverageRequirements);
  const categoryIds = categories.map(category => category.categoryId);
  const coverageIds = coverageRequirements.map(requirement => requirement.coverageId);
  const missingCoverageIds = getMissingCoverageIds(coverageRequirements);
  const compatibilityDeletionGates = asArray(plan.compatibilityDeletionGates);
  const deletionPolicy = plan.deletionPolicy || {};
  const sideEffects = plan.sideEffects || {};

  Object.values(PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS).forEach(categoryId => {
    if (!categoryIds.includes(categoryId)) {
      issues.push({
        riskId: PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.MISSING_DELETION_CATEGORY,
        categoryId,
        message: 'Every required legacy deletion category must be defined.',
      });
    }
  });

  Object.values(PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS).forEach(coverageId => {
    if (!coverageIds.includes(coverageId)) {
      issues.push({
        riskId: PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.MISSING_COVERAGE_REQUIREMENT,
        coverageId,
        message: 'Every required replacement coverage gate must be defined.',
      });
    }
  });

  if (compatibilityDeletionGates.length === 0) {
    issues.push({
      riskId: PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.MISSING_COMPATIBILITY_INVENTORY,
      message: 'Deletion gates must consume the compatibility boundary inventory.',
    });
  }

  if (plan.readyToDelete === true && Number(plan.unconvertedPolicyCount) > 0) {
    issues.push({
      riskId: PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.DELETE_WITH_UNCONVERTED_POLICIES,
      message: 'Compatibility code cannot be deleted while unconverted policies remain.',
    });
  }

  if (plan.readyToDelete === true && !isExplicitSupportStance(plan.supportStanceId)) {
    issues.push({
      riskId: PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.DELETE_WITHOUT_SUPPORT_STANCE,
      message: 'Compatibility code cannot be deleted without an explicit support stance.',
    });
  }

  if (plan.readyToDelete === true && missingCoverageIds.length > 0) {
    issues.push({
      riskId: PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.DELETE_WITHOUT_COVERAGE,
      missingCoverageIds,
      message: 'Compatibility code cannot be deleted until coverage gates pass.',
    });
  }

  if (
    deletionPolicy.hideOrArchiveReplacedCode === true ||
    deletionPolicy.allowPermanentDualModel === true ||
    categories.some(category => category.preservePermanently === true)
  ) {
    issues.push({
      riskId: PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.PRESERVE_REPLACED_CODE_PERMANENTLY,
      message: 'Replaced compatibility code must not remain as a permanent model.',
    });
  }

  if (Object.values(sideEffects).some(value => value === true)) {
    issues.push({
      riskId: PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.SIDE_EFFECT_PERFORMED,
      message: 'Phase 8R.7 deletion gates must not delete files or mutate storage.',
    });
  }

  if (asArray(plan.reasons).length === 0) {
    issues.push({
      riskId: PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.MISSING_REASON,
      message: 'Deletion-gate output must include bounded reasons.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyBuilderPhase8LegacyCodeDeletionGatesAudit(
  plan = buildPolicyBuilderPhase8LegacyCodeDeletionGates()
) {
  const validation = plan.validation ||
    validatePolicyBuilderPhase8LegacyCodeDeletionGates(plan);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: plan.statusId || null,
    readyToDelete: plan.readyToDelete === true,
    supportStanceId: plan.supportStanceId || null,
    unconvertedPolicyCount: plan.unconvertedPolicyCount ?? null,
    categoryCount: asArray(plan.categories).length,
    coverageRequirementCount: asArray(plan.coverageRequirements).length,
    missingCoverageIds: getMissingCoverageIds(plan.coverageRequirements),
    blockerCount: asArray(plan.blockers).length,
    issueIds: asArray(validation.issues).map(issue => issue.riskId),
    nextPhase: plan.nextPhase || null,
  };
}

export {
  PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS,
  PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS,
  PHASE8R_LEGACY_CODE_DELETION_GATES_VERSION,
  PHASE8R_LEGACY_CODE_DELETION_REASON_IDS,
  PHASE8R_LEGACY_CODE_DELETION_RISK_IDS,
  PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS,
  PHASE8R_LEGACY_CODE_DELETION_SUPPORT_STANCE_IDS,
  buildPolicyBuilderPhase8LegacyCodeDeletionGates,
  buildPolicyBuilderPhase8LegacyCodeDeletionGatesAudit,
  validatePolicyBuilderPhase8LegacyCodeDeletionGates,
};
