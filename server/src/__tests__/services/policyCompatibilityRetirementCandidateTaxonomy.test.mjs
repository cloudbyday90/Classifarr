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
  buildPolicyCompatibilityComponentDeletionDependencyAudit,
  listPolicyCompatibilityComponentDeletionDependencies,
  listPolicyCompatibilityComponentDeletionRouteSourcePaths,
} from '../../services/policyCompatibilityComponentDeletionDependencies.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from '../../services/policyCompatibilityDeletionExecutionActions.mjs';
import {
  getPolicyCompatibilityDeletionCategoryActionId,
} from '../../services/policyCompatibilityDeletionCategoryAction.mjs';
import {
  buildPolicyCompatibilityRetirementCandidatePlanProjection,
} from '../../services/policyCompatibilityRetirementCandidatePlanProjection.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS,
  buildPolicyCompatibilityRetirementCandidateTaxonomy,
  validatePolicyCompatibilityRetirementCandidateTaxonomy,
} from '../../services/policyCompatibilityRetirementCandidateTaxonomy.mjs';
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

async function buildReadyCandidateProjection() {
  const dependencyAudit = buildPolicyCompatibilityComponentDeletionDependencyAudit({
    sourceTextByPath: await readDependencySources(),
    routeSourceTextByPath: await readRouteSources(),
  });
  const reconciliation = buildPolicyCompatibilityRetirementManifestReconciliation({
    dependencyAudit,
  });

  return buildPolicyCompatibilityRetirementCandidatePlanProjection({ reconciliation });
}

describe('policyCompatibilityRetirementCandidateTaxonomy', () => {
  test('derives four action-owned categories for every exact source-backed candidate', async () => {
    const taxonomy = buildPolicyCompatibilityRetirementCandidateTaxonomy({
      candidateProjection: await buildReadyCandidateProjection(),
    });
    const categoriesById = Object.fromEntries(taxonomy.categories
      .map(category => [category.categoryId, category]));
    const namedScopeCategory = categoriesById[
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
        .COMPATIBILITY_NAMED_TEST_SCOPES
    ];

    expect(taxonomy).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS
        .TAXONOMY_READY,
      taxonomyReady: true,
      readOnly: true,
      deletionAuthorized: false,
      executionManifestWritten: false,
      categoryCount: 4,
      targetCount: 10,
      issueCount: 0,
      issues: [],
      validation: {
        ok: true,
        issueCount: 0,
        issues: [],
      },
    }));
    expect(taxonomy.categories.map(category => category.categoryId)).toEqual([
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
        .COMPATIBILITY_COMPONENT_FILES,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
        .POLICY_BUILDER_MODAL_LEGACY_BRANCH,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
        .COMPATIBILITY_DEDICATED_TEST_FILES,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
        .COMPATIBILITY_NAMED_TEST_SCOPES,
    ]);
    expect(namedScopeCategory).toEqual(expect.objectContaining({
      actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS
        .REMOVE_NAMED_TEST_SCOPE,
      targetCount: 4,
    }));
    expect(namedScopeCategory.targets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        wholeFileDeletion: false,
        path: 'client/src/__tests__/PolicyBuilderModal.test.js',
      }),
      expect.objectContaining({
        wholeFileDeletion: false,
        path: 'client/src/__tests__/PolicyIntentEditor.test.js',
      }),
    ]));
    expect(taxonomy.categories.every(category => (
      category.actionId === getPolicyCompatibilityDeletionCategoryActionId(category.categoryId)
    ))).toBe(true);
  });

  test('fails closed for an unavailable candidate and requested side effects', async () => {
    const unavailableTaxonomy = buildPolicyCompatibilityRetirementCandidateTaxonomy();
    const sideEffectTaxonomy = buildPolicyCompatibilityRetirementCandidateTaxonomy({
      candidateProjection: await buildReadyCandidateProjection(),
      sideEffects: {
        executionManifestWritten: true,
        storageChanged: true,
      },
    });

    expect(unavailableTaxonomy.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS
        .BLOCKED_BY_CANDIDATE);
    expect(unavailableTaxonomy.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.CANDIDATE_MISSING,
      }),
    ]));
    expect(sideEffectTaxonomy.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_STATUS_IDS
        .BLOCKED_BY_SIDE_EFFECT);
    expect(sideEffectTaxonomy.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });

  test('rejects changed category actions, duplicate targets, and widened named scopes', async () => {
    const taxonomy = buildPolicyCompatibilityRetirementCandidateTaxonomy({
      candidateProjection: await buildReadyCandidateProjection(),
    });
    const namedScopeCategoryId =
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
        .COMPATIBILITY_NAMED_TEST_SCOPES;
    const validation = validatePolicyCompatibilityRetirementCandidateTaxonomy({
      ...taxonomy,
      categories: taxonomy.categories.map(category => (
        category.categoryId === namedScopeCategoryId
          ? {
            ...category,
            actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_TEST,
            targets: [
              {
                ...category.targets[0],
                wholeFileDeletion: true,
              },
              ...category.targets,
            ],
          }
          : category
      )),
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.CATEGORY_ACTION_MISMATCH,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.CATEGORY_TARGET_DUPLICATE,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.NAMED_SCOPE_INVALID,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_RISK_IDS.TARGET_COUNT_MISMATCH,
    ]));
  });
});
