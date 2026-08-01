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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  buildPolicyCompatibilityComponentDeletionDependencyAudit,
  listPolicyCompatibilityComponentDeletionDependencies,
  listPolicyCompatibilityComponentDeletionRouteSourcePaths,
} from '../../services/policyCompatibilityComponentDeletionDependencies.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_STATUS_IDS,
  buildPolicyCompatibilityRetirementExecutionManifestBinding,
  validatePolicyCompatibilityRetirementExecutionManifestBinding,
} from '../../services/policyCompatibilityRetirementExecutionManifestBinding.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_ACTION_IDS,
  buildPolicyCompatibilityRetirementExecutionManifestTargets,
} from '../../services/policyCompatibilityRetirementExecutionManifestTargets.mjs';
import {
  buildPolicyCompatibilityRetirementManifestReconciliation,
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

async function buildSourceBackedReconciliation() {
  const dependencyAudit = buildPolicyCompatibilityComponentDeletionDependencyAudit({
    sourceTextByPath: await readDependencySources(),
    routeSourceTextByPath: await readRouteSources(),
  });

  return buildPolicyCompatibilityRetirementManifestReconciliation({ dependencyAudit });
}

function readyPlan(entries) {
  return {
    statusId: POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    manifest: {
      approved: true,
      entries,
    },
    validation: { ok: true },
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      manifestWritten: false,
    },
  };
}

describe('policyCompatibilityRetirementExecutionManifestBinding', () => {
  test('derives exact execution targets from every reconciled dependency', async () => {
    const reconciliation = await buildSourceBackedReconciliation();
    const targets = buildPolicyCompatibilityRetirementExecutionManifestTargets(
      reconciliation.entries,
    );
    const targetDependencyIds = new Set(targets.flatMap(target => target.dependencyIds));

    expect(targets).toHaveLength(10);
    expect(targetDependencyIds).toEqual(new Set(reconciliation.entries.map(entry => entry.dependencyId)));
    expect(targets.filter(target => target.actionId ===
      POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REPLACE_CODE_PATH)).toHaveLength(1);
    expect(targets.filter(target => target.actionId ===
      POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.DELETE_FILE)).toHaveLength(3);
    expect(targets.filter(target => target.actionId ===
      POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_TEST)).toHaveLength(2);
    expect(targets.filter(target => target.actionId ===
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE)).toHaveLength(4);
    expect(targets.find(target => target.path ===
      'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js'))
      .toEqual(expect.objectContaining({
        dependencyIds: expect.arrayContaining([
          'maintenance_surface_test_surface_import',
          'maintenance_surface_test_editor_import',
          'maintenance_surface_test_migration_notice_import',
        ]),
      }));
  });

  test('blocks an incomplete execution plan while preserving its no-side-effect boundary', async () => {
    const reconciliation = await buildSourceBackedReconciliation();
    const binding = buildPolicyCompatibilityRetirementExecutionManifestBinding({
      reconciliation,
      executionPlan: readyPlan([{
        path: 'client/src/components/policies/PolicyPresetMigrationNotice.vue',
        actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.DELETE_FILE,
      }]),
    });

    expect(binding.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_STATUS_IDS
        .BLOCKED_BY_MANIFEST_COVERAGE);
    expect(binding.bindingReady).toBe(false);
    expect(binding.targetCount).toBe(10);
    expect(binding.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .EXECUTION_TARGET_MISSING_FROM_MANIFEST,
    ]));
    expect(Object.values(binding.sideEffects).some(Boolean)).toBe(false);
  });

  test('binds an exact complete manifest without authorizing deletion', async () => {
    const reconciliation = await buildSourceBackedReconciliation();
    const targets = buildPolicyCompatibilityRetirementExecutionManifestTargets(
      reconciliation.entries,
    );
    const binding = buildPolicyCompatibilityRetirementExecutionManifestBinding({
      reconciliation,
      executionPlan: readyPlan(targets),
    });

    expect(binding.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_STATUS_IDS
        .BINDING_READY);
    expect(binding.bindingReady).toBe(true);
    expect(binding.deletionAuthorized).toBe(false);
    expect(binding.coverage.every(record => record.covered)).toBe(true);
    expect(Object.values(binding.sideEffects).some(Boolean)).toBe(false);
  });

  test('fails closed when reconciliation is missing or the binding reports a side effect', () => {
    const binding = buildPolicyCompatibilityRetirementExecutionManifestBinding({
      sideEffects: {
        executionManifestWritten: true,
        storageChanged: true,
      },
    });

    expect(binding.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_STATUS_IDS
        .BLOCKED_BY_SIDE_EFFECT);
    expect(binding.deletionAuthorized).toBe(false);
    expect(binding.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .RECONCILIATION_MISSING,
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
        .SIDE_EFFECT_PERFORMED,
    ]));
  });

  test('reports a binding issue-count invariant separately from manifest coverage', () => {
    const validation = validatePolicyCompatibilityRetirementExecutionManifestBinding({
      deletionAuthorized: false,
      issueCount: 1,
      issues: [],
      sideEffects: {},
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_MANIFEST_BINDING_RISK_IDS
          .ISSUE_COUNT_MISMATCH,
      }),
    ]));
  });
});
