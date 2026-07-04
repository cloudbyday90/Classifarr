import {
  PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS,
  PHASE8R_EXPECTED_COMPONENTS,
  buildPolicyBuilderPhase8CompletionCheckpoint,
} from './policyBuilderPhase8CompletionCheckpoint.mjs';

const PHASE8R_COMPLETION_EVIDENCE_RUN_VERSION =
  'phase8r.completion_evidence_run.v1';

const PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED_BY_CHECKPOINT: 'blocked_by_checkpoint',
  BLOCKED_BY_ARTIFACT_INVENTORY: 'blocked_by_artifact_inventory',
});

const PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS = Object.freeze({
  MISSING_ARTIFACT_INVENTORY: 'missing_artifact_inventory',
  CHECKPOINT_NOT_COMPLETE: 'checkpoint_not_complete',
  CHECKPOINT_VALIDATION_FAILED: 'checkpoint_validation_failed',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
});

const PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP = Object.freeze([
  {
    phaseId: '8r_1',
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
    phaseId: '8r_2',
    label: 'Migration Candidate Report',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-migration-candidate-report.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8MigrationCandidateReport.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8MigrationCandidateReport.test.mjs'],
  },
  {
    phaseId: '8r_3',
    label: 'Explicit Conversion Workflow',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-explicit-conversion-workflow.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8ExplicitConversionWorkflow.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8ExplicitConversionWorkflow.test.mjs'],
  },
  {
    phaseId: '8r_4',
    label: 'Native Runtime Read Path',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-native-runtime-read-path.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8NativeRuntimeReadPath.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8NativeRuntimeReadPath.test.mjs'],
  },
  {
    phaseId: '8r_5',
    label: 'Rollback Snapshot And Reversion Window',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-rollback-snapshot-window.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8RollbackSnapshotWindow.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8RollbackSnapshotWindow.test.mjs'],
  },
  {
    phaseId: '8r_6',
    label: 'Legacy Write Path Shutdown',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-legacy-write-path-shutdown.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8LegacyWritePathShutdown.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8LegacyWritePathShutdown.test.mjs'],
  },
  {
    phaseId: '8r_7',
    label: 'Legacy Code Deletion Gates',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-legacy-code-deletion-gates.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8LegacyCodeDeletionGates.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8LegacyCodeDeletionGates.test.mjs'],
  },
  {
    phaseId: '8r_8',
    label: 'Backup, Restore, And Post-Upgrade Safety',
    designDocPaths: ['docs/architecture/policy-native-storage-operational-safety.md'],
    contractPaths: ['server/src/services/policyNativeStorageOperationalSafety.mjs'],
    testPaths: ['server/src/__tests__/services/policyNativeStorageOperationalSafety.test.mjs'],
  },
  {
    phaseId: '8r_9',
    label: 'Native Storage Test Reset',
    designDocPaths: ['docs/architecture/policy-native-storage-test-reset.md'],
    contractPaths: ['server/src/services/policyNativeStorageTestReset.mjs'],
    testPaths: ['server/src/__tests__/services/policyNativeStorageTestReset.test.mjs'],
  },
  {
    phaseId: '8r_10',
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
    phaseId: '8r_11',
    label: 'Post-Upgrade Dry-Run Wiring',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-post-upgrade-dry-run-wiring.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8PostUpgradeDryRun.mjs',
      'server/src/services/postUpgradeService.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8PostUpgradeDryRun.test.mjs'],
  },
  {
    phaseId: '8r_12',
    label: 'Post-Upgrade Apply Gate',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-post-upgrade-apply-gate.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8PostUpgradeApplyGate.mjs',
      'server/src/services/postUpgradeService.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8PostUpgradeApplyGate.test.mjs'],
  },
  {
    phaseId: '8r_13',
    label: 'Native Runtime Cutover Verification',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-native-runtime-cutover-verification.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8NativeRuntimeCutoverVerification.mjs',
      'server/src/services/policyBuilderPhase8NativePolicyReadService.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyBuilderPhase8NativeRuntimeCutoverVerification.test.mjs',
      'server/src/__tests__/services/policyBuilderPhase8NativePolicyReadService.test.mjs',
    ],
  },
  {
    phaseId: '8r_14',
    label: 'Compatibility Path Deletion Readiness',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-compatibility-path-deletion-readiness.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8CompatibilityPathDeletionReadiness.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8CompatibilityPathDeletionReadiness.test.mjs'],
  },
  {
    phaseId: '8r_15',
    label: 'Compatibility Path Deletion Execution Plan',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-compatibility-path-deletion-execution-plan.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8CompatibilityPathDeletionExecutionPlan.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8CompatibilityPathDeletionExecutionPlan.test.mjs'],
  },
  {
    phaseId: '8r_16',
    label: 'Compatibility Path Deletion Execution Gate',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-compatibility-path-deletion-execution-gate.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8CompatibilityPathDeletionExecutionGate.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8CompatibilityPathDeletionExecutionGate.test.mjs'],
  },
  {
    phaseId: '8r_17',
    label: 'Controlled Compatibility Path Removal',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-controlled-compatibility-path-removal.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8ControlledCompatibilityPathRemoval.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8ControlledCompatibilityPathRemoval.test.mjs'],
  },
  {
    phaseId: '8r_18',
    label: 'Controlled Compatibility Path Removal Apply',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-controlled-compatibility-path-removal-apply.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8ControlledCompatibilityPathRemovalApply.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8ControlledCompatibilityPathRemovalApply.test.mjs'],
  },
  {
    phaseId: '8r_19',
    label: 'Post-Removal Runtime Verification',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-post-removal-runtime-verification.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8PostRemovalRuntimeVerification.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8PostRemovalRuntimeVerification.test.mjs'],
  },
  {
    phaseId: '8r_20',
    label: 'Next Compatibility Removal Batch Authorization',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-next-compatibility-removal-batch-authorization.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8NextCompatibilityRemovalBatchAuthorization.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8NextCompatibilityRemovalBatchAuthorization.test.mjs'],
  },
  {
    phaseId: '8r_21',
    label: 'Compatibility Removal Completion Audit',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-compatibility-removal-completion-audit.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8CompatibilityRemovalCompletionAudit.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8CompatibilityRemovalCompletionAudit.test.mjs'],
  },
  {
    phaseId: '8r_22',
    label: 'Phase 8R Completion Checkpoint',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-completion-checkpoint.md'],
    contractPaths: ['server/src/services/policyBuilderPhase8CompletionCheckpoint.mjs'],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8CompletionCheckpoint.test.mjs'],
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function normalizePhaseId(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  const dottedPhaseMatch = normalized.match(/^(\d+)r?\.(\d+)$/);

  if (dottedPhaseMatch) {
    return `${dottedPhaseMatch[1]}r_${dottedPhaseMatch[2]}`;
  }

  return normalized;
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
  componentArtifactMap = PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP,
  artifactInventory = {},
  changelogPhaseIds = [],
} = {}) {
  const inventoryPathSet = getInventoryPathSet(artifactInventory);
  const changelogPhaseIdSet = new Set(changelogPhaseIds.map(normalizePhaseId));

  return componentArtifactMap.map(component => {
    const phaseId = normalizePhaseId(component.phaseId);
    const missingDesignDocPaths = missingPaths(component.designDocPaths, inventoryPathSet);
    const missingContractPaths = missingPaths(component.contractPaths, inventoryPathSet);
    const missingTestPaths = missingPaths(component.testPaths, inventoryPathSet);

    return {
      phaseId,
      label: component.label,
      implemented:
        allPathsPresent(component.contractPaths, inventoryPathSet) &&
        allPathsPresent(component.designDocPaths, inventoryPathSet) &&
        allPathsPresent(component.testPaths, inventoryPathSet),
      designDocPresent: missingDesignDocPaths.length === 0,
      contractEvidencePresent: missingContractPaths.length === 0,
      testEvidencePresent: missingTestPaths.length === 0,
      changelogEntryPresent: changelogPhaseIdSet.has(phaseId),
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
      PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS.MISSING_ARTIFACT_INVENTORY,
      'Phase 8R completion evidence run requires an explicit artifact inventory.'
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
    sequencePhaseIds: asArray(roadmapEvidence.sequencePhaseIds).map(normalizePhaseId),
    implementationStatusPhaseIds:
      asArray(roadmapEvidence.implementationStatusPhaseIds).map(normalizePhaseId),
  };
}

function normalizeChangelogEvidence(changelogEvidence = {}) {
  return {
    ...changelogEvidence,
    phaseIds: asArray(changelogEvidence.phaseIds).map(normalizePhaseId),
  };
}

function determineStatusId({ risks = [], checkpoint = {} } = {}) {
  if (risks.some(risk => (
    risk.riskId === PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS.MISSING_ARTIFACT_INVENTORY
  ))) {
    return PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_ARTIFACT_INVENTORY;
  }

  if (
    checkpoint.statusId !== PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE ||
    checkpoint.complete !== true
  ) {
    return PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT;
  }

  if (checkpoint.validation?.ok !== true) {
    return PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.BLOCKED_BY_CHECKPOINT;
  }

  return PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS.COMPLETE;
}

function buildPolicyBuilderPhase8CompletionEvidenceRun({
  artifactInventory = {},
  componentArtifactMap = PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP,
  roadmapEvidence = {},
  finalRemovalAudit = {},
  validationEvidence = {},
  changelogEvidence = {},
  sideEffects = {},
} = {}) {
  const normalizedRoadmapEvidence = normalizeRoadmapEvidence(roadmapEvidence);
  const normalizedChangelogEvidence = normalizeChangelogEvidence(changelogEvidence);
  const componentEvidence = buildComponentEvidence({
    componentArtifactMap,
    artifactInventory,
    changelogPhaseIds: normalizedChangelogEvidence.phaseIds,
  });
  const artifactInventoryEvaluation = evaluateArtifactInventory({
    artifactInventory,
    componentEvidence,
  });
  const expectedComponents = [
    ...PHASE8R_EXPECTED_COMPONENTS,
    {
      phaseId: '8r_22',
      label: 'Phase 8R Completion Checkpoint',
    },
  ];
  const checkpoint = buildPolicyBuilderPhase8CompletionCheckpoint({
    expectedComponents,
    componentEvidence,
    roadmapEvidence: normalizedRoadmapEvidence,
    finalRemovalAudit,
    validationEvidence,
    changelogEvidence: normalizedChangelogEvidence,
  });
  const risks = [
    ...artifactInventoryEvaluation.risks,
  ];

  if (checkpoint.statusId !== PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE) {
    risks.push(buildRisk(
      PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS.CHECKPOINT_NOT_COMPLETE,
      'Phase 8R completion evidence run requires the Phase 8R.22 checkpoint to complete.',
      {
        checkpointStatusId: checkpoint.statusId,
        checkpointRiskCount: checkpoint.riskCount,
      }
    ));
  }

  if (checkpoint.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS.CHECKPOINT_VALIDATION_FAILED,
      'Phase 8R completion evidence run requires valid checkpoint output.',
      { checkpointValidationIssueCount: checkpoint.validation?.issueCount ?? null }
    ));
  }

  const evidenceRun = {
    version: PHASE8R_COMPLETION_EVIDENCE_RUN_VERSION,
    statusId: determineStatusId({ risks, checkpoint }),
    complete:
      risks.length === 0 &&
      checkpoint.statusId === PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE &&
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
    nextPhase: {
      phaseId: '8r_complete',
      label: 'Phase 8R Complete',
      reason:
        'When the evidence run is complete, the current repository evidence satisfies the Phase 8R checkpoint.',
    },
  };

  return {
    ...evidenceRun,
    validation: validatePolicyBuilderPhase8CompletionEvidenceRun(evidenceRun),
  };
}

function validatePolicyBuilderPhase8CompletionEvidenceRun(evidenceRun = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS)
    .includes(evidenceRun.statusId)) {
    issues.push(buildRisk(
      PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS.UNKNOWN_STATUS,
      'Phase 8R completion evidence run status must be known.'
    ));
  }

  if (evidenceRun.riskCount !== asArray(evidenceRun.risks).length) {
    issues.push(buildRisk(
      PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS.RISK_COUNT_MISMATCH,
      'Phase 8R completion evidence run risk count must match risk list length.'
    ));
  }

  Object.entries(evidenceRun.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Phase 8R completion evidence run cannot perform side effect "${key}".`
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
  PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP,
  PHASE8R_COMPLETION_EVIDENCE_RUN_RISK_IDS,
  PHASE8R_COMPLETION_EVIDENCE_RUN_STATUS_IDS,
  PHASE8R_COMPLETION_EVIDENCE_RUN_VERSION,
  buildPolicyBuilderPhase8CompletionEvidenceRun,
  validatePolicyBuilderPhase8CompletionEvidenceRun,
};
