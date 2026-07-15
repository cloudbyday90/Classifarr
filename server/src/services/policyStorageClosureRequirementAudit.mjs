import fs from 'node:fs';
import path from 'node:path';

import {
  POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP as POLICY_STORAGE_BASE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
} from './policyStorageClosureEvidenceRun.mjs';
import {
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS,
} from './policyStorageCurrentClosureAudit.mjs';
import {
  validatePolicyStorageCurrentClosureAuditIntegrity,
} from './policyStorageCurrentClosureAuditIntegrity.mjs';
import {
  ROADMAP_ENTRY_TYPES,
  collectArtifactInventory,
  collectRoadmapComponentIds,
  normalizeRepositoryPath,
} from './policyStorageClosureCurrentEvidenceCollector.mjs';
import {
  extractPolicyStorageReleaseNoteCoverage,
} from './policyStorageReleaseNoteCoverage.mjs';

const POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_VERSION =
  'policy.storage_closure_requirement_audit.v2';

const POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED_BY_CURRENT_CLOSURE: 'blocked_by_current_closure',
  BLOCKED_BY_COMPONENT_EVIDENCE: 'blocked_by_component_evidence',
  BLOCKED_BY_ROADMAP_EVIDENCE: 'blocked_by_roadmap_evidence',
  BLOCKED_BY_CHANGELOG: 'blocked_by_changelog',
  BLOCKED_BY_SIDE_EFFECTS: 'blocked_by_side_effects',
});

const POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS = Object.freeze({
  CURRENT_CLOSURE_AUDIT_MISSING: 'current_closure_audit_missing',
  CURRENT_CLOSURE_AUDIT_NOT_COMPLETE: 'current_closure_audit_not_complete',
  CURRENT_CLOSURE_AUDIT_VALIDATION_FAILED:
    'current_closure_audit_validation_failed',
  CURRENT_CLOSURE_AUDIT_ARTIFACT_INTEGRITY_FAILED:
    'current_closure_audit_artifact_integrity_failed',
  COMPONENT_ARTIFACT_MISSING: 'component_artifact_missing',
  COMPONENT_DESIGN_DOC_MISSING: 'component_design_doc_missing',
  COMPONENT_CONTRACT_EVIDENCE_MISSING: 'component_contract_evidence_missing',
  COMPONENT_TEST_EVIDENCE_MISSING: 'component_test_evidence_missing',
  ROADMAP_SEQUENCE_MISSING: 'roadmap_sequence_missing',
  ROADMAP_IMPLEMENTATION_STATUS_MISSING:
    'roadmap_implementation_status_missing',
  CHANGELOG_ENTRY_MISSING: 'changelog_entry_missing',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  COMPLETE_FLAG_MISMATCH: 'complete_flag_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
});

function normalizeClosureComponentId(value = '') {
  return String(value || '').trim().toLowerCase();
}

function toClosureComponentMap(componentArtifactMap = []) {
  return asArray(componentArtifactMap).map(component => ({
    componentId: normalizeClosureComponentId(component.componentId),
    label: component.label,
    designDocPaths: asArray(component.designDocPaths),
    contractPaths: asArray(component.contractPaths),
    testPaths: asArray(component.testPaths),
  }));
}

const POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP = Object.freeze([
  ...toClosureComponentMap(POLICY_STORAGE_BASE_CLOSURE_REQUIREMENT_ARTIFACT_MAP),
  {
    componentId: 'storage_closure_evidence_run',
    label: 'Policy Storage Closure Evidence Run',
    designDocPaths: ['docs/architecture/policy-storage-closure-evidence-run.md'],
    contractPaths: [
      'server/src/services/policyStorageClosureEvidenceRun.mjs',
      'server/src/services/policyStorageClosureCurrentEvidenceCollector.mjs',
      'scripts/run-policy-storage-closure-evidence.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyStorageClosureEvidenceRun.test.mjs',
      'server/src/__tests__/services/policyStorageClosureCurrentEvidenceCollector.test.mjs',
    ],
  },
  {
    componentId: 'storage_closure_validation_evidence',
    label: 'Policy Storage Closure Validation Evidence',
    designDocPaths: [
      'docs/architecture/policy-storage-closure-validation-evidence.md',
      'docs/architecture/policy-storage-closure-validation-evidence-artifact-integrity.md',
    ],
    contractPaths: [
      'server/src/services/policyStorageClosureValidationEvidence.mjs',
      'server/src/services/policyStorageClosureValidationEvidenceFingerprint.mjs',
      'server/src/services/policyStorageClosureValidationEvidenceIntegrity.mjs',
      'server/src/services/policyStorageClosureValidationCommandInvocation.mjs',
      'scripts/generate-policy-storage-closure-validation-evidence.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyStorageClosureValidationEvidence.test.mjs',
      'server/src/__tests__/services/policyStorageClosureValidationEvidenceFingerprint.test.mjs',
      'server/src/__tests__/services/policyStorageClosureValidationEvidenceIntegrity.test.mjs',
      'server/src/__tests__/services/policyStorageClosureValidationCommandInvocation.test.mjs',
    ],
  },
  {
    componentId: 'storage_closure_final_removal_audit',
    label: 'Policy Storage Closure Final Removal Audit',
    designDocPaths: [
      'docs/architecture/policy-storage-closure-final-removal-audit.md',
      'docs/architecture/policy-storage-closure-execution-plan-source.md',
      'docs/architecture/policy-storage-closure-path-state-evidence.md',
    ],
    contractPaths: [
      'server/src/services/policyStorageClosureFinalRemovalAudit.mjs',
      'server/src/services/policyStorageClosureExecutionPlanSource.mjs',
      'server/src/services/policyStorageClosureManifestPathState.mjs',
      'server/src/services/policyStorageClosurePathStateCollector.mjs',
      'server/src/services/policyStorageClosurePathStateEvidence.mjs',
      'server/src/services/policyStorageClosurePathStateEvidenceFingerprint.mjs',
      'server/src/services/policyStorageClosurePathStateEvidenceIntegrity.mjs',
      'scripts/generate-policy-storage-closure-path-state-evidence.mjs',
      'scripts/generate-policy-storage-closure-final-removal-audit.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyStorageClosureFinalRemovalAudit.test.mjs',
      'server/src/__tests__/scripts/generatePolicyStorageClosureFinalRemovalAudit.test.mjs',
      'server/src/__tests__/services/policyStorageClosureExecutionPlanSource.test.mjs',
      'server/src/__tests__/services/policyStorageClosurePathStateCollector.test.mjs',
      'server/src/__tests__/services/policyStorageClosurePathStateEvidence.test.mjs',
      'server/src/__tests__/services/policyStorageClosurePathStateEvidenceFingerprint.test.mjs',
      'server/src/__tests__/services/policyStorageClosurePathStateEvidenceIntegrity.test.mjs',
    ],
  },
  {
    componentId: 'compatibility_deletion_execution_plan_artifact',
    label: 'Policy Compatibility Deletion Execution Plan Artifact',
    designDocPaths: [
      'docs/architecture/policy-compatibility-deletion-execution-plan-artifact.md',
      'docs/architecture/policy-compatibility-deletion-execution-artifact-fingerprint.md',
    ],
    contractPaths: [
      'server/src/services/policyCompatibilityDeletionExecutionPlanArtifact.mjs',
      'server/src/services/policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs',
      'scripts/generate-policy-compatibility-deletion-execution-plan-artifact.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyCompatibilityDeletionExecutionPlanArtifact.test.mjs',
      'server/src/__tests__/services/policyCompatibilityDeletionExecutionPlanArtifactFingerprint.test.mjs',
      'server/src/__tests__/scripts/generatePolicyCompatibilityDeletionExecutionPlanArtifact.test.mjs',
    ],
  },
  {
    componentId: 'controlled_compatibility_removal_batch_artifact',
    label: 'Policy Controlled Compatibility Removal Batch Artifact',
    designDocPaths: [
      'docs/architecture/policy-controlled-compatibility-removal-batch-artifact.md',
    ],
    contractPaths: [
      'server/src/services/policyControlledCompatibilityRemovalBatchArtifact.mjs',
      'scripts/generate-policy-controlled-compatibility-removal-batch-artifact.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyControlledCompatibilityRemovalBatchArtifact.test.mjs',
      'server/src/__tests__/scripts/generatePolicyControlledCompatibilityRemovalBatchArtifact.test.mjs',
    ],
  },
  {
    componentId: 'controlled_removal_apply_artifact_exporter',
    label: 'Controlled Removal Apply Artifact Exporter',
    designDocPaths: ['docs/architecture/policy-controlled-removal-apply-artifact-exporter.md'],
    contractPaths: [
      'server/src/services/policyControlledRemovalApplyArtifact.mjs',
      'server/src/services/policyControlledRemovalFileApplyAdapter.mjs',
      'scripts/generate-policy-controlled-removal-apply.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyControlledRemovalApplyArtifact.test.mjs',
      'server/src/__tests__/services/policyControlledRemovalFileApplyAdapter.test.mjs',
      'server/src/__tests__/scripts/generatePolicyControlledRemovalApply.test.mjs',
    ],
  },
  {
    componentId: 'post_removal_runtime_verification_artifact_exporter',
    label: 'Post-Removal Runtime Verification Artifact Exporter',
    designDocPaths: [
      'docs/architecture/policy-post-removal-runtime-verification-artifact-exporter.md',
      'docs/architecture/policy-post-removal-runtime-evidence-integrity.md',
    ],
    contractPaths: [
      'server/src/services/policyPostRemovalRuntimeVerificationArtifact.mjs',
      'server/src/services/policyPostRemovalRuntimeEvidenceArtifact.mjs',
      'scripts/generate-policy-post-removal-verification.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyPostRemovalRuntimeVerificationArtifact.test.mjs',
      'server/src/__tests__/services/policyPostRemovalRuntimeEvidenceArtifact.test.mjs',
      'server/src/__tests__/scripts/generatePolicyPostRemovalVerification.test.mjs',
    ],
  },
  {
    componentId: 'next_compatibility_removal_batch_authorization_artifact_exporter',
    label: 'Next Compatibility Removal Batch Authorization Artifact Exporter',
    designDocPaths: [
      'docs/architecture/policy-next-compatibility-removal-batch-authorization-artifact-exporter.md',
      'docs/architecture/policy-next-compatibility-removal-batch-authorization-artifact-integrity.md',
      'docs/architecture/policy-next-compatibility-removal-batch-authorization-path-state-binding.md',
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
    componentId: 'compatibility_removal_completion_audit_artifact_exporter',
    label: 'Compatibility Removal Completion Audit Artifact Exporter',
    designDocPaths: [
      'docs/architecture/policy-compatibility-removal-completion-audit-artifact-exporter.md',
      'docs/architecture/policy-compatibility-removal-completion-audit-artifact-integrity.md',
      'docs/architecture/policy-storage-completion-checkpoint-artifact-integrity.md',
    ],
    contractPaths: [
      'server/src/services/policyCompatibilityRemovalCompletionAuditArtifact.mjs',
      'server/src/services/policyCompatibilityRemovalCompletionAuditArtifactFingerprint.mjs',
      'server/src/services/policyCompatibilityRemovalCompletionAuditArtifactIntegrity.mjs',
      'server/src/services/policyCompatibilityRemovalCompletionAudit.mjs',
      'server/src/services/policyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity.mjs',
      'scripts/generate-policy-compatibility-removal-completion-audit.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyCompatibilityRemovalCompletionAuditArtifact.test.mjs',
      'server/src/__tests__/services/policyCompatibilityRemovalCompletionAuditArtifactIntegrity.test.mjs',
      'server/src/__tests__/services/policyNextCompatibilityRemovalBatchAuthorizationArtifactIntegrity.test.mjs',
      'server/src/__tests__/scripts/generatePolicyCompatibilityRemovalCompletionAudit.test.mjs',
    ],
  },
  {
    componentId: 'storage_completion_checkpoint_artifact_exporter',
    label: 'Completion Checkpoint Artifact Exporter',
    designDocPaths: [
      'docs/architecture/policy-storage-completion-checkpoint-artifact-exporter.md',
      'docs/architecture/policy-storage-completion-checkpoint-artifact-integrity.md',
    ],
    contractPaths: [
      'server/src/services/policyStorageCompletionCheckpointArtifact.mjs',
      'scripts/generate-policy-storage-completion-checkpoint.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyStorageCompletionCheckpointArtifact.test.mjs'],
  },
  {
    componentId: 'storage_final_closure_readout',
    label: 'Policy Storage Final Closure Readout',
    designDocPaths: ['docs/architecture/policy-storage-final-closure-readout.md'],
    contractPaths: [
      'server/src/services/policyStorageFinalClosureReadout.mjs',
      'scripts/generate-policy-storage-final-closure-readout.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyStorageFinalClosureReadout.test.mjs'],
  },
  {
    componentId: 'storage_current_closure_audit',
    label: 'Policy Storage Current Closure Audit',
    designDocPaths: [
      'docs/architecture/policy-storage-current-closure-audit.md',
      'docs/architecture/policy-storage-current-closure-audit-artifact-integrity.md',
    ],
    contractPaths: [
      'server/src/services/policyStorageCurrentClosureAudit.mjs',
      'server/src/services/policyStorageCurrentClosureAuditFingerprint.mjs',
      'server/src/services/policyStorageCurrentClosureAuditIntegrity.mjs',
      'scripts/run-policy-storage-current-closure-audit.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyStorageCurrentClosureAudit.test.mjs',
      'server/src/__tests__/services/policyStorageCurrentClosureAuditIntegrity.test.mjs',
    ],
  },
]);

const DEFAULT_POLICY_BUILDER_ROADMAP_PATH =
  'docs/architecture/policy-builder-intent-model-roadmap.md';
const DEFAULT_CHANGELOG_PATH = 'CHANGELOG.md';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function defaultFileExists(filePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Local/CI evidence collection reads mapped repository paths.
  return fs.existsSync(filePath);
}

function defaultReadTextFile(filePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Local/CI evidence collection reads mapped repository paths.
  return fs.readFileSync(filePath, 'utf8');
}

function readOptionalTextFile({
  cwd = process.cwd(),
  repositoryPath,
  readTextFile = defaultReadTextFile,
} = {}) {
  try {
    return readTextFile(path.resolve(cwd, normalizeRepositoryPath(repositoryPath)));
  } catch (_err) {
    return '';
  }
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
  ].map(normalizeRepositoryPath).filter(Boolean));
}

function getMissingPaths(paths = [], inventoryPathSet = new Set()) {
  return asArray(paths)
    .map(normalizeRepositoryPath)
    .filter(repositoryPath => repositoryPath && !inventoryPathSet.has(repositoryPath));
}

function extractRoadmapComponentEvidence({
  roadmapContent = '',
  componentArtifactMap = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
} = {}) {
  return {
    sequenceComponentIds: collectRoadmapComponentIds({
      roadmapContent,
      componentArtifactMap,
      entryType: ROADMAP_ENTRY_TYPES.SEQUENCE,
    }).map(normalizeClosureComponentId),
    implementationStatusComponentIds: collectRoadmapComponentIds({
      roadmapContent,
      componentArtifactMap,
      entryType: ROADMAP_ENTRY_TYPES.IMPLEMENTATION_STATUS,
    }).map(normalizeClosureComponentId),
  };
}

function extractChangelogComponentEvidence({
  changelogContent = '',
  componentArtifactMap = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
} = {}) {
  return extractPolicyStorageReleaseNoteCoverage({
    changelogContent,
    componentArtifactMap,
  });
}

function evaluateComponentEvidence({
  artifactInventory = {},
  componentArtifactMap = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
} = {}) {
  const inventoryPathSet = getInventoryPathSet(artifactInventory);
  const components = asArray(componentArtifactMap).map(component => {
    const missingDesignDocPaths =
      getMissingPaths(component.designDocPaths, inventoryPathSet);
    const missingContractPaths =
      getMissingPaths(component.contractPaths, inventoryPathSet);
    const missingTestPaths = getMissingPaths(component.testPaths, inventoryPathSet);
    const implemented = (
      missingDesignDocPaths.length === 0 &&
      missingContractPaths.length === 0 &&
      missingTestPaths.length === 0
    );

    return {
      componentId: normalizeClosureComponentId(component.componentId),
      label: component.label,
      implemented,
      designDocPresent: missingDesignDocPaths.length === 0,
      contractEvidencePresent: missingContractPaths.length === 0,
      testEvidencePresent: missingTestPaths.length === 0,
      missingDesignDocPaths,
      missingContractPaths,
      missingTestPaths,
    };
  });
  const componentsWithMissingArtifacts = components.filter(component => (
    asArray(component.missingDesignDocPaths).length > 0 ||
    asArray(component.missingContractPaths).length > 0 ||
    asArray(component.missingTestPaths).length > 0
  ));

  return {
    expectedCount: components.length,
    implementedCount: components.filter(component => component.implemented).length,
    documentedCount: components.filter(component => component.designDocPresent).length,
    contractEvidenceCount:
      components.filter(component => component.contractEvidencePresent).length,
    testEvidenceCount: components.filter(component => component.testEvidencePresent).length,
    missingArtifactCount: componentsWithMissingArtifacts.length,
    componentsWithMissingArtifacts,
    components,
  };
}

function evaluateRoadmapEvidence({
  roadmapEvidence = {},
  componentArtifactMap = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
} = {}) {
  const sequenceComponentIds =
    asArray(roadmapEvidence.sequenceComponentIds)
      .map(normalizeClosureComponentId);
  const implementationStatusComponentIds =
    asArray(roadmapEvidence.implementationStatusComponentIds)
      .map(normalizeClosureComponentId);
  const expectedComponentIds =
    asArray(componentArtifactMap)
      .map(component => normalizeClosureComponentId(component.componentId));
  const missingSequenceComponentIds =
    expectedComponentIds
      .filter(componentId => !sequenceComponentIds.includes(componentId));
  const missingImplementationStatusComponentIds =
    expectedComponentIds
      .filter(componentId => !implementationStatusComponentIds.includes(componentId));

  return {
    sequenceCount: sequenceComponentIds.length,
    implementationStatusCount: implementationStatusComponentIds.length,
    sequenceComponentIds,
    implementationStatusComponentIds,
    missingSequenceComponentIds,
    missingImplementationStatusComponentIds,
  };
}

function evaluateChangelogEvidence({
  changelogEvidence = {},
  componentArtifactMap = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
} = {}) {
  const coveredComponentIds =
    asArray(changelogEvidence.componentIds).map(normalizeClosureComponentId);
  const expectedComponentIds =
    asArray(componentArtifactMap)
      .map(component => normalizeClosureComponentId(component.componentId));
  const missingComponentIds =
    expectedComponentIds
      .filter(componentId => !coveredComponentIds.includes(componentId));

  return {
    updated: changelogEvidence.updated === true,
    coveredComponentIds,
    missingComponentIds,
  };
}

function summarizeSideEffects(sideEffects = {}) {
  return {
    filesRead: sideEffects.filesRead === true,
    filesWritten: sideEffects.filesWritten === true,
    storageChanged: sideEffects.storageChanged === true,
    gitCommandsRun: sideEffects.gitCommandsRun === true,
    commandsExecuted: sideEffects.commandsExecuted === true,
    manifestWritten: sideEffects.manifestWritten === true,
  };
}

function buildAuditRisks({
  currentClosureAudit = {},
  currentClosureAuditIntegrity = {},
  componentEvidence = {},
  roadmapEvidence = {},
  changelogEvidence = {},
  sideEffects = {},
} = {}) {
  const risks = [];
  const normalizedCurrentClosureAudit = asObject(currentClosureAudit);
  const integrity = asObject(currentClosureAuditIntegrity);

  if (Object.keys(normalizedCurrentClosureAudit).length === 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_MISSING,
      'Policy storage closure requirement audit requires a policy storage current closure audit.'
    ));
  }

  if (integrity.ok !== true) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_ARTIFACT_INTEGRITY_FAILED,
      'Policy storage closure requirement audit requires a fingerprint-valid replay-verified current closure audit artifact.',
      {
        issueCount: integrity.issueCount ?? null,
        issueRiskIds: asArray(integrity.issues).map(issue => issue.riskId),
      }
    ));
  }

  if (
    integrity.ok === true &&
    Object.keys(normalizedCurrentClosureAudit).length > 0 &&
    (
      normalizedCurrentClosureAudit.statusId !==
        POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS.COMPLETE ||
      normalizedCurrentClosureAudit.complete !== true
    )
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_NOT_COMPLETE,
      'Policy storage closure requirement audit requires a complete policy storage current closure audit.',
      {
        currentClosureAuditStatusId:
          normalizedCurrentClosureAudit.statusId || null,
      }
    ));
  }

  if (
    integrity.ok === true &&
    Object.keys(normalizedCurrentClosureAudit).length > 0 &&
    normalizedCurrentClosureAudit.validation?.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_VALIDATION_FAILED,
      'Policy storage closure requirement audit requires valid policy storage current closure audit evidence.',
      {
        currentClosureAuditValidationIssueCount:
          normalizedCurrentClosureAudit.validation?.issueCount ?? null,
      }
    ));
  }

  asArray(componentEvidence.componentsWithMissingArtifacts).forEach(component => {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
        .COMPONENT_ARTIFACT_MISSING,
      'Policy storage closure requirement audit requires every mapped closure component artifact to exist in the current checkout.',
      {
        componentId: component.componentId,
        label: component.label,
        missingDesignDocPaths: component.missingDesignDocPaths,
        missingContractPaths: component.missingContractPaths,
        missingTestPaths: component.missingTestPaths,
      }
    ));

    if (asArray(component.missingDesignDocPaths).length > 0) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
          .COMPONENT_DESIGN_DOC_MISSING,
        'Policy storage closure requirement audit requires a design/outcome document for every mapped closure component.',
        {
          componentId: component.componentId,
          label: component.label,
          missingDesignDocPaths: component.missingDesignDocPaths,
        }
      ));
    }

    if (asArray(component.missingContractPaths).length > 0) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
          .COMPONENT_CONTRACT_EVIDENCE_MISSING,
        'Policy storage closure requirement audit requires service, script, route, migration, or wiring evidence for every mapped closure component.',
        {
          componentId: component.componentId,
          label: component.label,
          missingContractPaths: component.missingContractPaths,
        }
      ));
    }

    if (asArray(component.missingTestPaths).length > 0) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
          .COMPONENT_TEST_EVIDENCE_MISSING,
        'Policy storage closure requirement audit requires focused test evidence for every mapped closure component.',
        {
          componentId: component.componentId,
          label: component.label,
          missingTestPaths: component.missingTestPaths,
        }
      ));
    }
  });

  if (asArray(roadmapEvidence.missingSequenceComponentIds).length > 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
        .ROADMAP_SEQUENCE_MISSING,
      'Policy storage closure requirement audit requires the roadmap work sequence to include every mapped closure component.',
      { missingComponentIds: roadmapEvidence.missingSequenceComponentIds }
    ));
  }

  if (
    asArray(roadmapEvidence.missingImplementationStatusComponentIds).length > 0
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
        .ROADMAP_IMPLEMENTATION_STATUS_MISSING,
      'Policy storage closure requirement audit requires the roadmap component map to include every implementation-status section.',
      {
        missingComponentIds:
          roadmapEvidence.missingImplementationStatusComponentIds,
      }
    ));
  }

  if (
    changelogEvidence.updated !== true ||
    asArray(changelogEvidence.missingComponentIds).length > 0
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
        .CHANGELOG_ENTRY_MISSING,
      'Policy storage closure requirement audit requires changelog coverage for every mapped closure component.',
      { missingComponentIds: changelogEvidence.missingComponentIds }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (key !== 'filesRead' && value === true) {
      risks.push(buildRisk(
        POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Policy storage closure requirement audit cannot report side effect "${key}".`,
        { sideEffect: key }
      ));
    }
  });

  return risks;
}

function determineStatusId({
  risks = [],
  currentClosureAudit = {},
  currentClosureAuditIntegrity = {},
  componentEvidence = {},
  roadmapEvidence = {},
  changelogEvidence = {},
  sideEffects = {},
} = {}) {
  if (risks.length === 0) {
    return POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS.COMPLETE;
  }

  if (Object.entries(sideEffects || {}).some(([key, value]) => (
    key !== 'filesRead' && value === true
  ))) {
    return POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
      .BLOCKED_BY_SIDE_EFFECTS;
  }

  if (
    currentClosureAuditIntegrity.ok !== true ||
    currentClosureAudit.statusId !==
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_STATUS_IDS.COMPLETE ||
    currentClosureAudit.complete !== true ||
    currentClosureAudit.validation?.ok !== true
  ) {
    return POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
      .BLOCKED_BY_CURRENT_CLOSURE;
  }

  if (componentEvidence.missingArtifactCount > 0) {
    return POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
      .BLOCKED_BY_COMPONENT_EVIDENCE;
  }

  if (
    asArray(roadmapEvidence.missingSequenceComponentIds).length > 0 ||
    asArray(roadmapEvidence.missingImplementationStatusComponentIds).length > 0
  ) {
    return POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
      .BLOCKED_BY_ROADMAP_EVIDENCE;
  }

  if (
    changelogEvidence.updated !== true ||
    asArray(changelogEvidence.missingComponentIds).length > 0
  ) {
    return POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
      .BLOCKED_BY_CHANGELOG;
  }

  return POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS
    .BLOCKED_BY_COMPONENT_EVIDENCE;
}

async function buildPolicyStorageClosureRequirementAudit({
  cwd = process.cwd(),
  currentClosureAudit = {},
  componentArtifactMap = POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
  roadmapPath = DEFAULT_POLICY_BUILDER_ROADMAP_PATH,
  changelogPath = DEFAULT_CHANGELOG_PATH,
  generatedAt = null,
  sideEffects = {},
  fileExists = defaultFileExists,
  readTextFile = defaultReadTextFile,
} = {}) {
  const currentClosureAuditIntegrity =
    await validatePolicyStorageCurrentClosureAuditIntegrity({
      currentClosureAudit,
    });
  const verifiedCurrentClosureAudit =
    asObject(currentClosureAuditIntegrity.audit);
  const artifactInventoryResult = collectArtifactInventory({
    cwd,
    componentArtifactMap,
    fileExists,
  });
  const roadmapContent = readOptionalTextFile({
    cwd,
    repositoryPath: roadmapPath,
    readTextFile,
  });
  const changelogContent = readOptionalTextFile({
    cwd,
    repositoryPath: changelogPath,
    readTextFile,
  });
  const rawRoadmapEvidence = extractRoadmapComponentEvidence({
    roadmapContent,
    componentArtifactMap,
  });
  const rawChangelogEvidence = extractChangelogComponentEvidence({
    changelogContent,
    componentArtifactMap,
  });
  const componentEvidence = evaluateComponentEvidence({
    artifactInventory: artifactInventoryResult.artifactInventory,
    componentArtifactMap,
  });
  const roadmapEvidence = evaluateRoadmapEvidence({
    roadmapEvidence: rawRoadmapEvidence,
    componentArtifactMap,
  });
  const changelogEvidence = evaluateChangelogEvidence({
    changelogEvidence: rawChangelogEvidence,
    componentArtifactMap,
  });
  const combinedSideEffects = summarizeSideEffects({
    filesRead: true,
    ...sideEffects,
  });
  const risks = buildAuditRisks({
    currentClosureAudit,
    currentClosureAuditIntegrity,
    componentEvidence,
    roadmapEvidence,
    changelogEvidence,
    sideEffects: combinedSideEffects,
  });
  const statusId = determineStatusId({
    risks,
    currentClosureAudit: verifiedCurrentClosureAudit,
    currentClosureAuditIntegrity,
    componentEvidence,
    roadmapEvidence,
    changelogEvidence,
    sideEffects: combinedSideEffects,
  });
  const audit = {
    version: POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    statusId,
    complete:
      statusId ===
        POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS.COMPLETE,
    evidenceScope: {
      componentCount: asArray(componentArtifactMap).length,
      componentCatalog: 'policy_storage_closure',
      roadmapPath,
      changelogPath,
      requiresCurrentClosureAudit: true,
    },
    currentClosureAudit: {
      statusId: verifiedCurrentClosureAudit.statusId || null,
      complete: verifiedCurrentClosureAudit.complete === true,
      validationOk: verifiedCurrentClosureAudit.validation?.ok === true,
      integrityOk: currentClosureAuditIntegrity.ok === true,
      artifactFingerprint: currentClosureAuditIntegrity.artifactFingerprint,
      integrityIssueCount: currentClosureAuditIntegrity.issueCount,
      riskCount: verifiedCurrentClosureAudit.riskCount ?? null,
    },
    artifactInventory: artifactInventoryResult,
    componentEvidence,
    roadmapEvidence,
    changelogEvidence,
    summary: {
      currentClosureAuditComplete: verifiedCurrentClosureAudit.complete === true,
      currentClosureAuditValidationOk:
        verifiedCurrentClosureAudit.validation?.ok === true,
      currentClosureAuditIntegrityOk: currentClosureAuditIntegrity.ok === true,
      expectedComponentCount: componentEvidence.expectedCount,
      implementedComponentCount: componentEvidence.implementedCount,
      missingComponentArtifactCount: componentEvidence.missingArtifactCount,
      missingRoadmapSequenceCount:
        roadmapEvidence.missingSequenceComponentIds.length,
      missingRoadmapImplementationStatusCount:
        roadmapEvidence.missingImplementationStatusComponentIds.length,
      missingChangelogCount: changelogEvidence.missingComponentIds.length,
    },
    riskCount: risks.length,
    risks,
    sideEffects: combinedSideEffects,
    executionPolicy: {
      readsCurrentRepositoryFiles: true,
      requireCurrentClosureAudit: true,
      requireFingerprintValidCurrentClosureAudit: true,
      requireReplayedCurrentClosureAudit: true,
      requireAllClosureComponentArtifacts: true,
      requireRoadmapSequenceCoverage: true,
      requireRoadmapImplementationStatusCoverage: true,
      requireChangelogCoverage: true,
      allowFileWrites: false,
      allowStorageMutation: false,
      allowGitCommandsInsideAudit: false,
      allowCommandExecutionInsideService: false,
      allowManifestWrite: false,
    },
    finalDecision: {
      stepId: 'policy_storage_closure_requirements_complete',
      label: 'Policy Storage Closure Requirements Complete',
      complete:
        statusId ===
          POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS.COMPLETE,
      reason: statusId ===
        POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS.COMPLETE
        ? 'All mapped policy storage closure components are covered by current closure, artifact, roadmap, changelog, and validation evidence.'
        : 'Policy storage closure remains blocked until the reported current-state evidence gaps are resolved.',
    },
  };

  return {
    ...audit,
    validation:
      validatePolicyStorageClosureRequirementAudit(audit),
  };
}

function validatePolicyStorageClosureRequirementAudit(audit = {}) {
  const issues = [];

  if (!Object.values(POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS)
    .includes(audit.statusId)) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      'Policy storage closure requirement audit status must be known.'
    ));
  }

  if (audit.riskCount !== asArray(audit.risks).length) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Policy storage closure requirement audit risk count must match risk list length.'
    ));
  }

  if (
    audit.statusId ===
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS.COMPLETE &&
    audit.complete !== true
  ) {
    issues.push(buildRisk(
      POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
        .COMPLETE_FLAG_MISMATCH,
      'Policy storage closure requirement audit complete flag must match complete status.'
    ));
  }

  Object.entries(audit.sideEffects || {}).forEach(([key, value]) => {
    if (key !== 'filesRead' && value === true) {
      issues.push(buildRisk(
        POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Policy storage closure requirement audit cannot report side effect "${key}".`,
        { sideEffect: key }
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
  POLICY_STORAGE_CLOSURE_REQUIREMENT_ARTIFACT_MAP,
  POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_RISK_IDS,
  POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_STATUS_IDS,
  POLICY_STORAGE_CLOSURE_REQUIREMENT_AUDIT_VERSION,
  buildPolicyStorageClosureRequirementAudit,
  evaluateChangelogEvidence,
  evaluateComponentEvidence,
  evaluateRoadmapEvidence,
  validatePolicyStorageClosureRequirementAudit,
};
