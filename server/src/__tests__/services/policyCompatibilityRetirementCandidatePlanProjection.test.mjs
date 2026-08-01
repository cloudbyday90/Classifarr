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
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS,
  buildPolicyCompatibilityRetirementCandidatePlanProjection,
  validatePolicyCompatibilityRetirementCandidatePlanProjection,
} from '../../services/policyCompatibilityRetirementCandidatePlanProjection.mjs';
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

async function buildReadyReconciliation() {
  const dependencyAudit = buildPolicyCompatibilityComponentDeletionDependencyAudit({
    sourceTextByPath: await readDependencySources(),
    routeSourceTextByPath: await readRouteSources(),
  });

  return buildPolicyCompatibilityRetirementManifestReconciliation({ dependencyAudit });
}

describe('policyCompatibilityRetirementCandidatePlanProjection', () => {
  test('projects exact, source-backed candidates without approving or executing them', async () => {
    const projection = buildPolicyCompatibilityRetirementCandidatePlanProjection({
      reconciliation: await buildReadyReconciliation(),
    });

    expect(projection).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
        .CANDIDATE_PLAN_READY,
      candidatePlanReady: true,
      readOnly: true,
      deletionAuthorized: false,
      executionManifestWritten: false,
      targetCount: 10,
      issueCount: 0,
      issues: [],
      validation: {
        ok: true,
        issueCount: 0,
        issues: [],
      },
    }));
    expect(projection.reconciliation).toEqual(expect.objectContaining({
      reconciliationReady: true,
      validationOk: true,
      entryCount: 11,
    }));
    expect(projection.candidateTargetEntries).toHaveLength(10);
    expect(projection.candidatePlanInput).toEqual(expect.objectContaining({
      manifestApproved: false,
      approvedBy: null,
    }));
    expect(projection.candidatePlanInput).not.toHaveProperty('deletionReadiness');
    expect(projection.candidatePlanInput).not.toHaveProperty('executionManifest');
    expect(projection.candidatePlanInput.namedTestScopeEntries).toHaveLength(4);
    expect(projection.candidatePlanInput.namedTestScopeEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS
          .REMOVE_NAMED_TEST_SCOPE,
        wholeFileDeletion: false,
      }),
    ]));
    expect(projection.candidateTargetEntries.every(entry => (
      entry.nativeSuccessorEvidence.length > 0 &&
      entry.nativeSuccessorEvidence.every(successor => (
        successor.dependencyId && successor.handoffId &&
        successor.nativeWorkflowTestPath &&
        successor.nativeWorkflowTestNameFragments.length > 0
      ))
    ))).toBe(true);
  });

  test('derives its targets from reconciliation rather than caller-supplied plans or targets', async () => {
    const projection = buildPolicyCompatibilityRetirementCandidatePlanProjection({
      reconciliation: await buildReadyReconciliation(),
      targets: [],
      candidatePlanInput: { manifestApproved: true },
      executionPlan: { manifestApproved: true },
    });

    expect(projection.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
        .CANDIDATE_PLAN_READY);
    expect(projection.targetCount).toBe(10);
    expect(projection.candidatePlanInput.manifestApproved).toBe(false);
    expect(projection.candidatePlanInput.approvedBy).toBeNull();
  });

  test('fails closed when reconciliation is unavailable or native successor evidence is incomplete', async () => {
    const unavailableProjection = buildPolicyCompatibilityRetirementCandidatePlanProjection();
    const reconciliation = await buildReadyReconciliation();
    const incompleteSuccessorProjection = buildPolicyCompatibilityRetirementCandidatePlanProjection({
      reconciliation: {
        ...reconciliation,
        entries: reconciliation.entries.map(entry => (
          entry.dependencyId === 'policy_intent_editor_named_maintenance_scope'
            ? {
              ...entry,
              nativeStorageCutover: {
                ...entry.nativeStorageCutover,
                nativeWorkflowSuccessors: [],
              },
            }
            : entry
        )),
      },
    });

    expect(unavailableProjection.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
        .BLOCKED_BY_RECONCILIATION);
    expect(unavailableProjection.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
          .RECONCILIATION_MISSING,
      }),
    ]));
    expect(incompleteSuccessorProjection.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
        .BLOCKED_BY_TARGETS);
    expect(incompleteSuccessorProjection.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
          .NATIVE_SUCCESSOR_MISSING,
      }),
    ]));
  });

  test('blocks attempted side effects and rejects a tampered approval or execution request', async () => {
    const reconciliation = await buildReadyReconciliation();
    const projection = buildPolicyCompatibilityRetirementCandidatePlanProjection({ reconciliation });
    const sideEffectProjection = buildPolicyCompatibilityRetirementCandidatePlanProjection({
      reconciliation,
      sideEffects: {
        executionManifestWritten: true,
        storageChanged: true,
      },
    });
    const validation = validatePolicyCompatibilityRetirementCandidatePlanProjection({
      ...projection,
      targetCount: 0,
      deletionAuthorized: true,
      candidateTargetEntries: projection.candidateTargetEntries.map(entry => (
        entry.actionId === POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS
          .REMOVE_NAMED_TEST_SCOPE
          ? { ...entry, wholeFileDeletion: true }
          : entry
      )),
      candidatePlanInput: {
        ...projection.candidatePlanInput,
        manifestApproved: true,
        approvedBy: 'maintainer',
        executeDeletionNow: true,
        candidateTargetEntries: projection.candidateTargetEntries.map(entry => (
          entry.actionId === POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS
            .REMOVE_NAMED_TEST_SCOPE
            ? { ...entry, wholeFileDeletion: true }
            : entry
        )),
      },
    });

    expect(sideEffectProjection.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_STATUS_IDS
        .BLOCKED_BY_SIDE_EFFECT);
    expect(sideEffectProjection.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
      }),
    ]));
    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .CANDIDATE_AUTHORIZES_DELETION,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .CANDIDATE_TARGET_COUNT_MISMATCH,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .CANDIDATE_MANIFEST_APPROVED,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .CANDIDATE_EXECUTION_REQUESTED,
      POLICY_COMPATIBILITY_RETIREMENT_CANDIDATE_PLAN_PROJECTION_RISK_IDS
        .NAMED_SCOPE_INVALID,
    ]));
  });
});
