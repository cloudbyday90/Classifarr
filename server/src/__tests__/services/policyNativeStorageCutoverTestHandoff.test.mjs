/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS,
  POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS,
  POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS,
  buildPolicyNativeStorageCutoverTestHandoffAudit,
  buildPolicyNativeStorageCutoverTestHandoffSourceAudit,
  getPolicyNativeStorageCutoverTestHandoff,
  listPolicyNativeStorageCutoverTestHandoffs,
  summarizePolicyNativeStorageCutoverTestHandoff,
  validatePolicyNativeStorageCutoverTestHandoff,
} from '../../services/policyNativeStorageCutoverTestHandoff.mjs';
import {
  buildPolicyNativeStorageTestReset,
} from '../../services/policyNativeStorageTestReset.mjs';
import {
  listPolicyStarterTemplateCompatibilityBridgeArtifacts,
} from '../../services/policyStarterTemplateCompatibilityBridgeInventory.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');

async function readHandoffTestSources() {
  const handoffs = listPolicyNativeStorageCutoverTestHandoffs();
  const compatibilitySourcePaths = [
    'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
    'client/src/__tests__/PolicyIntentEditor.test.js',
    'client/src/__tests__/PolicyBuilderModal.test.js',
    'client/src/__tests__/PolicyPresetMigrationNotice.test.js',
  ];
  const sourcePaths = [...new Set([
    ...compatibilitySourcePaths,
    ...handoffs.map(handoff => handoff.nativeWorkflowTestPath),
  ])];
  const entries = await Promise.all(sourcePaths.map(async sourcePath => [
    sourcePath,
    await readFile(resolve(repoRoot, sourcePath), 'utf8'),
  ]));

  return Object.fromEntries(entries);
}

describe('policyNativeStorageCutoverTestHandoff', () => {
  test('transfers each compatibility regression scope to a native workflow successor without authorizing deletion', () => {
    const handoffs = listPolicyNativeStorageCutoverTestHandoffs();

    expect(handoffs.map(handoff => handoff.compatibilityScopeId)).toEqual([
      'compatibility_maintenance_surface',
      'compatibility_maintenance_editor',
      'compatibility_maintenance_modal',
      'compatibility_migration_notice',
    ]);
    expect(handoffs.map(handoff => handoff.sourceTestFileDispositionId)).toEqual([
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS.DELETE_TEST_FILE_WITH_BRIDGE,
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS
        .REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE,
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS
        .REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE,
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_SOURCE_DISPOSITION_IDS.DELETE_TEST_FILE_WITH_BRIDGE,
    ]);
    handoffs.forEach(handoff => {
      expect(handoff.retireWithBridge).toBe(true);
      expect(handoff.deletionAuthorized).toBe(false);
      expect(handoff.requiredDeletionEvidenceIds).toEqual(
        Object.values(POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS),
      );
    });
  });

  test('requires native-storage coverage and all deletion gates before a handoff is cutover-evidence ready', () => {
    const audit = buildPolicyNativeStorageCutoverTestHandoffAudit();

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      statusId: 'ready_for_cutover_evidence',
      deletionAuthorized: false,
      checkedHandoffCount: 4,
      deleteTestFileWithBridgeCount: 2,
      retainTestFileRemoveNamedScopeCount: 2,
      issueCount: 0,
      issues: [],
    }));
    expect(audit.remainingDeletionEvidenceIds).toEqual([
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS
        .AUTHORIZED_REMOVAL_COMPLETION,
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS.FINAL_REFERENCE_SCAN,
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_DELETION_EVIDENCE_IDS
        .FOCUSED_AND_FULL_VALIDATION,
    ]);
  });

  test('points every handoff to executable compatibility and native workflow assertions', async () => {
    const audit = buildPolicyNativeStorageCutoverTestHandoffSourceAudit(
      await readHandoffTestSources(),
    );

    expect(audit).toEqual({
      ok: true,
      checkedHandoffCount: 4,
      issues: [],
    });
  });

  test('fails closed when native storage coverage is not proven', () => {
    const handoff = getPolicyNativeStorageCutoverTestHandoff(
      'compatibility_maintenance_surface_handoff',
    );
    const nativeStorageTestReset = buildPolicyNativeStorageTestReset({
      testRecords: [],
    });
    const result = validatePolicyNativeStorageCutoverTestHandoff(handoff, {
      nativeStorageTestReset,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.NATIVE_STORAGE_TEST_RESET_NOT_READY,
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.NATIVE_STORAGE_COVERAGE_NOT_PROVEN,
    ]));
  });

  test('fails closed when a native assertion, deletion evidence, or component disposition drifts', () => {
    const handoff = getPolicyNativeStorageCutoverTestHandoff(
      'compatibility_migration_notice_handoff',
    );
    const result = validatePolicyNativeStorageCutoverTestHandoff({
      ...handoff,
      nativeWorkflowTestNameFragments: [],
      requiredDeletionEvidenceIds: [],
    }, {
      artifacts: [],
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_NATIVE_WORKFLOW_TEST_ASSERTION,
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_DELETION_EVIDENCE,
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.MISSING_COMPATIBILITY_ARTIFACT,
    ]));
  });

  test('fails closed when a retiring component is admitted to normal authoring or raw payload mutation', () => {
    const handoff = getPolicyNativeStorageCutoverTestHandoff(
      'compatibility_migration_notice_handoff',
    );
    const artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts().map(artifact => (
      artifact.sourcePath === 'client/src/components/policies/PolicyPresetMigrationNotice.vue'
        ? {
          ...artifact,
          normalAuthoringAllowed: true,
          rawPayloadMutationAllowed: true,
        }
        : artifact
    ));
    const result = validatePolicyNativeStorageCutoverTestHandoff(handoff, {
      artifacts,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.NORMAL_AUTHORING_COMPONENT,
      POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.RAW_PAYLOAD_MUTATION_COMPONENT,
    ]));
  });

  test('fails the source audit when an owned native assertion is renamed or unavailable', () => {
    const handoff = getPolicyNativeStorageCutoverTestHandoff(
      'compatibility_maintenance_surface_handoff',
    );
    const audit = buildPolicyNativeStorageCutoverTestHandoffSourceAudit({
      'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js':
        'uses one context-first purpose statement for compatibility maintenance\nforwards retained compatibility intent commands without raw scoring updates',
      [handoff.nativeWorkflowTestPath]: 'unrelated test',
    }, [handoff]);

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS
          .MISSING_NATIVE_WORKFLOW_TEST_ASSERTION,
      }),
    ]));
  });

  test('does not permit the handoff audit to perform deletion or mutation', () => {
    const audit = buildPolicyNativeStorageCutoverTestHandoffAudit({
      sideEffects: {
        testsDeleted: true,
        componentsDeleted: true,
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_STORAGE_CUTOVER_TEST_HANDOFF_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });

  test('summarizes the bounded handoff inventory without treating it as deletion approval', () => {
    expect(summarizePolicyNativeStorageCutoverTestHandoff()).toEqual({
      handoffCount: 4,
      compatibilityScopeCount: 4,
      deleteTestFileWithBridgeCount: 2,
      retainTestFileRemoveNamedScopeCount: 2,
      deletionAuthorized: false,
      cutoverEvidenceReady: true,
    });
  });
});
