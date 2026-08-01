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
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS,
  buildPolicyCompatibilityComponentDeletionDependencyAudit,
  listPolicyCompatibilityComponentDeletionDependencies,
  listPolicyCompatibilityComponentDeletionRouteSourcePaths,
} from '../../services/policyCompatibilityComponentDeletionDependencies.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS,
} from '../../services/policyCompatibilityRetirementManifestInventory.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS,
  buildPolicyCompatibilityRetirementManifestReconciliation,
  validatePolicyCompatibilityRetirementManifestReconciliation,
} from '../../services/policyCompatibilityRetirementManifestReconciliation.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');

async function readDependencySources() {
  const sourcePaths = new Set();

  listPolicyCompatibilityComponentDeletionDependencies().forEach(dependency => {
    sourcePaths.add(dependency.sourcePath);
    dependency.nativeRehomeTargets.forEach(target => sourcePaths.add(target.path));
  });

  const entries = await Promise.all([...sourcePaths].map(async sourcePath => [
    sourcePath,
    await readFile(resolve(repoRoot, sourcePath), 'utf8'),
  ]));

  return Object.fromEntries(entries);
}

async function readRouteSources() {
  const entries = await Promise.all(listPolicyCompatibilityComponentDeletionRouteSourcePaths()
    .map(async sourcePath => [
      sourcePath,
      await readFile(resolve(repoRoot, sourcePath), 'utf8'),
    ]));

  return Object.fromEntries(entries);
}

async function buildSourceBackedDependencyAudit() {
  return buildPolicyCompatibilityComponentDeletionDependencyAudit({
    sourceTextByPath: await readDependencySources(),
    routeSourceTextByPath: await readRouteSources(),
  });
}

describe('policyCompatibilityRetirementManifestReconciliation', () => {
  test('reconciles all remaining compatibility dependencies without authorizing removal', async () => {
    const reconciliation = buildPolicyCompatibilityRetirementManifestReconciliation({
      dependencyAudit: await buildSourceBackedDependencyAudit(),
    });

    expect(reconciliation).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS
        .RECONCILIATION_READY,
      reconciliationReady: true,
      readOnly: true,
      deletionAuthorized: false,
      executionManifestWritten: false,
      classificationCounts: {
        [POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS.NATIVE_REHOME]: 0,
        [POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
          .NAMED_COMPATIBILITY_RETIREMENT]: 3,
        [POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
          .REMOVAL_MANIFEST_CANDIDATE]: 8,
      },
      issueCount: 0,
      issues: [],
    }));
    expect(reconciliation.entries).toHaveLength(11);
    expect(reconciliation.validation).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('preserves precise component and shared-test cutover dispositions', async () => {
    const reconciliation = buildPolicyCompatibilityRetirementManifestReconciliation({
      dependencyAudit: await buildSourceBackedDependencyAudit(),
    });
    const entriesById = Object.fromEntries(reconciliation.entries.map(entry => [
      entry.dependencyId,
      entry,
    ]));

    expect(entriesById.policy_builder_modal_legacy_maintenance_branch)
      .toEqual(expect.objectContaining({
        entryDispositionId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS
          .REMOVE_RUNTIME_REFERENCE_WITH_COMPONENT,
        nativeStorageCutover: expect.objectContaining({
          componentHandoffIds: expect.arrayContaining([
            'compatibility_maintenance_surface_handoff',
            'compatibility_maintenance_modal_handoff',
          ]),
        }),
      }));
    expect(entriesById.maintenance_surface_test_editor_import)
      .toEqual(expect.objectContaining({
        entryDispositionId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS
          .DELETE_TEST_FILE_WITH_BRIDGE,
        nativeStorageCutover: expect.objectContaining({
          sourceTestHandoffIds: ['compatibility_maintenance_surface_handoff'],
        }),
      }));
    expect(entriesById.policy_intent_editor_named_maintenance_scope)
      .toEqual(expect.objectContaining({
        entryDispositionId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS
          .REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE,
        compatibilityScope: expect.objectContaining({
          id: 'compatibility_maintenance_editor',
        }),
        nativeStorageCutover: expect.objectContaining({
          namedScopeHandoffId: 'compatibility_maintenance_editor_handoff',
        }),
      }));
    expect(entriesById.policy_builder_modal_migration_notice_scope)
      .toEqual(expect.objectContaining({
        entryDispositionId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS
          .REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE,
        nativeStorageCutover: expect.objectContaining({
          sourceTestHandoffIds: ['compatibility_maintenance_modal_handoff'],
        }),
      }));
  });

  test('fails closed when a named compatibility scope or a side effect drifts', async () => {
    const dependencies = listPolicyCompatibilityComponentDeletionDependencies().map(dependency => (
      dependency.id === 'policy_intent_editor_named_maintenance_scope'
        ? { ...dependency, compatibilityScopeId: 'unknown_compatibility_scope' }
        : dependency
    ));
    const dependencyAudit = await buildSourceBackedDependencyAudit();
    const reconciliation = buildPolicyCompatibilityRetirementManifestReconciliation({
      dependencies,
      dependencyAudit,
      sideEffects: {
        executionManifestWritten: true,
        storageChanged: true,
      },
    });

    expect(reconciliation.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS
        .BLOCKED_BY_SIDE_EFFECT);
    expect(reconciliation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
        .NAMED_SCOPE_MISSING,
      POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
        .NAMED_SCOPE_HANDOFF_MISSING,
      POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
        .SIDE_EFFECT_PERFORMED,
    ]));
  });

  test('requires the source-backed dependency audit before reconciliation', () => {
    const reconciliation = buildPolicyCompatibilityRetirementManifestReconciliation();

    expect(reconciliation.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_STATUS_IDS
        .BLOCKED_BY_DEPENDENCY_AUDIT);
    expect(reconciliation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
          .DEPENDENCY_AUDIT_MISSING,
      }),
    ]));
  });

  test('rejects a manifest entry that no longer matches its audited dependency', async () => {
    const reconciliation = buildPolicyCompatibilityRetirementManifestReconciliation({
      dependencyAudit: await buildSourceBackedDependencyAudit(),
    });
    const manifest = {
      ...reconciliation,
      entries: reconciliation.entries.map(entry => (
        entry.dependencyId === 'policy_builder_modal_migration_notice_scope'
          ? {
            ...entry,
            classificationId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
              .NAMED_COMPATIBILITY_RETIREMENT,
          }
          : entry
      )),
    };

    expect(validatePolicyCompatibilityRetirementManifestReconciliation(manifest).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_RECONCILIATION_RISK_IDS
            .MANIFEST_ENTRY_DEPENDENCY_DRIFT,
        }),
      ]));
  });
});
