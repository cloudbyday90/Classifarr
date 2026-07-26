/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/run-policy-storage-closure-evidence-launcher.mjs',
    import.meta.url
  )
);

function runLauncher(args = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  });
}

describe('run-policy-storage-closure-evidence-launcher', () => {
  test('prints the fixed execution plan without running either evidence producer', () => {
    const result = runLauncher([
      '--dry-run',
      '--cwd',
      REPOSITORY_ROOT,
      '--completion-audit-artifact',
      '.tmp/completion-audit.json',
      '--output-directory',
      '.tmp/closure-evidence',
    ]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expect.objectContaining({
      ok: true,
      commands: [
        expect.objectContaining({ commandId: 'validation_evidence' }),
        expect.objectContaining({ commandId: 'instance_evidence_assembly' }),
      ],
    }));
  });

  test('rejects an incomplete launch request before it runs a command', () => {
    const result = runLauncher(['--dry-run', '--cwd', REPOSITORY_ROOT]);

    expect(result.status).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      version: 'policy.storage_closure_evidence_launcher.v1',
      statusId: 'invalid',
      issues: ['completion_audit_artifact_missing'],
    });
  });
});
