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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
} from '../../services/policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs';
import {
  POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS,
  POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_STATUS_IDS,
  isSafeRepositoryPath,
  resolvePolicyStorageClosureExecutionPlanSource,
} from '../../services/policyStorageClosureExecutionPlanSource.mjs';
import {
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';

const MANIFEST_PATH = 'server/src/services/legacyPolicyBridge.mjs';

function executionPlan(overrides = {}) {
  return {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
    },
    validation: { ok: true, issueCount: 0, issues: [] },
    manifest: {
      approved: true,
      approvedBy: 'storage-closure-maintainer',
      entryCount: 1,
      entries: [{
        categoryId: 'legacy_serializer_deserializer',
        actionId: 'replace_code_path',
        path: MANIFEST_PATH,
        ready: true,
        replacementEvidence: { replacementPath: 'server/src/services/nativePolicyIntent.mjs' },
      }],
    },
    ...overrides,
  };
}

function readyArtifact(plan = executionPlan()) {
  return buildReadyExecutionPlanArtifact({ executionPlan: plan });
}

function refingerprintedArtifact(artifact) {
  const artifactWithoutFingerprint = {
    ...artifact,
    artifactFingerprint: undefined,
    validation: undefined,
  };

  return {
    ...artifact,
    artifactFingerprint: buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact: artifactWithoutFingerprint,
    }),
  };
}

describe('policyStorageClosureExecutionPlanSource', () => {
  test('accepts only the nested manifest from a ready fingerprint-valid artifact', () => {
    const source = resolvePolicyStorageClosureExecutionPlanSource({
      executionPlanArtifact: readyArtifact(),
    });

    expect(source).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_STATUS_IDS.READY,
      ok: true,
      issueCount: 0,
      manifestPaths: [MANIFEST_PATH],
    }));
    expect(source.executionPlan.manifest.entries).toHaveLength(1);
  });

  test('rejects a raw plan and a changed artifact fingerprint', () => {
    const plan = executionPlan();
    const rawPlanSource = resolvePolicyStorageClosureExecutionPlanSource({
      executionPlanArtifact: plan,
    });
    const artifact = readyArtifact();
    const alteredSource = resolvePolicyStorageClosureExecutionPlanSource({
      executionPlanArtifact: {
        ...artifact,
        executionPlan: {
          ...artifact.executionPlan,
          manifest: {
            ...artifact.executionPlan.manifest,
            entries: [{
              ...artifact.executionPlan.manifest.entries[0],
              path: 'server/src/services/unapprovedReplacement.mjs',
            }],
          },
        },
      },
    });

    expect(rawPlanSource.ok).toBe(false);
    expect(rawPlanSource.issues.map(issue => issue.riskId)).toContain(
      POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.ARTIFACT_NOT_READY
    );
    expect(alteredSource.ok).toBe(false);
    expect(alteredSource.issues.map(issue => issue.riskId)).toContain(
      POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.ARTIFACT_FINGERPRINT_INVALID
    );
  });

  test('rejects re-fingerprinted unsafe and duplicate manifest paths', () => {
    const unsafeArtifact = readyArtifact(executionPlan({
      manifest: {
        approved: true,
        approvedBy: 'storage-closure-maintainer',
        entryCount: 2,
        entries: [{
          categoryId: 'legacy_serializer_deserializer',
          actionId: 'replace_code_path',
          path: '../outside-the-repository.mjs',
          ready: true,
        }, {
          categoryId: 'legacy_serializer_deserializer',
          actionId: 'replace_code_path',
          path: MANIFEST_PATH,
          ready: true,
        }],
      },
    }));
    const unsafeSource = resolvePolicyStorageClosureExecutionPlanSource({
      executionPlanArtifact: refingerprintedArtifact(unsafeArtifact),
    });
    const duplicateArtifact = readyArtifact(executionPlan({
      manifest: {
        approved: true,
        approvedBy: 'storage-closure-maintainer',
        entryCount: 2,
        entries: [{
          categoryId: 'legacy_serializer_deserializer',
          actionId: 'replace_code_path',
          path: MANIFEST_PATH,
          ready: true,
        }, {
          categoryId: 'legacy_serializer_deserializer',
          actionId: 'replace_code_path',
          path: MANIFEST_PATH,
          ready: true,
        }],
      },
    }));
    const duplicateSource = resolvePolicyStorageClosureExecutionPlanSource({
      executionPlanArtifact: refingerprintedArtifact(duplicateArtifact),
    });

    expect(unsafeSource.ok).toBe(false);
    expect(unsafeSource.issues.map(issue => issue.riskId)).toContain(
      POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.MANIFEST_PATH_INVALID
    );
    expect(duplicateSource.ok).toBe(false);
    expect(duplicateSource.issues.map(issue => issue.riskId)).toContain(
      POLICY_STORAGE_CLOSURE_EXECUTION_PLAN_SOURCE_RISK_IDS.MANIFEST_PATH_DUPLICATE
    );
  });

  test('recognizes only canonical repository-relative manifest paths', () => {
    expect(isSafeRepositoryPath(MANIFEST_PATH)).toBe(true);
    expect(isSafeRepositoryPath('./server/src/services/legacyPolicyBridge.mjs')).toBe(false);
    expect(isSafeRepositoryPath('/etc/passwd')).toBe(false);
    expect(isSafeRepositoryPath('C:\\Windows\\System32\\config')).toBe(false);
    expect(isSafeRepositoryPath('server/src/../secrets.mjs')).toBe(false);
  });
});
