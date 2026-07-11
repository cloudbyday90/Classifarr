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
  legacyId: '8r_22',
  label: 'Policy Storage Completion Checkpoint',
});

const POLICY_STORAGE_CLOSURE_COMPONENT_ID_MAP = new Map([
  ...POLICY_STORAGE_COMPLETION_COMPONENTS,
  POLICY_STORAGE_CLOSURE_COMPLETION_CHECKPOINT_COMPONENT,
].map(component => [component.legacyId, component.componentId]));

const POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP = Object.freeze([
  {
    legacyId: '8r_1',
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
    legacyId: '8r_2',
    label: 'Migration Candidate Report',
    designDocPaths: [
      'docs/architecture/policy-intent-migration-candidate-report.md',
      'docs/architecture/policy-intent-migration-candidate-report-module-cutover.md',
    ],
    contractPaths: ['server/src/services/policyIntentMigrationCandidateReport.mjs'],
    testPaths: ['server/src/__tests__/services/policyIntentMigrationCandidateReport.test.mjs'],
  },
  {
    legacyId: '8r_3',
    label: 'Explicit Conversion Workflow',
    designDocPaths: [
      'docs/architecture/policy-intent-conversion-workflow.md',
      'docs/architecture/policy-intent-conversion-workflow-module-cutover.md',
    ],
    contractPaths: ['server/src/services/policyIntentConversionWorkflow.mjs'],
    testPaths: ['server/src/__tests__/services/policyIntentConversionWorkflow.test.mjs'],
  },
  {
    legacyId: '8r_4',
    label: 'Native Runtime Read Path',
    designDocPaths: ['docs/architecture/policy-intent-runtime-read-path.md'],
    contractPaths: ['server/src/services/policyIntentRuntimeReadPath.mjs'],
    testPaths: ['server/src/__tests__/services/policyIntentRuntimeReadPath.test.mjs'],
  },
  {
    legacyId: '8r_5',
    label: 'Rollback Snapshot And Reversion Window',
    designDocPaths: ['docs/architecture/policy-rollback-snapshot-window.md'],
    contractPaths: ['server/src/services/policyRollbackSnapshotWindow.mjs'],
    testPaths: ['server/src/__tests__/services/policyRollbackSnapshotWindow.test.mjs'],
  },
  {
    legacyId: '8r_6',
    label: 'Legacy Write Path Shutdown',
    designDocPaths: ['docs/architecture/policy-legacy-write-boundary.md'],
    contractPaths: ['server/src/services/policyLegacyWriteBoundary.mjs'],
    testPaths: ['server/src/__tests__/services/policyLegacyWriteBoundary.test.mjs'],
  },
  {
    legacyId: '8r_7',
    label: 'Legacy Code Deletion Gates',
    designDocPaths: ['docs/architecture/policy-compatibility-deletion-gates.md'],
    contractPaths: ['server/src/services/policyCompatibilityDeletionGates.mjs'],
    testPaths: ['server/src/__tests__/services/policyCompatibilityDeletionGates.test.mjs'],
  },
  {
    legacyId: '8r_8',
    label: 'Backup, Restore, And Post-Upgrade Safety',
    designDocPaths: ['docs/architecture/policy-native-storage-operational-safety.md'],
    contractPaths: ['server/src/services/policyNativeStorageOperationalSafety.mjs'],
    testPaths: ['server/src/__tests__/services/policyNativeStorageOperationalSafety.test.mjs'],
  },
  {
    legacyId: '8r_9',
    label: 'Native Storage Test Reset',
    designDocPaths: ['docs/architecture/policy-native-storage-test-reset.md'],
    contractPaths: ['server/src/services/policyNativeStorageTestReset.mjs'],
    testPaths: ['server/src/__tests__/services/policyNativeStorageTestReset.test.mjs'],
  },
  {
    legacyId: '8r_10',
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
    legacyId: '8r_11',
    label: 'Post-Upgrade Dry-Run Wiring',
    designDocPaths: ['docs/architecture/policy-post-upgrade-dry-run-wiring.md'],
    contractPaths: [
      'server/src/services/policyPostUpgradeDryRun.mjs',
      'server/src/services/postUpgradeService.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyPostUpgradeDryRun.test.mjs'],
  },
  {
    legacyId: '8r_12',
    label: 'Post-Upgrade Apply Gate',
    designDocPaths: ['docs/architecture/policy-post-upgrade-apply-gate.md'],
    contractPaths: [
      'server/src/services/policyPostUpgradeApplyGate.mjs',
      'server/src/services/postUpgradeService.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyPostUpgradeApplyGate.test.mjs'],
  },
  {
    legacyId: '8r_13',
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
    legacyId: '8r_14',
    label: 'Compatibility Path Deletion Readiness',
    designDocPaths: ['docs/architecture/policy-compatibility-deletion-readiness.md'],
    contractPaths: ['server/src/services/policyCompatibilityDeletionReadiness.mjs'],
    testPaths: ['server/src/__tests__/services/policyCompatibilityDeletionReadiness.test.mjs'],
  },
  {
    legacyId: '8r_15',
    label: 'Compatibility Path Deletion Execution Plan',
    designDocPaths: ['docs/architecture/policy-compatibility-deletion-execution-plan.md'],
    contractPaths: ['server/src/services/policyCompatibilityDeletionExecutionPlan.mjs'],
    testPaths: ['server/src/__tests__/services/policyCompatibilityDeletionExecutionPlan.test.mjs'],
  },
  {
    legacyId: '8r_16',
    label: 'Compatibility Path Deletion Execution Gate',
    designDocPaths: ['docs/architecture/policy-compatibility-deletion-execution-gate.md'],
    contractPaths: ['server/src/services/policyCompatibilityDeletionExecutionGate.mjs'],
    testPaths: ['server/src/__tests__/services/policyCompatibilityDeletionExecutionGate.test.mjs'],
  },
  {
    legacyId: '8r_17',
    label: 'Controlled Compatibility Path Removal',
    designDocPaths: ['docs/architecture/policy-controlled-compatibility-path-removal.md'],
    contractPaths: ['server/src/services/policyControlledCompatibilityPathRemoval.mjs'],
    testPaths: ['server/src/__tests__/services/policyControlledCompatibilityPathRemoval.test.mjs'],
  },
  {
    legacyId: '8r_18',
    label: 'Controlled Compatibility Path Removal Apply',
    designDocPaths: ['docs/architecture/policy-controlled-compatibility-path-removal-apply.md'],
    contractPaths: ['server/src/services/policyControlledCompatibilityPathRemovalApply.mjs'],
    testPaths: ['server/src/__tests__/services/policyControlledCompatibilityPathRemovalApply.test.mjs'],
  },
  {
    legacyId: '8r_19',
    label: 'Post-Removal Runtime Verification',
    designDocPaths: ['docs/architecture/policy-post-removal-runtime-verification.md'],
    contractPaths: ['server/src/services/policyPostRemovalRuntimeVerification.mjs'],
    testPaths: ['server/src/__tests__/services/policyPostRemovalRuntimeVerification.test.mjs'],
  },
  {
    legacyId: '8r_20',
    label: 'Next Compatibility Removal Batch Authorization',
    designDocPaths: ['docs/architecture/policy-next-compatibility-removal-batch-authorization.md'],
    contractPaths: ['server/src/services/policyNextCompatibilityRemovalBatchAuthorization.mjs'],
    testPaths: ['server/src/__tests__/services/policyNextCompatibilityRemovalBatchAuthorization.test.mjs'],
  },
  {
    legacyId: '8r_21',
    label: 'Compatibility Removal Completion Audit',
    designDocPaths: ['docs/architecture/policy-compatibility-removal-completion-audit.md'],
    contractPaths: ['server/src/services/policyCompatibilityRemovalCompletionAudit.mjs'],
    testPaths: ['server/src/__tests__/services/policyCompatibilityRemovalCompletionAudit.test.mjs'],
  },
  {
    legacyId: '8r_22',
    label: 'Policy Storage Completion Checkpoint',
    designDocPaths: ['docs/architecture/policy-storage-completion-checkpoint.md'],
    contractPaths: ['server/src/services/policyStorageCompletionCheckpoint.mjs'],
    testPaths: ['server/src/__tests__/services/policyStorageCompletionCheckpoint.test.mjs'],
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function normalizeSourceComponentId(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  const dottedSourceMatch = normalized.match(/^(\d+)r?\.(\d+)$/);

  if (dottedSourceMatch) {
    return `${dottedSourceMatch[1]}r_${dottedSourceMatch[2]}`;
  }

  return normalized;
}

function normalizeComponentId(value = '') {
  const sourceComponentId = normalizeSourceComponentId(value);

  return POLICY_STORAGE_CLOSURE_COMPONENT_ID_MAP.get(sourceComponentId) || sourceComponentId;
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
    const sourceComponentId = normalizeSourceComponentId(component.legacyId);
    const componentId = normalizeComponentId(component.componentId || sourceComponentId);
    const missingDesignDocPaths = missingPaths(component.designDocPaths, inventoryPathSet);
    const missingContractPaths = missingPaths(component.contractPaths, inventoryPathSet);
    const missingTestPaths = missingPaths(component.testPaths, inventoryPathSet);

    return {
      componentId,
      sourceRoadmapComponentId: sourceComponentId,
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

function buildPolicyStorageClosureEvidenceRun({
  artifactInventory = {},
  componentArtifactMap = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
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
  const checkpoint = buildPolicyStorageCompletionCheckpoint({
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
