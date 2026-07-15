import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS,
  POLICY_STORAGE_COMPLETION_COMPONENTS,
  buildPolicyStorageCompletionCheckpoint,
} from './policyStorageCompletionCheckpoint.mjs';

const POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_VERSION =
  'policy.storage_closure_evidence_run.v1';

const POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED_BY_CHECKPOINT: 'blocked_by_checkpoint',
  BLOCKED_BY_ARTIFACT_INVENTORY: 'blocked_by_artifact_inventory',
});

const POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS = Object.freeze({
  MISSING_ARTIFACT_INVENTORY: 'missing_artifact_inventory',
  CHECKPOINT_NOT_COMPLETE: 'checkpoint_not_complete',
  CHECKPOINT_VALIDATION_FAILED: 'checkpoint_validation_failed',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
});

const POLICY_STORAGE_CLOSURE_COMPLETION_CHECKPOINT_COMPONENT = Object.freeze({
  componentId: 'storage_completion_checkpoint',
  label: 'Policy Storage Completion Checkpoint',
});

const POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP = Object.freeze([
  {
    componentId: 'native_schema_contract',
    label: 'Native Schema Contract',
    designDocPaths: ['docs/architecture/policy-native-schema-contract.md'],
    contractPaths: [
      'server/src/services/policyNativeSchemaContract.mjs',
      'database/migrations/20260701_160000_add_policy_intent_native_storage.sql',
    ],
    testPaths: [
      'server/src/__tests__/services/policyNativeSchemaContract.test.mjs',
      'server/src/__tests__/migrations.test.mjs',
    ],
  },
  {
    componentId: 'active_native_intent_integrity_correction',
    label: 'Active Native Intent Integrity Correction',
    designDocPaths: ['docs/architecture/policy-active-intent-integrity-correction.md'],
    contractPaths: [
      'server/src/services/policyActiveIntentIntegrity.mjs',
      'database/migrations/20260713_150000_enforce_single_active_policy_intent.sql',
    ],
    testPaths: [
      'server/src/__tests__/services/policyActiveIntentIntegrity.test.mjs',
      'server/src/__tests__/integration/policy-active-intent-integrity.test.mjs',
    ],
  },
  {
    componentId: 'migration_candidate_report',
    label: 'Migration Candidate Report',
    designDocPaths: [
      'docs/architecture/policy-intent-migration-candidate-report.md',
      'docs/architecture/policy-intent-migration-candidate-report-module-cutover.md',
    ],
    contractPaths: ['server/src/services/policyIntentMigrationCandidateReport.mjs'],
    testPaths: ['server/src/__tests__/services/policyIntentMigrationCandidateReport.test.mjs'],
  },
  {
    componentId: 'candidate_authority_eligibility',
    label: 'Candidate Authority Eligibility',
    designDocPaths: ['docs/architecture/policy-candidate-authority-eligibility.md'],
    contractPaths: ['server/src/services/policyCandidateAuthorityEligibility.mjs'],
    testPaths: ['server/src/__tests__/services/policyCandidateAuthorityEligibility.test.mjs'],
  },
  {
    componentId: 'explicit_conversion_workflow',
    label: 'Explicit Conversion Workflow',
    designDocPaths: [
      'docs/architecture/policy-intent-conversion-workflow.md',
      'docs/architecture/policy-intent-conversion-workflow-module-cutover.md',
    ],
    contractPaths: ['server/src/services/policyIntentConversionWorkflow.mjs'],
    testPaths: ['server/src/__tests__/services/policyIntentConversionWorkflow.test.mjs'],
  },
  {
    componentId: 'native_runtime_read_path',
    label: 'Native Runtime Read Path',
    designDocPaths: ['docs/architecture/policy-intent-runtime-read-path.md'],
    contractPaths: ['server/src/services/policyIntentRuntimeReadPath.mjs'],
    testPaths: ['server/src/__tests__/services/policyIntentRuntimeReadPath.test.mjs'],
  },
  {
    componentId: 'runtime_authority_selection_integrity',
    label: 'Runtime Authority Selection Integrity',
    designDocPaths: [
      'docs/architecture/policy-native-runtime-authority-selection-integrity.md',
    ],
    contractPaths: [
      'server/src/services/policyNativeIntentAuthority.mjs',
      'server/src/services/policyNativeIntentAuthorityLock.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyNativeIntentAuthority.test.mjs',
      'server/src/__tests__/services/policyNativeIntentAuthorityLock.test.mjs',
    ],
  },
  {
    componentId: 'rollback_snapshot_reversion_window',
    label: 'Rollback Snapshot And Reversion Window',
    designDocPaths: ['docs/architecture/policy-rollback-snapshot-window.md'],
    contractPaths: ['server/src/services/policyRollbackSnapshotWindow.mjs'],
    testPaths: [
      'server/src/__tests__/services/policyRollbackSnapshotWindow.test.mjs',
    ],
  },
  {
    componentId: 'transactional_native_authority_reversion',
    label: 'Transactional Native Authority Reversion',
    designDocPaths: ['docs/architecture/policy-native-intent-reversion.md'],
    contractPaths: [
      'server/src/services/policyNativeIntentReversionContract.mjs',
      'server/src/services/policyNativeIntentReversionService.mjs',
      'server/src/services/policyNativeIntentReversionPersistence.mjs',
      'server/src/routes/policiesRouteNativeIntentReversion.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyNativeIntentReversionService.test.mjs',
      'server/src/__tests__/policies-native-intent-reversion-routes.test.mjs',
    ],
  },
  {
    componentId: 'rollback_snapshot_retention_cleanup',
    label: 'Rollback Snapshot Retention Cleanup',
    designDocPaths: ['docs/architecture/policy-rollback-snapshot-retention.md'],
    contractPaths: [
      'server/src/services/policyRollbackSnapshotRetentionContract.mjs',
      'server/src/services/policyRollbackSnapshotRetentionPersistence.mjs',
      'server/src/services/policyRollbackSnapshotRetentionService.mjs',
      'server/src/services/schedulerRetentionService.mjs',
      'server/src/services/scheduler.mjs',
      'database/migrations/20260714_090000_add_policy_rollback_snapshot_retention_event.sql',
      'database/schema/current.sql',
    ],
    testPaths: [
      'server/src/__tests__/services/policyRollbackSnapshotRetentionService.test.mjs',
      'server/src/__tests__/services/policyRollbackSnapshotWindow.test.mjs',
      'server/src/__tests__/schedulerRetentionService.test.mjs',
      'server/src/__tests__/services/backupRestoreTables.nativePolicyIntent.test.mjs',
      'server/src/__tests__/migrations.test.mjs',
    ],
  },
  {
    componentId: 'legacy_write_path_shutdown',
    label: 'Legacy Write Path Shutdown',
    designDocPaths: ['docs/architecture/policy-legacy-write-boundary.md'],
    contractPaths: ['server/src/services/policyLegacyWriteBoundary.mjs'],
    testPaths: ['server/src/__tests__/services/policyLegacyWriteBoundary.test.mjs'],
  },
  {
    componentId: 'legacy_code_deletion_gates',
    label: 'Legacy Code Deletion Gates',
    designDocPaths: ['docs/architecture/policy-compatibility-deletion-gates.md'],
    contractPaths: ['server/src/services/policyCompatibilityDeletionGates.mjs'],
    testPaths: ['server/src/__tests__/services/policyCompatibilityDeletionGates.test.mjs'],
  },
  {
    componentId: 'backup_restore_post_upgrade_safety',
    label: 'Backup, Restore, And Post-Upgrade Safety',
    designDocPaths: ['docs/architecture/policy-native-storage-operational-safety.md'],
    contractPaths: ['server/src/services/policyNativeStorageOperationalSafety.mjs'],
    testPaths: ['server/src/__tests__/services/policyNativeStorageOperationalSafety.test.mjs'],
  },
  {
    componentId: 'native_storage_test_reset',
    label: 'Native Storage Test Reset',
    designDocPaths: ['docs/architecture/policy-native-storage-test-reset.md'],
    contractPaths: ['server/src/services/policyNativeStorageTestReset.mjs'],
    testPaths: ['server/src/__tests__/services/policyNativeStorageTestReset.test.mjs'],
  },
  {
    componentId: 'native_backup_restore_wiring',
    label: 'Native Backup And Restore Wiring',
    designDocPaths: ['docs/architecture/policy-native-backup-restore-wiring.md'],
    contractPaths: [
      'server/src/services/backupService.mjs',
      'server/src/services/backupRestore.mjs',
      'server/src/services/backupRestoreTables.mjs',
    ],
    testPaths: [
      'server/src/__tests__/backupService.evidence.test.mjs',
      'server/src/__tests__/integration/backup-lifecycle.test.mjs',
    ],
  },
  {
    componentId: 'post_upgrade_dry_run_wiring',
    label: 'Post-Upgrade Dry-Run Wiring',
    designDocPaths: ['docs/architecture/policy-post-upgrade-dry-run-wiring.md'],
    contractPaths: [
      'server/src/services/policyPostUpgradeDryRun.mjs',
      'server/src/services/postUpgradeService.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyPostUpgradeDryRun.test.mjs'],
  },
  {
    componentId: 'post_upgrade_apply_gate',
    label: 'Post-Upgrade Apply Gate',
    designDocPaths: ['docs/architecture/policy-post-upgrade-apply-gate.md'],
    contractPaths: [
      'server/src/services/policyPostUpgradeApplyGate.mjs',
      'server/src/services/postUpgradeService.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyPostUpgradeApplyGate.test.mjs'],
  },
  {
    componentId: 'native_runtime_cutover_verification',
    label: 'Native Runtime Cutover Verification',
    designDocPaths: ['docs/architecture/policy-native-runtime-cutover-verification.md'],
    contractPaths: [
      'server/src/services/policyNativeRuntimeCutoverVerification.mjs',
      'server/src/services/policyNativePolicyReadService.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyNativeRuntimeCutoverVerification.test.mjs',
      'server/src/__tests__/services/policyNativePolicyReadService.test.mjs',
    ],
  },
  {
    componentId: 'compatibility_path_deletion_readiness',
    label: 'Compatibility Path Deletion Readiness',
    designDocPaths: [
      'docs/architecture/policy-compatibility-deletion-readiness.md',
      'docs/architecture/policy-compatibility-deletion-current-inventory.md',
    ],
    contractPaths: [
      'server/src/services/policyCompatibilityDeletionReadiness.mjs',
      'server/src/services/policyCompatibilityDeletionCurrentInventory.mjs',
      'scripts/generate-policy-compatibility-deletion-current-inventory.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyCompatibilityDeletionReadiness.test.mjs',
      'server/src/__tests__/services/policyCompatibilityDeletionCurrentInventory.test.mjs',
    ],
  },
  {
    componentId: 'compatibility_path_deletion_execution_plan',
    label: 'Compatibility Path Deletion Execution Plan',
    designDocPaths: [
      'docs/architecture/policy-compatibility-deletion-execution-plan.md',
      'docs/architecture/policy-compatibility-deletion-execution-plan-evidence-bundle.md',
      'docs/architecture/policy-compatibility-deletion-execution-plan-artifact.md',
      'docs/architecture/policy-compatibility-deletion-execution-artifact-fingerprint.md',
    ],
    contractPaths: [
      'server/src/services/policyCompatibilityDeletionExecutionPlan.mjs',
      'server/src/services/policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs',
      'server/src/services/policyCompatibilityDeletionExecutionPlanArtifact.mjs',
      'server/src/services/policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs',
      'scripts/generate-policy-compatibility-deletion-execution-plan-evidence-bundle.mjs',
      'scripts/generate-policy-compatibility-deletion-execution-plan-artifact.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyCompatibilityDeletionExecutionPlan.test.mjs',
      'server/src/__tests__/services/policyCompatibilityDeletionExecutionPlanEvidenceBundle.test.mjs',
      'server/src/__tests__/services/policyCompatibilityDeletionExecutionPlanArtifact.test.mjs',
      'server/src/__tests__/services/policyCompatibilityDeletionExecutionPlanArtifactFingerprint.test.mjs',
    ],
  },
  {
    componentId: 'compatibility_path_deletion_execution_gate',
    label: 'Compatibility Path Deletion Execution Gate',
    designDocPaths: [
      'docs/architecture/policy-compatibility-deletion-execution-gate.md',
      'docs/architecture/policy-compatibility-deletion-execution-artifact-fingerprint.md',
    ],
    contractPaths: ['server/src/services/policyCompatibilityDeletionExecutionGate.mjs'],
    testPaths: [
      'server/src/__tests__/services/policyCompatibilityDeletionExecutionGate.test.mjs',
      'server/src/__tests__/scripts/generatePolicyControlledCompatibilityRemovalBatchArtifact.test.mjs',
    ],
  },
  {
    componentId: 'controlled_compatibility_path_removal',
    label: 'Controlled Compatibility Path Removal',
    designDocPaths: [
      'docs/architecture/policy-controlled-compatibility-path-removal.md',
      'docs/architecture/policy-controlled-compatibility-path-removal-artifact-cohesion.md',
    ],
    contractPaths: ['server/src/services/policyControlledCompatibilityPathRemoval.mjs'],
    testPaths: ['server/src/__tests__/services/policyControlledCompatibilityPathRemoval.test.mjs'],
  },
  {
    componentId: 'controlled_compatibility_path_removal_apply',
    label: 'Controlled Compatibility Path Removal Apply',
    designDocPaths: [
      'docs/architecture/policy-controlled-compatibility-path-removal-apply.md',
      'docs/architecture/policy-controlled-compatibility-path-removal-review-artifact-integrity.md',
    ],
    contractPaths: [
      'server/src/services/policyControlledCompatibilityPathRemovalApply.mjs',
      'server/src/services/policyControlledCompatibilityPathRemovalReviewArtifact.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyControlledCompatibilityPathRemovalApply.test.mjs',
      'server/src/__tests__/services/policyControlledCompatibilityPathRemovalReviewArtifact.test.mjs',
    ],
  },
  {
    componentId: 'post_removal_runtime_verification',
    label: 'Post-Removal Runtime Verification',
    designDocPaths: [
      'docs/architecture/policy-post-removal-runtime-verification.md',
      'docs/architecture/policy-post-removal-runtime-evidence-integrity.md',
    ],
    contractPaths: [
      'server/src/services/policyPostRemovalRuntimeVerification.mjs',
      'server/src/services/policyPostRemovalRuntimeEvidenceArtifact.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyPostRemovalRuntimeVerification.test.mjs',
      'server/src/__tests__/services/policyPostRemovalRuntimeEvidenceArtifact.test.mjs',
    ],
  },
  {
    componentId: 'next_compatibility_removal_batch_authorization',
    label: 'Next Compatibility Removal Batch Authorization',
    designDocPaths: [
      'docs/architecture/policy-next-compatibility-removal-batch-authorization.md',
      'docs/architecture/policy-next-compatibility-removal-batch-authorization-artifact-integrity.md',
      'docs/architecture/policy-next-compatibility-removal-batch-authorization-artifact-exporter.md',
    ],
    contractPaths: [
      'server/src/services/policyNextCompatibilityRemovalBatchAuthorization.mjs',
      'server/src/services/policyNextCompatibilityRemovalBatchAuthorizationPathStateSource.mjs',
      'server/src/services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs',
      'server/src/services/policyNextCompatibilityRemovalBatchAuthorizationArtifactFingerprint.mjs',
      'server/src/services/policyPostRemovalRuntimeEvidenceArtifact.mjs',
      'scripts/generate-policy-next-batch-authorization.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyNextCompatibilityRemovalBatchAuthorization.test.mjs',
      'server/src/__tests__/services/policyNextCompatibilityRemovalBatchAuthorizationPathStateSource.test.mjs',
      'server/src/__tests__/services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.test.mjs',
      'server/src/__tests__/scripts/generatePolicyNextBatchAuthorization.test.mjs',
    ],
  },
  {
    componentId: 'compatibility_removal_completion_audit',
    label: 'Compatibility Removal Completion Audit',
    designDocPaths: [
      'docs/architecture/policy-compatibility-removal-completion-audit.md',
      'docs/architecture/policy-compatibility-removal-completion-audit-artifact-exporter.md',
      'docs/architecture/policy-compatibility-removal-completion-audit-artifact-integrity.md',
      'docs/architecture/policy-storage-completion-checkpoint-artifact-integrity.md',
    ],
    contractPaths: [
      'server/src/services/policyCompatibilityRemovalCompletionAudit.mjs',
      'server/src/services/policyCompatibilityRemovalCompletionAuditArtifact.mjs',
      'server/src/services/policyCompatibilityRemovalCompletionAuditArtifactFingerprint.mjs',
      'server/src/services/policyCompatibilityRemovalCompletionAuditArtifactIntegrity.mjs',
      'server/src/services/policyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity.mjs',
      'scripts/generate-policy-compatibility-removal-completion-audit.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyCompatibilityRemovalCompletionAudit.test.mjs',
      'server/src/__tests__/services/policyCompatibilityRemovalCompletionAuditArtifact.test.mjs',
      'server/src/__tests__/services/policyCompatibilityRemovalCompletionAuditArtifactIntegrity.test.mjs',
      'server/src/__tests__/services/policyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity.test.mjs',
      'server/src/__tests__/scripts/generatePolicyCompatibilityRemovalCompletionAudit.test.mjs',
    ],
  },
  {
    componentId: 'compatibility_removal_evidence_regeneration',
    label: 'Compatibility-Removal Evidence Regeneration',
    designDocPaths: [
      'docs/architecture/policy-compatibility-removal-evidence-regeneration.md',
    ],
    contractPaths: [
      'server/src/services/policyCompatibilityRemovalEvidenceRegeneration.mjs',
      'scripts/generate-policy-compatibility-removal-evidence.mjs',
      'scripts/lib/policyStorageClosureReferenceScanner.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyCompatibilityRemovalEvidenceRegeneration.test.mjs',
      'server/src/__tests__/scripts/generatePolicyCompatibilityRemovalEvidence.test.mjs',
      'server/src/__tests__/scripts/policyStorageClosureReferenceScanner.test.mjs',
    ],
  },
  {
    componentId: 'storage_completion_checkpoint',
    label: 'Policy Storage Completion Checkpoint',
    designDocPaths: [
      'docs/architecture/policy-storage-completion-checkpoint.md',
      'docs/architecture/policy-storage-completion-checkpoint-artifact-exporter.md',
      'docs/architecture/policy-storage-completion-checkpoint-artifact-integrity.md',
      'docs/architecture/policy-storage-completion-checkpoint-artifact-integrity-boundary.md',
      'docs/architecture/policy-storage-final-closure-readout.md',
    ],
    contractPaths: [
      'server/src/services/policyStorageCompletionCheckpoint.mjs',
      'server/src/services/policyStorageCompletionCheckpointArtifact.mjs',
      'server/src/services/policyStorageCompletionCheckpointArtifactFingerprint.mjs',
      'server/src/services/policyStorageCompletionCheckpointArtifactIntegrity.mjs',
      'scripts/generate-policy-storage-completion-checkpoint.mjs',
      'server/src/services/policyStorageFinalClosureReadout.mjs',
      'scripts/generate-policy-storage-final-closure-readout.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyStorageCompletionCheckpoint.test.mjs',
      'server/src/__tests__/services/policyStorageCompletionCheckpointArtifact.test.mjs',
      'server/src/__tests__/services/policyStorageCompletionCheckpointArtifactFingerprint.test.mjs',
      'server/src/__tests__/services/policyStorageCompletionCheckpointArtifactIntegrity.test.mjs',
      'server/src/__tests__/scripts/generatePolicyStorageCompletionCheckpoint.test.mjs',
      'server/src/__tests__/services/policyStorageFinalClosureReadout.test.mjs',
      'server/src/__tests__/scripts/generatePolicyStorageFinalClosureReadout.test.mjs',
    ],
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function normalizeComponentId(value = '') {
  return String(value || '').trim().toLowerCase();
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function getInventoryPathSet(artifactInventory = {}) {
  return new Set([
    ...asArray(artifactInventory.servicePaths),
    ...asArray(artifactInventory.routePaths),
    ...asArray(artifactInventory.migrationPaths),
    ...asArray(artifactInventory.testPaths),
    ...asArray(artifactInventory.docPaths),
    ...asArray(artifactInventory.wiringPaths),
    ...asArray(artifactInventory.otherPaths),
  ].map(normalizePath).filter(Boolean));
}

function allPathsPresent(paths = [], inventoryPathSet = new Set()) {
  return paths.every(path => inventoryPathSet.has(normalizePath(path)));
}

function missingPaths(paths = [], inventoryPathSet = new Set()) {
  return paths
    .map(normalizePath)
    .filter(path => path && !inventoryPathSet.has(path));
}

function buildComponentEvidence({
  componentArtifactMap = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
  artifactInventory = {},
  changelogComponentIds = [],
} = {}) {
  const inventoryPathSet = getInventoryPathSet(artifactInventory);
  const changelogComponentIdSet =
    new Set(changelogComponentIds.map(normalizeComponentId));

  return componentArtifactMap.map(component => {
    const componentId = normalizeComponentId(component.componentId);
    const missingDesignDocPaths = missingPaths(component.designDocPaths, inventoryPathSet);
    const missingContractPaths = missingPaths(component.contractPaths, inventoryPathSet);
    const missingTestPaths = missingPaths(component.testPaths, inventoryPathSet);

    return {
      componentId,
      label: component.label,
      implemented:
        allPathsPresent(component.contractPaths, inventoryPathSet) &&
        allPathsPresent(component.designDocPaths, inventoryPathSet) &&
        allPathsPresent(component.testPaths, inventoryPathSet),
      designDocPresent: missingDesignDocPaths.length === 0,
      contractEvidencePresent: missingContractPaths.length === 0,
      testEvidencePresent: missingTestPaths.length === 0,
      changelogEntryPresent: changelogComponentIdSet.has(componentId),
      missingDesignDocPaths,
      missingContractPaths,
      missingTestPaths,
    };
  });
}

function evaluateArtifactInventory({
  artifactInventory = {},
  componentEvidence = [],
} = {}) {
  const risks = [];
  const inventoryCount = getInventoryPathSet(artifactInventory).size;
  const componentsWithMissingArtifacts = asArray(componentEvidence)
    .filter(component => (
      asArray(component.missingDesignDocPaths).length > 0 ||
      asArray(component.missingContractPaths).length > 0 ||
      asArray(component.missingTestPaths).length > 0
    ));

  if (inventoryCount === 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.MISSING_ARTIFACT_INVENTORY,
      'Policy storage closure evidence run requires an explicit artifact inventory.'
    ));
  }

  return {
    inventoryCount,
    componentsWithMissingArtifacts,
    risks,
  };
}

function normalizeRoadmapEvidence(roadmapEvidence = {}) {
  return {
    ...roadmapEvidence,
    componentSequenceIds: asArray(roadmapEvidence.componentSequenceIds)
      .map(normalizeComponentId),
    implementationStatusComponentIds: asArray(roadmapEvidence.implementationStatusComponentIds)
      .map(normalizeComponentId),
  };
}

function normalizeChangelogEvidence(changelogEvidence = {}) {
  return {
    ...changelogEvidence,
    componentIds: asArray(changelogEvidence.componentIds).map(normalizeComponentId),
  };
}

function determineStatusId({ risks = [], checkpoint = {} } = {}) {
  if (risks.some(risk => (
    risk.riskId === POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.MISSING_ARTIFACT_INVENTORY
  ))) {
    return POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_ARTIFACT_INVENTORY;
  }

  if (
    checkpoint.statusId !== POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE ||
    checkpoint.complete !== true
  ) {
    return POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT;
  }

  if (checkpoint.validation?.ok !== true) {
    return POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT;
  }

  return POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS.COMPLETE;
}

async function buildPolicyStorageClosureEvidenceRun({
  artifactInventory = {},
  componentArtifactMap = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
  roadmapEvidence = {},
  completionAuditArtifact = {},
  validationEvidence = {},
  changelogEvidence = {},
  sideEffects = {},
} = {}) {
  const normalizedRoadmapEvidence = normalizeRoadmapEvidence(roadmapEvidence);
  const normalizedChangelogEvidence = normalizeChangelogEvidence(changelogEvidence);
  const componentEvidence = buildComponentEvidence({
    componentArtifactMap,
    artifactInventory,
    changelogComponentIds: normalizedChangelogEvidence.componentIds,
  });
  const artifactInventoryEvaluation = evaluateArtifactInventory({
    artifactInventory,
    componentEvidence,
  });
  const expectedComponents = [
    ...POLICY_STORAGE_COMPLETION_COMPONENTS,
    POLICY_STORAGE_CLOSURE_COMPLETION_CHECKPOINT_COMPONENT,
  ];
  const checkpoint = await buildPolicyStorageCompletionCheckpoint({
    expectedComponents,
    componentEvidence,
    roadmapEvidence: normalizedRoadmapEvidence,
    completionAuditArtifact,
    validationEvidence,
    changelogEvidence: normalizedChangelogEvidence,
  });
  const risks = [
    ...artifactInventoryEvaluation.risks,
  ];

  if (checkpoint.statusId !== POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.CHECKPOINT_NOT_COMPLETE,
      'Policy storage closure evidence run requires the policy storage completion checkpoint to complete.',
      {
        checkpointStatusId: checkpoint.statusId,
        checkpointRiskCount: checkpoint.riskCount,
      }
    ));
  }

  if (checkpoint.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.CHECKPOINT_VALIDATION_FAILED,
      'Policy storage closure evidence run requires valid checkpoint output.',
      { checkpointValidationIssueCount: checkpoint.validation?.issueCount ?? null }
    ));
  }

  const evidenceRun = {
    version: POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_VERSION,
    statusId: determineStatusId({ risks, checkpoint }),
    complete:
      risks.length === 0 &&
      checkpoint.statusId === POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE &&
      checkpoint.complete === true,
    artifactInventory: {
      inventoryCount: artifactInventoryEvaluation.inventoryCount,
      componentCount: componentEvidence.length,
      componentsWithMissingArtifactCount:
        artifactInventoryEvaluation.componentsWithMissingArtifacts.length,
      componentsWithMissingArtifacts:
        artifactInventoryEvaluation.componentsWithMissingArtifacts,
    },
    componentEvidence,
    checkpoint: {
      statusId: checkpoint.statusId,
      complete: checkpoint.complete,
      validationOk: checkpoint.validation?.ok === true,
      riskCount: checkpoint.riskCount,
      risks: checkpoint.risks,
    },
    riskCount: risks.length,
    risks,
    sideEffects: {
      filesWritten: sideEffects.filesWritten === true,
      storageChanged: sideEffects.storageChanged === true,
      gitCommandsRun: sideEffects.gitCommandsRun === true,
      commandsExecuted: sideEffects.commandsExecuted === true,
    },
    nextStep: {
      stepId: 'policy_storage_closure_evidence_complete',
      label: 'Policy Storage Closure Evidence Complete',
      reason:
        'When the evidence run is complete, the current repository evidence satisfies the policy storage closure checkpoint.',
    },
  };

  return {
    ...evidenceRun,
    validation: validatePolicyStorageClosureEvidenceRun(evidenceRun),
  };
}

function validatePolicyStorageClosureEvidenceRun(evidenceRun = {}) {
  const issues = [];

  if (!Object.values(POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS)
    .includes(evidenceRun.statusId)) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.UNKNOWN_STATUS,
      'Policy storage closure evidence run status must be known.'
    ));
  }

  if (evidenceRun.riskCount !== asArray(evidenceRun.risks).length) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.RISK_COUNT_MISMATCH,
      'Policy storage closure evidence run risk count must match risk list length.'
    ));
  }

  Object.entries(evidenceRun.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Policy storage closure evidence run cannot perform side effect "${key}".`
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
  POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
  POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_RISK_IDS,
  POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_STATUS_IDS,
  POLICY_STORAGE_CLOSURE_EVIDENCE_RUN_VERSION,
  buildPolicyStorageClosureEvidenceRun,
  validatePolicyStorageClosureEvidenceRun,
};
