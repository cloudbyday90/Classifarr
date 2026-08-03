/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  buildPolicyCompatibilityRemovalCompletionAudit,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';
import {
  POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS,
  POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS,
  buildPolicyNativeStorageCutoverDeletionEvidenceAudit,
  buildSharedTestScopeRetirementEvidenceAudit,
  getCompatibilityComponentPaths,
  getRetiringComponentPaths,
  getRetiringTestFilePaths,
  listSharedTestScopeHandoffs,
  validatePolicyNativeStorageCutoverDeletionEvidenceAudit,
} from '../../services/policyNativeStorageCutoverDeletionEvidence.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';
import {
  buildNextBatchAuthorizationPathStateSource,
} from './fixtures/policyNextCompatibilityRemovalBatchAuthorizationFixtures.mjs';

const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);

function buildExecutionPlan(manifestPaths) {
  const entries = manifestPaths.map(path => ({
    categoryId: 'native_storage_cutover_test_handoff',
    actionId: 'delete_file',
    path,
    replacementEvidence: {
      replacementPath: 'client/src/components/policies/PolicyBuilderWorkflowShell.vue',
    },
    ready: true,
  }));

  return {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
    statusId: POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    },
    manifest: {
      approved: true,
      approvedBy: 'policy-maintainer',
      entryCount: entries.length,
      entries,
    },
  };
}

function buildRuntimeEvidenceArtifact(manifestPaths, executionPlanArtifactFingerprint) {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      applied: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      removalReview: {
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
        executionPlanArtifactFingerprint,
      },
      applyBatch: {
        requestedCount: manifestPaths.length,
        results: manifestPaths.map(path => ({
          path,
          actionId: 'delete_file',
          applied: true,
        })),
      },
    },
    importScan: {
      completed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      checkedPaths: manifestPaths,
      references: [],
    },
    runtimeChecks: [{
      checkId: 'policy-runtime-imports',
      passed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    }],
    validationEvidence: {
      focused: {
        command: 'focused validation',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      full: {
        command: 'full validation',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
    },
  });
}

async function buildCompleteCompletionAudit(manifestPaths) {
  const executionPlan = buildExecutionPlan(manifestPaths);
  const source = buildNextBatchAuthorizationPathStateSource({
    executionPlan,
    existingPaths: [],
  });
  const nextBatchAuthorizationArtifact =
    await buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
      runtimeEvidenceArtifact: buildRuntimeEvidenceArtifact(
        manifestPaths,
        source.executionPlanArtifact.artifactFingerprint.fingerprint,
      ),
      ...source,
      input: {
        requestedPaths: [],
        maxBatchSize: manifestPaths.length,
        authorizationReason: '',
        authorizedBy: '',
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      generatedAt: '2026-08-01T14:00:00.000Z',
    });

  return buildPolicyCompatibilityRemovalCompletionAudit({
    nextBatchAuthorizationArtifact,
    executionPlan,
    reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    finalImportScan: {
      completed: true,
      checkedPaths: manifestPaths,
      references: [],
    },
    validationEvidence: {
      focused: { command: 'focused validation', passed: true },
      full: { command: 'full validation', passed: true },
    },
  });
}

function buildRetiredSharedScopeSourceText() {
  return {
    'client/src/__tests__/PolicyIntentEditor.test.js':
      'native editor behavior was rehomed to destination questions',
    'client/src/__tests__/PolicyBuilderDestinationQuestions.test.js': [
      'renders observed signal selection only for selectable server projection',
      'withholds selection while the observed profile is stale',
    ].join('\n'),
    'client/src/__tests__/PolicyBuilderModal.test.js': [
      'submits the narrow native creation contract only after observed values are explicitly accepted',
      'keeps native creation open for a persisted server-owned policy handoff',
    ].join('\n'),
  };
}

describe('policyNativeStorageCutoverDeletionEvidence', () => {
  test('derives deleted component and test paths separately from shared test-scope handoffs', () => {
    expect(getCompatibilityComponentPaths()).toEqual([
      'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
      'client/src/components/policies/PolicyIntentEditor.vue',
      'client/src/components/policies/PolicyPresetMigrationNotice.vue',
    ]);
    expect(getRetiringComponentPaths()).toEqual([
      'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
      'client/src/components/policies/PolicyIntentEditor.vue',
      'client/src/components/policies/PolicyPresetMigrationNotice.vue',
    ]);
    expect(getRetiringTestFilePaths()).toEqual([
      'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
      'client/src/__tests__/PolicyPresetMigrationNotice.test.js',
    ]);
    expect(listSharedTestScopeHandoffs().map(handoff => handoff.compatibilityScopeId)).toEqual([
      'compatibility_maintenance_editor',
      'compatibility_maintenance_modal',
    ]);
  });

  test('requires a complete authorized artifact, full manifest coverage, and retired shared scopes', async () => {
    const requiredRemovedPaths = [
      ...getRetiringComponentPaths(),
      ...getRetiringTestFilePaths(),
    ];
    const completionAudit = await buildCompleteCompletionAudit(requiredRemovedPaths);
    const audit = buildPolicyNativeStorageCutoverDeletionEvidenceAudit({
      completionAudit,
      sourceTextByPath: buildRetiredSharedScopeSourceText(),
    });

    expect(audit).toEqual(expect.objectContaining({
      statusId:
        POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS
          .RETIREMENT_EVIDENCE_COMPLETE,
      deletionEvidenceComplete: true,
      deletionAuthorized: false,
      requiredRemovedPaths,
      issueCount: 0,
      issues: [],
    }));
    expect(audit.sharedScopeAudit).toEqual({
      ok: true,
      checkedSharedScopeCount: 2,
      issues: [],
    });
    expect(audit.validation).toEqual({ ok: true, issueCount: 0, issues: [] });
  });

  test('fails closed without an authorized complete removal audit', () => {
    const audit = buildPolicyNativeStorageCutoverDeletionEvidenceAudit({
      sourceTextByPath: buildRetiredSharedScopeSourceText(),
    });

    expect(audit.statusId)
      .toBe(POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS
        .BLOCKED_BY_COMPLETION_AUDIT);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.COMPLETION_AUDIT_MISSING,
      }),
    ]));
    expect(audit.deletionEvidenceComplete).toBe(false);
  });

  test('fails when a retiring component or delete-with-bridge test file is absent from the removal manifest', async () => {
    const requiredRemovedPaths = [
      ...getRetiringComponentPaths(),
      ...getRetiringTestFilePaths(),
    ];
    const omittedPath = requiredRemovedPaths[0];
    const completionAudit = await buildCompleteCompletionAudit(
      requiredRemovedPaths.filter(path => path !== omittedPath),
    );
    const audit = buildPolicyNativeStorageCutoverDeletionEvidenceAudit({
      completionAudit,
      sourceTextByPath: buildRetiredSharedScopeSourceText(),
    });

    expect(audit.statusId)
      .toBe(POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS
        .BLOCKED_BY_MANIFEST_COVERAGE);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
          .RETIRING_PATH_MISSING_FROM_MANIFEST,
        path: omittedPath,
      }),
      expect.objectContaining({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
          .RETIRING_PATH_NOT_REMOVED,
        path: omittedPath,
      }),
    ]));
  });

  test('fails closed when a handoff component no longer has a delete-after-native-storage artifact', () => {
    const audit = buildPolicyNativeStorageCutoverDeletionEvidenceAudit({
      handoffAudit: { ok: true, deletionAuthorized: false },
      artifacts: [],
      sourceTextByPath: buildRetiredSharedScopeSourceText(),
    });

    expect(audit.statusId)
      .toBe(POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS.BLOCKED_BY_HANDOFF);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
          .RETIRING_COMPONENT_ARTIFACT_INVALID,
      }),
    ]));
  });

  test('fails shared-scope evidence when compatibility assertions remain or a native successor assertion disappears', () => {
    const sourceTextByPath = {
      ...buildRetiredSharedScopeSourceText(),
      'client/src/__tests__/PolicyIntentEditor.test.js':
        'renders policy context before editable compatibility controls',
      'client/src/__tests__/PolicyBuilderModal.test.js': 'unrelated native test',
    };
    const audit = buildSharedTestScopeRetirementEvidenceAudit(sourceTextByPath);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.SHARED_SCOPE_ASSERTION_REMAINS,
      POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
        .NATIVE_SUCCESSOR_ASSERTION_MISSING,
    ]));
  });

  test('rejects invalid audit output and any side effects', async () => {
    const requiredRemovedPaths = [
      ...getRetiringComponentPaths(),
      ...getRetiringTestFilePaths(),
    ];
    const completionAudit = await buildCompleteCompletionAudit(requiredRemovedPaths);
    const audit = buildPolicyNativeStorageCutoverDeletionEvidenceAudit({
      completionAudit,
      sourceTextByPath: buildRetiredSharedScopeSourceText(),
      sideEffects: { testsDeleted: true },
    });
    const validation = validatePolicyNativeStorageCutoverDeletionEvidenceAudit({
      ...audit,
      statusId: 'unknown',
      issueCount: 99,
      deletionAuthorized: true,
      sideEffects: { storageChanged: true },
    });

    expect(audit.statusId)
      .toBe(POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_STATUS_IDS.BLOCKED_BY_SIDE_EFFECT);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.UNKNOWN_STATUS,
      POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.ISSUE_COUNT_MISMATCH,
      POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS
        .HANDOFF_AUDIT_AUTHORIZES_DELETION,
      POLICY_NATIVE_STORAGE_CUTOVER_DELETION_EVIDENCE_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
