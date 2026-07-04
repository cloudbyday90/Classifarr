const POLICY_NATIVE_STORAGE_TEST_RESET_VERSION = 'policy.native_storage_test_reset.v1';

const POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS = Object.freeze({
  NATIVE_SCHEMA_SQL_MIGRATION_TESTS: 'native_schema_sql_migration_tests',
  NATIVE_SCHEMA_CONTRACT_TESTS: 'native_schema_contract_tests',
  DRY_RUN_CANDIDATE_REPORT_TESTS: 'dry_run_candidate_report_tests',
  EXPLICIT_CONVERSION_TESTS: 'explicit_conversion_tests',
  NATIVE_RUNTIME_READ_PATH_TESTS: 'native_runtime_read_path_tests',
  ROLLBACK_REVERSION_TESTS: 'rollback_reversion_tests',
  LEGACY_WRITE_BLOCKING_TESTS: 'legacy_write_blocking_tests',
  BACKUP_RESTORE_COVERAGE_TESTS: 'backup_restore_coverage_tests',
  DELETION_GATE_TESTS: 'deletion_gate_tests',
});

const POLICY_NATIVE_STORAGE_TEST_LEGACY_SCOPE_IDS = Object.freeze({
  UNCONVERTED_POLICY_COMPATIBILITY: 'unconverted_policy_compatibility',
  ROLLBACK_SNAPSHOT_RESTORE: 'rollback_snapshot_restore',
  MAINTAINER_MIGRATION_FIXTURE: 'maintainer_migration_fixture',
});

const POLICY_NATIVE_STORAGE_TEST_STATUS_IDS = Object.freeze({
  BLOCKED_BY_MISSING_NATIVE_COVERAGE: 'blocked_by_missing_native_coverage',
  BLOCKED_BY_LEGACY_SCOPE: 'blocked_by_legacy_scope',
  BLOCKED_BY_DELETION_GATE_SCOPE: 'blocked_by_deletion_gate_scope',
  READY_FOR_NATIVE_STORAGE_TEST_RESET: 'ready_for_native_storage_test_reset',
});

const POLICY_NATIVE_STORAGE_TEST_RISK_IDS = Object.freeze({
  MISSING_REQUIRED_COVERAGE: 'missing_required_coverage',
  NATIVE_SQL_MIGRATION_COVERAGE_MISSING: 'native_sql_migration_coverage_missing',
  LEGACY_PRESERVATION_UNSCOPED: 'legacy_preservation_unscoped',
  DIAGNOSTIC_UI_TEST_NOT_DELETION_SCOPED: 'diagnostic_ui_test_not_deletion_scoped',
  DELETION_GATES_PASSED_WITH_DIAGNOSTIC_TESTS: 'deletion_gates_passed_with_diagnostic_tests',
  ABANDONED_DIAGNOSTIC_MARKED_FINAL: 'abandoned_diagnostic_marked_final',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  MISSING_REASON: 'missing_reason',
});

const POLICY_NATIVE_STORAGE_TEST_REASON_IDS = Object.freeze({
  COVERAGE_ALLOW_LIST_DEFINED: 'coverage_allow_list_defined',
  CURRENT_TESTS_INVENTORIED: 'current_tests_inventoried',
  NATIVE_SQL_MIGRATION_GAP_EXPLICIT: 'native_sql_migration_gap_explicit',
  LEGACY_TEST_SCOPE_REQUIRED: 'legacy_test_scope_required',
  DIAGNOSTIC_TESTS_DELETION_SCOPED: 'diagnostic_tests_deletion_scoped',
  SIDE_EFFECTS_DISABLED: 'side_effects_disabled',
});

const REQUIRED_COVERAGE = Object.freeze([
  {
    coverageId: POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.NATIVE_SCHEMA_SQL_MIGRATION_TESTS,
    label: 'Native schema SQL migration tests',
    requiredBeforeNativeDefault: true,
  },
  {
    coverageId: POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.NATIVE_SCHEMA_CONTRACT_TESTS,
    label: 'Native schema contract tests',
    requiredBeforeNativeDefault: true,
  },
  {
    coverageId: POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.DRY_RUN_CANDIDATE_REPORT_TESTS,
    label: 'Dry-run migration candidate report tests',
    requiredBeforeNativeDefault: true,
  },
  {
    coverageId: POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.EXPLICIT_CONVERSION_TESTS,
    label: 'Explicit conversion workflow tests',
    requiredBeforeNativeDefault: true,
  },
  {
    coverageId: POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.NATIVE_RUNTIME_READ_PATH_TESTS,
    label: 'Native runtime read-path tests',
    requiredBeforeNativeDefault: true,
  },
  {
    coverageId: POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.ROLLBACK_REVERSION_TESTS,
    label: 'Rollback and reversion tests',
    requiredBeforeNativeDefault: true,
  },
  {
    coverageId: POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.LEGACY_WRITE_BLOCKING_TESTS,
    label: 'Legacy write-blocking tests for converted policies',
    requiredBeforeNativeDefault: true,
  },
  {
    coverageId: POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.BACKUP_RESTORE_COVERAGE_TESTS,
    label: 'Backup/restore native coverage tests',
    requiredBeforeNativeDefault: true,
  },
  {
    coverageId: POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.DELETION_GATE_TESTS,
    label: 'Deletion-gate tests',
    requiredBeforeNativeDefault: true,
  },
]);

const CURRENT_NATIVE_STORAGE_TEST_RECORDS = Object.freeze([
  {
    path: 'server/src/__tests__/migrations.test.mjs',
    coverageIds: [POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.NATIVE_SCHEMA_SQL_MIGRATION_TESTS],
    finalNativeStorageContract: true,
  },
  {
    path: 'server/src/__tests__/services/policyNativeSchemaContract.test.mjs',
    coverageIds: [POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.NATIVE_SCHEMA_CONTRACT_TESTS],
    finalNativeStorageContract: true,
  },
  {
    path: 'server/src/__tests__/services/policyBuilderPhase8MigrationCandidateReport.test.mjs',
    coverageIds: [POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.DRY_RUN_CANDIDATE_REPORT_TESTS],
    finalNativeStorageContract: true,
  },
  {
    path: 'server/src/__tests__/services/policyBuilderPhase8ExplicitConversionWorkflow.test.mjs',
    coverageIds: [POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.EXPLICIT_CONVERSION_TESTS],
    finalNativeStorageContract: true,
  },
  {
    path: 'server/src/__tests__/services/policyNativeRuntimeReadPath.test.mjs',
    coverageIds: [POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.NATIVE_RUNTIME_READ_PATH_TESTS],
    finalNativeStorageContract: true,
  },
  {
    path: 'server/src/__tests__/services/policyRollbackSnapshotWindow.test.mjs',
    coverageIds: [POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.ROLLBACK_REVERSION_TESTS],
    finalNativeStorageContract: true,
    preservesLegacyPayload: true,
    legacyScopeId: POLICY_NATIVE_STORAGE_TEST_LEGACY_SCOPE_IDS.ROLLBACK_SNAPSHOT_RESTORE,
  },
  {
    path: 'server/src/__tests__/services/policyLegacyWriteBoundary.test.mjs',
    coverageIds: [POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.LEGACY_WRITE_BLOCKING_TESTS],
    finalNativeStorageContract: true,
  },
  {
    path: 'server/src/__tests__/services/policyNativeStorageOperationalSafety.test.mjs',
    coverageIds: [POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.BACKUP_RESTORE_COVERAGE_TESTS],
    finalNativeStorageContract: true,
  },
  {
    path: 'server/src/__tests__/services/policyCompatibilityDeletionGates.test.mjs',
    coverageIds: [POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.DELETION_GATE_TESTS],
    finalNativeStorageContract: true,
  },
  {
    path: 'server/src/__tests__/services/policyBuilderLegacyCompatibilityBoundary.test.mjs',
    coverageIds: [],
    preservesLegacyPayload: true,
    legacyScopeId:
      POLICY_NATIVE_STORAGE_TEST_LEGACY_SCOPE_IDS.UNCONVERTED_POLICY_COMPATIBILITY,
  },
  {
    path: 'server/src/__tests__/services/policyBuilderPhase8ImpactMigrationVerifier.test.mjs',
    coverageIds: [],
    abandonedDiagnosticUi: true,
    deleteAfterNativeStorageGates: true,
  },
  {
    path: 'server/src/__tests__/policyBuilderPhase8ReplayMigrationVerifier.test.mjs',
    coverageIds: [],
    abandonedDiagnosticUi: true,
    deleteAfterNativeStorageGates: true,
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value) {
  return value === true;
}

function uniqueNormalizedStrings(values) {
  return [...new Set(asArray(values).map(normalizeString).filter(Boolean))];
}

function buildReason(reasonId, message) {
  return { reasonId, message };
}

function normalizeTestRecord(record = {}) {
  return {
    path: normalizeString(record.path),
    coverageIds: uniqueNormalizedStrings(record.coverageIds),
    preservesLegacyPayload: normalizeBoolean(record.preservesLegacyPayload),
    legacyScopeId: normalizeString(record.legacyScopeId) || null,
    abandonedDiagnosticUi: normalizeBoolean(record.abandonedDiagnosticUi),
    deleteAfterNativeStorageGates: normalizeBoolean(record.deleteAfterNativeStorageGates),
    finalNativeStorageContract: normalizeBoolean(record.finalNativeStorageContract),
  };
}

function buildCoverageRequirements(testRecords = []) {
  return REQUIRED_COVERAGE.map(requirement => {
    const evidencePaths = asArray(testRecords)
      .filter(record => asArray(record.coverageIds).includes(requirement.coverageId))
      .map(record => record.path)
      .filter(Boolean);

    return {
      ...requirement,
      provided: evidencePaths.length > 0,
      evidencePaths,
    };
  });
}

function getMissingCoverageIds(coverageRequirements = []) {
  return asArray(coverageRequirements)
    .filter(requirement => requirement.requiredBeforeNativeDefault === true && requirement.provided !== true)
    .map(requirement => requirement.coverageId);
}

function isAllowedLegacyScope(legacyScopeId) {
  return Object.values(POLICY_NATIVE_STORAGE_TEST_LEGACY_SCOPE_IDS).includes(legacyScopeId);
}

function getUnscopedLegacyTestPaths(testRecords = []) {
  return asArray(testRecords)
    .filter(record => (
      record.preservesLegacyPayload === true &&
      !isAllowedLegacyScope(record.legacyScopeId)
    ))
    .map(record => record.path);
}

function getUnscopedDiagnosticTestPaths(testRecords = []) {
  return asArray(testRecords)
    .filter(record => (
      record.abandonedDiagnosticUi === true &&
      record.deleteAfterNativeStorageGates !== true
    ))
    .map(record => record.path);
}

function getDiagnosticTestsPresentAfterDeletionGates(testRecords = [], deletionGatesPassed) {
  if (deletionGatesPassed !== true) return [];

  return asArray(testRecords)
    .filter(record => record.abandonedDiagnosticUi === true)
    .map(record => record.path);
}

function getAbandonedDiagnosticsMarkedFinal(testRecords = []) {
  return asArray(testRecords)
    .filter(record => (
      record.abandonedDiagnosticUi === true &&
      record.finalNativeStorageContract === true
    ))
    .map(record => record.path);
}

function buildSideEffects(sideEffects = {}) {
  return {
    testsDeleted: normalizeBoolean(sideEffects.testsDeleted),
    testsRewritten: normalizeBoolean(sideEffects.testsRewritten),
    coverageFilesGenerated: normalizeBoolean(sideEffects.coverageFilesGenerated),
    schemaMutated: normalizeBoolean(sideEffects.schemaMutated),
  };
}

function hasSideEffects(sideEffects = {}) {
  return Object.values(sideEffects).some(Boolean);
}

function determineStatus({
  missingCoverageIds,
  unscopedLegacyTestPaths,
  unscopedDiagnosticTestPaths,
  diagnosticTestsPresentAfterDeletionGates,
}) {
  if (missingCoverageIds.length > 0) {
    return POLICY_NATIVE_STORAGE_TEST_STATUS_IDS.BLOCKED_BY_MISSING_NATIVE_COVERAGE;
  }

  if (unscopedLegacyTestPaths.length > 0) {
    return POLICY_NATIVE_STORAGE_TEST_STATUS_IDS.BLOCKED_BY_LEGACY_SCOPE;
  }

  if (
    unscopedDiagnosticTestPaths.length > 0 ||
    diagnosticTestsPresentAfterDeletionGates.length > 0
  ) {
    return POLICY_NATIVE_STORAGE_TEST_STATUS_IDS.BLOCKED_BY_DELETION_GATE_SCOPE;
  }

  return POLICY_NATIVE_STORAGE_TEST_STATUS_IDS.READY_FOR_NATIVE_STORAGE_TEST_RESET;
}

function buildBlockers({
  missingCoverageIds,
  unscopedLegacyTestPaths,
  unscopedDiagnosticTestPaths,
  diagnosticTestsPresentAfterDeletionGates,
}) {
  const blockers = [];

  missingCoverageIds.forEach(coverageId => {
    blockers.push({
      blockerId: 'missing_native_storage_test_coverage',
      coverageId,
      message: 'Required native-storage test coverage is missing.',
    });
  });

  unscopedLegacyTestPaths.forEach(path => {
    blockers.push({
      blockerId: 'legacy_preservation_test_unscoped',
      path,
      message:
        'Legacy payload preservation tests must be scoped to unconverted policies, rollback snapshots, or maintainer migration fixtures.',
    });
  });

  unscopedDiagnosticTestPaths.forEach(path => {
    blockers.push({
      blockerId: 'diagnostic_test_not_deletion_scoped',
      path,
      message: 'Abandoned diagnostic UI tests must be marked for deletion after native-storage gates pass.',
    });
  });

  diagnosticTestsPresentAfterDeletionGates.forEach(path => {
    blockers.push({
      blockerId: 'diagnostic_test_present_after_deletion_gates',
      path,
      message: 'Abandoned diagnostic UI tests must be removed after deletion gates pass.',
    });
  });

  return blockers;
}

function buildPolicyNativeStorageTestReset({
  testRecords = CURRENT_NATIVE_STORAGE_TEST_RECORDS,
  deletionGatesPassed = false,
  sideEffects = {},
} = {}) {
  const normalizedTestRecords = asArray(testRecords).map(normalizeTestRecord);
  const coverageRequirements = buildCoverageRequirements(normalizedTestRecords);
  const missingCoverageIds = getMissingCoverageIds(coverageRequirements);
  const unscopedLegacyTestPaths = getUnscopedLegacyTestPaths(normalizedTestRecords);
  const unscopedDiagnosticTestPaths = getUnscopedDiagnosticTestPaths(normalizedTestRecords);
  const diagnosticTestsPresentAfterDeletionGates = getDiagnosticTestsPresentAfterDeletionGates(
    normalizedTestRecords,
    deletionGatesPassed
  );
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const statusId = determineStatus({
    missingCoverageIds,
    unscopedLegacyTestPaths,
    unscopedDiagnosticTestPaths,
    diagnosticTestsPresentAfterDeletionGates,
  });

  const plan = {
    contractVersion: POLICY_NATIVE_STORAGE_TEST_RESET_VERSION,
    statusId,
    resetReady:
      statusId === POLICY_NATIVE_STORAGE_TEST_STATUS_IDS.READY_FOR_NATIVE_STORAGE_TEST_RESET &&
      hasSideEffects(normalizedSideEffects) === false,
    deletionGatesPassed: normalizeBoolean(deletionGatesPassed),
    requiredCoverageIds: REQUIRED_COVERAGE.map(requirement => requirement.coverageId),
    coverageRequirements,
    testRecords: normalizedTestRecords,
    blockers: buildBlockers({
      missingCoverageIds,
      unscopedLegacyTestPaths,
      unscopedDiagnosticTestPaths,
      diagnosticTestsPresentAfterDeletionGates,
    }),
    sideEffects: normalizedSideEffects,
    reasons: [
      buildReason(
        POLICY_NATIVE_STORAGE_TEST_REASON_IDS.COVERAGE_ALLOW_LIST_DEFINED,
        'Native storage coverage is allow-listed from the storage migration roadmap.'
      ),
      buildReason(
        POLICY_NATIVE_STORAGE_TEST_REASON_IDS.CURRENT_TESTS_INVENTORIED,
        'Current native-storage contract and compatibility tests are inventoried before reset.'
      ),
      buildReason(
        POLICY_NATIVE_STORAGE_TEST_REASON_IDS.NATIVE_SQL_MIGRATION_GAP_EXPLICIT,
        'Native SQL migration coverage is tracked explicitly instead of inferred from schema-contract tests.'
      ),
      buildReason(
        POLICY_NATIVE_STORAGE_TEST_REASON_IDS.LEGACY_TEST_SCOPE_REQUIRED,
        'Legacy preservation tests must be scoped to unconverted policies, rollback snapshots, or maintainer fixtures.'
      ),
      buildReason(
        POLICY_NATIVE_STORAGE_TEST_REASON_IDS.DIAGNOSTIC_TESTS_DELETION_SCOPED,
        'Tests for abandoned diagnostic UI must remain deletion-scoped until native-storage gates permit removal.'
      ),
      buildReason(
        POLICY_NATIVE_STORAGE_TEST_REASON_IDS.SIDE_EFFECTS_DISABLED,
        'This reset contract does not delete, rewrite, generate, or mutate tests or schemas.'
      ),
    ],
    nextStep: {
      stepId: 'native_backup_restore_wiring',
      label: 'Native Backup And Restore Wiring',
      reason:
        'Native SQL migration coverage is present; backup and restore wiring is the next operational storage risk.',
    },
  };

  return {
    ...plan,
    validation: validatePolicyNativeStorageTestReset(plan),
  };
}

function validatePolicyNativeStorageTestReset(plan = {}) {
  const issues = [];
  const coverageRequirements = asArray(plan.coverageRequirements);
  const coverageIds = new Set(coverageRequirements.map(requirement => requirement.coverageId));
  const testRecords = asArray(plan.testRecords);

  REQUIRED_COVERAGE.forEach(requirement => {
    const coverage = coverageRequirements.find(candidate => (
      candidate.coverageId === requirement.coverageId
    ));

    if (!coverageIds.has(requirement.coverageId) || coverage?.provided !== true) {
      issues.push({
        riskId: requirement.coverageId ===
          POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.NATIVE_SCHEMA_SQL_MIGRATION_TESTS
          ? POLICY_NATIVE_STORAGE_TEST_RISK_IDS.NATIVE_SQL_MIGRATION_COVERAGE_MISSING
          : POLICY_NATIVE_STORAGE_TEST_RISK_IDS.MISSING_REQUIRED_COVERAGE,
        coverageId: requirement.coverageId,
        message: 'Required native-storage test coverage is missing.',
      });
    }
  });

  getUnscopedLegacyTestPaths(testRecords).forEach(path => {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_TEST_RISK_IDS.LEGACY_PRESERVATION_UNSCOPED,
      path,
      message: 'Legacy preservation test is not scoped to an allowed migration/rollback boundary.',
    });
  });

  getUnscopedDiagnosticTestPaths(testRecords).forEach(path => {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_TEST_RISK_IDS.DIAGNOSTIC_UI_TEST_NOT_DELETION_SCOPED,
      path,
      message: 'Abandoned diagnostic UI test is not marked for deletion after native-storage gates pass.',
    });
  });

  getDiagnosticTestsPresentAfterDeletionGates(
    testRecords,
    plan.deletionGatesPassed
  ).forEach(path => {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_TEST_RISK_IDS.DELETION_GATES_PASSED_WITH_DIAGNOSTIC_TESTS,
      path,
      message: 'Abandoned diagnostic UI test remains present after deletion gates passed.',
    });
  });

  getAbandonedDiagnosticsMarkedFinal(testRecords).forEach(path => {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_TEST_RISK_IDS.ABANDONED_DIAGNOSTIC_MARKED_FINAL,
      path,
      message: 'Abandoned diagnostic UI test cannot be marked as final native-storage contract coverage.',
    });
  });

  if (hasSideEffects(plan.sideEffects)) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_TEST_RISK_IDS.SIDE_EFFECT_PERFORMED,
      message: 'Native storage reset planning must not delete, rewrite, generate, or mutate tests or schemas.',
    });
  }

  if (asArray(plan.reasons).length === 0) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_TEST_RISK_IDS.MISSING_REASON,
      message: 'Test reset plan must explain its test-boundary decisions.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyNativeStorageTestResetAudit(
  plan = buildPolicyNativeStorageTestReset()
) {
  const validation = validatePolicyNativeStorageTestReset(plan);
  const missingCoverageIds = getMissingCoverageIds(plan.coverageRequirements);
  const diagnosticDeletionCandidatePaths = asArray(plan.testRecords)
    .filter(record => (
      record.abandonedDiagnosticUi === true &&
      record.deleteAfterNativeStorageGates === true
    ))
    .map(record => record.path);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: plan.statusId,
    resetReady: plan.resetReady === true,
    requiredCoverageCount: asArray(plan.requiredCoverageIds).length,
    testRecordCount: asArray(plan.testRecords).length,
    missingCoverageIds,
    diagnosticDeletionCandidatePaths,
    nextStep: plan.nextStep || {
      stepId: 'native_backup_restore_wiring',
      label: 'Native Backup And Restore Wiring',
      reason: 'Native SQL migration coverage is present; backup and restore wiring is the next risk.',
    },
    validation,
  };
}

export {
  POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS,
  POLICY_NATIVE_STORAGE_TEST_LEGACY_SCOPE_IDS,
  POLICY_NATIVE_STORAGE_TEST_REASON_IDS,
  POLICY_NATIVE_STORAGE_TEST_RESET_VERSION,
  POLICY_NATIVE_STORAGE_TEST_RISK_IDS,
  POLICY_NATIVE_STORAGE_TEST_STATUS_IDS,
  buildPolicyNativeStorageTestReset,
  buildPolicyNativeStorageTestResetAudit,
  validatePolicyNativeStorageTestReset,
};
