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
  buildPolicyStorageClosurePathStateEvidence,
  validatePolicyStorageClosurePathStateEvidence,
} from '../../services/policyStorageClosurePathStateEvidence.mjs';
import {
  buildPolicyStorageClosurePathStateEvidenceFingerprint,
} from '../../services/policyStorageClosurePathStateEvidenceFingerprint.mjs';
import {
  POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS,
  buildCapturedPathStateEvidence,
  buildPathStateExecutionPlanArtifact,
  buildPathStateObservations,
} from './fixtures/policyStorageClosurePathStateEvidenceFixtures.mjs';

describe('policyStorageClosurePathStateEvidence', () => {
  test('captures exact removed and remaining path state from the approved manifest', () => {
    const evidence = buildCapturedPathStateEvidence({
      observations: buildPathStateObservations({
        existingPaths: [POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS[0]],
      }),
    });

    expect(evidence.captured).toBe(true);
    expect(evidence.validation.ok).toBe(true);
    expect(evidence.pathState).toEqual({
      manifestPaths: [...POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS].sort(),
      existingPaths: [POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS[0]],
      removedPaths: [POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS[1]],
      totalCount: 2,
      existingCount: 1,
      removedCount: 1,
    });
  });

  test('blocks a snapshot that omits, duplicates, or extends approved paths', () => {
    const evidence = buildPolicyStorageClosurePathStateEvidence({
      executionPlanArtifact: buildPathStateExecutionPlanArtifact(),
      observations: [
        { path: POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS[0], exists: true },
        { path: POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS[0], exists: false },
        { path: 'server/src/services/unapproved.mjs', exists: false },
      ],
      sideEffects: { filesRead: true },
    });

    expect(evidence.captured).toBe(false);
    expect(evidence.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      'observation_path_duplicate',
      'observation_path_unknown',
      'observation_path_missing',
    ]));
    expect(evidence.validation.ok).toBe(true);
  });

  test('rejects a re-fingerprinted snapshot whose derived path state was changed', () => {
    const evidence = buildCapturedPathStateEvidence();
    const altered = structuredClone(evidence);
    altered.pathState.existingPaths = [POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS[0]];
    altered.pathState.removedPaths = [POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS[1]];
    altered.pathState.existingCount = 1;
    altered.pathState.removedCount = 1;
    altered.artifactFingerprint = buildPolicyStorageClosurePathStateEvidenceFingerprint({
      evidence: altered,
    });

    const validation = validatePolicyStorageClosurePathStateEvidence(altered);

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toContain('path_state_mismatch');
  });

  test('rejects a re-fingerprinted side-effect summary that disagrees with retained inputs', () => {
    const evidence = buildCapturedPathStateEvidence();
    const altered = structuredClone(evidence);
    altered.sideEffects.filesRead = false;
    altered.artifactFingerprint = buildPolicyStorageClosurePathStateEvidenceFingerprint({
      evidence: altered,
    });

    const validation = validatePolicyStorageClosurePathStateEvidence(altered);

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId))
      .toContain('side_effect_summary_mismatch');
  });
});
