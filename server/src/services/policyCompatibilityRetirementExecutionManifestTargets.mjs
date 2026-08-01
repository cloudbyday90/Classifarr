/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS,
} from './policyCompatibilityComponentDeletionDependencyInventory.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from './policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS,
} from './policyCompatibilityRetirementManifestInventory.mjs';

const POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS = Object.freeze({
  CODE_PATH: 'code_path',
  TEST_FILE: 'test_file',
  NAMED_TEST_SCOPE: 'named_test_scope',
});

const POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_ACTION_IDS =
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))];
}

function createTarget({
  kindId,
  actionId,
  path,
  sourceTextFragments = [],
  testNameFragments = [],
  componentPath = null,
  dependencyId,
}) {
  return {
    kindId,
    actionId,
    path,
    sourceTextFragments: uniqueStrings(sourceTextFragments),
    testNameFragments: uniqueStrings(testNameFragments),
    componentPath,
    dependencyIds: [dependencyId],
  };
}

function buildReferenceTarget(entry, retiringComponentPaths) {
  const sourcePath = cleanString(entry.sourcePath);
  const dependencyId = cleanString(entry.dependencyId);
  const isRuntimeImport = entry.dependencyKindId ===
    POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.RUNTIME_IMPORT;

  if (isRuntimeImport) {
    return createTarget({
      kindId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.CODE_PATH,
      actionId: retiringComponentPaths.has(sourcePath)
        ? POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_ACTION_IDS.DELETE_FILE
        : POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_ACTION_IDS.REPLACE_CODE_PATH,
      path: sourcePath,
      sourceTextFragments: entry.sourceTextFragments,
      componentPath: entry.componentPath || null,
      dependencyId,
    });
  }

  if (entry.entryDispositionId ===
      POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS
        .DELETE_TEST_FILE_WITH_BRIDGE) {
    return createTarget({
      kindId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.TEST_FILE,
      actionId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_ACTION_IDS.REMOVE_TEST,
      path: sourcePath,
      sourceTextFragments: entry.sourceTextFragments,
      componentPath: entry.componentPath || null,
      dependencyId,
    });
  }

  if (entry.entryDispositionId ===
      POLICY_COMPATIBILITY_RETIREMENT_MANIFEST_ENTRY_DISPOSITION_IDS
        .REMOVE_NAMED_SCOPE_RETAIN_TEST_FILE) {
    return createTarget({
      kindId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.NAMED_TEST_SCOPE,
      actionId:
        POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE,
      path: sourcePath,
      sourceTextFragments: entry.sourceTextFragments,
      testNameFragments: entry.testNameFragments,
      componentPath: entry.componentPath || null,
      dependencyId,
    });
  }

  return createTarget({
    kindId: null,
    actionId: null,
    path: sourcePath,
    componentPath: entry.componentPath || null,
    dependencyId,
  });
}

function buildComponentTarget(entry) {
  if (entry.dependencyKindId !==
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS.RUNTIME_IMPORT) {
    return null;
  }

  return createTarget({
    kindId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS.CODE_PATH,
    actionId: POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_ACTION_IDS.DELETE_FILE,
    path: cleanString(entry.componentPath),
    componentPath: cleanString(entry.componentPath) || null,
    dependencyId: cleanString(entry.dependencyId),
  });
}

function targetKey(target) {
  return JSON.stringify([
    target.kindId,
    target.actionId,
    target.path,
    uniqueStrings(target.testNameFragments),
  ]);
}

function mergeTargets(targets) {
  const targetsByKey = new Map();

  asArray(targets).forEach(target => {
    const key = targetKey(target);
    const existingTarget = targetsByKey.get(key);

    if (existingTarget) {
      existingTarget.dependencyIds = uniqueStrings([
        ...existingTarget.dependencyIds,
        ...target.dependencyIds,
      ]);
      existingTarget.sourceTextFragments = uniqueStrings([
        ...existingTarget.sourceTextFragments,
        ...target.sourceTextFragments,
      ]);
      return;
    }

    targetsByKey.set(key, {
      ...target,
      dependencyIds: uniqueStrings(target.dependencyIds),
    });
  });

  return [...targetsByKey.values()];
}

function buildPolicyCompatibilityRetirementExecutionManifestTargets(entries = []) {
  const reconciliationEntries = asArray(entries);
  const retiringComponentPaths = new Set(reconciliationEntries
    .map(entry => cleanString(entry.componentPath))
    .filter(Boolean));
  const targets = reconciliationEntries.flatMap(entry => [
    buildReferenceTarget(entry, retiringComponentPaths),
    buildComponentTarget(entry),
  ].filter(Boolean));

  return mergeTargets(targets);
}

export {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_ACTION_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_TARGET_KIND_IDS,
  buildPolicyCompatibilityRetirementExecutionManifestTargets,
};
