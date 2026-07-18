/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

import {
  collectPolicyCompatibilityRemovalReferenceScan,
} from '../../../../scripts/lib/policyCompatibilityRemovalEvidenceReferenceScan.mjs';

describe('policyCompatibilityRemovalEvidenceReferenceScan', () => {
  test('does not resolve plans or scan a checkout for missing-evidence diagnostics', () => {
    const resolveExecutionPlanSource = jest.fn(() => {
      throw new Error('Missing-evidence diagnostics must not resolve an execution plan.');
    });
    const scanReferences = jest.fn(() => {
      throw new Error('Missing-evidence diagnostics must not scan a checkout.');
    });

    const referenceScan = collectPolicyCompatibilityRemovalReferenceScan({
      missingRequiredInputs: ['validation evidence'],
      cwd: '/repository',
      resolveExecutionPlanSource,
      scanReferences,
    });

    expect(referenceScan).toBeNull();
    expect(resolveExecutionPlanSource).not.toHaveBeenCalled();
    expect(scanReferences).not.toHaveBeenCalled();
  });

  test('resolves and scans only after the complete evidence chain is present', () => {
    const executionPlanArtifact = { artifactFingerprint: { fingerprint: 'sha256:plan' } };
    const resolveExecutionPlanSource = jest.fn(() => ({
      manifestPaths: ['server/src/retired-policy-compatibility.mjs'],
    }));
    const scanReferences = jest.fn(() => ({
      completed: true,
      checkedPaths: ['server/src/retired-policy-compatibility.mjs'],
      references: [],
    }));

    const referenceScan = collectPolicyCompatibilityRemovalReferenceScan({
      missingRequiredInputs: [],
      cwd: '/repository',
      executionPlanArtifact,
      resolveExecutionPlanSource,
      scanReferences,
    });

    expect(resolveExecutionPlanSource).toHaveBeenCalledWith({ executionPlanArtifact });
    expect(scanReferences).toHaveBeenCalledWith({
      cwd: '/repository',
      manifestPaths: ['server/src/retired-policy-compatibility.mjs'],
    });
    expect(referenceScan).toEqual(expect.objectContaining({ completed: true }));
  });
});
