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
  buildPolicyStorageClosureValidationEvidenceFingerprint,
} from '../../services/policyStorageClosureValidationEvidenceFingerprint.mjs';
import {
  POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_RISK_IDS,
  validatePolicyStorageClosureValidationEvidenceIntegrity,
} from '../../services/policyStorageClosureValidationEvidenceIntegrity.mjs';
import {
  validatePolicyStorageClosureValidationEvidence,
} from '../../services/policyStorageClosureValidationEvidence.mjs';
import {
  buildPolicyStorageClosureValidationEvidenceFixture,
} from './policyStorageClosureValidationEvidenceFixture.mjs';

describe('policyStorageClosureValidationEvidenceIntegrity', () => {
  test('accepts a fingerprint-valid artifact that exactly replays without command execution', () => {
    const evidence = buildPolicyStorageClosureValidationEvidenceFixture();
    const integrity = validatePolicyStorageClosureValidationEvidenceIntegrity({
      validationEvidence: evidence,
    });

    expect(integrity.ok).toBe(true);
    expect(integrity.evidence).toEqual(evidence);
    expect(integrity.policy).toEqual(expect.objectContaining({
      allowCommandExecutionInsideVerifier: false,
      allowStorageMutation: false,
      allowGitCommands: false,
      allowFileWrites: false,
    }));
  });

  test('rejects legacy raw check summaries with no retained replay inputs', () => {
    const integrity = validatePolicyStorageClosureValidationEvidenceIntegrity({
      validationEvidence: {
        focused: { passed: true },
        lint: { passed: true },
        markdown: { passed: true },
        full: { passed: true },
      },
    });

    expect(integrity.ok).toBe(false);
    expect(integrity.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_RISK_IDS
        .VALIDATION_EVIDENCE_INVALID,
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_RISK_IDS
        .VALIDATION_EVIDENCE_NOT_REPLAYABLE,
    ]));
  });

  test('rejects a refingerprinted derived state that disagrees with retained command input', () => {
    const evidence = buildPolicyStorageClosureValidationEvidenceFixture();
    evidence.full.passed = false;
    evidence.passedCount = 3;
    evidence.statusId = 'failed';
    evidence.complete = false;
    evidence.risks = [{
      riskId: 'check_failed',
      message: 'Synthetic derived failure for replay verification.',
      checkId: 'full',
    }];
    evidence.riskCount = evidence.risks.length;
    evidence.artifactFingerprint =
      buildPolicyStorageClosureValidationEvidenceFingerprint({ evidence });
    evidence.validation = validatePolicyStorageClosureValidationEvidence(evidence);

    const integrity = validatePolicyStorageClosureValidationEvidenceIntegrity({
      validationEvidence: evidence,
    });

    expect(evidence.validation.ok).toBe(true);
    expect(integrity.ok).toBe(false);
    expect(integrity.issues.map(issue => issue.riskId)).toContain(
      POLICY_STORAGE_CLOSURE_VALIDATION_EVIDENCE_INTEGRITY_RISK_IDS
        .VALIDATION_EVIDENCE_REPLAY_MISMATCH
    );
  });
});
