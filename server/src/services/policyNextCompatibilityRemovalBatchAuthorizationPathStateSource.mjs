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
  resolvePolicyStorageClosureExecutionPlanSource,
} from './policyStorageClosureExecutionPlanSource.mjs';
import {
  buildPolicyStorageClosurePathStateEvidenceIntegrity,
} from './policyStorageClosurePathStateEvidenceIntegrity.mjs';

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_VERSION =
  'policy.next_compatibility_removal_batch_authorization_path_state_source.v1';

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_STATUS_IDS =
  Object.freeze({
    READY: 'ready',
    BLOCKED: 'blocked',
  });

const POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS =
  Object.freeze({
    EXECUTION_PLAN_ARTIFACT_INVALID: 'execution_plan_artifact_invalid',
    PATH_STATE_EVIDENCE_INVALID: 'path_state_evidence_invalid',
    PATH_STATE_EVIDENCE_ARTIFACT_MISMATCH: 'path_state_evidence_artifact_mismatch',
    PATH_STATE_EVIDENCE_MANIFEST_MISMATCH: 'path_state_evidence_manifest_mismatch',
  });

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function uniqueNormalizedPaths(paths = []) {
  return [...new Set(asArray(paths).map(normalizePath).filter(Boolean))].sort();
}

function pathsMatch(left = [], right = []) {
  const expected = uniqueNormalizedPaths(left);
  const actual = uniqueNormalizedPaths(right);

  return expected.length === actual.length &&
    expected.every((path, index) => path === actual[index]);
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function emptyPathState() {
  return {
    totalCount: 0,
    existingCount: 0,
    removedCount: 0,
    manifestPaths: [],
    existingPaths: [],
    removedPaths: [],
  };
}

function resolvePolicyNextCompatibilityRemovalBatchAuthorizationPathStateSource({
  executionPlanArtifact = null,
  pathStateEvidence = null,
} = {}) {
  const executionPlanSource = resolvePolicyStorageClosureExecutionPlanSource({
    executionPlanArtifact,
  });
  const pathStateEvidenceIntegrity = buildPolicyStorageClosurePathStateEvidenceIntegrity({
    evidence: pathStateEvidence,
  });
  const replayedEvidence = pathStateEvidenceIntegrity.replayedEvidence || {};
  const pathState = replayedEvidence.pathState || emptyPathState();
  const risks = [];

  if (!executionPlanSource.ok) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS
        .EXECUTION_PLAN_ARTIFACT_INVALID,
      'Next compatibility removal batch authorization requires a ready fingerprint-valid execution-plan artifact.',
      {
        issueCount: executionPlanSource.issueCount,
        issueRiskIds: asArray(executionPlanSource.issues).map(issue => issue.riskId),
      }
    ));
  }

  if (!pathStateEvidenceIntegrity.ok) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS
        .PATH_STATE_EVIDENCE_INVALID,
      'Next compatibility removal batch authorization requires replay-verified checkout path-state evidence.',
      {
        issueCount: pathStateEvidenceIntegrity.issueCount,
        issueRiskIds: asArray(pathStateEvidenceIntegrity.issues).map(issue => issue.riskId),
      }
    ));
  }

  if (
    executionPlanSource.ok &&
    pathStateEvidenceIntegrity.ok &&
    replayedEvidence.executionPlanArtifactFingerprint !== executionPlanSource.artifactFingerprint
  ) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS
        .PATH_STATE_EVIDENCE_ARTIFACT_MISMATCH,
      'Next compatibility removal batch authorization must use checkout path-state evidence bound to the exact approved execution-plan artifact.',
      {
        expectedExecutionPlanArtifactFingerprint: executionPlanSource.artifactFingerprint,
        receivedExecutionPlanArtifactFingerprint:
          replayedEvidence.executionPlanArtifactFingerprint || null,
      }
    ));
  }

  if (
    executionPlanSource.ok &&
    pathStateEvidenceIntegrity.ok &&
    !pathsMatch(executionPlanSource.manifestPaths, pathState.manifestPaths)
  ) {
    risks.push(buildRisk(
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS
        .PATH_STATE_EVIDENCE_MANIFEST_MISMATCH,
      'Next compatibility removal batch authorization must use checkout path-state evidence covering the exact approved manifest paths.',
      {
        expectedManifestPaths: uniqueNormalizedPaths(executionPlanSource.manifestPaths),
        receivedManifestPaths: uniqueNormalizedPaths(pathState.manifestPaths),
      }
    ));
  }

  const ok = risks.length === 0;

  return {
    version:
      POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_VERSION,
    statusId: ok
      ? POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_STATUS_IDS.READY
      : POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_STATUS_IDS
        .BLOCKED,
    ok,
    issueCount: risks.length,
    issues: risks,
    executionPlan: executionPlanSource.ok
      ? executionPlanSource.executionPlan
      : null,
    executionPlanArtifactFingerprint: executionPlanSource.ok
      ? executionPlanSource.artifactFingerprint
      : null,
    pathStateEvidenceFingerprint: pathStateEvidenceIntegrity.ok
      ? replayedEvidence.artifactFingerprint?.fingerprint || null
      : null,
    pathState: ok ? pathState : emptyPathState(),
    executionPlanSource,
    pathStateEvidenceIntegrity,
  };
}

export {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_RISK_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_STATUS_IDS,
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_PATH_STATE_SOURCE_VERSION,
  resolvePolicyNextCompatibilityRemovalBatchAuthorizationPathStateSource,
};
