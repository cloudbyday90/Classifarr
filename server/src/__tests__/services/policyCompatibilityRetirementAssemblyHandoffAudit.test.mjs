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
  POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS,
  POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS,
  buildPolicyCompatibilityDeletionGates,
} from '../../services/policyCompatibilityDeletionGates.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionGate,
} from '../../services/policyCompatibilityDeletionExecutionGate.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  buildPolicyBackupRestoreVerificationEvidence,
} from '../../services/policyBackupRestoreVerificationEvidence.mjs';
import {
  buildPolicyCompatibilityComponentDeletionDependencyAudit,
  listPolicyCompatibilityComponentDeletionDependencies,
  listPolicyCompatibilityComponentDeletionRouteSourcePaths,
} from '../../services/policyCompatibilityComponentDeletionDependencies.mjs';
import {
  buildPolicyCompatibilityDeletionCurrentInventory,
} from '../../services/policyCompatibilityDeletionCurrentInventory.mjs';
import {
  buildPolicyCompatibilityDeletionReadiness,
} from '../../services/policyCompatibilityDeletionReadiness.mjs';
import {
  buildPolicyCompatibilityDeletionReconciliationStateInventory,
} from '../../services/policyCompatibilityDeletionReconciliationStateInventory.mjs';
import {
  buildPolicyNativeRuntimeCutoverVerification,
} from '../../services/policyNativeRuntimeCutoverVerification.mjs';
import {
  buildPolicyCompatibilityRetirementCandidatePlanProjection,
} from '../../services/policyCompatibilityRetirementCandidatePlanProjection.mjs';
import {
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS,
  POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS,
  buildPolicyCompatibilityRetirementAssemblyHandoffAudit,
  validatePolicyCompatibilityRetirementAssemblyHandoffAudit,
} from '../../services/policyCompatibilityRetirementAssemblyHandoffAudit.mjs';
import {
  buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate,
} from '../../services/policyCompatibilityRetirementCandidatePlanAssemblyGate.mjs';
import {
  buildPolicyCompatibilityRetirementManifestReconciliation,
} from '../../services/policyCompatibilityRetirementManifestReconciliation.mjs';
import {
  buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence,
} from '../helpers/policyCompatibilityDeletionReleasePrerequisiteEvidence.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  buildReadyExecutionGateOperatorEvidence,
  buildReadyExecutionGatePreflightEvidenceArtifact,
  buildReadyExecutionGateRecoveryEvidence,
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';

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

async function buildReadyCandidateAssembly() {
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

  return buildPolicyCompatibilityRetirementCandidatePlanAssemblyGate({
    candidateProjection,
    deletionGatePlan: buildPolicyCompatibilityDeletionGates(),
  });
}

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

function nativePolicy() {
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
  });
}

function buildReadyDeletionReadiness() {
  const generatedAt = POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME;
  const deletionGatePlan = buildPolicyCompatibilityDeletionGates({
    coverage: Object.fromEntries(
      Object.values(POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS)
        .map(coverageId => [coverageId, true]),
    ),
    supportStanceId:
      POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
    unconvertedPolicyCount: 0,
    requiresMaintenanceStateCount: 0,
    generatedAt,
  });
  const currentPolicyInventory = buildPolicyCompatibilityDeletionCurrentInventory({
    policyRows: [{
      policy_id: 14,
      active_intent_count: 1,
      authoritative_native_intent_count: 1,
      active_intent_sources: ['native_intent'],
      active_intent_validation_statuses: ['valid'],
    }],
    generatedAt,
  });
  const reconciliationStateInventory =
    buildPolicyCompatibilityDeletionReconciliationStateInventory({
      requiresMaintenanceStateCount: 0,
      generatedAt,
    });
  const cutoverVerification = buildPolicyNativeRuntimeCutoverVerification({
    convertedPolicy: nativePolicy(),
    unconvertedPolicy: policy({ id: 15 }),
    rollbackAvailable: true,
    legacyDeletionBlocked: true,
    supportDiagnosticsSafe: true,
    generatedAt,
  });
  const backupRestoreEvidence = buildPolicyBackupRestoreVerificationEvidence({
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
  });
  const evidence = {
    currentPolicyInventory,
    reconciliationStateInventory,
    cutoverVerification,
    deletionGatePlan,
    backupRestoreEvidence,
  };

  return buildPolicyCompatibilityDeletionReadiness({
    ...evidence,
    releasePrerequisiteEvidence:
      buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence(evidence),
  });
}

function buildApprovedArtifact(assembly, transformEntry = entry => entry) {
  const entries = assembly.mappings.map((mapping, index) => transformEntry({
    categoryId: mapping.categoryId,
    actionId: mapping.candidate.actionId,
    path: mapping.candidate.path,
    componentPath: mapping.candidate.componentPath,
    sourceTextFragments: mapping.candidate.sourceTextFragments,
    testNameFragments: mapping.candidate.testNameFragments,
    wholeFileDeletion: mapping.candidate.kindId === 'named_test_scope' ? false : null,
    replacementEvidence: { successor: 'Native workflow contract coverage' },
    ready: true,
  }, index));
  const executionPlan = {
    statusId: POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    manifest: {
      approved: true,
      approvedBy: 'policy-maintainer',
      entryCount: entries.length,
      entries,
    },
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      manifestWritten: false,
    },
  };

  return buildReadyExecutionPlanArtifact({
    executionPlan,
    generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  });
}

function buildReadyExecutionGate(artifact) {
  return buildPolicyCompatibilityDeletionExecutionGate({
    executionPlanArtifact: artifact,
    recoveryEvidence: buildReadyExecutionGateRecoveryEvidence({
      executionPlanArtifact: artifact,
    }),
    operatorEvidence: buildReadyExecutionGateOperatorEvidence({
      executionPlanArtifact: artifact,
    }),
    preflightEvidenceArtifact: buildReadyExecutionGatePreflightEvidenceArtifact({
      executionPlanArtifact: artifact,
    }),
    generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  });
}

describe('policyCompatibilityRetirementAssemblyHandoffAudit', () => {
  test('requires existing release readiness after source-backed candidate assembly', async () => {
    const candidateAssembly = await buildReadyCandidateAssembly();
    const audit = buildPolicyCompatibilityRetirementAssemblyHandoffAudit({
      candidateAssembly,
    });

    expect(candidateAssembly.assemblyReady).toBe(true);
    expect(candidateAssembly.mappedTargetCount).toBe(10);
    expect(audit).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
        .BLOCKED_BY_RELEASE_READINESS,
      handoffReady: false,
      readOnly: true,
      deletionAuthorized: false,
      executionManifestWritten: false,
      executionPlanArtifactWritten: false,
      executionGateInvoked: false,
      coverageCount: 0,
      validation: { ok: true, issueCount: 0, issues: [] },
    }));
    expect(audit.issues.map(issue => issue.riskId)).toContain(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .RELEASE_READINESS_MISSING,
    );
  });

  test('blocks the existing execution gate when exact named scopes share a retained test file', async () => {
    const candidateAssembly = await buildReadyCandidateAssembly();
    const deletionReadiness = buildReadyDeletionReadiness();
    const executionPlanArtifact = buildApprovedArtifact(candidateAssembly);
    const executionGate = buildReadyExecutionGate(executionPlanArtifact);
    const audit = buildPolicyCompatibilityRetirementAssemblyHandoffAudit({
      candidateAssembly,
      deletionReadiness,
      executionPlanArtifact,
      executionGate,
    });

    expect(deletionReadiness.readyForDeletionExecutionPlan).toBe(true);
    expect(executionGate.statusId).toBe(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
        .BLOCKED_BY_MANIFEST_VERIFICATION,
    );
    expect(executionGate.risks.map(risk => risk.riskId)).toContain('manifest_duplicate_path');
    expect(audit).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
        .BLOCKED_BY_EXECUTION_GATE,
      handoffReady: false,
      coverageCount: 10,
      coveredTargetCount: 10,
      uncoveredTargetCount: 0,
      validation: { ok: true, issueCount: 0, issues: [] },
    }));
    expect(audit.issues.map(issue => issue.riskId)).toContain(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.EXECUTION_GATE_NOT_READY,
    );
    expect(audit.nextStep.stepId)
      .toBe('compatibility_deletion_execution_gate_named_scope_observation_identity');
  });

  test('blocks a ready legacy artifact that substitutes a broad category for an assembled target', async () => {
    const candidateAssembly = await buildReadyCandidateAssembly();
    const deletionReadiness = buildReadyDeletionReadiness();
    const executionPlanArtifact = buildApprovedArtifact(candidateAssembly, (entry, index) => (
      index === 0 ? { ...entry, categoryId: 'client_bridge_ui' } : entry
    ));
    const executionGate = buildReadyExecutionGate(executionPlanArtifact);
    const audit = buildPolicyCompatibilityRetirementAssemblyHandoffAudit({
      candidateAssembly,
      deletionReadiness,
      executionPlanArtifact,
      executionGate,
    });

    expect(audit.statusId).toBe(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS
        .BLOCKED_BY_ARTIFACT_COVERAGE,
    );
    expect(audit.issues.map(issue => issue.riskId)).toContain(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.ARTIFACT_TARGET_MISSING,
    );
    expect(audit.nextStep.stepId)
      .toBe('compatibility_retirement_execution_plan_candidate_target_adapter');
  });

  test('blocks requested side effects and rejects a tampered audit result', async () => {
    const candidateAssembly = await buildReadyCandidateAssembly();
    const audit = buildPolicyCompatibilityRetirementAssemblyHandoffAudit({
      candidateAssembly,
      sideEffects: {
        executionPlanArtifactWritten: true,
        executionGateInvoked: true,
      },
    });
    const validation = validatePolicyCompatibilityRetirementAssemblyHandoffAudit({
      ...audit,
      readOnly: false,
      deletionAuthorized: true,
      executionManifestWritten: true,
      coverageCount: 99,
    });

    expect(audit.statusId).toBe(
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_STATUS_IDS.BLOCKED_BY_SIDE_EFFECT,
    );
    expect(audit.validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.AUDIT_NOT_READ_ONLY,
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .AUDIT_AUTHORIZES_DELETION,
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS
        .AUDIT_MANIFEST_WRITTEN,
      POLICY_COMPATIBILITY_RETIREMENT_ASSEMBLY_HANDOFF_AUDIT_RISK_IDS.COVERAGE_COUNT_MISMATCH,
    ]));
  });
});
