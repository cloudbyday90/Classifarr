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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION,
} from '../../../services/policyCompatibilityDeletionExecutionPlanArtifact.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
} from '../../../services/policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION,
} from '../../../services/policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME =
  '2026-07-14T20:00:00.000Z';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildReadyExecutionPlanArtifact({
  executionPlan,
  generatedAt = POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  overrides = {},
} = {}) {
  const value = asObject(overrides);
  const baseArtifact = {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION,
    generatedAt,
    statusId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.READY,
    ready: true,
    evidenceBundle: {
      version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION,
      generatedAt,
      statusId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS.READY,
      validationOk: true,
      ...asObject(value.evidenceBundle),
    },
    executionPlan,
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    },
  };
  const artifact = {
    ...baseArtifact,
    ...value,
    evidenceBundle: {
      ...baseArtifact.evidenceBundle,
      ...asObject(value.evidenceBundle),
    },
    sideEffects: {
      ...baseArtifact.sideEffects,
      ...asObject(value.sideEffects),
    },
  };
  const artifactWithoutFingerprint = {
    ...artifact,
    artifactFingerprint: undefined,
    validation: undefined,
  };
  const artifactFingerprint = value.artifactFingerprint ||
    buildPolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact: artifactWithoutFingerprint,
    });

  return {
    ...artifact,
    artifactFingerprint,
    validation: value.validation || {
      ok: true,
      issueCount: 0,
      issues: [],
    },
  };
}

function buildReadyExecutionGatePreflightEvidence({
  executionPlanArtifact,
  observedAt = POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  overrides = {},
} = {}) {
  const value = asObject(overrides);
  const base = {
    executionPlanArtifactFingerprint:
      executionPlanArtifact?.artifactFingerprint?.fingerprint || null,
    worktree: {
      clean: true,
      observedAt,
      checkedBy: 'policy-maintainer',
    },
    recovery: {
      backupRestoreVerified: true,
      verifiedAt: observedAt,
      verifiedBy: 'policy-maintainer',
    },
    approval: {
      approved: true,
      approvedAt: observedAt,
      approvedBy: 'policy-maintainer',
    },
    stances: {
      rollbackStanceFinal: true,
      supportStanceFinal: true,
      confirmedAt: observedAt,
      confirmedBy: 'policy-maintainer',
    },
    manifest: {
      matchesExecutionPlan: true,
      verifiedAt: observedAt,
      verifiedBy: 'policy-maintainer',
    },
  };

  return {
    ...base,
    ...value,
    worktree: { ...base.worktree, ...asObject(value.worktree) },
    recovery: { ...base.recovery, ...asObject(value.recovery) },
    approval: { ...base.approval, ...asObject(value.approval) },
    stances: { ...base.stances, ...asObject(value.stances) },
    manifest: { ...base.manifest, ...asObject(value.manifest) },
  };
}

export {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  buildReadyExecutionGatePreflightEvidence,
  buildReadyExecutionPlanArtifact,
};
