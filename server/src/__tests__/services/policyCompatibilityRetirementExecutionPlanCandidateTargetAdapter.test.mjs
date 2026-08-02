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
  POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS,
  POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS,
  buildPolicyCompatibilityDeletionGates,
} from '../../services/policyCompatibilityDeletionGates.mjs';
import {
  buildPolicyCompatibilityDeletionCurrentInventory,
} from '../../services/policyCompatibilityDeletionCurrentInventory.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionPlan,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  buildPolicyCompatibilityDeletionReadiness,
} from '../../services/policyCompatibilityDeletionReadiness.mjs';
import {
  buildPolicyCompatibilityDeletionReconciliationStateInventory,
} from '../../services/policyCompatibilityDeletionReconciliationStateInventory.mjs';
import {
  buildPolicyBackupRestoreVerificationEvidence,
} from '../../services/policyBackupRestoreVerificationEvidence.mjs';
import {
  buildPolicyNativeRuntimeCutoverVerification,
} from '../../services/policyNativeRuntimeCutoverVerification.mjs';
import {
  buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate,
} from '../../services/policyCompatibilityRetirementCandidatePlanAssemblyGate.mjs';
import {
  buildPolicyCompatibilityRetirementCandidatePlanProjection,
} from '../../services/policyCompatibilityRetirementCandidatePlanProjection.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS,
  buildPolicyCompatibilityRetirementExecutionPlanCandidateTargetAdapter,
  validatePolicyCompatibilityRetirementExecutionPlanCandidateTargetAdapter,
} from '../../services/policyCompatibilityRetirementExecutionPlanCandidateTargetAdapter.mjs';
import {
  buildPolicyCompatibilityRetirementManifestReconciliation,
} from '../../services/policyCompatibilityRetirementManifestReconciliation.mjs';
import {
  buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence,
} from '../helpers/policyCompatibilityDeletionReleasePrerequisiteEvidence.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const generatedAt = new Date().toISOString();

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 4,
    library_name: 'Animated Movies',
    library_media_type: 'movie',
    name: 'Animated Policy',
    presets: [{
      id: 7,
      key: 'family',
      name: 'Family',
      signals: {
        genres: { require_any: ['Family'] },
      },
      custom_signals: null,
    }],
    ...overrides,
  };
}

function nativePolicy(overrides = {}) {
  return policy({
    native_intent: {
      active: true,
      intent_version: 2,
      contract: {
        schema_version: 1,
        policy_id: 14,
        library_id: 4,
        library_name: 'Animated Movies',
        library_media_type: 'movie',
        source: 'native_intent',
        inference_state: 'inferred',
        model: {
          mode: 'native_intent',
          intent_supported: true,
          native_intent: true,
          conversion_available: false,
        },
        purpose: [{
          intent_role: 'purpose',
          signal_type: 'genres',
          operator: 'require_any',
          values: { require_any: ['Animation'] },
          constraint_mode: 'advisory',
          semantics: 'identity',
          source: 'native_intent',
          inference_state: 'inferred',
        }],
        hard_limits: [],
        helpful_hints: [],
        avoid: [],
        review_behavior: {},
        template_links: [],
        warnings: [],
        unsupported_signals: [],
      },
    },
    ...overrides,
  });
}

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

async function buildReadyAdapter() {
  const dependencyAudit = buildPolicyCompatibilityComponentDeletionDependencyAudit({
    sourceTextByPath: await readDependencySources(),
    routeSourceTextByPath: await readRouteSources(),
  });
  const reconciliation = buildPolicyCompatibilityRetirementManifestReconciliation({
    dependencyAudit,
  });
  const candidateProjection = buildPolicyCompatibilityRetirementCandidatePlanProjection({
    reconciliation,
  });
  const candidateAssembly = buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate({
    candidateProjection,
    deletionGatePlan: buildPolicyCompatibilityDeletionGates(),
  });

  return buildPolicyCompatibilityRetirementExecutionPlanCandidateTargetAdapter({
    candidateProjection,
    candidateAssembly,
  });
}

function buildCompleteCoverage() {
  return Object.fromEntries(
    Object.values(POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS)
      .map(coverageId => [coverageId, true]),
  );
}

function buildReadyDeletionReadiness() {
  const deletionGatePlan = buildPolicyCompatibilityDeletionGates({
    coverage: buildCompleteCoverage(),
    supportStanceId:
      POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
    unconvertedPolicyCount: 0,
    requiresMaintenanceStateCount: 0,
    generatedAt,
  });
  const evidence = {
    currentPolicyInventory: buildPolicyCompatibilityDeletionCurrentInventory({
      policyRows: [{
        policy_id: 14,
        active_intent_count: 1,
        authoritative_native_intent_count: 1,
        active_intent_sources: ['native_intent'],
        active_intent_validation_statuses: ['valid'],
      }],
      generatedAt,
    }),
    reconciliationStateInventory: buildPolicyCompatibilityDeletionReconciliationStateInventory({
      requiresMaintenanceStateCount: 0,
      generatedAt,
    }),
    cutoverVerification: buildPolicyNativeRuntimeCutoverVerification({
      convertedPolicy: nativePolicy(),
      unconvertedPolicy: policy({ id: 15 }),
      rollbackAvailable: true,
      legacyDeletionBlocked: true,
      supportDiagnosticsSafe: true,
      generatedAt,
    }),
    deletionGatePlan,
    backupRestoreEvidence: buildPolicyBackupRestoreVerificationEvidence({
      generatedAt,
      record: {
        verification_version: 1,
        restore_mode: 'replace',
        backup_version: '2.0',
        verification_status: 'verified',
        schema_parity_verified: true,
        native_authority_verified: true,
        policy_library_mismatch_count: 0,
        verified_at: generatedAt,
        restore_gate_state: 'ready',
        restore_gate_reason_id: 'restore_verified',
        restore_gate_verified_at: generatedAt,
      },
    }),
  };

  return {
    deletionGatePlan,
    deletionReadiness: buildPolicyCompatibilityDeletionReadiness({
      ...evidence,
      releasePrerequisiteEvidence:
        buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence(evidence, {
          generatedAt,
        }),
    }),
  };
}

describe('policyCompatibilityRetirementExecutionPlanCandidateTargetAdapter', () => {
  test('derives all exact mapped targets as unapproved, side-effect-free execution-plan input', async () => {
    const adapter = await buildReadyAdapter();

    expect(adapter).toEqual(expect.objectContaining({
      statusId:
        POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS
          .ADAPTER_READY,
      adapterReady: true,
      readOnly: true,
      deletionAuthorized: false,
      executionManifestWritten: false,
      executionPlanArtifactWritten: false,
      executionGateInvoked: false,
      candidateTargetCount: 10,
      mappingCount: 10,
      validation: { ok: true, issueCount: 0, issues: [] },
    }));
    expect(adapter.executionPlanInput).toEqual(expect.objectContaining({
      manifestApproved: false,
      approvedBy: null,
      candidateTargetEntries: expect.arrayContaining([
        expect.objectContaining({
          categoryId: 'compatibility_named_test_scopes',
          targetKindId: 'named_test_scope',
          wholeFileDeletion: false,
        }),
        expect.objectContaining({
          categoryId: 'policy_builder_modal_legacy_branch',
          targetKindId: 'code_path',
          actionId: 'replace_code_path',
        }),
      ]),
    }));
    expect(adapter.executionPlanInput.candidateTargetEntries).toHaveLength(10);
    expect(Object.values(adapter.sideEffects).some(Boolean)).toBe(false);
  });

  test('feeds exact candidate targets into the existing execution-plan contract without weakening approval or release readiness', async () => {
    const adapter = await buildReadyAdapter();
    const { deletionReadiness, deletionGatePlan } = buildReadyDeletionReadiness();
    const replacementEvidence = Object.fromEntries(
      adapter.executionPlanInput.candidateTargetEntries.map(entry => [entry.categoryId, {
        replacement: `Native workflow successor evidence for ${entry.categoryId}.`,
      }]),
    );
    const plan = buildPolicyCompatibilityDeletionExecutionPlan({
      deletionReadiness,
      deletionGatePlan,
      candidateTargetAdapter: adapter,
      replacementEvidence,
      rollbackStance: 'Restore evidence remains available through the approved support window.',
      supportStance: 'Converted native policies retain bounded support diagnostics.',
      manifestApproved: true,
      approvedBy: 'policy-maintainer',
    });

    expect(plan.risks).toEqual([]);
    expect(plan.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE);
    expect(plan.manifest.entryCount).toBe(10);
    expect(plan.manifest.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        categoryId: 'compatibility_named_test_scopes',
        targetKindId: 'named_test_scope',
        wholeFileDeletion: false,
        ready: true,
      }),
      expect.objectContaining({
        categoryId: 'policy_builder_modal_legacy_branch',
        targetKindId: 'code_path',
        dependencyIds: expect.any(Array),
        sourceTextFragments: expect.any(Array),
        ready: true,
      }),
    ]));
    expect(plan.manifest.entries.every(entry => entry.targetKindId &&
      entry.dependencyIds.length > 0)).toBe(true);
    expect(plan.validation.ok).toBe(true);
  });

  test('fails closed on target substitution, approval claims, and reported side effects', async () => {
    const adapter = await buildReadyAdapter();
    const tampered = {
      ...adapter,
      executionPlanInput: {
        ...adapter.executionPlanInput,
        manifestApproved: true,
        candidateTargetEntries: adapter.executionPlanInput.candidateTargetEntries
          .slice(1)
          .map((entry, index) => index === 0
            ? { ...entry, replacementEvidence: { substituted: true } }
            : entry),
      },
    };
    const validation = validatePolicyCompatibilityRetirementExecutionPlanCandidateTargetAdapter(
      tampered,
    );
    const sideEffectAdapter = buildPolicyCompatibilityRetirementExecutionPlanCandidateTargetAdapter({
      candidateProjection: adapter.candidateProjection,
      candidateAssembly: adapter.candidateAssembly,
      sideEffects: {
        executionManifestWritten: true,
        executionPlanArtifactWritten: true,
      },
    });
    const plan = buildPolicyCompatibilityDeletionExecutionPlan({
      candidateTargetAdapter: tampered,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS
        .EXECUTION_PLAN_INPUT_MISMATCH,
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS
        .EXECUTION_PLAN_INPUT_APPROVED,
    ]));
    expect(sideEffectAdapter.statusId)
      .toBe(POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_STATUS_IDS
        .BLOCKED_BY_SIDE_EFFECT);
    expect(sideEffectAdapter.issues.map(issue => issue.riskId)).toContain(
      POLICY_COMPATIBILITY_RETIREMENT_EXECUTION_PLAN_CANDIDATE_TARGET_ADAPTER_RISK_IDS
        .SIDE_EFFECT_REPORTED,
    );
    expect(plan.risks.map(risk => risk.riskId)).toContain(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_RISK_IDS.CANDIDATE_TARGET_ADAPTER_INVALID,
    );
  });
});
