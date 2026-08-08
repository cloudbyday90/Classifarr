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
  buildPolicyStorageCompletionCheckpointArtifact,
} from '../../services/policyStorageCompletionCheckpointArtifact.mjs';
import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_RISK_IDS,
  buildPolicyStorageCompletionCheckpointArtifactFingerprint,
  validatePolicyStorageCompletionCheckpointArtifactFingerprint,
} from '../../services/policyStorageCompletionCheckpointArtifactFingerprint.mjs';
import {
  buildPolicyStorageCompletionCheckpointArtifactInputs,
} from './policyStorageCompletionCheckpointArtifactFixture.mjs';

async function buildCompleteArtifact() {
  const inputs = await buildPolicyStorageCompletionCheckpointArtifactInputs();

  return buildPolicyStorageCompletionCheckpointArtifact({
    ...inputs,
    generatedAt: '2026-07-15T12:00:00.000Z',
  });
}

describe('policyStorageCompletionCheckpointArtifactFingerprint', () => {
  test('binds a complete checkpoint artifact and reports stable provenance', async () => {
    const artifact = await buildCompleteArtifact();
    const validation =
      validatePolicyStorageCompletionCheckpointArtifactFingerprint({
        artifact,
        artifactFingerprint: artifact.artifactFingerprint,
      });

    expect(validation).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
    expect(artifact.artifactFingerprint.provenance).toEqual(expect.objectContaining({
      artifactVersion: artifact.version,
      statusId: 'complete',
      complete: true,
      componentEvidenceCount: artifact.componentEvidence.length,
      roadmapSequenceCount: artifact.roadmapEvidence.componentSequenceIds.length,
      checkpointStatusId: 'complete',
    }));
  });

  test('rejects a checkpoint artifact whose retained evidence changes after fingerprinting', async () => {
    const artifact = await buildCompleteArtifact();
    artifact.componentEvidence[0].implemented = false;

    const validation =
      validatePolicyStorageCompletionCheckpointArtifactFingerprint({
        artifact,
        artifactFingerprint: artifact.artifactFingerprint,
      });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_RISK_IDS
            .FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('rejects a checkpoint artifact whose closure component scope map changes after fingerprinting', async () => {
    const artifact = await buildCompleteArtifact();
    artifact.componentScopeMap.instanceCutover.componentIds = [];

    const validation =
      validatePolicyStorageCompletionCheckpointArtifactFingerprint({
        artifact,
        artifactFingerprint: artifact.artifactFingerprint,
      });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_RISK_IDS
            .FINGERPRINT_MISMATCH,
      }),
    ]));
  });

  test('rejects provenance that does not agree with the bounded artifact', async () => {
    const artifact = await buildCompleteArtifact();
    const artifactFingerprint = structuredClone(artifact.artifactFingerprint);
    artifactFingerprint.provenance.componentEvidenceCount = 0;

    const validation =
      validatePolicyStorageCompletionCheckpointArtifactFingerprint({
        artifact,
        artifactFingerprint,
      });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_FINGERPRINT_RISK_IDS
            .PROVENANCE_MISMATCH,
      }),
    ]));
  });

  test('does not include the fingerprint wrapper itself in the bounded projection', async () => {
    const artifact = await buildCompleteArtifact();

    expect(buildPolicyStorageCompletionCheckpointArtifactFingerprint({ artifact }))
      .toEqual(artifact.artifactFingerprint);
  });
});
