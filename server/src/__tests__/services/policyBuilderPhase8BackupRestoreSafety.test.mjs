import {
  PHASE8R_BACKUP_RESTORE_MODE_IDS,
  PHASE8R_BACKUP_RESTORE_RISK_IDS,
  PHASE8R_BACKUP_RESTORE_STATUS_IDS,
  PHASE8R_BACKUP_RESTORE_VALIDATION_IDS,
  PHASE8R_POST_UPGRADE_OPERATOR_ERROR_IDS,
  buildPolicyBuilderPhase8BackupRestoreSafetyAudit,
  buildPolicyBuilderPhase8BackupRestoreSafetyPlan,
  validatePolicyBuilderPhase8BackupRestoreSafetyPlan,
} from '../../services/policyBuilderPhase8BackupRestoreSafety.mjs';
import {
  PHASE8R_NATIVE_SCHEMA_TABLE_IDS,
} from '../../services/policyBuilderPhase8NativeSchemaContract.mjs';
import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
} from '../../services/policyIntentSchema.mjs';

const NATIVE_TABLE_IDS = Object.freeze(Object.values(PHASE8R_NATIVE_SCHEMA_TABLE_IDS));
const RESTORE_VALIDATION_IDS = Object.freeze(
  Object.values(PHASE8R_BACKUP_RESTORE_VALIDATION_IDS)
);
const OPERATOR_ERROR_IDS = Object.freeze(Object.values(PHASE8R_POST_UPGRADE_OPERATOR_ERROR_IDS));

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
      freshInstallChecksum: 'phase8r-native-schema',
      upgradedInstallChecksum: 'phase8r-native-schema',
    },
    postUpgrade: {
      modeId: PHASE8R_BACKUP_RESTORE_MODE_IDS.APPLY,
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

describe('policyBuilderPhase8BackupRestoreSafety', () => {
  test('defaults to a fail-closed operational safety plan with no side effects', () => {
    const plan = buildPolicyBuilderPhase8BackupRestoreSafetyPlan();

    expect(plan.statusId)
      .toBe(PHASE8R_BACKUP_RESTORE_STATUS_IDS.BLOCKED_BY_SCHEMA_MISMATCH);
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
      PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_NATIVE_TABLE_BACKUP,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_NATIVE_TABLE_RESTORE,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_RESTORE_VALIDATION,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_SCHEMA_VERSION_CHECK,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.FRESH_UPGRADE_SCHEMA_MISMATCH,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.MIXED_PARTIAL_WRITES_ALLOWED,
    ]));
  });

  test('blocks when any native table is missing from backup coverage', () => {
    const plan = buildPolicyBuilderPhase8BackupRestoreSafetyPlan(buildCompleteSafetyInput({
      backupTableIds: NATIVE_TABLE_IDS.filter(tableId => (
        tableId !== PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS
      )),
    }));

    expect(plan.statusId)
      .toBe(PHASE8R_BACKUP_RESTORE_STATUS_IDS.BLOCKED_BY_BACKUP_RESTORE_GAPS);
    expect(plan.readyForOperationalApply).toBe(false);
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        blockerId: 'native_table_missing_from_backup',
        tableId: PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS,
      }),
    ]));
    expect(plan.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_NATIVE_TABLE_BACKUP,
        tableId: PHASE8R_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS,
      }),
    ]));
  });

  test('blocks when restore validation does not prove rollback snapshots and migration events', () => {
    const plan = buildPolicyBuilderPhase8BackupRestoreSafetyPlan(buildCompleteSafetyInput({
      restoreValidationIds: [
        PHASE8R_BACKUP_RESTORE_VALIDATION_IDS.NATIVE_POLICY_RECOVERY,
        PHASE8R_BACKUP_RESTORE_VALIDATION_IDS.SCHEMA_VERSION_RESTORE,
      ],
    }));

    expect(plan.statusId)
      .toBe(PHASE8R_BACKUP_RESTORE_STATUS_IDS.BLOCKED_BY_BACKUP_RESTORE_GAPS);
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        blockerId: 'restore_validation_missing',
        validationId: PHASE8R_BACKUP_RESTORE_VALIDATION_IDS.ROLLBACK_SNAPSHOT_RESTORE,
      }),
      expect.objectContaining({
        blockerId: 'restore_validation_missing',
        validationId: PHASE8R_BACKUP_RESTORE_VALIDATION_IDS.MIGRATION_EVENT_RESTORE,
      }),
    ]));
  });

  test('blocks post-upgrade apply when dry-run or transaction safety is incomplete', () => {
    const plan = buildPolicyBuilderPhase8BackupRestoreSafetyPlan(buildCompleteSafetyInput({
      postUpgrade: {
        modeId: PHASE8R_BACKUP_RESTORE_MODE_IDS.APPLY,
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
      .toBe(PHASE8R_BACKUP_RESTORE_STATUS_IDS.BLOCKED_BY_POST_UPGRADE_DRY_RUN);
    expect(plan.readyForOperationalApply).toBe(false);
    expect(plan.validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_BACKUP_RESTORE_RISK_IDS.APPLY_WITHOUT_DRY_RUN,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.MIXED_PARTIAL_WRITES_ALLOWED,
    ]));
  });

  test('marks operational apply ready only when backup, restore, schema, dry-run, transaction, and operator errors pass', () => {
    const plan = buildPolicyBuilderPhase8BackupRestoreSafetyPlan(buildCompleteSafetyInput());

    expect(plan.statusId)
      .toBe(PHASE8R_BACKUP_RESTORE_STATUS_IDS.READY_FOR_OPERATIONAL_APPLY);
    expect(plan.readyForOperationalApply).toBe(true);
    expect(plan.validation.ok).toBe(true);
    expect(plan.blockers).toEqual([]);
    expect(plan.nextPhase).toEqual(expect.objectContaining({
      phaseId: '8r_9',
      label: 'Native Storage Test Reset',
    }));
  });

  test('rejects tampered safety plans that hide operator errors or perform side effects', () => {
    const plan = buildPolicyBuilderPhase8BackupRestoreSafetyPlan(buildCompleteSafetyInput());
    const validation = validatePolicyBuilderPhase8BackupRestoreSafetyPlan({
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
          PHASE8R_POST_UPGRADE_OPERATOR_ERROR_IDS.APPLY_FAILED_ROLLED_BACK,
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
      PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_NATIVE_TABLE_BACKUP,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_RESTORE_VALIDATION,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_SCHEMA_VERSION_CHECK,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.FRESH_UPGRADE_SCHEMA_MISMATCH,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.APPLY_WITHOUT_DRY_RUN,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.MIXED_PARTIAL_WRITES_ALLOWED,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.POST_UPGRADE_ERROR_NOT_OPERATOR_FACING,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.SIDE_EFFECT_PERFORMED,
      PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_REASON,
    ]));
  });

  test('summarizes operational safety for the Phase 8R audit chain', () => {
    const audit = buildPolicyBuilderPhase8BackupRestoreSafetyAudit(
      buildPolicyBuilderPhase8BackupRestoreSafetyPlan(buildCompleteSafetyInput())
    );

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      statusId: PHASE8R_BACKUP_RESTORE_STATUS_IDS.READY_FOR_OPERATIONAL_APPLY,
      readyForOperationalApply: true,
      nativeTableCount: NATIVE_TABLE_IDS.length,
      missingBackupTableIds: [],
      missingRestoreTableIds: [],
      missingRestoreValidationIds: [],
      missingOperatorErrorIds: [],
      nextPhase: expect.objectContaining({
        phaseId: '8r_9',
      }),
    }));
  });
});
