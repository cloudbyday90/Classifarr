import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from './policyCompatibilityRemovalCompletionAudit.mjs';
import {
  validatePolicyCompatibilityRemovalCompletionAuditArtifactIntegrity,
} from './policyCompatibilityRemovalCompletionAuditArtifactIntegrity.mjs';

const POLICY_STORAGE_COMPLETION_CHECKPOINT_VERSION =
  'policy.storage_completion_checkpoint.v2';

const POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED_BY_COMPONENT_COVERAGE: 'blocked_by_component_coverage',
  BLOCKED_BY_ROADMAP_EVIDENCE: 'blocked_by_roadmap_evidence',
  BLOCKED_BY_FINAL_REMOVAL_AUDIT: 'blocked_by_final_removal_audit',
  BLOCKED_BY_VALIDATION: 'blocked_by_validation',
  BLOCKED_BY_CHANGELOG: 'blocked_by_changelog',
});

const POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS = Object.freeze({
  MISSING_COMPONENT_EVIDENCE: 'missing_component_evidence',
  COMPONENT_NOT_IMPLEMENTED: 'component_not_implemented',
  COMPONENT_MISSING_DESIGN_DOC: 'component_missing_design_doc',
  COMPONENT_MISSING_CONTRACT_EVIDENCE: 'component_missing_contract_evidence',
  COMPONENT_MISSING_TEST_EVIDENCE: 'component_missing_test_evidence',
  ROADMAP_SEQUENCE_INCOMPLETE: 'roadmap_sequence_incomplete',
  ROADMAP_IMPLEMENTATION_STATUS_INCOMPLETE: 'roadmap_implementation_status_incomplete',
  FINAL_REMOVAL_AUDIT_ARTIFACT_INTEGRITY_FAILED:
    'final_removal_audit_artifact_integrity_failed',
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

const POLICY_STORAGE_COMPLETION_COMPONENTS = Object.freeze([
  {
    componentId: 'native_schema_contract',
    label: 'Native Schema Contract',
  },
  {
    componentId: 'active_native_intent_integrity_correction',
    label: 'Active Native Intent Integrity Correction',
  },
  {
    componentId: 'migration_candidate_report',
    label: 'Migration Candidate Report',
  },
  {
    componentId: 'candidate_authority_eligibility',
    label: 'Candidate Authority Eligibility',
  },
  {
    componentId: 'explicit_conversion_workflow',
    label: 'Explicit Conversion Workflow',
  },
  {
    componentId: 'native_runtime_read_path',
    label: 'Native Runtime Read Path',
  },
  {
    componentId: 'runtime_authority_selection_integrity',
    label: 'Runtime Authority Selection Integrity',
  },
  {
    componentId: 'rollback_snapshot_reversion_window',
    label: 'Rollback Snapshot And Reversion Window',
  },
  {
    componentId: 'transactional_native_authority_reversion',
    label: 'Transactional Native Authority Reversion',
  },
  {
    componentId: 'rollback_snapshot_retention_cleanup',
    label: 'Rollback Snapshot Retention Cleanup',
  },
  {
    componentId: 'legacy_write_path_shutdown',
    label: 'Legacy Write Path Shutdown',
  },
  {
    componentId: 'legacy_code_deletion_gates',
    label: 'Legacy Code Deletion Gates',
  },
  {
    componentId: 'backup_restore_post_upgrade_safety',
    label: 'Backup, Restore, And Post-Upgrade Safety',
  },
  {
    componentId: 'native_storage_test_reset',
    label: 'Native Storage Test Reset',
  },
  {
    componentId: 'native_backup_restore_wiring',
    label: 'Native Backup And Restore Wiring',
  },
  {
    componentId: 'post_upgrade_dry_run_wiring',
    label: 'Post-Upgrade Dry-Run Wiring',
  },
  {
    componentId: 'post_upgrade_apply_gate',
    label: 'Post-Upgrade Apply Gate',
  },
  {
    componentId: 'native_runtime_cutover_verification',
    label: 'Native Runtime Cutover Verification',
  },
  {
    componentId: 'compatibility_path_deletion_readiness',
    label: 'Compatibility Path Deletion Readiness',
  },
  {
    componentId: 'compatibility_path_deletion_execution_plan',
    label: 'Compatibility Path Deletion Execution Plan',
  },
  {
    componentId: 'compatibility_path_deletion_execution_gate',
    label: 'Compatibility Path Deletion Execution Gate',
  },
  {
    componentId: 'controlled_compatibility_path_removal',
    label: 'Controlled Compatibility Path Removal',
  },
  {
    componentId: 'controlled_compatibility_path_removal_apply',
    label: 'Controlled Compatibility Path Removal Apply',
  },
  {
    componentId: 'post_removal_runtime_verification',
    label: 'Post-Removal Runtime Verification',
  },
  {
    componentId: 'next_compatibility_removal_batch_authorization',
    label: 'Next Compatibility Removal Batch Authorization',
  },
  {
    componentId: 'compatibility_removal_completion_audit',
    label: 'Compatibility Removal Completion Audit',
  },
  {
    componentId: 'compatibility_removal_evidence_regeneration',
    label: 'Compatibility-Removal Evidence Regeneration',
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeComponentId(value = '') {
  return String(value || '').trim().toLowerCase();
}

function getEvidenceComponentId(component = {}) {
  return normalizeComponentId(component.componentId);
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function getComponentEvidenceByComponentId(componentEvidence = []) {
  return new Map(asArray(componentEvidence)
    .map(component => [getEvidenceComponentId(component), component]));
}

function evaluateComponentCoverage({
  expectedComponents = POLICY_STORAGE_COMPLETION_COMPONENTS,
  componentEvidence = [],
} = {}) {
  const risks = [];
  const evidenceByComponentId = getComponentEvidenceByComponentId(componentEvidence);
  const componentSummaries = expectedComponents.map(expected => {
    const componentId = normalizeComponentId(expected.componentId);
    const evidence = evidenceByComponentId.get(componentId);

    if (!evidence) {
      risks.push(buildRisk(
        POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.MISSING_COMPONENT_EVIDENCE,
        'Policy storage completion checkpoint requires evidence for every expected component.',
        {
          componentId,
          label: expected.label,
        }
      ));

      return {
        componentId,
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
        POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_NOT_IMPLEMENTED,
        'Storage completion component evidence must mark the component as implemented.',
        { componentId, label: expected.label }
      ));
    }

    if (evidence.designDocPresent !== true) {
      risks.push(buildRisk(
        POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_DESIGN_DOC,
        'Storage completion component evidence must include a design/outcome document.',
        { componentId, label: expected.label }
      ));
    }

    if (evidence.contractEvidencePresent !== true) {
      risks.push(buildRisk(
        POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_CONTRACT_EVIDENCE,
        'Storage completion component evidence must include service, route, migration, or wiring contract evidence.',
        { componentId, label: expected.label }
      ));
    }

    if (evidence.testEvidencePresent !== true) {
      risks.push(buildRisk(
        POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_TEST_EVIDENCE,
        'Storage completion component evidence must include focused test evidence.',
        { componentId, label: expected.label }
      ));
    }

    return {
      componentId,
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
    providedCount: evidenceByComponentId.size,
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
  expectedComponents = POLICY_STORAGE_COMPLETION_COMPONENTS,
} = {}) {
  const risks = [];
  const sequenceComponentIds = asArray(roadmapEvidence.componentSequenceIds)
    .map(normalizeComponentId);
  const implementationStatusComponentIds = asArray(roadmapEvidence.implementationStatusComponentIds)
    .map(normalizeComponentId);
  const expectedComponentIds =
    expectedComponents.map(component => normalizeComponentId(component.componentId));
  const missingSequenceComponentIds =
    expectedComponentIds.filter(componentId => !sequenceComponentIds.includes(componentId));
  const missingImplementationStatusComponentIds =
    expectedComponentIds
      .filter(componentId => !implementationStatusComponentIds.includes(componentId));

  if (missingSequenceComponentIds.length > 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.ROADMAP_SEQUENCE_INCOMPLETE,
      'Policy storage roadmap work sequence must include every expected component.',
      { missingComponentIds: missingSequenceComponentIds }
    ));
  }

  if (missingImplementationStatusComponentIds.length > 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.ROADMAP_IMPLEMENTATION_STATUS_INCOMPLETE,
      'Policy storage roadmap implementation status must include every expected component.',
      { missingComponentIds: missingImplementationStatusComponentIds }
    ));
  }

  return {
    sequenceCount: sequenceComponentIds.length,
    implementationStatusCount: implementationStatusComponentIds.length,
    missingSequenceComponentIds,
    missingImplementationStatusComponentIds,
    risks,
  };
}

async function evaluateFinalRemovalAudit(completionAuditArtifact = {}) {
  const risks = [];
  const integrity =
    await validatePolicyCompatibilityRemovalCompletionAuditArtifactIntegrity({
      completionAuditArtifact,
    });
  const finalRemovalAudit = integrity.audit;

  if (!integrity.ok) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS
        .FINAL_REMOVAL_AUDIT_ARTIFACT_INTEGRITY_FAILED,
      'Policy storage completion checkpoint requires a fingerprint-valid replayable compatibility-removal completion-audit artifact.',
      {
        issueCount: integrity.issueCount,
        issueRiskIds: integrity.issues.map(issue => issue.riskId),
      }
    ));
  }

  if (
    integrity.ok &&
    (finalRemovalAudit.statusId !==
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE ||
      finalRemovalAudit.complete !== true)
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_NOT_COMPLETE,
      'Policy storage completion checkpoint requires a complete compatibility-removal completion audit.',
      { statusId: finalRemovalAudit.statusId || null }
    ));
  }

  if (integrity.ok && finalRemovalAudit.validation?.ok !== true) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_VALIDATION_FAILED,
      'Policy storage completion checkpoint requires valid compatibility-removal completion-audit evidence.',
      { issueCount: finalRemovalAudit.validation?.issueCount ?? null }
    ));
  }

  return {
    statusId: finalRemovalAudit.statusId || null,
    complete: finalRemovalAudit.complete === true,
    validationOk: finalRemovalAudit.validation?.ok === true,
    integrityOk: integrity.ok,
    artifactFingerprint: integrity.artifactFingerprint,
    integrityIssueCount: integrity.issueCount,
    risks,
  };
}

function evaluateValidationEvidence(validationEvidence = {}) {
  const risks = [];
  const checks = [
    {
      key: 'focused',
      missingRiskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FOCUSED_VALIDATION_MISSING,
      failedRiskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FOCUSED_VALIDATION_FAILED,
      missingMessage:
        'Policy storage completion checkpoint requires focused validation evidence.',
      failedMessage: 'Policy storage focused validation failed.',
    },
    {
      key: 'lint',
      missingRiskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.LINT_VALIDATION_MISSING,
      failedRiskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.LINT_VALIDATION_FAILED,
      missingMessage: 'Policy storage completion checkpoint requires lint validation evidence.',
      failedMessage: 'Policy storage lint validation failed.',
    },
    {
      key: 'markdown',
      missingRiskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.MARKDOWN_VALIDATION_MISSING,
      failedRiskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.MARKDOWN_VALIDATION_FAILED,
      missingMessage: 'Policy storage completion checkpoint requires markdown validation evidence.',
      failedMessage: 'Policy storage markdown validation failed.',
    },
    {
      key: 'full',
      missingRiskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FULL_VALIDATION_MISSING,
      failedRiskId: POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FULL_VALIDATION_FAILED,
      missingMessage: 'Policy storage completion checkpoint requires full server validation evidence.',
      failedMessage: 'Policy storage full validation failed.',
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
  const coveredComponentIds = asArray(changelogEvidence.componentIds)
    .map(normalizeComponentId);
  const missingComponentIds = asArray(componentCoverage.components)
    .filter(component => !coveredComponentIds.includes(component.componentId))
    .map(component => component.componentId);

  if (changelogEvidence.updated !== true || missingComponentIds.length > 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.CHANGELOG_ENTRY_MISSING,
      'Policy storage completion checkpoint requires changelog coverage for every expected component.',
      { missingComponentIds }
    ));
  }

  return {
    updated: changelogEvidence.updated === true,
    coveredComponentIds,
    missingComponentIds,
    risks,
  };
}

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.MISSING_COMPONENT_EVIDENCE,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_NOT_IMPLEMENTED,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_DESIGN_DOC,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_CONTRACT_EVIDENCE,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.COMPONENT_MISSING_TEST_EVIDENCE,
  ].includes(risk.riskId))) {
    return POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_COMPONENT_COVERAGE;
  }

  if (risks.some(risk => [
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.ROADMAP_SEQUENCE_INCOMPLETE,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.ROADMAP_IMPLEMENTATION_STATUS_INCOMPLETE,
  ].includes(risk.riskId))) {
    return POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_ROADMAP_EVIDENCE;
  }

  if (risks.some(risk => [
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS
      .FINAL_REMOVAL_AUDIT_ARTIFACT_INTEGRITY_FAILED,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_NOT_COMPLETE,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FINAL_REMOVAL_AUDIT_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_FINAL_REMOVAL_AUDIT;
  }

  if (risks.some(risk => [
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FOCUSED_VALIDATION_MISSING,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FOCUSED_VALIDATION_FAILED,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.LINT_VALIDATION_MISSING,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.LINT_VALIDATION_FAILED,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.MARKDOWN_VALIDATION_MISSING,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.MARKDOWN_VALIDATION_FAILED,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FULL_VALIDATION_MISSING,
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.FULL_VALIDATION_FAILED,
  ].includes(risk.riskId))) {
    return POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_VALIDATION;
  }

  if (risks.some(risk => (
    risk.riskId === POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.CHANGELOG_ENTRY_MISSING
  ))) {
    return POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.BLOCKED_BY_CHANGELOG;
  }

  return POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS.COMPLETE;
}

async function buildPolicyStorageCompletionCheckpoint({
  expectedComponents = POLICY_STORAGE_COMPLETION_COMPONENTS,
  componentEvidence = [],
  roadmapEvidence = {},
  completionAuditArtifact = {},
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
  const finalRemoval = await evaluateFinalRemovalAudit(completionAuditArtifact);
  const changelog = evaluateChangelogEvidence({
    componentCoverage,
    changelogEvidence,
    expectedComponents,
  });
  const risks = [
    ...componentCoverage.risks,
    ...roadmap.risks,
    ...finalRemoval.risks,
    ...evaluateValidationEvidence(validationEvidence),
    ...changelog.risks,
  ];
  const checkpoint = {
    version: POLICY_STORAGE_COMPLETION_CHECKPOINT_VERSION,
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
    nextStep: {
      stepId: 'policy_storage_final_closure_readout',
      label: 'Policy Storage Final Closure Readout',
      reason:
        'When the checkpoint is complete, storage migration has current evidence for roadmap coverage, contracts, tests, docs, changelog, validation, and removal-loop closure.',
    },
  };

  return {
    ...checkpoint,
    validation: validatePolicyStorageCompletionCheckpoint(checkpoint),
  };
}

function validatePolicyStorageCompletionCheckpoint(checkpoint = {}) {
  const issues = [];

  if (!Object.values(POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS)
    .includes(checkpoint.statusId)) {
    issues.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.UNKNOWN_STATUS,
      'Policy storage completion checkpoint status must be known.'
    ));
  }

  if (checkpoint.riskCount !== asArray(checkpoint.risks).length) {
    issues.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.RISK_COUNT_MISMATCH,
      'Policy storage completion checkpoint risk count must match risk list length.'
    ));
  }

  Object.entries(checkpoint.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Policy storage completion checkpoint cannot perform side effect "${key}".`
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
  POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS,
  POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS,
  POLICY_STORAGE_COMPLETION_CHECKPOINT_VERSION,
  POLICY_STORAGE_COMPLETION_COMPONENTS,
  buildPolicyStorageCompletionCheckpoint,
  validatePolicyStorageCompletionCheckpoint,
};
