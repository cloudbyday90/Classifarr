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
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS,
  buildPolicyCompatibilityComponentDeletionDependencyAudit,
  listPolicyCompatibilityComponentDeletionDependencies,
  listPolicyCompatibilityComponentDeletionRouteSourcePaths,
} from '../../services/policyCompatibilityComponentDeletionDependencies.mjs';

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

describe('policyCompatibilityComponentDeletionDependencies', () => {
  test('classifies every executable compatibility dependency without authorizing deletion', async () => {
    const audit = buildPolicyCompatibilityComponentDeletionDependencyAudit({
      sourceTextByPath: await readDependencySources(),
      routeSourceTextByPath: await readRouteSources(),
    });

    expect(audit).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS
        .READY_FOR_REHOME_AND_MANIFEST_RECONCILIATION,
      ok: true,
      deletionAuthorized: false,
      checkedDependencyCount: 13,
      retiringComponentCount: 3,
      classificationCounts: {
        [POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS.NATIVE_REHOME]: 2,
        [POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
          .NAMED_COMPATIBILITY_RETIREMENT]: 3,
        [POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
          .REMOVAL_MANIFEST_CANDIDATE]: 8,
      },
      issueCount: 0,
      issues: [],
    }));
    expect(audit.sourceAudit).toEqual({
      ok: true,
      checkedDependencyCount: 13,
      issues: [],
    });
    expect(audit.routeAudit).toEqual({
      ok: true,
      checkedRouteSourceCount: 1,
      routeReferenceCount: 0,
      issues: [],
    });
  });

  test('keeps active editor command and parity coverage on the native-rehome path', () => {
    const nativeRehomes = listPolicyCompatibilityComponentDeletionDependencies()
      .filter(dependency => dependency.classificationId ===
        POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS.NATIVE_REHOME);

    expect(nativeRehomes).toEqual([
      expect.objectContaining({
        id: 'policy_intent_editor_active_command_scope',
        sourcePath: 'client/src/__tests__/PolicyIntentEditor.test.js',
      }),
      expect.objectContaining({
        id: 'policy_intent_editor_parity_scope',
        sourcePath: 'client/src/__tests__/PolicyIntentEditorParity.test.js',
      }),
    ]);
    nativeRehomes.forEach(dependency => {
      expect(dependency.nativeRehomeTargets.length).toBeGreaterThan(0);
    });
  });

  test('fails closed when source, route, or component-boundary evidence drifts', async () => {
    const sourceTextByPath = await readDependencySources();
    const routeSourceTextByPath = await readRouteSources();
    sourceTextByPath['client/src/__tests__/PolicyIntentReviewTriggerControl.test.js'] =
      'unrelated native test';
    routeSourceTextByPath['client/src/router/index.js'] += '\nPolicyIntentEditor';

    const audit = buildPolicyCompatibilityComponentDeletionDependencyAudit({
      sourceTextByPath,
      routeSourceTextByPath,
    });

    expect(audit.statusId)
      .toBe(POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS.BLOCKED_BY_ROUTE_REFERENCE);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
        .NATIVE_REHOME_TARGET_ASSERTION_MISSING,
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.ROUTE_REFERENCE_RETAINED,
    ]));
  });

  test('rejects deletion candidates that would remove an active regression or perform side effects', async () => {
    const dependencies = listPolicyCompatibilityComponentDeletionDependencies().map(dependency => (
      dependency.id === 'migration_notice_test_import'
        ? {
          ...dependency,
          sourcePath: 'client/src/__tests__/PolicyIntentEditorParity.test.js',
          sourceTextFragments: ['PolicyIntentEditor'],
        }
        : dependency
    ));
    const audit = buildPolicyCompatibilityComponentDeletionDependencyAudit({
      dependencies,
      sourceTextByPath: await readDependencySources(),
      routeSourceTextByPath: await readRouteSources(),
      sideEffects: {
        componentsDeleted: true,
        testsMoved: true,
      },
    });

    expect(audit.statusId)
      .toBe(POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS.BLOCKED_BY_SIDE_EFFECT);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
        .MANIFEST_CANDIDATE_RETAINS_ACTIVE_REGRESSION,
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
