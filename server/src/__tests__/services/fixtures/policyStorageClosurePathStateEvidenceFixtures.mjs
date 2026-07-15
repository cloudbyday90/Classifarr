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
} from '../../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  buildPolicyStorageClosurePathStateEvidence,
} from '../../../services/policyStorageClosurePathStateEvidence.mjs';
import {
  buildReadyExecutionPlanArtifact,
} from './policyCompatibilityDeletionExecutionGateFixtures.mjs';

const POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_TEST_TIME =
  '2026-07-15T12:00:00.000Z';

const POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS = Object.freeze([
  'server/src/services/legacyA.mjs',
  'client/src/components/LegacyB.vue',
]);

function buildPathStateExecutionPlan(overrides = {}) {
  return {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
    },
    manifest: {
      approved: true,
      approvedBy: 'storage-closure-maintainer',
      entryCount: POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS.length,
      entries: POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS.map(path => ({
        categoryId: 'old_preview_replay_diagnostics',
        actionId: 'delete_file',
        path,
        replacementEvidence: {
          replacementPath: 'server/src/services/nativeIntent.mjs',
        },
        ready: true,
      })),
    },
    ...overrides,
  };
}

function buildPathStateExecutionPlanArtifact({
  executionPlan = buildPathStateExecutionPlan(),
  generatedAt = POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_TEST_TIME,
  overrides = {},
} = {}) {
  return buildReadyExecutionPlanArtifact({
    executionPlan,
    generatedAt,
    overrides,
  });
}

function buildPathStateObservations({ existingPaths = [] } = {}) {
  const existingPathSet = new Set(existingPaths);

  return POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS.map(path => ({
    path,
    exists: existingPathSet.has(path),
  }));
}

function buildCapturedPathStateEvidence({
  executionPlanArtifact = buildPathStateExecutionPlanArtifact(),
  observations = buildPathStateObservations(),
  generatedAt = POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_TEST_TIME,
  sideEffects = { filesRead: true },
} = {}) {
  return buildPolicyStorageClosurePathStateEvidence({
    executionPlanArtifact,
    observations,
    generatedAt,
    sideEffects,
  });
}

export {
  POLICY_STORAGE_CLOSURE_PATH_STATE_EVIDENCE_TEST_TIME,
  POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS,
  buildCapturedPathStateEvidence,
  buildPathStateExecutionPlan,
  buildPathStateExecutionPlanArtifact,
  buildPathStateObservations,
};
