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
  buildPolicyStorageClosurePathStateEvidenceIntegrity,
} from '../../services/policyStorageClosurePathStateEvidenceIntegrity.mjs';
import {
  buildPolicyStorageClosurePathStateEvidenceFingerprint,
} from '../../services/policyStorageClosurePathStateEvidenceFingerprint.mjs';
import {
  POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS,
  buildCapturedPathStateEvidence,
} from './fixtures/policyStorageClosurePathStateEvidenceFixtures.mjs';

describe('policyStorageClosurePathStateEvidenceIntegrity', () => {
  test('replays a captured path-state snapshot from its retained inputs', () => {
    const evidence = buildCapturedPathStateEvidence();
    const integrity = buildPolicyStorageClosurePathStateEvidenceIntegrity({ evidence });

    expect(integrity.ok).toBe(true);
    expect(integrity.replayedEvidence).toEqual(expect.objectContaining({
      captured: true,
      pathState: expect.objectContaining({
        removedPaths: [...POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS].sort(),
      }),
    }));
  });

  test('rejects a re-fingerprinted evidence artifact whose snapshot cannot replay', () => {
    const evidence = buildCapturedPathStateEvidence();
    const altered = structuredClone(evidence);
    altered.pathState.existingPaths = [POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS[0]];
    altered.pathState.removedPaths = [POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS[1]];
    altered.pathState.existingCount = 1;
    altered.pathState.removedCount = 1;
    altered.artifactFingerprint = buildPolicyStorageClosurePathStateEvidenceFingerprint({
      evidence: altered,
    });

    const integrity = buildPolicyStorageClosurePathStateEvidenceIntegrity({ evidence: altered });

    expect(integrity.ok).toBe(false);
    expect(integrity.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      'evidence_validation_failed',
      'evidence_replay_mismatch',
    ]));
    expect(integrity.replayedEvidence).toBeNull();
  });

  test('rejects a coherent blocked observation artifact for final-removal use', () => {
    const evidence = buildCapturedPathStateEvidence({ sideEffects: {} });
    const integrity = buildPolicyStorageClosurePathStateEvidenceIntegrity({ evidence });

    expect(evidence.validation.ok).toBe(true);
    expect(evidence.captured).toBe(false);
    expect(integrity.ok).toBe(false);
    expect(integrity.issues.map(issue => issue.riskId)).toContain('evidence_not_captured');
  });
});
