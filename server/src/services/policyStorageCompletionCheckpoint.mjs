import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from './policyCompatibilityRemovalCompletionAudit.mjs';
import {
  validatePolicyCompatibilityRemovalCompletionAuditArtifactIntegrity,
} from './policyCompatibilityRemovalCompletionAuditArtifactIntegrity.mjs';
import {
  POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS,
  buildPolicyStorageImplementationReadiness,
} from './policyStorageImplementationReadiness.mjs';

const POLICY_STORAGE_COMPLETION_CHECKPOINT_VERSION =
  'policy.storage_completion_checkpoint.v4';

const POLICY_STORAGE_COMPLETION_CHECKPOINT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED_BY_COMPONENT_COVERAGE: 'blocked_by_component_coverage',
  BLOCKED_BY_ROADMAP_EVIDENCE: 'blocked_by_roadmap_evidence',
  BLOCKED_BY_FINAL_REMOVAL_AUDIT: 'blocked_by_final_removal_audit',
  BLOCKED_BY_VALIDATION: 'blocked_by_validation',
  BLOCKED_BY_CHANGELOG: 'blocked_by_changelog',
});

const POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS = Object.freeze({
  ...POLICY_STORAGE_IMPLEMENTATION_READINESS_RISK_IDS,
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
  VALIDATION_EVIDENCE_ARTIFACT_INTEGRITY_FAILED:
    'validation_evidence_artifact_integrity_failed',
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
    componentId: 'semantic_native_authority_eligibility',
    label: 'Semantic Native Authority Eligibility And Empty-Intent Recovery',
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
    componentId: 'initial_native_intent_establishment',
    label: 'Initial Native Intent Establishment',
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

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
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

function determineStatusId(risks = []) {
  if (risks.some(risk => [
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS.MISSING_EXPECTED_COMPONENTS,
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
    POLICY_STORAGE_COMPLETION_CHECKPOINT_RISK_IDS
      .VALIDATION_EVIDENCE_ARTIFACT_INTEGRITY_FAILED,
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
  const implementationReadiness = buildPolicyStorageImplementationReadiness({
    expectedComponents,
    componentEvidence,
    roadmapEvidence,
    validationEvidence,
    changelogEvidence,
    sideEffects,
  });
  const finalRemoval = await evaluateFinalRemovalAudit(completionAuditArtifact);
  const risks = [
    ...implementationReadiness.risks,
    ...finalRemoval.risks,
  ];
  const checkpoint = {
    version: POLICY_STORAGE_COMPLETION_CHECKPOINT_VERSION,
    statusId: determineStatusId(risks),
    complete: risks.length === 0,
    implementationReadiness: {
      statusId: implementationReadiness.statusId,
      ready: implementationReadiness.ready,
      riskCount: implementationReadiness.riskCount,
      risks: implementationReadiness.risks,
      validationOk: implementationReadiness.validation?.ok === true,
    },
    componentCoverage: implementationReadiness.componentCoverage,
    roadmapEvidence: implementationReadiness.roadmapEvidence,
    finalRemovalAudit: finalRemoval,
    validationEvidence: implementationReadiness.validationEvidence,
    validationEvidenceIntegrity: implementationReadiness.validationEvidenceIntegrity,
    changelogEvidence: implementationReadiness.changelogEvidence,
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
        'The source implementation and the active-installation compatibility-removal audit must both be complete before storage closure can pass.',
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
