/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'node:path';

import {
  POLICY_STORAGE_CLOSURE_EVIDENCE_COMMAND_TIMEOUTS_MS,
  POLICY_STORAGE_CLOSURE_EVIDENCE_LAUNCHER_PLAN_VERSION,
  buildPolicyStorageClosureEvidenceLauncherPlan,
} from '../../services/policyStorageClosureEvidenceLauncherPlan.mjs';

describe('policyStorageClosureEvidenceLauncherPlan', () => {
  test('builds the fixed validation and assembly commands inside the selected checkout', () => {
    const selectedCwd = path.join(process.cwd(), 'launcher-checkout');
    const result = buildPolicyStorageClosureEvidenceLauncherPlan({
      cwd: selectedCwd,
      completionAuditArtifactPath: '.tmp/completion-audit.json',
      outputDirectory: '.tmp/closure-evidence',
      generatedAt: '2026-07-25T00:00:00.000Z',
      allowBlocked: true,
    });

    const validationEvidencePath = path.join(
      selectedCwd,
      '.tmp',
      'closure-evidence',
      'validation-evidence.json'
    );

    expect(result).toEqual(expect.objectContaining({
      version: POLICY_STORAGE_CLOSURE_EVIDENCE_LAUNCHER_PLAN_VERSION,
      ok: true,
      issues: [],
      selectedCwd,
      outputs: expect.objectContaining({ validationEvidencePath }),
    }));
    expect(result.commands).toEqual([
      expect.objectContaining({
        commandId: 'validation_evidence',
        scriptPath: 'scripts/generate-policy-storage-closure-validation-evidence.mjs',
        timeoutMs: POLICY_STORAGE_CLOSURE_EVIDENCE_COMMAND_TIMEOUTS_MS.validationEvidence,
        args: ['--cwd', selectedCwd, '--output', validationEvidencePath],
      }),
      expect.objectContaining({
        commandId: 'instance_evidence_assembly',
        scriptPath: 'scripts/assemble-policy-storage-closure-instance-evidence.mjs',
        timeoutMs:
          POLICY_STORAGE_CLOSURE_EVIDENCE_COMMAND_TIMEOUTS_MS.instanceEvidenceAssembly,
        args: expect.arrayContaining([
          '--cwd',
          selectedCwd,
          '--completion-audit-artifact',
          '.tmp/completion-audit.json',
          '--validation-evidence',
          validationEvidencePath,
          '--allow-blocked',
        ]),
      }),
    ]);
  });

  test('fails closed when its required completion artifact is absent or output escapes the checkout', () => {
    const selectedCwd = path.join(process.cwd(), 'launcher-checkout');
    const result = buildPolicyStorageClosureEvidenceLauncherPlan({
      cwd: selectedCwd,
      outputDirectory: path.join(selectedCwd, '..', 'outside'),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      issueCount: 2,
      issues: expect.arrayContaining([
        'completion_audit_artifact_missing',
        'output_directory_outside_selected_checkout',
      ]),
    }));
  });
});
