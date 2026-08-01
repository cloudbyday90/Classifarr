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
  POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS,
  buildPolicyCompatibilityDeletionGates,
} from '../../services/policyCompatibilityDeletionGates.mjs';
import {
  buildPolicyCompatibilityRetirementCandidatePlanProjection,
} from '../../services/policyCompatibilityRetirementCandidatePlanProjection.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS,
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

function buildSingleCandidateProjection(projection, candidateTargetEntry) {
  return {
    ...projection,
    candidateTargetEntries: [candidateTargetEntry],
    candidatePlanInput: {
      ...projection.candidatePlanInput,
      candidateTargetEntries: [candidateTargetEntry],
      namedTestScopeEntries: [],
    },
    reconciliation: {
      ...projection.reconciliation,
      dependencyIds: candidateTargetEntry.dependencyIds,
    },
  };
}

describe('policyCompatibilityRetirementCandidatePlanAssemblyGate', () => {
  test('fails closed on missing categories and named-scope action mismatches in the current gate model', async () => {
    const assembly = buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate({
      candidateProjection: await buildReadyCandidateProjection(),
      deletionGatePlan: buildPolicyCompatibilityDeletionGates(),
    });

    expect(assembly).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
        .BLOCKED_BY_CATEGORY_MAPPING,
      assemblyReady: false,
      readOnly: true,
      deletionAuthorized: false,
      executionManifestWritten: false,
      mappingCount: 10,
      mappedTargetCount: 1,
      unresolvedTargetCount: 9,
      validation: {
        ok: true,
        issueCount: 0,
        issues: [],
      },
    }));
    expect(assembly.mappings.filter(mapping => mapping.statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS
        .MAPPED)).toEqual([
      expect.objectContaining({
        categoryId: POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.CLIENT_BRIDGE_UI,
        candidate: expect.objectContaining({
          path: 'client/src/components/policies/PolicyPresetMigrationNotice.vue',
        }),
      }),
    ]);
    expect(assembly.mappings.filter(mapping => mapping.statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS
        .CATEGORY_ACTION_MISMATCH)).toHaveLength(3);
    expect(assembly.mappings.filter(mapping => mapping.statusId ===
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_MAPPING_STATUS_IDS
        .CATEGORY_MISSING)).toHaveLength(6);
    expect(assembly.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .CANDIDATE_CATEGORY_MISSING,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .CANDIDATE_CATEGORY_ACTION_MISMATCH,
    ]));
  });

  test('accepts an exact action-compatible category correlation without requiring deletion readiness', async () => {
    const projection = await buildReadyCandidateProjection();
    const migrationNoticeCandidate = projection.candidateTargetEntries.find(candidate => (
      candidate.path === 'client/src/components/policies/PolicyPresetMigrationNotice.vue'
    ));
    const assembly = buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate({
      candidateProjection: buildSingleCandidateProjection(projection, migrationNoticeCandidate),
      deletionGatePlan: buildPolicyCompatibilityDeletionGates(),
    });

    expect(assembly).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
        .ASSEMBLY_READY,
      assemblyReady: true,
      mappedTargetCount: 1,
      unresolvedTargetCount: 0,
      gateModel: expect.objectContaining({
        readyToDelete: false,
        validationOk: true,
      }),
      validation: {
        ok: true,
        issueCount: 0,
        issues: [],
      },
    }));
  });

  test('rejects invalid candidate projections, invalid gate models, and action-mismatched category paths', async () => {
    const projection = await buildReadyCandidateProjection();
    const gatePlan = buildPolicyCompatibilityDeletionGates();
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
    const actionMismatchAssembly = buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate({
      candidateProjection: projection,
      deletionGatePlan: {
        ...gatePlan,
        categories: gatePlan.categories.map(category => (
          category.categoryId === POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.STALE_COMPATIBILITY_TESTS
            ? {
              ...category,
              paths: ['client/src/__tests__/RetiredCompatibilityTest.test.js'],
            }
            : category.categoryId === POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.CLIENT_BRIDGE_UI
              ? {
                ...category,
                paths: [
                  ...category.paths,
                  'client/src/__tests__/PolicyBuilderModal.test.js',
                ],
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
    expect(actionMismatchAssembly.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_STATUS_IDS
        .BLOCKED_BY_CATEGORY_MAPPING);
    expect(actionMismatchAssembly.issues.map(issue => issue.riskId)).toContain(
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_ASSEMBLY_GATE_RISK_IDS
        .CANDIDATE_CATEGORY_ACTION_MISMATCH
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
