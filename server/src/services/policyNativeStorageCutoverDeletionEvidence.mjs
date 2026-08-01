/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
  validatePolicyCompatibilityRemovalCompletionAudit,
} from './policyCompatibilityRemovalCompletionAudit.mjs';
import {
  getPolicyCompatibilityMaintenanceTestRecord,
} from './policyCompatibilityMaintenanceTestOwnership.mjs';
import {
  POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS,
  buildPolicyNativeStorageCutoverTestHandoffAudit,
  listPolicyNativeStorageCutoverTestHandoffs,
} from './policyNativeStorageCutoverTestHandoff.mjs';
import {
  POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS,
  listPolicyStarterTemplateCompatibilityBridgeArtifacts,
} from './policyStarterTemplateCompatibilityBridgeInventory.mjs';

const POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_VERSION =
  'policy.native_storage_cutover_deletion_evidence.v1';

const POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS = Object.freeze({
  RETIREMENT_EVIDENCE_COMPLETE: 'retirement_evidence_complete',
  BLOCKED_BY_HANDOFF: 'blocked_by_handoff',
  BLOCKED_BY_COMPLETION_AUDIT: 'blocked_by_completion_audit',
  BLOCKED_BY_MANIFEST_COVERAGE: 'blocked_by_manifest_coverage',
  BLOCKED_BY_SHARED_TEST_SCOPE: 'blocked_by_shared_test_scope',
  BLOCKED_BY_SIDE_EFFECT: 'blocked_by_side_effect',
});

const POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS = Object.freeze({
  HANDOFF_AUDIT_NOT_READY: 'handoff_audit_not_ready',
  HANDOFF_AUDIT_AUTHORIZES_DELETION: 'handoff_audit_authorizes_deletion',
  COMPLETION_AUDIT_MISSING: 'completion_audit_missing',
  COMPLETION_AUDIT_INVALID: 'completion_audit_invalid',
  COMPLETION_AUDIT_INCOMPLETE: 'completion_audit_incomplete',
  AUTHORIZATION_EVIDENCE_INCOMPLETE: 'authorization_evidence_incomplete',
  REMOVAL_EVIDENCE_INCOMPLETE: 'removal_evidence_incomplete',
  FINAL_REFERENCE_SCAN_INCOMPLETE: 'final_reference_scan_incomplete',
  FINAL_REFERENCE_SCAN_REFERENCES_FOUND: 'final_reference_scan_references_found',
  FOCUSED_VALIDATION_INCOMPLETE: 'focused_validation_incomplete',
  FULL_VALIDATION_INCOMPLETE: 'full_validation_incomplete',
  COMPLETION_AUDIT_SIDE_EFFECT: 'completion_audit_side_effect',
  RETIRING_PATH_MISSING_FROM_MANIFEST: 'retiring_path_missing_from_manifest',
  RETIRING_PATH_NOT_REMOVED: 'retiring_path_not_removed',
  RETIRING_COMPONENT_ARTIFACT_INVALID: 'retiring_component_artifact_invalid',
  SHARED_SCOPE_SOURCE_MISSING: 'shared_scope_source_missing',
  SHARED_SCOPE_ASSERTION_REMAINS: 'shared_scope_assertion_remains',
  NATIVE_SUCCESSOR_SOURCE_MISSING: 'native_successor_source_missing',
  NATIVE_SUCCESSOR_ASSERTION_MISSING: 'native_successor_assertion_missing',
  UNKNOWN_STATUS: 'unknown_status',
  ISSUE_COUNT_MISMATCH: 'issue_count_mismatch',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePath(value) {
  return cleanString(value).replace(/\\/g, '/');
}

function uniquePaths(paths) {
  return [...new Set(asArray(paths).map(normalizePath).filter(Boolean))];
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))];
}

function getSourceText(sourceTextByPath, sourcePath) {
  if (sourceTextByPath instanceof Map) {
    return sourceTextByPath.get(sourcePath);
  }

  return sourceTextByPath?.[sourcePath];
}

function buildSideEffects(sideEffects = {}) {
  return {
    testsDeleted: sideEffects.testsDeleted === true,
    componentsDeleted: sideEffects.componentsDeleted === true,
    sourceFilesRewritten: sideEffects.sourceFilesRewritten === true,
    storageChanged: sideEffects.storageChanged === true,
  };
}

function hasSideEffects(sideEffects = {}) {
  return Object.values(sideEffects).some(Boolean);
}

function getRetiringComponentPaths(
  handoffs = listPolicyNativeStorageCutoverTestHandoffs(),
  artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts(),
) {
  return getCompatibilityComponentPaths(handoffs)
    .filter(componentPath => asArray(artifacts).some(artifact => (
      artifact.sourcePath === componentPath &&
      artifact.dispositionId ===
        POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS
          .DELETE_AFTER_NATIVE_STORAGE
    )));
}

function getCompatibilityComponentPaths(handoffs = listPolicyNativeStorageCutoverTestHandoffs()) {
  return uniquePaths(asArray(handoffs).flatMap(handoff => {
    const scope = getPolicyCompatibilityMaintenanceTestRecord(handoff.compatibilityScopeId);

    return asArray(scope?.componentPaths);
  }));
}

function getRetiringTestFilePaths(handoffs = listPolicyNativeStorageCutoverTestHandoffs()) {
  return uniquePaths(asArray(handoffs)
    .filter(handoff => handoff.sourceTestFileDispositionId ===
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS
        .DELETE_TEST_FILE_WITH_BRIDGE)
    .map(handoff => getPolicyCompatibilityMaintenanceTestRecord(
      handoff.compatibilityScopeId,
    )?.sourceTestPath));
}

function listSharedTestScopeHandoffs(handoffs = listPolicyNativeStorageCutoverTestHandoffs()) {
  return asArray(handoffs).filter(handoff => (
    handoff.sourceTestFileDispositionId ===
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS
        .REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE
  ));
}

function evaluateRetiringComponentArtifacts(handoffs, artifacts) {
  return getCompatibilityComponentPaths(handoffs).flatMap(componentPath => {
    const artifact = asArray(artifacts).find(record => record.sourcePath === componentPath);

    if (artifact?.dispositionId ===
        POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS
          .DELETE_AFTER_NATIVE_STORAGE) {
      return [];
    }

    return [{
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
        .RETIRING_COMPONENT_ARTIFACT_INVALID,
      componentPath,
      dispositionId: artifact?.dispositionId || null,
      message: 'Every compatibility component in the cutover handoff must retain a delete-after-native-storage bridge artifact.',
    }];
  });
}

function buildSharedTestScopeRetirementEvidenceAudit(
  sourceTextByPath = {},
  handoffs = listPolicyNativeStorageCutoverTestHandoffs(),
) {
  const issues = [];
  const sharedHandoffs = listSharedTestScopeHandoffs(handoffs);

  sharedHandoffs.forEach(handoff => {
    const scope = getPolicyCompatibilityMaintenanceTestRecord(handoff.compatibilityScopeId);
    const sourceTestPath = normalizePath(scope?.sourceTestPath);
    const sourceText = getSourceText(sourceTextByPath, sourceTestPath);
    const nativeWorkflowTestPath = normalizePath(handoff.nativeWorkflowTestPath);
    const nativeWorkflowSourceText = getSourceText(sourceTextByPath, nativeWorkflowTestPath);

    if (typeof sourceText !== 'string') {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
          .SHARED_SCOPE_SOURCE_MISSING,
        handoffId: handoff.id || null,
        sourceTestPath: sourceTestPath || null,
        message: 'Retained shared test files require current source evidence after compatibility assertions retire.',
      });
    } else {
      asArray(scope?.testNameFragments).forEach(testNameFragment => {
        if (sourceText.includes(testNameFragment)) {
          issues.push({
            riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
              .SHARED_SCOPE_ASSERTION_REMAINS,
            handoffId: handoff.id || null,
            sourceTestPath,
            testNameFragment,
            message: 'A named compatibility assertion remains in a shared test file after its retirement evidence was requested.',
          });
        }
      });
    }

    if (typeof nativeWorkflowSourceText !== 'string') {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
          .NATIVE_SUCCESSOR_SOURCE_MISSING,
        handoffId: handoff.id || null,
        sourceTestPath: nativeWorkflowTestPath || null,
        message: 'Retirement evidence requires current source text for the mapped native workflow successor.',
      });
    } else {
      uniqueStrings(handoff.nativeWorkflowTestNameFragments).forEach(testNameFragment => {
        if (!nativeWorkflowSourceText.includes(testNameFragment)) {
          issues.push({
            riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
              .NATIVE_SUCCESSOR_ASSERTION_MISSING,
            handoffId: handoff.id || null,
            sourceTestPath: nativeWorkflowTestPath,
            testNameFragment,
            message: 'Retirement evidence requires every named native workflow successor assertion to remain executable.',
          });
        }
      });
    }
  });

  return {
    ok: issues.length === 0,
    checkedSharedScopeCount: sharedHandoffs.length,
    issues,
  };
}

function evaluateCompletionAudit(completionAudit, requiredRemovedPaths) {
  const issues = [];

  if (!completionAudit || typeof completionAudit !== 'object') {
    return [{
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.COMPLETION_AUDIT_MISSING,
      message: 'Cutover deletion evidence requires a compatibility-removal completion audit.',
    }];
  }

  if (validatePolicyCompatibilityRemovalCompletionAudit(completionAudit).ok !== true) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.COMPLETION_AUDIT_INVALID,
      message: 'Cutover deletion evidence requires a structurally valid compatibility-removal completion audit.',
    });
  }

  if (completionAudit.statusId !== POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE ||
      completionAudit.complete !== true) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.COMPLETION_AUDIT_INCOMPLETE,
      statusId: completionAudit.statusId || null,
      message: 'Cutover deletion evidence requires an authorized compatibility-removal completion audit with no remaining paths.',
    });
  }

  if (completionAudit.authorizationArtifact?.integrityOk !== true ||
      completionAudit.authorizationArtifact?.completedNoRemainingPaths !== true ||
      completionAudit.authorizationArtifact?.remainingCount !== 0) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
        .AUTHORIZATION_EVIDENCE_INCOMPLETE,
      message: 'Cutover deletion evidence requires intact authorization evidence with no remaining approved paths.',
    });
  }

  if (completionAudit.removalEvidence?.verifiedCount !== 1) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.REMOVAL_EVIDENCE_INCOMPLETE,
      message: 'Cutover deletion evidence requires verified post-removal runtime evidence.',
    });
  }

  if (completionAudit.finalImportScan?.completed !== true) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
        .FINAL_REFERENCE_SCAN_INCOMPLETE,
      message: 'Cutover deletion evidence requires a completed final import/reference scan.',
    });
  }

  if (completionAudit.finalImportScan?.referenceCount !== 0) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
        .FINAL_REFERENCE_SCAN_REFERENCES_FOUND,
      referenceCount: completionAudit.finalImportScan?.referenceCount ?? null,
      message: 'Cutover deletion evidence cannot accept remaining import or reference scan findings.',
    });
  }

  if (completionAudit.validationEvidence?.focused?.passed !== true) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
        .FOCUSED_VALIDATION_INCOMPLETE,
      message: 'Cutover deletion evidence requires passed focused validation.',
    });
  }

  if (completionAudit.validationEvidence?.full?.passed !== true) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.FULL_VALIDATION_INCOMPLETE,
      message: 'Cutover deletion evidence requires passed full validation.',
    });
  }

  Object.entries(completionAudit.sideEffects || {}).forEach(([sideEffectId, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.COMPLETION_AUDIT_SIDE_EFFECT,
        sideEffectId,
        message: 'The supplied completion audit must be observational and cannot report side effects of its own.',
      });
    }
  });

  const manifestPaths = uniquePaths(completionAudit.manifestInventory?.manifestPaths);
  const appliedPaths = uniquePaths(completionAudit.removalEvidence?.appliedPaths);

  requiredRemovedPaths.forEach(path => {
    if (!manifestPaths.includes(path)) {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
          .RETIRING_PATH_MISSING_FROM_MANIFEST,
        path,
        message: 'Every retiring compatibility component and delete-with-bridge test file must be present in the authorized removal manifest.',
      });
    }

    if (!appliedPaths.includes(path)) {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
          .RETIRING_PATH_NOT_REMOVED,
        path,
        message: 'Every retiring compatibility component and delete-with-bridge test file requires verified removal evidence.',
      });
    }
  });

  return issues;
}

function determineStatusId({ handoffIssues, completionIssues, sharedScopeIssues, sideEffects }) {
  if (hasSideEffects(sideEffects)) {
    return POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS.BLOCKED_BY_SIDE_EFFECT;
  }

  if (handoffIssues.length > 0) {
    return POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS.BLOCKED_BY_HANDOFF;
  }

  if (completionIssues.some(issue => [
    POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
      .RETIRING_PATH_MISSING_FROM_MANIFEST,
    POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.RETIRING_PATH_NOT_REMOVED,
  ].includes(issue.riskId))) {
    return POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS
      .BLOCKED_BY_MANIFEST_COVERAGE;
  }

  if (completionIssues.length > 0) {
    return POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS
      .BLOCKED_BY_COMPLETION_AUDIT;
  }

  if (sharedScopeIssues.length > 0) {
    return POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS
      .BLOCKED_BY_SHARED_TEST_SCOPE;
  }

  return POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS
    .RETIREMENT_EVIDENCE_COMPLETE;
}

function buildPolicyNativeStorageCutoverDeletionEvidenceAudit({
  handoffs = listPolicyNativeStorageCutoverTestHandoffs(),
  artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts(),
  handoffAudit = buildPolicyNativeStorageCutoverTestHandoffAudit({ handoffs, artifacts }),
  completionAudit = null,
  sourceTextByPath = {},
  sideEffects = {},
} = {}) {
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const retiringComponentPaths = getRetiringComponentPaths(handoffs, artifacts);
  const retiringTestFilePaths = getRetiringTestFilePaths(handoffs);
  const requiredRemovedPaths = uniquePaths([
    ...retiringComponentPaths,
    ...retiringTestFilePaths,
  ]);
  const handoffIssues = evaluateRetiringComponentArtifacts(handoffs, artifacts);

  if (handoffAudit?.ok !== true) {
    handoffIssues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.HANDOFF_AUDIT_NOT_READY,
      message: 'Cutover deletion evidence requires a ready native-storage test handoff audit.',
    });
  }

  if (handoffAudit?.deletionAuthorized !== false) {
    handoffIssues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
        .HANDOFF_AUDIT_AUTHORIZES_DELETION,
      message: 'The read-only handoff audit cannot authorize deletion; authorization belongs to the validated completion artifact.',
    });
  }

  const completionIssues = evaluateCompletionAudit(completionAudit, requiredRemovedPaths);
  const sharedScopeAudit = buildSharedTestScopeRetirementEvidenceAudit(
    sourceTextByPath,
    handoffs,
  );
  const issues = [
    ...handoffIssues,
    ...completionIssues,
    ...sharedScopeAudit.issues,
  ];

  if (hasSideEffects(normalizedSideEffects)) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.SIDE_EFFECT_PERFORMED,
      message: 'Cutover deletion-evidence integration cannot delete, rewrite, or mutate tests, components, or storage.',
    });
  }

  const statusId = determineStatusId({
    handoffIssues,
    completionIssues,
    sharedScopeIssues: sharedScopeAudit.issues,
    sideEffects: normalizedSideEffects,
  });
  const audit = {
    version: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_VERSION,
    statusId,
    deletionEvidenceComplete:
      statusId === POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS
        .RETIREMENT_EVIDENCE_COMPLETE,
    deletionAuthorized: false,
    requiredRemovedPaths,
    retiringComponentPaths,
    retiringTestFilePaths,
    sharedScopeAudit,
    completionAudit: {
      statusId: completionAudit?.statusId || null,
      complete: completionAudit?.complete === true,
      validationOk: completionAudit?.validation?.ok === true,
      finalReferenceScanCompleted: completionAudit?.finalImportScan?.completed === true,
      finalReferenceCount: completionAudit?.finalImportScan?.referenceCount ?? null,
      focusedValidationPassed: completionAudit?.validationEvidence?.focused?.passed === true,
      fullValidationPassed: completionAudit?.validationEvidence?.full?.passed === true,
    },
    sideEffects: normalizedSideEffects,
    issueCount: issues.length,
    issues,
    nextStep: {
      stepId: 'native_workflow_test_rehoming_audit',
      label: 'Native Workflow Test Rehoming Audit',
      reason: 'Before any compatibility component is removed, transfer remaining normal-workflow regression ownership away from tests that still import a retiring component.',
    },
  };

  return {
    ...audit,
    validation: validatePolicyNativeStorageCutoverDeletionEvidenceAudit(audit),
  };
}

function validatePolicyNativeStorageCutoverDeletionEvidenceAudit(audit = {}) {
  const issues = [];

  if (!Object.values(POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS)
    .includes(audit.statusId)) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.UNKNOWN_STATUS,
      message: 'Cutover deletion-evidence audit status must be known.',
    });
  }

  if (audit.issueCount !== asArray(audit.issues).length) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.ISSUE_COUNT_MISMATCH,
      message: 'Cutover deletion-evidence issue count must match its issue list.',
    });
  }

  if (audit.deletionAuthorized !== false) {
    issues.push({
      riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
        .HANDOFF_AUDIT_AUTHORIZES_DELETION,
      message: 'Cutover deletion-evidence integration cannot authorize destructive work.',
    });
  }

  Object.entries(audit.sideEffects || {}).forEach(([sideEffectId, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.SIDE_EFFECT_PERFORMED,
        sideEffectId,
        message: 'Cutover deletion-evidence integration cannot perform side effects.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS,
  POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS,
  POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_VERSION,
  buildPolicyNativeStorageCutoverDeletionEvidenceAudit,
  buildSharedTestScopeRetirementEvidenceAudit,
  getCompatibilityComponentPaths,
  getRetiringComponentPaths,
  getRetiringTestFilePaths,
  listSharedTestScopeHandoffs,
  validatePolicyNativeStorageCutoverDeletionEvidenceAudit,
};
