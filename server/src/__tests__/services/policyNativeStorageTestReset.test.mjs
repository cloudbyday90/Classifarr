import {
  POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS,
  POLICY_NATIVE_STORAGE_TEST_LEGACY_SCOPE_IDS,
  POLICY_NATIVE_STORAGE_TEST_RISK_IDS,
  POLICY_NATIVE_STORAGE_TEST_STATUS_IDS,
  buildPolicyNativeStorageTestReset,
  buildPolicyNativeStorageTestResetAudit,
  validatePolicyNativeStorageTestReset,
} from '../../services/policyNativeStorageTestReset.mjs';

const COVERAGE_IDS = Object.freeze(Object.values(POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS));

function buildCompleteTestRecords(overrides = []) {
  return COVERAGE_IDS.map(coverageId => ({
    path: `server/src/__tests__/phase8r/${coverageId}.test.mjs`,
    coverageIds: [coverageId],
    finalNativeStorageContract: true,
  })).concat(overrides);
}

describe('policyNativeStorageTestReset', () => {
  test('inventories current native-storage test coverage including native SQL migration coverage', () => {
    const plan = buildPolicyNativeStorageTestReset();

    expect(plan.statusId)
      .toBe(POLICY_NATIVE_STORAGE_TEST_STATUS_IDS.READY_FOR_NATIVE_STORAGE_TEST_RESET);
    expect(plan.resetReady).toBe(true);
    expect(plan.requiredCoverageIds).toEqual(COVERAGE_IDS);
    expect(plan.testRecords.map(record => record.path)).toEqual(expect.arrayContaining([
      'server/src/__tests__/migrations.test.mjs',
      'server/src/__tests__/services/policyNativeSchemaContract.test.mjs',
      'server/src/__tests__/services/policyBuilderPhase8MigrationCandidateReport.test.mjs',
      'server/src/__tests__/services/policyBuilderPhase8ExplicitConversionWorkflow.test.mjs',
      'server/src/__tests__/services/policyBuilderPhase8NativeRuntimeReadPath.test.mjs',
      'server/src/__tests__/services/policyBuilderPhase8RollbackSnapshotWindow.test.mjs',
      'server/src/__tests__/services/policyBuilderPhase8LegacyWritePathShutdown.test.mjs',
      'server/src/__tests__/services/policyNativeStorageOperationalSafety.test.mjs',
      'server/src/__tests__/services/policyBuilderPhase8LegacyCodeDeletionGates.test.mjs',
    ]));
    expect(plan.blockers).toEqual([]);
    expect(plan.validation.ok).toBe(true);
  });

  test('still rejects reset plans when native SQL migration coverage is missing', () => {
    const plan = buildPolicyNativeStorageTestReset({
      testRecords: buildCompleteTestRecords().filter(record => !record.coverageIds.includes(
        POLICY_NATIVE_STORAGE_TEST_COVERAGE_IDS.NATIVE_SCHEMA_SQL_MIGRATION_TESTS
      )),
    });

    expect(plan.statusId)
      .toBe(POLICY_NATIVE_STORAGE_TEST_STATUS_IDS.BLOCKED_BY_MISSING_NATIVE_COVERAGE);
    expect(plan.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_STORAGE_TEST_RISK_IDS.NATIVE_SQL_MIGRATION_COVERAGE_MISSING,
      }),
    ]));
  });

  test('requires legacy payload preservation tests to be scoped to migration or rollback boundaries', () => {
    const plan = buildPolicyNativeStorageTestReset({
      testRecords: buildCompleteTestRecords([
        {
          path: 'server/src/__tests__/legacy/unscoped-preservation.test.mjs',
          preservesLegacyPayload: true,
        },
      ]),
    });

    expect(plan.statusId)
      .toBe(POLICY_NATIVE_STORAGE_TEST_STATUS_IDS.BLOCKED_BY_LEGACY_SCOPE);
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        blockerId: 'legacy_preservation_test_unscoped',
        path: 'server/src/__tests__/legacy/unscoped-preservation.test.mjs',
      }),
    ]));
  });

  test('allows legacy preservation tests only for unconverted policies, rollback snapshots, or maintainer fixtures', () => {
    const plan = buildPolicyNativeStorageTestReset({
      testRecords: buildCompleteTestRecords([
        {
          path: 'server/src/__tests__/legacy/unconverted-policy-compatibility.test.mjs',
          preservesLegacyPayload: true,
          legacyScopeId:
            POLICY_NATIVE_STORAGE_TEST_LEGACY_SCOPE_IDS.UNCONVERTED_POLICY_COMPATIBILITY,
        },
        {
          path: 'server/src/__tests__/legacy/rollback-snapshot-restore.test.mjs',
          preservesLegacyPayload: true,
          legacyScopeId: POLICY_NATIVE_STORAGE_TEST_LEGACY_SCOPE_IDS.ROLLBACK_SNAPSHOT_RESTORE,
        },
      ]),
    });

    expect(plan.validation.issues.map(issue => issue.riskId))
      .not.toContain(POLICY_NATIVE_STORAGE_TEST_RISK_IDS.LEGACY_PRESERVATION_UNSCOPED);
  });

  test('keeps abandoned diagnostic UI tests deletion-scoped until deletion gates pass', () => {
    const unscoped = buildPolicyNativeStorageTestReset({
      testRecords: buildCompleteTestRecords([
        {
          path: 'server/src/__tests__/services/policyIntentImpactPreview.test.mjs',
          abandonedDiagnosticUi: true,
        },
      ]),
    });
    const afterGates = buildPolicyNativeStorageTestReset({
      deletionGatesPassed: true,
      testRecords: buildCompleteTestRecords([
        {
          path: 'server/src/__tests__/services/policyIntentImpactPreview.test.mjs',
          abandonedDiagnosticUi: true,
          deleteAfterNativeStorageGates: true,
        },
      ]),
    });

    expect(unscoped.statusId)
      .toBe(POLICY_NATIVE_STORAGE_TEST_STATUS_IDS.BLOCKED_BY_DELETION_GATE_SCOPE);
    expect(unscoped.validation.issues.map(issue => issue.riskId)).toContain(
      POLICY_NATIVE_STORAGE_TEST_RISK_IDS.DIAGNOSTIC_UI_TEST_NOT_DELETION_SCOPED
    );
    expect(afterGates.validation.issues.map(issue => issue.riskId)).toContain(
      POLICY_NATIVE_STORAGE_TEST_RISK_IDS.DELETION_GATES_PASSED_WITH_DIAGNOSTIC_TESTS
    );
  });

  test('marks reset ready when all native coverage exists and legacy/diagnostic tests are properly scoped', () => {
    const plan = buildPolicyNativeStorageTestReset({
      testRecords: buildCompleteTestRecords([
        {
          path: 'server/src/__tests__/legacy/unconverted-policy-compatibility.test.mjs',
          preservesLegacyPayload: true,
          legacyScopeId:
            POLICY_NATIVE_STORAGE_TEST_LEGACY_SCOPE_IDS.UNCONVERTED_POLICY_COMPATIBILITY,
        },
        {
          path: 'server/src/__tests__/services/policyIntentReplayPreview.test.mjs',
          abandonedDiagnosticUi: true,
          deleteAfterNativeStorageGates: true,
        },
      ]),
    });

    expect(plan.statusId)
      .toBe(POLICY_NATIVE_STORAGE_TEST_STATUS_IDS.READY_FOR_NATIVE_STORAGE_TEST_RESET);
    expect(plan.resetReady).toBe(true);
    expect(plan.validation.ok).toBe(true);
    expect(plan.nextStep).toEqual(expect.objectContaining({
      stepId: 'native_backup_restore_wiring',
    }));
    expect(plan.nextPhase).toBeUndefined();
  });

  test('rejects tampered reset plans that mark diagnostics final or perform side effects', () => {
    const plan = buildPolicyNativeStorageTestReset({
      testRecords: buildCompleteTestRecords(),
    });
    const validation = validatePolicyNativeStorageTestReset({
      ...plan,
      testRecords: plan.testRecords.concat([
        {
          path: 'server/src/__tests__/services/policyIntentImpactPreview.test.mjs',
          abandonedDiagnosticUi: true,
          deleteAfterNativeStorageGates: true,
          finalNativeStorageContract: true,
        },
        {
          path: 'server/src/__tests__/legacy/unscoped-preservation.test.mjs',
          preservesLegacyPayload: true,
        },
      ]),
      sideEffects: {
        ...plan.sideEffects,
        testsDeleted: true,
      },
      reasons: [],
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_STORAGE_TEST_RISK_IDS.LEGACY_PRESERVATION_UNSCOPED,
      POLICY_NATIVE_STORAGE_TEST_RISK_IDS.ABANDONED_DIAGNOSTIC_MARKED_FINAL,
      POLICY_NATIVE_STORAGE_TEST_RISK_IDS.SIDE_EFFECT_PERFORMED,
      POLICY_NATIVE_STORAGE_TEST_RISK_IDS.MISSING_REASON,
    ]));
  });

  test('summarizes reset readiness for the native storage audit chain', () => {
    const audit = buildPolicyNativeStorageTestResetAudit(
      buildPolicyNativeStorageTestReset({
        testRecords: buildCompleteTestRecords([
          {
            path: 'server/src/__tests__/services/policyIntentImpactPreview.test.mjs',
            abandonedDiagnosticUi: true,
            deleteAfterNativeStorageGates: true,
          },
        ]),
      })
    );

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      statusId: POLICY_NATIVE_STORAGE_TEST_STATUS_IDS.READY_FOR_NATIVE_STORAGE_TEST_RESET,
      resetReady: true,
      requiredCoverageCount: COVERAGE_IDS.length,
      missingCoverageIds: [],
      diagnosticDeletionCandidatePaths: [
        'server/src/__tests__/services/policyIntentImpactPreview.test.mjs',
      ],
      nextStep: expect.objectContaining({
        stepId: 'native_backup_restore_wiring',
      }),
    }));
    expect(audit.nextPhase).toBeUndefined();
  });
});
