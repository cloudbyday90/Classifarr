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
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_VERSION,
  buildPolicyStorageCompletionCheckpointArtifact,
  validatePolicyStorageCompletionCheckpointArtifact,
} from './policyStorageCompletionCheckpointArtifact.mjs';

const POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_VERSION =
  'policy.storage_completion_checkpoint_artifact_integrity.v1';

const POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_RISK_IDS =
  Object.freeze({
    CHECKPOINT_ARTIFACT_MISSING: 'checkpoint_artifact_missing',
    CHECKPOINT_ARTIFACT_INVALID: 'checkpoint_artifact_invalid',
    CHECKPOINT_ARTIFACT_NOT_REPLAYABLE: 'checkpoint_artifact_not_replayable',
    CHECKPOINT_ARTIFACT_REPLAY_MISMATCH: 'checkpoint_artifact_replay_mismatch',
  });

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(item => stableValue(item));
  if (!value || typeof value !== 'object') {
    return typeof value === 'bigint' ? value.toString() : value;
  }

  return Object.keys(value)
    .filter(key => !['function', 'symbol', 'undefined'].includes(typeof value[key]))
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = stableValue(value[key]);
      return normalized;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function hasReplayInputs(artifact = {}) {
  const value = asObject(artifact);

  return Array.isArray(value.componentEvidence) &&
    Object.keys(asObject(value.roadmapEvidence)).length > 0 &&
    Object.keys(asObject(value.completionAuditArtifact)).length > 0 &&
    Object.keys(asObject(value.validationEvidence)).length > 0 &&
    Object.keys(asObject(value.changelogEvidence)).length > 0 &&
    Object.keys(asObject(value.sideEffects)).length > 0;
}

async function validatePolicyStorageCompletionCheckpointArtifactIntegrity({
  checkpointArtifact = null,
} = {}) {
  const risks = [];
  const artifact = asObject(checkpointArtifact);

  if (Object.keys(artifact).length === 0) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_RISK_IDS
        .CHECKPOINT_ARTIFACT_MISSING,
      'Final storage closure requires a policy storage completion-checkpoint artifact.'
    ));
  }

  const artifactValidation = validatePolicyStorageCompletionCheckpointArtifact(artifact);
  if (
    artifact.version !== POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_VERSION ||
    artifact.validation?.ok !== true ||
    artifactValidation.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_RISK_IDS
        .CHECKPOINT_ARTIFACT_INVALID,
      'Final storage closure requires a current fingerprint-valid completion-checkpoint artifact.',
      {
        artifactVersion: artifact.version || null,
        issueCount: artifactValidation.issueCount,
        issueRiskIds: artifactValidation.issues.map(issue => issue.riskId),
      }
    ));
  }

  if (!hasReplayInputs(artifact)) {
    risks.push(buildRisk(
      POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_RISK_IDS
        .CHECKPOINT_ARTIFACT_NOT_REPLAYABLE,
      'Checkpoint artifact must retain component, roadmap, completion-audit, validation, changelog, and side-effect inputs for deterministic verification.'
    ));
  }

  let replayedArtifact = null;
  if (risks.length === 0) {
    replayedArtifact = await buildPolicyStorageCompletionCheckpointArtifact({
      componentEvidence: asArray(artifact.componentEvidence),
      roadmapEvidence: asObject(artifact.roadmapEvidence),
      completionAuditArtifact: asObject(artifact.completionAuditArtifact),
      validationEvidence: asObject(artifact.validationEvidence),
      changelogEvidence: asObject(artifact.changelogEvidence),
      generatedAt: artifact.generatedAt,
      sideEffects: asObject(artifact.sideEffects),
    });

    if (stableStringify(artifact) !== stableStringify(replayedArtifact)) {
      risks.push(buildRisk(
        POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_RISK_IDS
          .CHECKPOINT_ARTIFACT_REPLAY_MISMATCH,
        'Checkpoint artifact does not match its retained component, roadmap, completion-audit, validation, and changelog inputs.',
        {
          artifactStatusId: artifact.statusId || null,
          replayStatusId: replayedArtifact.statusId || null,
        }
      ));
    }
  }

  return {
    version: POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_VERSION,
    ok: risks.length === 0,
    issueCount: risks.length,
    issues: risks,
    checkpointArtifact: artifact,
    artifact: risks.length === 0 ? replayedArtifact : {},
    artifactFingerprint: artifact.artifactFingerprint?.fingerprint || null,
    policy: {
      requireCurrentFingerprintValidArtifact: true,
      requireRetainedReplayInputs: true,
      requireArtifactReplay: true,
      allowSideEffects: false,
    },
  };
}

export {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_RISK_IDS,
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_VERSION,
  validatePolicyStorageCompletionCheckpointArtifactIntegrity,
};
