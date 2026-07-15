/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_FINGERPRINT_RISK_IDS,
  buildPolicyStorageClosureValidationEvidenceFingerprint,
  validatePolicyStorageClosureValidationEvidenceFingerprint,
} from '../../services/policyStorageClosureValidationEvidenceFingerprint.mjs';
import {
  buildPolicyStorageClosureValidationEvidenceFixture,
} from './policyStorageClosureValidationEvidenceFixture.mjs';

describe('policyStorageClosureValidationEvidenceFingerprint', () => {
  test('validates the canonical validation-evidence projection', () => {
    const evidence = buildPolicyStorageClosureValidationEvidenceFixture();
    const validation = validatePolicyStorageClosureValidationEvidenceFingerprint({
      evidence,
      artifactFingerprint: evidence.artifactFingerprint,
    });

    expect(validation.ok).toBe(true);
    expect(validation.issueCount).toBe(0);
  });

  test('rejects a changed check when the digest was not regenerated', () => {
    const evidence = buildPolicyStorageClosureValidationEvidenceFixture();
    evidence.full.passed = false;

    const validation = validatePolicyStorageClosureValidationEvidenceFingerprint({
      evidence,
      artifactFingerprint: evidence.artifactFingerprint,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toContain(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_FINGERPRINT_RISK_IDS.FINGERPRINT_MISMATCH
    );
  });

  test('rejects inconsistent fingerprint provenance', () => {
    const evidence = buildPolicyStorageClosureValidationEvidenceFixture();
    const fingerprint = buildPolicyStorageClosureValidationEvidenceFingerprint({ evidence });
    fingerprint.provenance.commandResultCount = 99;

    const validation = validatePolicyStorageClosureValidationEvidenceFingerprint({
      evidence,
      artifactFingerprint: fingerprint,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toContain(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_FINGERPRINT_RISK_IDS.PROVENANCE_MISMATCH
    );
  });
});
