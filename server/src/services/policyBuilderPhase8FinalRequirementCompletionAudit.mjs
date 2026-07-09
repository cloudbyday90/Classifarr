import fs from 'node:fs';
import path from 'node:path';

import {
  PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP,
} from './policyBuilderPhase8CompletionEvidenceRun.mjs';
import {
  PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS,
} from './policyBuilderPhase8CurrentRepositoryClosureAudit.mjs';
import {
  collectArtifactInventory,
  extractChangelogEvidence,
  extractRoadmapEvidence,
  normalizeRepositoryPath,
} from './policyBuilderPhase8CurrentEvidenceCollector.mjs';

const PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_VERSION =
  'phase8r.final_requirement_completion_audit.v1';

const PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED_BY_CURRENT_CLOSURE: 'blocked_by_current_closure',
  BLOCKED_BY_COMPONENT_EVIDENCE: 'blocked_by_component_evidence',
  BLOCKED_BY_ROADMAP_EVIDENCE: 'blocked_by_roadmap_evidence',
  BLOCKED_BY_CHANGELOG: 'blocked_by_changelog',
  BLOCKED_BY_SIDE_EFFECTS: 'blocked_by_side_effects',
});

const PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS = Object.freeze({
  CURRENT_CLOSURE_AUDIT_MISSING: 'current_closure_audit_missing',
  CURRENT_CLOSURE_AUDIT_NOT_COMPLETE: 'current_closure_audit_not_complete',
  CURRENT_CLOSURE_AUDIT_VALIDATION_FAILED:
    'current_closure_audit_validation_failed',
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

const PHASE8R_FINAL_REQUIREMENT_ARTIFACT_MAP = Object.freeze([
  ...PHASE8R_COMPLETION_EVIDENCE_ARTIFACT_MAP,
  {
    phaseId: '8r_23',
    label: 'Completion Evidence Run',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-completion-evidence-run.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8CompletionEvidenceRun.mjs',
      'server/src/services/policyBuilderPhase8CurrentEvidenceCollector.mjs',
      'scripts/run-policy-builder-phase-8r-evidence.mjs',
    ],
    testPaths: [
      'server/src/__tests__/services/policyBuilderPhase8CompletionEvidenceRun.test.mjs',
      'server/src/__tests__/services/policyBuilderPhase8CurrentEvidenceCollector.test.mjs',
    ],
  },
  {
    phaseId: '8r_24',
    label: 'Validation Evidence Generator',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-validation-evidence-generator.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8ValidationEvidence.mjs',
      'scripts/generate-policy-builder-phase-8r-validation-evidence.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8ValidationEvidence.test.mjs'],
  },
  {
    phaseId: '8r_25',
    label: 'Final Removal Audit Exporter',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-final-removal-audit-exporter.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8FinalRemovalAuditEvidence.mjs',
      'scripts/generate-policy-builder-phase-8r-final-removal-audit.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8FinalRemovalAuditEvidence.test.mjs'],
  },
  {
    phaseId: '8r_26',
    label: 'Execution Plan Artifact Exporter',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-execution-plan-artifact-exporter.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8ExecutionPlanArtifact.mjs',
      'scripts/generate-policy-builder-phase-8r-execution-plan.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8ExecutionPlanArtifact.test.mjs'],
  },
  {
    phaseId: '8r_27',
    label: 'Controlled Removal Batch Artifact Exporter',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-controlled-removal-batch-artifact-exporter.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8ControlledRemovalBatchArtifact.mjs',
      'scripts/generate-policy-builder-phase-8r-removal-batch.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8ControlledRemovalBatchArtifact.test.mjs'],
  },
  {
    phaseId: '8r_28',
    label: 'Controlled Removal Apply Artifact Exporter',
    designDocPaths: ['docs/architecture/policy-controlled-removal-apply-artifact-exporter.md'],
    contractPaths: [
      'server/src/services/policyControlledRemovalApplyArtifact.mjs',
      'scripts/generate-policy-controlled-removal-apply.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyControlledRemovalApplyArtifact.test.mjs'],
  },
  {
    phaseId: '8r_29',
    label: 'Post-Removal Runtime Verification Artifact Exporter',
    designDocPaths: ['docs/architecture/policy-post-removal-runtime-verification-artifact-exporter.md'],
    contractPaths: [
      'server/src/services/policyPostRemovalRuntimeVerificationArtifact.mjs',
      'scripts/generate-policy-post-removal-verification.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyPostRemovalRuntimeVerificationArtifact.test.mjs'],
  },
  {
    phaseId: '8r_30',
    label: 'Next Compatibility Removal Batch Authorization Artifact Exporter',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-next-compatibility-removal-batch-authorization-artifact-exporter.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8NextCompatibilityRemovalBatchAuthorizationArtifact.mjs',
      'scripts/generate-policy-builder-phase-8r-next-batch-authorization.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8NextCompatibilityRemovalBatchAuthorizationArtifact.test.mjs'],
  },
  {
    phaseId: '8r_31',
    label: 'Compatibility Removal Completion Audit Artifact Exporter',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-compatibility-removal-completion-audit-artifact-exporter.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact.mjs',
      'scripts/generate-policy-builder-phase-8r-completion-audit.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact.test.mjs'],
  },
  {
    phaseId: '8r_32',
    label: 'Completion Checkpoint Artifact Exporter',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-completion-checkpoint-artifact-exporter.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8CompletionCheckpointArtifact.mjs',
      'scripts/generate-policy-builder-phase-8r-completion-checkpoint.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8CompletionCheckpointArtifact.test.mjs'],
  },
  {
    phaseId: '8r_33',
    label: 'Final Closure Readout',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-final-closure-readout.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8FinalClosureReadout.mjs',
      'scripts/generate-policy-builder-phase-8r-final-closure-readout.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8FinalClosureReadout.test.mjs'],
  },
  {
    phaseId: '8r_34',
    label: 'Current Repository Closure Audit',
    designDocPaths: ['docs/architecture/policy-builder-phase-8r-current-repository-closure-audit.md'],
    contractPaths: [
      'server/src/services/policyBuilderPhase8CurrentRepositoryClosureAudit.mjs',
      'scripts/run-policy-builder-phase-8r-current-closure-audit.mjs',
    ],
    testPaths: ['server/src/__tests__/services/policyBuilderPhase8CurrentRepositoryClosureAudit.test.mjs'],
  },
]);

const DEFAULT_PHASE8R_ROADMAP_PATH =
  'docs/architecture/policy-builder-intent-model-roadmap.md';
const DEFAULT_CHANGELOG_PATH = 'CHANGELOG.md';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function evaluateComponentEvidence({
  artifactInventory = {},
  componentArtifactMap = PHASE8R_FINAL_REQUIREMENT_ARTIFACT_MAP,
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
      phaseId: normalizePhaseId(component.phaseId),
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
  componentArtifactMap = PHASE8R_FINAL_REQUIREMENT_ARTIFACT_MAP,
} = {}) {
  const sequencePhaseIds =
    asArray(roadmapEvidence.sequencePhaseIds).map(normalizePhaseId);
  const implementationStatusPhaseIds =
    asArray(roadmapEvidence.implementationStatusPhaseIds).map(normalizePhaseId);
  const expectedPhaseIds =
    asArray(componentArtifactMap).map(component => normalizePhaseId(component.phaseId));
  const missingSequencePhaseIds =
    expectedPhaseIds.filter(phaseId => !sequencePhaseIds.includes(phaseId));
  const missingImplementationStatusPhaseIds =
    expectedPhaseIds.filter(phaseId => !implementationStatusPhaseIds.includes(phaseId));

  return {
    sequenceCount: sequencePhaseIds.length,
    implementationStatusCount: implementationStatusPhaseIds.length,
    missingSequencePhaseIds,
    missingImplementationStatusPhaseIds,
  };
}

function evaluateChangelogEvidence({
  changelogEvidence = {},
  componentArtifactMap = PHASE8R_FINAL_REQUIREMENT_ARTIFACT_MAP,
} = {}) {
  const coveredPhaseIds = asArray(changelogEvidence.phaseIds).map(normalizePhaseId);
  const expectedPhaseIds =
    asArray(componentArtifactMap).map(component => normalizePhaseId(component.phaseId));
  const missingPhaseIds =
    expectedPhaseIds.filter(phaseId => !coveredPhaseIds.includes(phaseId));

  return {
    updated: changelogEvidence.updated === true,
    coveredPhaseIds,
    missingPhaseIds,
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
  componentEvidence = {},
  roadmapEvidence = {},
  changelogEvidence = {},
  sideEffects = {},
} = {}) {
  const risks = [];
  const normalizedCurrentClosureAudit = asObject(currentClosureAudit);

  if (Object.keys(normalizedCurrentClosureAudit).length === 0) {
    risks.push(buildRisk(
      PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_MISSING,
      'Final requirement completion audit requires a Phase 8R.34 current repository closure audit.'
    ));
  }

  if (
    Object.keys(normalizedCurrentClosureAudit).length > 0 &&
    (
      normalizedCurrentClosureAudit.statusId !==
        PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS.COMPLETE ||
      normalizedCurrentClosureAudit.complete !== true
    )
  ) {
    risks.push(buildRisk(
      PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_NOT_COMPLETE,
      'Final requirement completion audit requires a complete Phase 8R.34 current repository closure audit.',
      {
        currentClosureAuditStatusId:
          normalizedCurrentClosureAudit.statusId || null,
      }
    ));
  }

  if (
    Object.keys(normalizedCurrentClosureAudit).length > 0 &&
    normalizedCurrentClosureAudit.validation?.ok !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_VALIDATION_FAILED,
      'Final requirement completion audit requires valid Phase 8R.34 current repository closure audit evidence.',
      {
        currentClosureAuditValidationIssueCount:
          normalizedCurrentClosureAudit.validation?.issueCount ?? null,
      }
    ));
  }

  asArray(componentEvidence.componentsWithMissingArtifacts).forEach(component => {
    risks.push(buildRisk(
      PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
        .COMPONENT_ARTIFACT_MISSING,
      'Final requirement completion audit requires every Phase 8R component artifact to exist in the current checkout.',
      {
        phaseId: component.phaseId,
        label: component.label,
        missingDesignDocPaths: component.missingDesignDocPaths,
        missingContractPaths: component.missingContractPaths,
        missingTestPaths: component.missingTestPaths,
      }
    ));

    if (asArray(component.missingDesignDocPaths).length > 0) {
      risks.push(buildRisk(
        PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
          .COMPONENT_DESIGN_DOC_MISSING,
        'Final requirement completion audit requires a design/outcome document for every Phase 8R component.',
        {
          phaseId: component.phaseId,
          label: component.label,
          missingDesignDocPaths: component.missingDesignDocPaths,
        }
      ));
    }

    if (asArray(component.missingContractPaths).length > 0) {
      risks.push(buildRisk(
        PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
          .COMPONENT_CONTRACT_EVIDENCE_MISSING,
        'Final requirement completion audit requires service, script, route, migration, or wiring evidence for every Phase 8R component.',
        {
          phaseId: component.phaseId,
          label: component.label,
          missingContractPaths: component.missingContractPaths,
        }
      ));
    }

    if (asArray(component.missingTestPaths).length > 0) {
      risks.push(buildRisk(
        PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
          .COMPONENT_TEST_EVIDENCE_MISSING,
        'Final requirement completion audit requires focused test evidence for every Phase 8R component.',
        {
          phaseId: component.phaseId,
          label: component.label,
          missingTestPaths: component.missingTestPaths,
        }
      ));
    }
  });

  if (asArray(roadmapEvidence.missingSequencePhaseIds).length > 0) {
    risks.push(buildRisk(
      PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
        .ROADMAP_SEQUENCE_MISSING,
      'Final requirement completion audit requires the Phase 8R work sequence to include every component.',
      { missingPhaseIds: roadmapEvidence.missingSequencePhaseIds }
    ));
  }

  if (asArray(roadmapEvidence.missingImplementationStatusPhaseIds).length > 0) {
    risks.push(buildRisk(
      PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
        .ROADMAP_IMPLEMENTATION_STATUS_MISSING,
      'Final requirement completion audit requires the Phase 8R component map to include every implementation-status section.',
      { missingPhaseIds: roadmapEvidence.missingImplementationStatusPhaseIds }
    ));
  }

  if (
    changelogEvidence.updated !== true ||
    asArray(changelogEvidence.missingPhaseIds).length > 0
  ) {
    risks.push(buildRisk(
      PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
        .CHANGELOG_ENTRY_MISSING,
      'Final requirement completion audit requires changelog coverage for every Phase 8R component.',
      { missingPhaseIds: changelogEvidence.missingPhaseIds }
    ));
  }

  Object.entries(sideEffects || {}).forEach(([key, value]) => {
    if (key !== 'filesRead' && value === true) {
      risks.push(buildRisk(
        PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Final requirement completion audit cannot report side effect "${key}".`,
        { sideEffect: key }
      ));
    }
  });

  return risks;
}

function determineStatusId({
  risks = [],
  currentClosureAudit = {},
  componentEvidence = {},
  roadmapEvidence = {},
  changelogEvidence = {},
  sideEffects = {},
} = {}) {
  if (risks.length === 0) {
    return PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS.COMPLETE;
  }

  if (Object.entries(sideEffects || {}).some(([key, value]) => (
    key !== 'filesRead' && value === true
  ))) {
    return PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS
      .BLOCKED_BY_SIDE_EFFECTS;
  }

  if (
    currentClosureAudit.statusId !==
      PHASE8R_CURRENT_REPOSITORY_CLOSURE_AUDIT_STATUS_IDS.COMPLETE ||
    currentClosureAudit.complete !== true ||
    currentClosureAudit.validation?.ok !== true
  ) {
    return PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS
      .BLOCKED_BY_CURRENT_CLOSURE;
  }

  if (componentEvidence.missingArtifactCount > 0) {
    return PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS
      .BLOCKED_BY_COMPONENT_EVIDENCE;
  }

  if (
    asArray(roadmapEvidence.missingSequencePhaseIds).length > 0 ||
    asArray(roadmapEvidence.missingImplementationStatusPhaseIds).length > 0
  ) {
    return PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS
      .BLOCKED_BY_ROADMAP_EVIDENCE;
  }

  if (
    changelogEvidence.updated !== true ||
    asArray(changelogEvidence.missingPhaseIds).length > 0
  ) {
    return PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS
      .BLOCKED_BY_CHANGELOG;
  }

  return PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS
    .BLOCKED_BY_COMPONENT_EVIDENCE;
}

function buildPolicyBuilderPhase8FinalRequirementCompletionAudit({
  cwd = process.cwd(),
  currentClosureAudit = {},
  componentArtifactMap = PHASE8R_FINAL_REQUIREMENT_ARTIFACT_MAP,
  roadmapPath = DEFAULT_PHASE8R_ROADMAP_PATH,
  changelogPath = DEFAULT_CHANGELOG_PATH,
  generatedAt = null,
  sideEffects = {},
  fileExists = defaultFileExists,
  readTextFile = defaultReadTextFile,
} = {}) {
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
  const rawRoadmapEvidence = extractRoadmapEvidence(roadmapContent);
  const rawChangelogEvidence = extractChangelogEvidence({
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
    componentEvidence,
    roadmapEvidence,
    changelogEvidence,
    sideEffects: combinedSideEffects,
  });
  const statusId = determineStatusId({
    risks,
    currentClosureAudit: asObject(currentClosureAudit),
    componentEvidence,
    roadmapEvidence,
    changelogEvidence,
    sideEffects: combinedSideEffects,
  });
  const audit = {
    version: PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    statusId,
    complete:
      statusId ===
        PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
    evidenceScope: {
      phaseRange: '8R.1-8R.34',
      componentCount: asArray(componentArtifactMap).length,
      roadmapPath,
      changelogPath,
      requiresCurrentClosureAudit: true,
    },
    currentClosureAudit: {
      statusId: currentClosureAudit.statusId || null,
      complete: currentClosureAudit.complete === true,
      validationOk: currentClosureAudit.validation?.ok === true,
      riskCount: currentClosureAudit.riskCount ?? null,
    },
    artifactInventory: artifactInventoryResult,
    componentEvidence,
    roadmapEvidence: {
      raw: rawRoadmapEvidence,
      ...roadmapEvidence,
    },
    changelogEvidence: {
      raw: rawChangelogEvidence,
      ...changelogEvidence,
    },
    summary: {
      currentClosureAuditComplete: currentClosureAudit.complete === true,
      currentClosureAuditValidationOk: currentClosureAudit.validation?.ok === true,
      expectedComponentCount: componentEvidence.expectedCount,
      implementedComponentCount: componentEvidence.implementedCount,
      missingComponentArtifactCount: componentEvidence.missingArtifactCount,
      missingRoadmapSequenceCount:
        roadmapEvidence.missingSequencePhaseIds.length,
      missingRoadmapImplementationStatusCount:
        roadmapEvidence.missingImplementationStatusPhaseIds.length,
      missingChangelogCount: changelogEvidence.missingPhaseIds.length,
    },
    riskCount: risks.length,
    risks,
    sideEffects: combinedSideEffects,
    executionPolicy: {
      readsCurrentRepositoryFiles: true,
      requireCurrentClosureAudit: true,
      requireAllPhase8RComponentArtifacts: true,
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
      phaseId: '8r_complete',
      label: 'Phase 8R Requirement Completion',
      complete:
        statusId ===
          PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
      reason: statusId ===
        PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS.COMPLETE
        ? 'Phase 8R.1 through 8R.34 are covered by current closure, artifact, roadmap, changelog, and validation evidence.'
        : 'Phase 8R completion remains blocked until the reported current-state evidence gaps are resolved.',
    },
  };

  return {
    ...audit,
    validation:
      validatePolicyBuilderPhase8FinalRequirementCompletionAudit(audit),
  };
}

function validatePolicyBuilderPhase8FinalRequirementCompletionAudit(audit = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS)
    .includes(audit.statusId)) {
    issues.push(buildRisk(
      PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      'Final requirement completion audit status must be known.'
    ));
  }

  if (audit.riskCount !== asArray(audit.risks).length) {
    issues.push(buildRisk(
      PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Final requirement completion audit risk count must match risk list length.'
    ));
  }

  if (
    audit.statusId ===
      PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS.COMPLETE &&
    audit.complete !== true
  ) {
    issues.push(buildRisk(
      PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
        .COMPLETE_FLAG_MISMATCH,
      'Final requirement completion audit complete flag must match complete status.'
    ));
  }

  Object.entries(audit.sideEffects || {}).forEach(([key, value]) => {
    if (key !== 'filesRead' && value === true) {
      issues.push(buildRisk(
        PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS
          .SIDE_EFFECT_REPORTED,
        `Final requirement completion audit cannot report side effect "${key}".`,
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
  PHASE8R_FINAL_REQUIREMENT_ARTIFACT_MAP,
  PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_RISK_IDS,
  PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_STATUS_IDS,
  PHASE8R_FINAL_REQUIREMENT_COMPLETION_AUDIT_VERSION,
  buildPolicyBuilderPhase8FinalRequirementCompletionAudit,
  evaluateChangelogEvidence,
  evaluateComponentEvidence,
  evaluateRoadmapEvidence,
  validatePolicyBuilderPhase8FinalRequirementCompletionAudit,
};
