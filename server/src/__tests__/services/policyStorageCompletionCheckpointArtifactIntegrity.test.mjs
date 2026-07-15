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
  buildPolicyStorageCompletionCheckpointArtifactFingerprint,
} from '../../services/policyStorageCompletionCheckpointArtifactFingerprint.mjs';
import {
  POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_RISK_IDS,
  validatePolicyStorageCompletionCheckpointArtifactIntegrity,
} from '../../services/policyStorageCompletionCheckpointArtifactIntegrity.mjs';
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

describe('policyStorageCompletionCheckpointArtifactIntegrity', () => {
  test('accepts a current fingerprint-valid artifact that exactly replays from retained inputs', async () => {
    const artifact = await buildCompleteArtifact();
    const integrity =
      await validatePolicyStorageCompletionCheckpointArtifactIntegrity({
        checkpointArtifact: artifact,
      });

    expect(integrity).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      artifactFingerprint: artifact.artifactFingerprint.fingerprint,
      artifact,
    }));
  });

  test('rejects a fingerprint mismatch before replaying a tampered artifact', async () => {
    const artifact = await buildCompleteArtifact();
    artifact.checkpointSummary.componentImplementedCount = 0;

    const integrity =
      await validatePolicyStorageCompletionCheckpointArtifactIntegrity({
        checkpointArtifact: artifact,
      });

    expect(integrity.ok).toBe(false);
    expect(integrity.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_RISK_IDS
            .CHECKPOINT_ARTIFACT_INVALID,
      }),
    ]));
  });

  test('rejects a re-fingerprinted artifact that does not replay from retained evidence', async () => {
    const artifact = await buildCompleteArtifact();
    artifact.checkpointSummary.componentImplementedCount = 0;
    artifact.artifactFingerprint =
      buildPolicyStorageCompletionCheckpointArtifactFingerprint({ artifact });
    artifact.validation = {
      ...artifact.validation,
      ok: true,
      issueCount: 0,
      issues: [],
    };

    const integrity =
      await validatePolicyStorageCompletionCheckpointArtifactIntegrity({
        checkpointArtifact: artifact,
      });

    expect(integrity.ok).toBe(false);
    expect(integrity.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_RISK_IDS
            .CHECKPOINT_ARTIFACT_REPLAY_MISMATCH,
      }),
    ]));
  });

  test('rejects an otherwise valid fingerprint wrapper when required retained inputs are absent', async () => {
    const artifact = await buildCompleteArtifact();
    delete artifact.changelogEvidence;
    artifact.artifactFingerprint =
      buildPolicyStorageCompletionCheckpointArtifactFingerprint({ artifact });
    artifact.validation = {
      ...artifact.validation,
      ok: true,
      issueCount: 0,
      issues: [],
    };

    const integrity =
      await validatePolicyStorageCompletionCheckpointArtifactIntegrity({
        checkpointArtifact: artifact,
      });

    expect(integrity.ok).toBe(false);
    expect(integrity.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_STORAGE_COMPLETION_CHECKPOINT_ARTIFACT_INTEGRITY_RISK_IDS
            .CHECKPOINT_ARTIFACT_NOT_REPLAYABLE,
      }),
    ]));
  });
});
