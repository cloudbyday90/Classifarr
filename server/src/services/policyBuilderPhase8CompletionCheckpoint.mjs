import {
  PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from './policyBuilderPhase8CompatibilityRemovalCompletionAudit.mjs';

const PHASE8R_COMPLETION_CHECKPOINT_VERSION =
  'phase8r.completion_checkpoint.v1';

const PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED_BY_COMPONENT_COVERAGE: 'blocked_by_component_coverage',
  BLOCKED_BY_ROADMAP_EVIDENCE: 'blocked_by_roadmap_evidence',
  BLOCKED_BY_FINAL_REMOVAL_AUDIT: 'blocked_by_final_removal_audit',
  BLOCKED_BY_VALIDATION: 'blocked_by_validation',
  BLOCKED_BY_CHANGELOG: 'blocked_by_changelog',
});

const PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS = Object.freeze({
  MISSING_COMPONENT_EVIDENCE: 'missing_component_evidence',
  COMPONENT_NOT_IMPLEMENTED: 'component_not_implemented',
  COMPONENT_MISSING_DESIGN_DOC: 'component_missing_design_doc',
  COMPONENT_MISSING_CONTRACT_EVIDENCE: 'component_missing_contract_evidence',
  COMPONENT_MISSING_TEST_EVIDENCE: 'component_missing_test_evidence',
  ROADMAP_SEQUENCE_INCOMPLETE: 'roadmap_sequence_incomplete',
  ROADMAP_IMPLEMENTATION_STATUS_INCOMPLETE: 'roadmap_implementation_status_incomplete',
  FINAL_REMOVAL_AUDIT_NOT_COMPLETE: 'final_removal_audit_not_complete',
  FINAL_REMOVAL_AUDIT_VALIDATION_FAILED: 'final_removal_audit_validation_failed',
  FOCUSED_VALIDATION_MISSING: 'focused_validation_missing',
  FOCUSED_VALIDATION_FAILED: 'focused_validation_failed',
  LINT_VALIDATION_MISSING: 'lint_validation_missing',
  LINT_VALIDATION_FAILED: 'lint_validation_failed',
  MARKDOWN_VALIDATION_MISSING: 'markdown_validation_missing',
  MARKDOWN_VALIDATION_FAILED: 'markdown_validation_failed',
  FULL_VALIDATION_MISSING: 'full_validation_missing',
  FULL_VALIDATION_FAILED: 'full_validation_failed',
  CHANGELOG_ENTRY_MISSING: 'changelog_entry_missing',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
});

const PHASE8R_EXPECTED_COMPONENTS = Object.freeze([
  { phaseId: '8r_1', label: 'Native Schema Contract' },
  { phaseId: '8r_2', label: 'Migration Candidate Report' },
  { phaseId: '8r_3', label: 'Explicit Conversion Workflow' },
  { phaseId: '8r_4', label: 'Native Runtime Read Path' },
  { phaseId: '8r_5', label: 'Rollback Snapshot And Reversion Window' },
  { phaseId: '8r_6', label: 'Legacy Write Path Shutdown' },
  { phaseId: '8r_7', label: 'Legacy Code Deletion Gates' },
  { phaseId: '8r_8', label: 'Backup, Restore, And Post-Upgrade Safety' },
  { phaseId: '8r_9', label: 'Native Storage Test Reset' },
  { phaseId: '8r_10', label: 'Native Backup And Restore Wiring' },
  { phaseId: '8r_11', label: 'Post-Upgrade Dry-Run Wiring' },
  { phaseId: '8r_12', label: 'Post-Upgrade Apply Gate' },
  { phaseId: '8r_13', label: 'Native Runtime Cutover Verification' },
  { phaseId: '8r_14', label: 'Compatibility Path Deletion Readiness' },
  { phaseId: '8r_15', label: 'Compatibility Path Deletion Execution Plan' },
  { phaseId: '8r_16', label: 'Compatibility Path Deletion Execution Gate' },
  { phaseId: '8r_17', label: 'Controlled Compatibility Path Removal' },
  { phaseId: '8r_18', label: 'Controlled Compatibility Path Removal Apply' },
  { phaseId: '8r_19', label: 'Post-Removal Runtime Verification' },
  { phaseId: '8r_20', label: 'Next Compatibility Removal Batch Authorization' },
  { phaseId: '8r_21', label: 'Compatibility Removal Completion Audit' },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePhaseId(value = '') {
  return String(value || '').trim().toLowerCase().replace('.', 'r_');
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function getComponentEvidenceByPhaseId(componentEvidence = []) {
  return new Map(asArray(componentEvidence)
    .map(component => [normalizePhaseId(component.phaseId), component]));
}

function evaluateComponentCoverage({
  expectedComponents = PHASE8R_EXPECTED_COMPONENTS,
  componentEvidence = [],
} = {}) {
  const risks = [];
  const evidenceByPhaseId = getComponentEvidenceByPhaseId(componentEvidence);
  const componentSummaries = expectedComponents.map(expected => {
    const phaseId = normalizePhaseId(expected.phaseId);
    const evidence = evidenceByPhaseId.get(phaseId);

    if (!evidence) {
      risks.push(buildRisk(
        PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.MISSING_COMPONENT_EVIDENCE,
        'Phase 8R completion checkpoint requires evidence for every expected component.',
        {
          phaseId,
          label: expected.label,
        }
      ));

      return {
        phaseId,
        label: expected.label,
        implemented: false,
        designDocPresent: false,
        contractEvidencePresent: false,
        testEvidencePresent: false,
        changelogEntryPresent: false,
      };
    }

    if (evidence.implemented !== true) {
      risks.push(buildRisk(
        PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_NOT_IMPLEMENTED,
        'Phase 8R component evidence must mark the component as implemented.',
        { phaseId, label: expected.label }
      ));
    }

    if (evidence.designDocPresent !== true) {
      risks.push(buildRisk(
        PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_DESIGN_DOC,
        'Phase 8R component evidence must include a design/outcome document.',
        { phaseId, label: expected.label }
      ));
    }

    if (evidence.contractEvidencePresent !== true) {
      risks.push(buildRisk(
        PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_CONTRACT_EVIDENCE,
        'Phase 8R component evidence must include service, route, migration, or wiring contract evidence.',
        { phaseId, label: expected.label }
      ));
    }

    if (evidence.testEvidencePresent !== true) {
      risks.push(buildRisk(
        PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_TEST_EVIDENCE,
        'Phase 8R component evidence must include focused test evidence.',
        { phaseId, label: expected.label }
      ));
    }

    return {
      phaseId,
      label: evidence.label || expected.label,
      implemented: evidence.implemented === true,
      designDocPresent: evidence.designDocPresent === true,
      contractEvidencePresent: evidence.contractEvidencePresent === true,
      testEvidencePresent: evidence.testEvidencePresent === true,
      changelogEntryPresent: evidence.changelogEntryPresent === true,
    };
  });

  return {
    expectedCount: expectedComponents.length,
    providedCount: evidenceByPhaseId.size,
    implementedCount: componentSummaries.filter(component => component.implemented).length,
    documentedCount:
      componentSummaries.filter(component => component.designDocPresent).length,
    contractEvidenceCount:
      componentSummaries.filter(component => component.contractEvidencePresent).length,
    testEvidenceCount:
      componentSummaries.filter(component => component.testEvidencePresent).length,
    components: componentSummaries,
    risks,
  };
}

function evaluateRoadmapEvidence({
  roadmapEvidence = {},
  expectedComponents = PHASE8R_EXPECTED_COMPONENTS,
} = {}) {
  const risks = [];
  const sequencePhaseIds =
    asArray(roadmapEvidence.sequencePhaseIds).map(normalizePhaseId);
  const implementationStatusPhaseIds =
    asArray(roadmapEvidence.implementationStatusPhaseIds).map(normalizePhaseId);
  const expectedPhaseIds = expectedComponents.map(component => normalizePhaseId(component.phaseId));
  const missingSequencePhaseIds =
    expectedPhaseIds.filter(phaseId => !sequencePhaseIds.includes(phaseId));
  const missingImplementationStatusPhaseIds =
    expectedPhaseIds.filter(phaseId => !implementationStatusPhaseIds.includes(phaseId));

  if (missingSequencePhaseIds.length > 0) {
    risks.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.ROADMAP_SEQUENCE_INCOMPLETE,
      'Phase 8R roadmap work sequence must include every expected component.',
      { missingPhaseIds: missingSequencePhaseIds }
    ));
  }

  if (missingImplementationStatusPhaseIds.length > 0) {
    risks.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.ROADMAP_IMPLEMENTATION_STATUS_INCOMPLETE,
      'Phase 8R roadmap implementation status must include every expected component.',
      { missingPhaseIds: missingImplementationStatusPhaseIds }
    ));
  }

  return {
    sequenceCount: sequencePhaseIds.length,
    implementationStatusCount: implementationStatusPhaseIds.length,
    missingSequencePhaseIds,
    missingImplementationStatusPhaseIds,
    risks,
  };
}

function evaluateFinalRemovalAudit(finalRemovalAudit = {}) {
  const risks = [];

  if (
    finalRemovalAudit.statusId !==
      PHASE8R_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE ||
    finalRemovalAudit.complete !== true
  ) {
    risks.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_NOT_COMPLETE,
      'Phase 8R completion checkpoint requires a complete Phase 8R.21 removal audit.',
      { statusId: finalRemovalAudit.statusId || null }
    ));
  }

  if (finalRemovalAudit.validation?.ok !== true) {
    risks.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_VALIDATION_FAILED,
      'Phase 8R completion checkpoint requires valid Phase 8R.21 removal audit evidence.',
      { issueCount: finalRemovalAudit.validation?.issueCount ?? null }
    ));
  }

  return {
    statusId: finalRemovalAudit.statusId || null,
    complete: finalRemovalAudit.complete === true,
    validationOk: finalRemovalAudit.validation?.ok === true,
    risks,
  };
}

function evaluateValidationEvidence(validationEvidence = {}) {
  const risks = [];
  const checks = [
    {
      key: 'focused',
      missingRiskId: PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FOCUSED_VALIDATION_MISSING,
      failedRiskId: PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FOCUSED_VALIDATION_FAILED,
      missingMessage:
        'Phase 8R completion checkpoint requires focused Phase 8R validation evidence.',
      failedMessage: 'Phase 8R focused validation failed.',
    },
    {
      key: 'lint',
      missingRiskId: PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.LINT_VALIDATION_MISSING,
      failedRiskId: PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.LINT_VALIDATION_FAILED,
      missingMessage: 'Phase 8R completion checkpoint requires lint validation evidence.',
      failedMessage: 'Phase 8R lint validation failed.',
    },
    {
      key: 'markdown',
      missingRiskId: PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.MARKDOWN_VALIDATION_MISSING,
      failedRiskId: PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.MARKDOWN_VALIDATION_FAILED,
      missingMessage: 'Phase 8R completion checkpoint requires markdown validation evidence.',
      failedMessage: 'Phase 8R markdown validation failed.',
    },
    {
      key: 'full',
      missingRiskId: PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FULL_VALIDATION_MISSING,
      failedRiskId: PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FULL_VALIDATION_FAILED,
      missingMessage: 'Phase 8R completion checkpoint requires full server validation evidence.',
      failedMessage: 'Phase 8R full validation failed.',
    },
  ];

  checks.forEach(check => {
    const evidence = validationEvidence[check.key];

    if (!evidence) {
      risks.push(buildRisk(check.missingRiskId, check.missingMessage));
    } else if (evidence.passed !== true) {
      risks.push(buildRisk(check.failedRiskId, check.failedMessage, {
        command: evidence.command || null,
        message: evidence.message || null,
      }));
    }
  });

  return risks;
}

function evaluateChangelogEvidence({
  componentCoverage = {},
  changelogEvidence = {},
} = {}) {
  const risks = [];
  const coveredPhaseIds = asArray(changelogEvidence.phaseIds).map(normalizePhaseId);
  const missingPhaseIds = asArray(componentCoverage.components)
    .filter(component => !coveredPhaseIds.includes(component.phaseId))
    .map(component => component.phaseId);

  if (changelogEvidence.updated !== true || missingPhaseIds.length > 0) {
    risks.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.CHANGELOG_ENTRY_MISSING,
      'Phase 8R completion checkpoint requires changelog coverage for every expected component.',
      { missingPhaseIds }
    ));
  }

  return {
    updated: changelogEvidence.updated === true,
    coveredPhaseIds,
    missingPhaseIds,
    risks,
  };
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.MISSING_COMPONENT_EVIDENCE,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_NOT_IMPLEMENTED,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_DESIGN_DOC,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_CONTRACT_EVIDENCE,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_TEST_EVIDENCE,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_COMPONENT_COVERAGE;
  }

  if (risks.some(risk => [
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.ROADMAP_SEQUENCE_INCOMPLETE,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.ROADMAP_IMPLEMENTATION_STATUS_INCOMPLETE,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE;
  }

  if (risks.some(risk => [
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_NOT_COMPLETE,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_FINAL_REMOVAL_AUDIT;
  }

  if (risks.some(risk => [
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FOCUSED_VALIDATION_MISSING,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FOCUSED_VALIDATION_FAILED,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.LINT_VALIDATION_MISSING,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.LINT_VALIDATION_FAILED,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.MARKDOWN_VALIDATION_MISSING,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.MARKDOWN_VALIDATION_FAILED,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FULL_VALIDATION_MISSING,
    PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.FULL_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_VALIDATION;
  }

  if (risks.some(risk => (
    risk.riskId === PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.CHANGELOG_ENTRY_MISSING
  ))) {
    return PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_CHANGELOG;
  }

  return PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE;
}

function buildPolicyBuilderPhase8CompletionCheckpoint({
  expectedComponents = PHASE8R_EXPECTED_COMPONENTS,
  componentEvidence = [],
  roadmapEvidence = {},
  finalRemovalAudit = {},
  validationEvidence = {},
  changelogEvidence = {},
  sideEffects = {},
} = {}) {
  const componentCoverage = evaluateComponentCoverage({
    expectedComponents,
    componentEvidence,
  });
  const roadmap = evaluateRoadmapEvidence({
    roadmapEvidence,
    expectedComponents,
  });
  const finalRemoval = evaluateFinalRemovalAudit(finalRemovalAudit);
  const changelog = evaluateChangelogEvidence({
    componentCoverage,
    changelogEvidence,
  });
  const risks = [
    ...componentCoverage.risks,
    ...roadmap.risks,
    ...finalRemoval.risks,
    ...evaluateValidationEvidence(validationEvidence),
    ...changelog.risks,
  ];
  const checkpoint = {
    version: PHASE8R_COMPLETION_CHECKPOINT_VERSION,
    statusId: determineStatusId(risks),
    complete: risks.length === 0,
    componentCoverage,
    roadmapEvidence: roadmap,
    finalRemovalAudit: finalRemoval,
    validationEvidence: {
      focused: validationEvidence.focused || null,
      lint: validationEvidence.lint || null,
      markdown: validationEvidence.markdown || null,
      full: validationEvidence.full || null,
    },
    changelogEvidence: changelog,
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
        'When the checkpoint is complete, Phase 8R has current evidence for roadmap coverage, contracts, tests, docs, changelog, validation, and removal-loop closure.',
    },
  };

  return {
    ...checkpoint,
    validation: validatePolicyBuilderPhase8CompletionCheckpoint(checkpoint),
  };
}

function validatePolicyBuilderPhase8CompletionCheckpoint(checkpoint = {}) {
  const issues = [];

  if (!Object.values(PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS)
    .includes(checkpoint.statusId)) {
    issues.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.UNKNOWN_STATUS,
      'Phase 8R completion checkpoint status must be known.'
    ));
  }

  if (checkpoint.riskCount !== asArray(checkpoint.risks).length) {
    issues.push(buildRisk(
      PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Phase 8R completion checkpoint risk count must match risk list length.'
    ));
  }

  Object.entries(checkpoint.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Phase 8R completion checkpoint cannot perform side effect "${key}".`
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
  PHASE8R_COMPLETION_CHECKPOINT_RISK_IDS,
  PHASE8R_COMPLETION_CHECKPOINT_STATUS_IDS,
  PHASE8R_COMPLETION_CHECKPOINT_VERSION,
  PHASE8R_EXPECTED_COMPONENTS,
  buildPolicyBuilderPhase8CompletionCheckpoint,
  validatePolicyBuilderPhase8CompletionCheckpoint,
};
