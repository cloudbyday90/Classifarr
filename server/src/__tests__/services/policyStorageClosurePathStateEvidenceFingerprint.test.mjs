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
  buildPolicyStorageClosurePathStateEvidenceFingerprint,
  validatePolicyStorageClosurePathStateEvidenceFingerprint,
} from '../../services/policyStorageClosurePathStateEvidenceFingerprint.mjs';
import {
  buildCapturedPathStateEvidence,
} from './fixtures/policyStorageClosurePathStateEvidenceFixtures.mjs';

describe('policyStorageClosurePathStateEvidenceFingerprint', () => {
  test('keeps the fingerprint stable when retained observations change order', () => {
    const evidence = buildCapturedPathStateEvidence();
    const reordered = structuredClone(evidence);
    reordered.observationInput.observations.reverse();

    expect(buildPolicyStorageClosurePathStateEvidenceFingerprint({ evidence: reordered }))
      .toEqual(evidence.artifactFingerprint);
  });

  test('rejects a fingerprint after a retained observation changes', () => {
    const evidence = buildCapturedPathStateEvidence();
    const altered = structuredClone(evidence);
    altered.observationInput.observations[0].exists = true;

    const validation = validatePolicyStorageClosurePathStateEvidenceFingerprint({
      evidence: altered,
      artifactFingerprint: altered.artifactFingerprint,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toContain('fingerprint_mismatch');
  });

  test('rejects provenance that does not match the fingerprinted evidence', () => {
    const evidence = buildCapturedPathStateEvidence();
    const alteredFingerprint = structuredClone(evidence.artifactFingerprint);
    alteredFingerprint.provenance.removedPathCount = 0;

    const validation = validatePolicyStorageClosurePathStateEvidenceFingerprint({
      evidence,
      artifactFingerprint: alteredFingerprint,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toContain('provenance_mismatch');
  });
});
