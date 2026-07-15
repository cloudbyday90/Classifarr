/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_STATUS_IDS,
  resolvePolicyNextCompatibilityRemovalBatchAuthorizationPathStateSource,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationPathStateSource.mjs';
import {
  buildNextBatchAuthorizationPathStateSource,
} from './fixtures/policyNextCompatibilityRemovalBatchAuthorizationFixtures.mjs';

const MANIFEST_PATHS = Object.freeze([
  'server/src/services/legacyPolicyBridge.mjs',
  'client/src/components/policies/LegacyPolicyBridge.vue',
]);

function executionPlan() {
  return {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    },
    manifest: {
      approved: true,
      approvedBy: 'policy-maintainer',
      entryCount: MANIFEST_PATHS.length,
      entries: MANIFEST_PATHS.map(path => ({
        categoryId: 'legacy_policy_bridge',
        actionId: 'delete_file',
        path,
        replacementEvidence: {
          replacementPath: 'server/src/services/policyNativeIntentProjection.mjs',
        },
        ready: true,
      })),
    },
  };
}

describe('policyNextCompatibilityRemovalBatchAuthorizationPathStateSource', () => {
  test('resolves a verified snapshot from the same approved plan artifact', () => {
    const plan = executionPlan();
    const source = buildNextBatchAuthorizationPathStateSource({
      executionPlan: plan,
      existingPaths: [MANIFEST_PATHS[1]],
    });
    const resolved =
      resolvePolicyNextCompatibilityRemovalBatchAuthorizationPathStateSource(source);

    expect(resolved.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_STATUS_IDS
        .READY);
    expect(resolved.ok).toBe(true);
    expect(resolved.executionPlan).toEqual(plan);
    expect(resolved.pathState).toEqual(expect.objectContaining({
      removedPaths: [MANIFEST_PATHS[0]],
      existingPaths: [MANIFEST_PATHS[1]],
    }));
  });

  test('rejects a replay-valid snapshot from another execution-plan artifact', () => {
    const plan = executionPlan();
    const trusted = buildNextBatchAuthorizationPathStateSource({
      executionPlan: plan,
    });
    const other = buildNextBatchAuthorizationPathStateSource({
      executionPlan: plan,
      generatedAt: '2026-07-15T12:00:01.000Z',
    });
    const resolved =
      resolvePolicyNextCompatibilityRemovalBatchAuthorizationPathStateSource({
        executionPlanArtifact: trusted.executionPlanArtifact,
        pathStateEvidence: other.pathStateEvidence,
      });

    expect(resolved.statusId)
      .toBe(POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_STATUS_IDS
        .BLOCKED);
    expect(resolved.ok).toBe(false);
    expect(resolved.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS
            .PATH_STATE_EVIDENCE_ARTIFACT_MISMATCH,
      }),
    ]));
  });

  test('retains independently verified plan evidence when only the snapshot binding fails', () => {
    const plan = executionPlan();
    const trusted = buildNextBatchAuthorizationPathStateSource({
      executionPlan: plan,
    });
    const other = buildNextBatchAuthorizationPathStateSource({
      executionPlan: plan,
      generatedAt: '2026-07-15T12:00:01.000Z',
    });
    const resolved =
      resolvePolicyNextCompatibilityRemovalBatchAuthorizationPathStateSource({
        executionPlanArtifact: trusted.executionPlanArtifact,
        pathStateEvidence: other.pathStateEvidence,
      });

    expect(resolved.executionPlan).toEqual(plan);
    expect(resolved.executionPlanArtifactFingerprint)
      .toBe(trusted.executionPlanArtifact.artifactFingerprint.fingerprint);
    expect(resolved.pathState).toEqual({
      totalCount: 0,
      existingCount: 0,
      removedCount: 0,
      manifestPaths: [],
      existingPaths: [],
      removedPaths: [],
    });
  });
});
