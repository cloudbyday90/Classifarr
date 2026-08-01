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
  buildPolicyCompatibilityDeletionGates,
} from '../../services/policyCompatibilityDeletionGates.mjs';
import {
  buildPolicyCompatibilityRetirementCandidatePlanProjection,
} from '../../services/policyCompatibilityRetirementCandidatePlanProjection.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS,
  buildPolicyCompatibilityRetirementCandidateTaxonomy,
} from '../../services/policyCompatibilityRetirementCandidateTaxonomy.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS,
  buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate,
  validatePolicyCompatibilityRetirementCandidatePlanAssemblyGate,
} from '../../services/policyCompatibilityRetirementCandidatePlanAssemblyGate.mjs';
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

describe('policyCompatibilityRetirementCandidatePlanAssemblyGate', () => {
  test('assembles every exact source-backed candidate through the reconciled taxonomy', async () => {
    const assembly = buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate({
      candidateProjection: await buildReadyCandidateProjection(),
      deletionGatePlan: buildPolicyCompatibilityDeletionGates(),
    });

    expect(assembly).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
        .ASSEMBLY_READY,
      assemblyReady: true,
      readOnly: true,
      deletionAuthorized: false,
      executionManifestWritten: false,
      mappingCount: 10,
      mappedTargetCount: 10,
      unresolvedTargetCount: 0,
      categoryTaxonomy: expect.objectContaining({
        taxonomyReady: true,
        categoryCount: 4,
        targetCount: 10,
      }),
      validation: {
        ok: true,
        issueCount: 0,
        issues: [],
      },
    }));
    expect(assembly.gateModel).toEqual(expect.objectContaining({
      readyToDelete: false,
      validationOk: true,
    }));
    expect(assembly.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        categoryId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
          .COMPATIBILITY_NAMED_TEST_SCOPES,
        candidate: expect.objectContaining({
          path: 'client/src/__tests__/PolicyBuilderModal.test.js',
        }),
      }),
      expect.objectContaining({
        categoryId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
          .POLICY_BUILDER_MODAL_LEGACY_BRANCH,
        candidate: expect.objectContaining({
          path: 'client/src/components/policies/PolicyBuilderModal.vue',
        }),
      }),
    ]));
  });

  test('rejects invalid candidates, invalid gate models, and altered taxonomy categories', async () => {
    const projection = await buildReadyCandidateProjection();
    const gatePlan = buildPolicyCompatibilityDeletionGates();
    const taxonomy = buildPolicyCompatibilityRetirementCandidateTaxonomy({
      candidateProjection: projection,
    });
    const invalidCandidateAssembly = buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate({
      candidateProjection: {
        ...projection,
        deletionAuthorized: true,
      },
      deletionGatePlan: gatePlan,
    });
    const invalidGateAssembly = buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate({
      candidateProjection: projection,
      deletionGatePlan: {
        ...gatePlan,
        version: 'unknown',
        categories: [...gatePlan.categories, gatePlan.categories[0]],
      },
    });
    const invalidTaxonomyAssembly = buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate({
      candidateProjection: projection,
      deletionGatePlan: gatePlan,
      categoryTaxonomy: {
        ...taxonomy,
        categories: taxonomy.categories.map(category => (
          category.categoryId ===
            POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_TAXONOMY_CATEGORY_IDS
              .COMPATIBILITY_NAMED_TEST_SCOPES
            ? {
              ...category,
              actionId: 'remove_test',
            }
            : category
        )),
      },
    });

    expect(invalidCandidateAssembly.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
        .BLOCKED_BY_CANDIDATE);
    expect(invalidCandidateAssembly.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .CANDIDATE_AUTHORIZES_DELETION,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .CANDIDATE_VALIDATION_FAILED,
    ]));
    expect(invalidGateAssembly.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
        .BLOCKED_BY_GATE_MODEL);
    expect(invalidGateAssembly.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .GATE_MODEL_VERSION_UNKNOWN,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .GATE_CATEGORY_DUPLICATE,
    ]));
    expect(invalidTaxonomyAssembly.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
        .BLOCKED_BY_TAXONOMY);
    expect(invalidTaxonomyAssembly.issues.map(issue => issue.riskId)).toContain(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .TAXONOMY_VALIDATION_FAILED
    );
  });

  test('blocks side effects and rejects a tampered assembly result', async () => {
    const assembly = buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate({
      candidateProjection: await buildReadyCandidateProjection(),
      deletionGatePlan: buildPolicyCompatibilityDeletionGates(),
      sideEffects: {
        executionManifestWritten: true,
        storageChanged: true,
      },
    });
    const validation = validatePolicyCompatibilityRetirementCandidatePlanAssemblyGate({
      ...assembly,
      readOnly: false,
      deletionAuthorized: true,
      executionManifestWritten: true,
      mappingCount: 0,
    });

    expect(assembly.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
        .BLOCKED_BY_SIDE_EFFECT);
    expect(assembly.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
      }),
    ]));
    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .ASSEMBLY_NOT_READ_ONLY,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .ASSEMBLY_AUTHORIZES_DELETION,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .ASSEMBLY_MANIFEST_WRITTEN,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .MAPPING_COUNT_MISMATCH,
    ]));
  });
});
