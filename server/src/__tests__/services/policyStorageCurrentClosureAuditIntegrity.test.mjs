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
  buildPolicyStorageCurrentClosureAuditFingerprint,
} from '../../services/policyStorageCurrentClosureAuditFingerprint.mjs';
import {
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_RISK_IDS,
  validatePolicyStorageCurrentClosureAuditIntegrity,
} from '../../services/policyStorageCurrentClosureAuditIntegrity.mjs';
import {
  buildPolicyStorageCurrentClosureAuditFixture,
} from './policyStorageCurrentClosureAuditFixture.mjs';

describe('policyStorageCurrentClosureAuditIntegrity', () => {
  test('accepts a current fingerprint-valid replayable audit artifact', async () => {
    const currentClosureAudit = await buildPolicyStorageCurrentClosureAuditFixture();
    const integrity = await validatePolicyStorageCurrentClosureAuditIntegrity({
      currentClosureAudit,
    });

    expect(integrity.ok).toBe(true);
    expect(integrity.issueCount).toBe(0);
    expect(integrity.audit).toEqual(currentClosureAudit);
    expect(integrity.artifactFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  test('rejects an altered audit projection with its stale fingerprint', async () => {
    const currentClosureAudit = await buildPolicyStorageCurrentClosureAuditFixture();
    currentClosureAudit.summary.missingCurrentArtifactCount = 1;

    const integrity = await validatePolicyStorageCurrentClosureAuditIntegrity({
      currentClosureAudit,
    });

    expect(integrity.ok).toBe(false);
    expect(integrity.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_INVALID,
    ]));
  });

  test('rejects a refingerprinted artifact when replayed closure evidence differs', async () => {
    const currentClosureAudit = await buildPolicyStorageCurrentClosureAuditFixture();
    currentClosureAudit.summary.missingCurrentArtifactCount = 1;
    currentClosureAudit.artifactFingerprint =
      buildPolicyStorageCurrentClosureAuditFingerprint({ audit: currentClosureAudit });

    const integrity = await validatePolicyStorageCurrentClosureAuditIntegrity({
      currentClosureAudit,
    });

    expect(integrity.ok).toBe(false);
    expect(integrity.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_REPLAY_MISMATCH,
    ]));
  });

  test('rejects a refingerprinted artifact that omits replay inputs', async () => {
    const currentClosureAudit = await buildPolicyStorageCurrentClosureAuditFixture();
    delete currentClosureAudit.closureInput.currentEvidence.artifactInventory;
    currentClosureAudit.artifactFingerprint =
      buildPolicyStorageCurrentClosureAuditFingerprint({ audit: currentClosureAudit });

    const integrity = await validatePolicyStorageCurrentClosureAuditIntegrity({
      currentClosureAudit,
    });

    expect(integrity.ok).toBe(false);
    expect(integrity.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_NOT_REPLAYABLE,
    ]));
  });

  test('rejects a refingerprinted artifact without current checkout evidence', async () => {
    const currentClosureAudit = await buildPolicyStorageCurrentClosureAuditFixture();
    delete currentClosureAudit.closureInput.currentEvidence.currentEvidenceFingerprint;
    currentClosureAudit.artifactFingerprint =
      buildPolicyStorageCurrentClosureAuditFingerprint({ audit: currentClosureAudit });

    const integrity = await validatePolicyStorageCurrentClosureAuditIntegrity({
      currentClosureAudit,
    });

    expect(integrity.ok).toBe(false);
    expect(integrity.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_INTEGRITY_RISK_IDS
        .CURRENT_CLOSURE_AUDIT_NOT_REPLAYABLE,
    ]));
  });
});
