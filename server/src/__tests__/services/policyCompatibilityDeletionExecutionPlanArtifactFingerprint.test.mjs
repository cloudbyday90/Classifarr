/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS,
  buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
  validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
} from '../../services/policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs';

function executionPlanArtifact({ manifestEntries = [] } = {}) {
  return {
    version: 'policy.compatibility_deletion_execution_plan_artifact.v3',
    generatedAt: '2026-07-14T20:00:00.000Z',
    statusId: 'ready',
    ready: true,
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    },
    evidenceBundle: {
      version: 'policy.compatibility_deletion_execution_plan_evidence_bundle.v1',
      generatedAt: '2026-07-14T20:00:00.000Z',
      statusId: 'ready',
      validationOk: true,
    },
    executionPlan: {
      version: 'policy.compatibility_deletion_execution_plan.v2',
      statusId: 'ready_for_execution_gate',
      readyForExecutionGate: true,
      riskCount: 0,
      risks: [],
      readiness: { statusId: 'ready' },
      manifest: {
        approved: true,
        approvedBy: 'policy-maintainer',
        rollbackStance: 'Retained.',
        supportStance: 'Final.',
        entryCount: manifestEntries.length,
        entries: manifestEntries,
      },
      sideEffects: { filesDeleted: false },
    },
  };
}

describe('policyCompatibilityDeletionExecutionPlanArtifactFingerprint', () => {
  test('creates the same fingerprint for equivalent unordered manifest and risk data', () => {
    const entries = [
      { path: 'server/src/services/legacyB.mjs', categoryId: 'service', actionId: 'delete_file' },
      { path: 'server/src/services/legacyA.mjs', categoryId: 'service', actionId: 'delete_file' },
    ];
    const first = executionPlanArtifact({ manifestEntries: entries });
    const second = executionPlanArtifact({ manifestEntries: [...entries].reverse() });
    first.risks = [{ riskId: 'b' }, { riskId: 'a' }];
    second.risks = [{ riskId: 'a' }, { riskId: 'b' }];

    expect(buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({ artifact: first }))
      .toEqual(buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({ artifact: second }));
  });

  test('rejects a fingerprint after a bound manifest entry changes', () => {
    const artifact = executionPlanArtifact({
      manifestEntries: [
        { path: 'server/src/services/legacyA.mjs', categoryId: 'service', actionId: 'delete_file' },
      ],
    });
    const artifactFingerprint =
      buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({ artifact });
    const mutatedArtifact = {
      ...artifact,
      executionPlan: {
        ...artifact.executionPlan,
        manifest: {
          ...artifact.executionPlan.manifest,
          entries: [
            {
              ...artifact.executionPlan.manifest.entries[0],
              path: 'server/src/services/unapproved.mjs',
            },
          ],
        },
      },
    };

    const validation = validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact: mutatedArtifact,
      artifactFingerprint,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS
          .FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('rejects a fingerprint after an exact named test scope changes', () => {
    const artifact = executionPlanArtifact({
      manifestEntries: [{
        kindId: 'named_test_scope',
        actionId: 'remove_named_test_scope',
        categoryId: 'stale_compatibility_tests',
        path: 'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
        sourceTextFragments: ['legacy migration assertion'],
        testNameFragments: ['renders migration notice'],
        wholeFileDeletion: false,
      }],
    });
    const artifactFingerprint =
      buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({ artifact });
    const mutatedArtifact = {
      ...artifact,
      executionPlan: {
        ...artifact.executionPlan,
        manifest: {
          ...artifact.executionPlan.manifest,
          entries: [{
            ...artifact.executionPlan.manifest.entries[0],
            sourceTextFragments: ['different assertion'],
          }],
        },
      },
    };

    const validation = validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact: mutatedArtifact,
      artifactFingerprint,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS
          .FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('rejects a fingerprint after a bound candidate target kind or dependency changes', () => {
    const artifact = executionPlanArtifact({
      manifestEntries: [{
        kindId: 'file_path',
        targetKindId: 'code_path',
        dependencyIds: ['policy_builder_modal_legacy_branch'],
        actionId: 'replace_code_path',
        categoryId: 'policy_builder_modal_legacy_branch',
        path: 'client/src/components/policies/PolicyBuilderModal.vue',
      }],
    });
    const artifactFingerprint =
      buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({ artifact });
    const mutatedArtifact = {
      ...artifact,
      executionPlan: {
        ...artifact.executionPlan,
        manifest: {
          ...artifact.executionPlan.manifest,
          entries: [{
            ...artifact.executionPlan.manifest.entries[0],
            targetKindId: 'test_file',
            dependencyIds: ['substituted_dependency'],
          }],
        },
      },
    };

    const validation = validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact: mutatedArtifact,
      artifactFingerprint,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS
          .FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('rejects malformed fingerprint metadata and mismatched provenance', () => {
    const artifact = executionPlanArtifact();
    const fingerprint =
      buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({ artifact });
    const validation = validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact,
      artifactFingerprint: {
        ...fingerprint,
        fingerprint: 'not-a-sha256-digest',
        provenance: {
          ...fingerprint.provenance,
          manifestEntryCount: 99,
        },
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS
        .MALFORMED_FINGERPRINT,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_FINGERPRINT_RISK_IDS
        .PROVENANCE_MISMATCH,
    ]));
  });
});
