import {
  POLICY_NATIVE_SCHEMA_TABLE_IDS,
  buildPolicyNativeSchemaContract,
  validatePolicyNativeSchemaContract,
} from './policyNativeSchemaContract.mjs';

const PHASE8R_BACKUP_RESTORE_SAFETY_VERSION = 'phase8r.backup_restore_safety.v1';

const PHASE8R_BACKUP_RESTORE_STATUS_IDS = Object.freeze({
  BLOCKED_BY_SCHEMA_MISMATCH: 'blocked_by_schema_mismatch',
  BLOCKED_BY_BACKUP_RESTORE_GAPS: 'blocked_by_backup_restore_gaps',
  BLOCKED_BY_POST_UPGRADE_DRY_RUN: 'blocked_by_post_upgrade_dry_run',
  BLOCKED_BY_TRANSACTION_SAFETY: 'blocked_by_transaction_safety',
  READY_FOR_OPERATIONAL_APPLY: 'ready_for_operational_apply',
});

const PHASE8R_BACKUP_RESTORE_MODE_IDS = Object.freeze({
  REPORT_ONLY: 'report_only',
  DRY_RUN: 'dry_run',
  APPLY: 'apply',
});

const PHASE8R_BACKUP_RESTORE_VALIDATION_IDS = Object.freeze({
  NATIVE_POLICY_RECOVERY: 'native_policy_recovery',
  ROLLBACK_SNAPSHOT_RESTORE: 'rollback_snapshot_restore',
  MIGRATION_EVENT_RESTORE: 'migration_event_restore',
  SCHEMA_VERSION_RESTORE: 'schema_version_restore',
});

const PHASE8R_POST_UPGRADE_OPERATOR_ERROR_IDS = Object.freeze({
  SCHEMA_MISMATCH: 'schema_mismatch',
  BACKUP_RESTORE_GAP: 'backup_restore_gap',
  DRY_RUN_REQUIRED: 'dry_run_required',
  APPLY_FAILED_ROLLED_BACK: 'apply_failed_rolled_back',
  MIXED_PARTIAL_WRITE_BLOCKED: 'mixed_partial_write_blocked',
});

const PHASE8R_BACKUP_RESTORE_RISK_IDS = Object.freeze({
  MISSING_NATIVE_TABLE_BACKUP: 'missing_native_table_backup',
  MISSING_NATIVE_TABLE_RESTORE: 'missing_native_table_restore',
  MISSING_RESTORE_VALIDATION: 'missing_restore_validation',
  MISSING_SCHEMA_VERSION_CHECK: 'missing_schema_version_check',
  FRESH_UPGRADE_SCHEMA_MISMATCH: 'fresh_upgrade_schema_mismatch',
  APPLY_WITHOUT_DRY_RUN: 'apply_without_dry_run',
  MIXED_PARTIAL_WRITES_ALLOWED: 'mixed_partial_writes_allowed',
  POST_UPGRADE_ERROR_NOT_OPERATOR_FACING: 'post_upgrade_error_not_operator_facing',
  NATIVE_SCHEMA_CONTRACT_INVALID: 'native_schema_contract_invalid',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  MISSING_REASON: 'missing_reason',
});

const PHASE8R_BACKUP_RESTORE_REASON_IDS = Object.freeze({
  NATIVE_TABLES_ENUMERATED: 'native_tables_enumerated',
  BACKUP_RESTORE_COVERAGE_REQUIRED: 'backup_restore_coverage_required',
  RESTORE_VALIDATION_REQUIRED: 'restore_validation_required',
  SCHEMA_PARITY_REQUIRED: 'schema_parity_required',
  POST_UPGRADE_DRY_RUN_FIRST: 'post_upgrade_dry_run_first',
  APPLY_TRANSACTION_REQUIRED: 'apply_transaction_required',
  OPERATOR_ERRORS_REQUIRED: 'operator_errors_required',
  SIDE_EFFECTS_DISABLED: 'side_effects_disabled',
});

const NATIVE_TABLE_IDS = Object.freeze(Object.values(POLICY_NATIVE_SCHEMA_TABLE_IDS));
const RESTORE_VALIDATION_IDS = Object.freeze(Object.values(PHASE8R_BACKUP_RESTORE_VALIDATION_IDS));
const OPERATOR_ERROR_IDS = Object.freeze(Object.values(PHASE8R_POST_UPGRADE_OPERATOR_ERROR_IDS));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueNormalizedStrings(values) {
  return [...new Set(asArray(values).map(normalizeString).filter(Boolean))];
}

function normalizeBoolean(value) {
  return value === true;
}

function buildReason(reasonId, message) {
  return { reasonId, message };
}

function buildTableCoverage({ backupTableIds = [], restoreTableIds = [] } = {}) {
  const backupSet = new Set(uniqueNormalizedStrings(backupTableIds));
  const restoreSet = new Set(uniqueNormalizedStrings(restoreTableIds));

  return NATIVE_TABLE_IDS.map(tableId => ({
    tableId,
    required: true,
    includedInBackup: backupSet.has(tableId),
    includedInRestore: restoreSet.has(tableId),
  }));
}

function getMissingBackupTableIds(tableCoverage = []) {
  return asArray(tableCoverage)
    .filter(table => table.required === true && table.includedInBackup !== true)
    .map(table => table.tableId);
}

function getMissingRestoreTableIds(tableCoverage = []) {
  return asArray(tableCoverage)
    .filter(table => table.required === true && table.includedInRestore !== true)
    .map(table => table.tableId);
}

function buildRestoreValidations({ restoreValidationIds = [] } = {}) {
  const validationSet = new Set(uniqueNormalizedStrings(restoreValidationIds));

  return RESTORE_VALIDATION_IDS.map(validationId => ({
    validationId,
    required: true,
    provided: validationSet.has(validationId),
  }));
}

function getMissingRestoreValidationIds(restoreValidations = []) {
  return asArray(restoreValidations)
    .filter(validation => validation.required === true && validation.provided !== true)
    .map(validation => validation.validationId);
}

function buildSchemaParity({
  nativeSchemaContract = buildPolicyNativeSchemaContract(),
  schemaParity = {},
} = {}) {
  const nativeSchemaValidation = validatePolicyNativeSchemaContract(nativeSchemaContract);
  const freshInstallSchemaVersion = schemaParity.freshInstallSchemaVersion ?? null;
  const upgradedInstallSchemaVersion = schemaParity.upgradedInstallSchemaVersion ?? null;
  const freshInstallChecksum = schemaParity.freshInstallChecksum ?? null;
  const upgradedInstallChecksum = schemaParity.upgradedInstallChecksum ?? null;
  const versionedSchemaCheck =
    normalizeBoolean(schemaParity.versionedSchemaCheck) ||
    (freshInstallSchemaVersion !== null && upgradedInstallSchemaVersion !== null);
  const matches = normalizeBoolean(schemaParity.matches) &&
    nativeSchemaValidation.ok === true &&
    versionedSchemaCheck === true &&
    freshInstallSchemaVersion !== null &&
    upgradedInstallSchemaVersion !== null &&
    freshInstallSchemaVersion === upgradedInstallSchemaVersion &&
    (
      freshInstallChecksum === null ||
      upgradedInstallChecksum === null ||
      freshInstallChecksum === upgradedInstallChecksum
    );

  return {
    matches,
    versionedSchemaCheck,
    freshInstallSchemaVersion,
    upgradedInstallSchemaVersion,
    freshInstallChecksum,
    upgradedInstallChecksum,
    nativeSchemaValidation,
  };
}

function normalizeTransactionBoundary(transactionBoundary = {}) {
  return {
    atomicNativeConversion: normalizeBoolean(transactionBoundary.atomicNativeConversion),
    rollbackOnFailure: normalizeBoolean(transactionBoundary.rollbackOnFailure),
    legacyRemainsActiveUntilCommit: normalizeBoolean(
      transactionBoundary.legacyRemainsActiveUntilCommit
    ),
    mixedPartialWritesPrevented: normalizeBoolean(transactionBoundary.mixedPartialWritesPrevented),
  };
}

function isTransactionBoundarySafe(transactionBoundary = {}) {
  return transactionBoundary.atomicNativeConversion === true &&
    transactionBoundary.rollbackOnFailure === true &&
    transactionBoundary.legacyRemainsActiveUntilCommit === true &&
    transactionBoundary.mixedPartialWritesPrevented === true;
}

function buildPostUpgradeSafety({
  postUpgrade = {},
  transactionBoundary = {},
} = {}) {
  const modeId = Object.values(PHASE8R_BACKUP_RESTORE_MODE_IDS)
    .includes(postUpgrade.modeId)
    ? postUpgrade.modeId
    : PHASE8R_BACKUP_RESTORE_MODE_IDS.REPORT_ONLY;
  const normalizedTransactionBoundary = normalizeTransactionBoundary(transactionBoundary);
  const dryRunReportReady = normalizeBoolean(postUpgrade.dryRunReportReady);
  const applyModeRequested = modeId === PHASE8R_BACKUP_RESTORE_MODE_IDS.APPLY ||
    normalizeBoolean(postUpgrade.applyModeRequested);
  const operatorErrorIds = uniqueNormalizedStrings(postUpgrade.operatorErrorIds);
  const missingOperatorErrorIds = OPERATOR_ERROR_IDS
    .filter(errorId => !operatorErrorIds.includes(errorId));

  return {
    modeId,
    dryRunReportReady,
    applyModeRequested,
    transactionBoundary: normalizedTransactionBoundary,
    transactionSafe: isTransactionBoundarySafe(normalizedTransactionBoundary),
    operatorErrorIds,
    missingOperatorErrorIds,
  };
}

function buildSideEffects(sideEffects = {}) {
  return {
    backupWritten: normalizeBoolean(sideEffects.backupWritten),
    restoreApplied: normalizeBoolean(sideEffects.restoreApplied),
    postUpgradeApplied: normalizeBoolean(sideEffects.postUpgradeApplied),
    schemaMutated: normalizeBoolean(sideEffects.schemaMutated),
  };
}

function hasSideEffects(sideEffects = {}) {
  return Object.values(sideEffects).some(Boolean);
}

function determineStatus({
  schemaParity,
  missingBackupTableIds,
  missingRestoreTableIds,
  missingRestoreValidationIds,
  postUpgradeSafety,
}) {
  if (schemaParity.matches !== true) {
    return PHASE8R_BACKUP_RESTORE_STATUS_IDS.BLOCKED_BY_SCHEMA_MISMATCH;
  }

  if (
    missingBackupTableIds.length > 0 ||
    missingRestoreTableIds.length > 0 ||
    missingRestoreValidationIds.length > 0
  ) {
    return PHASE8R_BACKUP_RESTORE_STATUS_IDS.BLOCKED_BY_BACKUP_RESTORE_GAPS;
  }

  if (postUpgradeSafety.dryRunReportReady !== true) {
    return PHASE8R_BACKUP_RESTORE_STATUS_IDS.BLOCKED_BY_POST_UPGRADE_DRY_RUN;
  }

  if (postUpgradeSafety.transactionSafe !== true) {
    return PHASE8R_BACKUP_RESTORE_STATUS_IDS.BLOCKED_BY_TRANSACTION_SAFETY;
  }

  return PHASE8R_BACKUP_RESTORE_STATUS_IDS.READY_FOR_OPERATIONAL_APPLY;
}

function buildBlockers({
  schemaParity,
  missingBackupTableIds,
  missingRestoreTableIds,
  missingRestoreValidationIds,
  postUpgradeSafety,
}) {
  const blockers = [];

  if (schemaParity.matches !== true) {
    blockers.push({
      blockerId: 'schema_parity_not_proven',
      message: 'Fresh-install and upgraded-install native schemas must match before apply mode.',
    });
  }

  missingBackupTableIds.forEach(tableId => {
    blockers.push({
      blockerId: 'native_table_missing_from_backup',
      tableId,
      message: 'Native intent table is not included in backup coverage.',
    });
  });

  missingRestoreTableIds.forEach(tableId => {
    blockers.push({
      blockerId: 'native_table_missing_from_restore',
      tableId,
      message: 'Native intent table is not included in restore coverage.',
    });
  });

  missingRestoreValidationIds.forEach(validationId => {
    blockers.push({
      blockerId: 'restore_validation_missing',
      validationId,
      message: 'Required native restore validation is not provided.',
    });
  });

  if (postUpgradeSafety.dryRunReportReady !== true) {
    blockers.push({
      blockerId: 'post_upgrade_dry_run_missing',
      message: 'Post-upgrade native conversion must emit a dry-run report before apply mode.',
    });
  }

  if (postUpgradeSafety.transactionSafe !== true) {
    blockers.push({
      blockerId: 'post_upgrade_transaction_boundary_missing',
      transactionBoundary: postUpgradeSafety.transactionBoundary,
      message: 'Post-upgrade apply must be atomic and rollback mixed partial writes on failure.',
    });
  }

  if (postUpgradeSafety.missingOperatorErrorIds.length > 0) {
    blockers.push({
      blockerId: 'operator_facing_errors_missing',
      missingOperatorErrorIds: postUpgradeSafety.missingOperatorErrorIds,
      message: 'Operator-facing migration error IDs must be present before operational apply.',
    });
  }

  return blockers;
}

function buildPolicyBuilderPhase8BackupRestoreSafetyPlan({
  nativeSchemaContract = buildPolicyNativeSchemaContract(),
  backupTableIds = [],
  restoreTableIds = [],
  restoreValidationIds = [],
  schemaParity = {},
  postUpgrade = {},
  transactionBoundary = {},
  sideEffects = {},
} = {}) {
  const tableCoverage = buildTableCoverage({ backupTableIds, restoreTableIds });
  const restoreValidations = buildRestoreValidations({ restoreValidationIds });
  const normalizedSchemaParity = buildSchemaParity({ nativeSchemaContract, schemaParity });
  const postUpgradeSafety = buildPostUpgradeSafety({ postUpgrade, transactionBoundary });
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const missingBackupTableIds = getMissingBackupTableIds(tableCoverage);
  const missingRestoreTableIds = getMissingRestoreTableIds(tableCoverage);
  const missingRestoreValidationIds = getMissingRestoreValidationIds(restoreValidations);
  const statusId = determineStatus({
    schemaParity: normalizedSchemaParity,
    missingBackupTableIds,
    missingRestoreTableIds,
    missingRestoreValidationIds,
    postUpgradeSafety,
  });

  const plan = {
    contractVersion: PHASE8R_BACKUP_RESTORE_SAFETY_VERSION,
    statusId,
    readyForOperationalApply:
      statusId === PHASE8R_BACKUP_RESTORE_STATUS_IDS.READY_FOR_OPERATIONAL_APPLY &&
      postUpgradeSafety.missingOperatorErrorIds.length === 0 &&
      hasSideEffects(normalizedSideEffects) === false,
    requiredNativeTableIds: NATIVE_TABLE_IDS,
    tableCoverage,
    restoreValidations,
    schemaParity: normalizedSchemaParity,
    postUpgradeSafety,
    blockers: buildBlockers({
      schemaParity: normalizedSchemaParity,
      missingBackupTableIds,
      missingRestoreTableIds,
      missingRestoreValidationIds,
      postUpgradeSafety,
    }),
    sideEffects: normalizedSideEffects,
    reasons: [
      buildReason(
        PHASE8R_BACKUP_RESTORE_REASON_IDS.NATIVE_TABLES_ENUMERATED,
        'Native intent storage tables are enumerated from the native schema contract.'
      ),
      buildReason(
        PHASE8R_BACKUP_RESTORE_REASON_IDS.BACKUP_RESTORE_COVERAGE_REQUIRED,
        'Every native intent table must be included in backup and restore coverage.'
      ),
      buildReason(
        PHASE8R_BACKUP_RESTORE_REASON_IDS.RESTORE_VALIDATION_REQUIRED,
        'Restore validation must prove native policy recovery, rollback snapshots, migration events, and schema version checks.'
      ),
      buildReason(
        PHASE8R_BACKUP_RESTORE_REASON_IDS.SCHEMA_PARITY_REQUIRED,
        'Fresh-install and upgraded-install schemas must match before native storage becomes default.'
      ),
      buildReason(
        PHASE8R_BACKUP_RESTORE_REASON_IDS.POST_UPGRADE_DRY_RUN_FIRST,
        'Post-upgrade native conversion requires a dry-run report before apply mode.'
      ),
      buildReason(
        PHASE8R_BACKUP_RESTORE_REASON_IDS.APPLY_TRANSACTION_REQUIRED,
        'Apply mode must be atomic and must reject mixed partial native/legacy writes.'
      ),
      buildReason(
        PHASE8R_BACKUP_RESTORE_REASON_IDS.OPERATOR_ERRORS_REQUIRED,
        'Migration blockers and failures must produce clear operator-facing error IDs.'
      ),
      buildReason(
        PHASE8R_BACKUP_RESTORE_REASON_IDS.SIDE_EFFECTS_DISABLED,
        'This Phase 8R.8 component only plans and validates operational safety; it does not mutate storage.'
      ),
    ],
    nextPhase: {
      phaseId: '8r_9',
      label: 'Native Storage Test Reset',
      reason:
        'Backup, restore, and post-upgrade safety are defined; final storage tests can now reset around native behavior.',
    },
  };

  return {
    ...plan,
    validation: validatePolicyBuilderPhase8BackupRestoreSafetyPlan(plan),
  };
}

function validatePolicyBuilderPhase8BackupRestoreSafetyPlan(plan = {}) {
  const issues = [];
  const tableCoverage = asArray(plan.tableCoverage);
  const restoreValidations = asArray(plan.restoreValidations);
  const tableIds = new Set(tableCoverage.map(table => table.tableId));
  const validationIds = new Set(restoreValidations.map(validation => validation.validationId));

  NATIVE_TABLE_IDS.forEach(tableId => {
    if (!tableIds.has(tableId)) {
      issues.push({
        riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_NATIVE_TABLE_BACKUP,
        tableId,
        message: 'Native table is missing from backup/restore coverage declaration.',
      });
      return;
    }

    const table = tableCoverage.find(candidate => candidate.tableId === tableId);
    if (table?.includedInBackup !== true) {
      issues.push({
        riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_NATIVE_TABLE_BACKUP,
        tableId,
        message: 'Native table is not included in backup coverage.',
      });
    }
    if (table?.includedInRestore !== true) {
      issues.push({
        riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_NATIVE_TABLE_RESTORE,
        tableId,
        message: 'Native table is not included in restore coverage.',
      });
    }
  });

  RESTORE_VALIDATION_IDS.forEach(validationId => {
    if (!validationIds.has(validationId)) {
      issues.push({
        riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_RESTORE_VALIDATION,
        validationId,
        message: 'Required restore validation is missing from the safety plan.',
      });
      return;
    }

    const validation = restoreValidations.find(candidate => candidate.validationId === validationId);
    if (validation?.provided !== true) {
      issues.push({
        riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_RESTORE_VALIDATION,
        validationId,
        message: 'Required restore validation has not been provided.',
      });
    }
  });

  if (plan.schemaParity?.nativeSchemaValidation?.ok !== true) {
    issues.push({
      riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.NATIVE_SCHEMA_CONTRACT_INVALID,
      message: 'Native schema contract must validate before operational safety can pass.',
    });
  }

  if (plan.schemaParity?.versionedSchemaCheck !== true) {
    issues.push({
      riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_SCHEMA_VERSION_CHECK,
      message: 'Versioned schema check is required for backup/restore and post-upgrade safety.',
    });
  }

  if (plan.schemaParity?.matches !== true) {
    issues.push({
      riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.FRESH_UPGRADE_SCHEMA_MISMATCH,
      message: 'Fresh install and upgraded install schema parity has not been proven.',
    });
  }

  if (
    plan.postUpgradeSafety?.applyModeRequested === true &&
    plan.postUpgradeSafety?.dryRunReportReady !== true
  ) {
    issues.push({
      riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.APPLY_WITHOUT_DRY_RUN,
      message: 'Post-upgrade apply mode cannot run without a current dry-run report.',
    });
  }

  if (plan.postUpgradeSafety?.transactionSafe !== true) {
    issues.push({
      riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.MIXED_PARTIAL_WRITES_ALLOWED,
      message: 'Post-upgrade apply safety must prevent mixed partial native/legacy writes.',
    });
  }

  asArray(plan.postUpgradeSafety?.missingOperatorErrorIds).forEach(errorId => {
    issues.push({
      riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.POST_UPGRADE_ERROR_NOT_OPERATOR_FACING,
      errorId,
      message: 'Operator-facing migration error ID is missing.',
    });
  });

  if (hasSideEffects(plan.sideEffects)) {
    issues.push({
      riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.SIDE_EFFECT_PERFORMED,
      message: 'Phase 8R.8 safety planning must not write backups, apply restores, mutate schemas, or run post-upgrade apply.',
    });
  }

  if (asArray(plan.reasons).length === 0) {
    issues.push({
      riskId: PHASE8R_BACKUP_RESTORE_RISK_IDS.MISSING_REASON,
      message: 'Safety plan must explain its operational boundaries.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyBuilderPhase8BackupRestoreSafetyAudit(
  plan = buildPolicyBuilderPhase8BackupRestoreSafetyPlan()
) {
  const validation = validatePolicyBuilderPhase8BackupRestoreSafetyPlan(plan);
  const missingBackupTableIds = getMissingBackupTableIds(plan.tableCoverage);
  const missingRestoreTableIds = getMissingRestoreTableIds(plan.tableCoverage);
  const missingRestoreValidationIds = getMissingRestoreValidationIds(plan.restoreValidations);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: plan.statusId,
    readyForOperationalApply: plan.readyForOperationalApply === true,
    nativeTableCount: asArray(plan.requiredNativeTableIds).length,
    missingBackupTableIds,
    missingRestoreTableIds,
    missingRestoreValidationIds,
    missingOperatorErrorIds: asArray(plan.postUpgradeSafety?.missingOperatorErrorIds),
    nextPhase: plan.nextPhase || {
      phaseId: '8r_9',
      label: 'Native Storage Test Reset',
      reason:
        'Operational safety is defined; native storage test coverage can now reset around final behavior.',
    },
    validation,
  };
}

export {
  PHASE8R_BACKUP_RESTORE_MODE_IDS,
  PHASE8R_BACKUP_RESTORE_REASON_IDS,
  PHASE8R_BACKUP_RESTORE_RISK_IDS,
  PHASE8R_BACKUP_RESTORE_SAFETY_VERSION,
  PHASE8R_BACKUP_RESTORE_STATUS_IDS,
  PHASE8R_BACKUP_RESTORE_VALIDATION_IDS,
  PHASE8R_POST_UPGRADE_OPERATOR_ERROR_IDS,
  buildPolicyBuilderPhase8BackupRestoreSafetyAudit,
  buildPolicyBuilderPhase8BackupRestoreSafetyPlan,
  validatePolicyBuilderPhase8BackupRestoreSafetyPlan,
};
