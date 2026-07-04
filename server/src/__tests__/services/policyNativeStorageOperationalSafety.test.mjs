import {
  POLICY_NATIVE_STORAGE_OPERATIONAL_MODE_IDS,
  POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS,
  POLICY_NATIVE_STORAGE_OPERATIONAL_STATUS_IDS,
  POLICY_NATIVE_STORAGE_OPERATIONAL_VALIDATION_IDS,
  POLICY_NATIVE_STORAGE_OPERATOR_ERROR_IDS,
  buildPolicyNativeStorageOperationalSafetyAudit,
  buildPolicyNativeStorageOperationalSafetyPlan,
  validatePolicyNativeStorageOperationalSafetyPlan,
} from '../../services/policyNativeStorageOperationalSafety.mjs';
import {
  POLICY_NATIVE_SCHEMA_TABLE_IDS,
} from '../../services/policyNativeSchemaContract.mjs';
import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
} from '../../services/policyIntentSchema.mjs';

const NATIVE_TABLE_IDS = Object.freeze(Object.values(POLICY_NATIVE_SCHEMA_TABLE_IDS));
const RESTORE_VALIDATION_IDS = Object.freeze(
  Object.values(POLICY_NATIVE_STORAGE_OPERATIONAL_VALIDATION_IDS)
);
const OPERATOR_ERROR_IDS = Object.freeze(Object.values(POLICY_NATIVE_STORAGE_OPERATOR_ERROR_IDS));

function buildCompleteSafetyInput(overrides = {}) {
  return {
    backupTableIds: NATIVE_TABLE_IDS,
    restoreTableIds: NATIVE_TABLE_IDS,
    restoreValidationIds: RESTORE_VALIDATION_IDS,
    schemaParity: {
      versionedSchemaCheck: true,
      matches: true,
      freshInstallSchemaVersion: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
      upgradedInstallSchemaVersion: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
      freshInstallChecksum: 'native-policy-intent-schema',
      upgradedInstallChecksum: 'native-policy-intent-schema',
    },
    postUpgrade: {
      modeId: POLICY_NATIVE_STORAGE_OPERATIONAL_MODE_IDS.APPLY,
      dryRunReportReady: true,
      applyModeRequested: true,
      operatorErrorIds: OPERATOR_ERROR_IDS,
    },
    transactionBoundary: {
      atomicNativeConversion: true,
      rollbackOnFailure: true,
      legacyRemainsActiveUntilCommit: true,
      mixedPartialWritesPrevented: true,
    },
    ...overrides,
  };
}

describe('policyNativeStorageOperationalSafety', () => {
  test('defaults to a fail-closed operational safety plan with no side effects', () => {
    const plan = buildPolicyNativeStorageOperationalSafetyPlan();

    expect(plan.statusId)
      .toBe(POLICY_NATIVE_STORAGE_OPERATIONAL_STATUS_IDS.BLOCKED_BY_SCHEMA_MISMATCH);
    expect(plan.readyForOperationalApply).toBe(false);
    expect(plan.requiredNativeTableIds).toEqual(NATIVE_TABLE_IDS);
    expect(plan.tableCoverage).toHaveLength(NATIVE_TABLE_IDS.length);
    expect(plan.restoreValidations).toHaveLength(RESTORE_VALIDATION_IDS.length);
    expect(plan.sideEffects).toEqual({
      backupWritten: false,
      restoreApplied: false,
      postUpgradeApplied: false,
      schemaMutated: false,
    });
    expect(plan.validation.ok).toBe(false);
    expect(plan.validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.MISSING_NATIVE_TABLE_BACKUP,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.MISSING_NATIVE_TABLE_RESTORE,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.MISSING_RESTORE_VALIDATION,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.MISSING_SCHEMA_VERSION_CHECK,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.FRESH_UPGRADE_SCHEMA_MISMATCH,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.MIXED_PARTIAL_WRITES_ALLOWED,
    ]));
  });

  test('blocks when any native table is missing from backup coverage', () => {
    const plan = buildPolicyNativeStorageOperationalSafetyPlan(buildCompleteSafetyInput({
      backupTableIds: NATIVE_TABLE_IDS.filter(tableId => (
        tableId !== POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS
      )),
    }));

    expect(plan.statusId)
      .toBe(POLICY_NATIVE_STORAGE_OPERATIONAL_STATUS_IDS.BLOCKED_BY_BACKUP_RESTORE_GAPS);
    expect(plan.readyForOperationalApply).toBe(false);
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        blockerId: 'native_table_missing_from_backup',
        tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS,
      }),
    ]));
    expect(plan.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.MISSING_NATIVE_TABLE_BACKUP,
        tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS,
      }),
    ]));
  });

  test('blocks when restore validation does not prove rollback snapshots and migration events', () => {
    const plan = buildPolicyNativeStorageOperationalSafetyPlan(buildCompleteSafetyInput({
      restoreValidationIds: [
        POLICY_NATIVE_STORAGE_OPERATIONAL_VALIDATION_IDS.NATIVE_POLICY_RECOVERY,
        POLICY_NATIVE_STORAGE_OPERATIONAL_VALIDATION_IDS.SCHEMA_VERSION_RESTORE,
      ],
    }));

    expect(plan.statusId)
      .toBe(POLICY_NATIVE_STORAGE_OPERATIONAL_STATUS_IDS.BLOCKED_BY_BACKUP_RESTORE_GAPS);
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        blockerId: 'restore_validation_missing',
        validationId: POLICY_NATIVE_STORAGE_OPERATIONAL_VALIDATION_IDS.ROLLBACK_SNAPSHOT_RESTORE,
      }),
      expect.objectContaining({
        blockerId: 'restore_validation_missing',
        validationId: POLICY_NATIVE_STORAGE_OPERATIONAL_VALIDATION_IDS.MIGRATION_EVENT_RESTORE,
      }),
    ]));
  });

  test('blocks post-upgrade apply when dry-run or transaction safety is incomplete', () => {
    const plan = buildPolicyNativeStorageOperationalSafetyPlan(buildCompleteSafetyInput({
      postUpgrade: {
        modeId: POLICY_NATIVE_STORAGE_OPERATIONAL_MODE_IDS.APPLY,
        dryRunReportReady: false,
        applyModeRequested: true,
        operatorErrorIds: OPERATOR_ERROR_IDS,
      },
      transactionBoundary: {
        atomicNativeConversion: true,
        rollbackOnFailure: false,
        legacyRemainsActiveUntilCommit: true,
        mixedPartialWritesPrevented: false,
      },
    }));

    expect(plan.statusId)
      .toBe(POLICY_NATIVE_STORAGE_OPERATIONAL_STATUS_IDS.BLOCKED_BY_POST_UPGRADE_DRY_RUN);
    expect(plan.readyForOperationalApply).toBe(false);
    expect(plan.validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.APPLY_WITHOUT_DRY_RUN,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.MIXED_PARTIAL_WRITES_ALLOWED,
    ]));
  });

  test('marks operational apply ready only when backup, restore, schema, dry-run, transaction, and operator errors pass', () => {
    const plan = buildPolicyNativeStorageOperationalSafetyPlan(buildCompleteSafetyInput());

    expect(plan.statusId)
      .toBe(POLICY_NATIVE_STORAGE_OPERATIONAL_STATUS_IDS.READY_FOR_OPERATIONAL_APPLY);
    expect(plan.readyForOperationalApply).toBe(true);
    expect(plan.validation.ok).toBe(true);
    expect(plan.blockers).toEqual([]);
    expect(plan.nextStep).toEqual(expect.objectContaining({
      stepId: 'native_storage_test_reset',
      label: 'Native Storage Test Reset',
    }));
  });

  test('rejects tampered safety plans that hide operator errors or perform side effects', () => {
    const plan = buildPolicyNativeStorageOperationalSafetyPlan(buildCompleteSafetyInput());
    const validation = validatePolicyNativeStorageOperationalSafetyPlan({
      ...plan,
      tableCoverage: plan.tableCoverage.slice(1),
      restoreValidations: plan.restoreValidations.slice(1),
      schemaParity: {
        ...plan.schemaParity,
        versionedSchemaCheck: false,
        matches: false,
      },
      postUpgradeSafety: {
        ...plan.postUpgradeSafety,
        applyModeRequested: true,
        dryRunReportReady: false,
        transactionSafe: false,
        missingOperatorErrorIds: [
          POLICY_NATIVE_STORAGE_OPERATOR_ERROR_IDS.APPLY_FAILED_ROLLED_BACK,
        ],
      },
      sideEffects: {
        ...plan.sideEffects,
        restoreApplied: true,
      },
      reasons: [],
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.MISSING_NATIVE_TABLE_BACKUP,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.MISSING_RESTORE_VALIDATION,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.MISSING_SCHEMA_VERSION_CHECK,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.FRESH_UPGRADE_SCHEMA_MISMATCH,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.APPLY_WITHOUT_DRY_RUN,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.MIXED_PARTIAL_WRITES_ALLOWED,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.POST_UPGRADE_ERROR_NOT_OPERATOR_FACING,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.SIDE_EFFECT_PERFORMED,
      POLICY_NATIVE_STORAGE_OPERATIONAL_RISK_IDS.MISSING_REASON,
    ]));
  });

  test('summarizes operational safety for the native storage audit chain', () => {
    const audit = buildPolicyNativeStorageOperationalSafetyAudit(
      buildPolicyNativeStorageOperationalSafetyPlan(buildCompleteSafetyInput())
    );

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      statusId: POLICY_NATIVE_STORAGE_OPERATIONAL_STATUS_IDS.READY_FOR_OPERATIONAL_APPLY,
      readyForOperationalApply: true,
      nativeTableCount: NATIVE_TABLE_IDS.length,
      missingBackupTableIds: [],
      missingRestoreTableIds: [],
      missingRestoreValidationIds: [],
      missingOperatorErrorIds: [],
      nextStep: expect.objectContaining({
        stepId: 'native_storage_test_reset',
      }),
    }));
  });
});
