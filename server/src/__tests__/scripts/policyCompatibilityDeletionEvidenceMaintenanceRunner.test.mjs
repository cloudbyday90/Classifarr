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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { jest } from '@jest/globals';

import {
  POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES,
  POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS,
  runPolicyCompatibilityDeletionEvidenceMaintenance,
} from '../../../../scripts/lib/policyCompatibilityDeletionEvidenceMaintenanceRunner.mjs';

const IMAGE_ID = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SOURCE_REVISION = '0123456789abcdef0123456789abcdef01234567';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createCommandRunner({
  dockerRun = null,
  imageRevision = SOURCE_REVISION,
  gitStatusExitCode = 0,
  worktreeStatus = '',
  workspaceRoot,
} = {}) {
  return jest.fn(({ command, args }) => {
    if (command === 'git' && args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
      return { status: 0, stdout: `${workspaceRoot}\n` };
    }
    if (command === 'git' && args[0] === 'status') {
      return { status: gitStatusExitCode, stdout: worktreeStatus };
    }
    if (command === 'git' && args[0] === 'rev-parse' && args[1] === 'HEAD') {
      return { status: 0, stdout: `${SOURCE_REVISION}\n` };
    }
    if (command === 'docker' && args[0] === 'inspect' && args[2] === '{{.State.Running}}') {
      return { status: 0, stdout: 'true\n' };
    }
    if (command === 'docker' && args[0] === 'inspect' && args[2] === '{{.Image}}') {
      return { status: 0, stdout: `${IMAGE_ID}\n` };
    }
    if (command === 'docker' && args[0] === 'inspect' && args[2] === '{{.Config.User}}') {
      return { status: 0, stdout: '1000:1000\n' };
    }
    if (command === 'docker' && args[0] === 'image' && args[1] === 'inspect') {
      return { status: 0, stdout: `${imageRevision}\n` };
    }
    if (command === 'docker' && args[0] === 'run' && dockerRun) {
      return dockerRun(args);
    }

    return { status: 1, stdout: '' };
  });
}

describe('policyCompatibilityDeletionEvidenceMaintenanceRunner', () => {
  let fixtureRoot;
  let stderr;
  let stdout;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'classifarr-evidence-maintenance-runner-')
    );
    writeJson(path.join(fixtureRoot, 'input.json'), {
      deletionManifestApproved: true,
    });
    stderr = [];
    stdout = [];
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  async function runRunner({
    commandRunner,
    inputPath = 'input.json',
    outputPath = '.tmp/evidence.json',
  } = {}) {
    return runPolicyCompatibilityDeletionEvidenceMaintenance({
      argv: [
        '--container', 'classifarr',
        ...(inputPath ? ['--input', inputPath] : []),
        '--output', outputPath,
      ],
      commandRunner,
      cwd: fixtureRoot,
      stderr: message => stderr.push(message),
      stdout: message => stdout.push(message),
    });
  }

  test('collects ready evidence through a read-only, provenance-matched helper', async () => {
    const outputPath = path.join(fixtureRoot, '.tmp', 'evidence.json');
    const commandRunner = createCommandRunner({
      workspaceRoot: fixtureRoot,
      dockerRun: _args => {
        writeJson(outputPath, {
          readyForExecutionPlan: true,
          statusId: 'ready',
          validation: { ok: true },
        });
        return { status: 0, stdout: '' };
      },
    });

    const outcome = await runRunner({ commandRunner });
    const dockerRunCall = commandRunner.mock.calls.find(([call]) => (
      call.command === 'docker' && call.args[0] === 'run'
    ));
    const dockerRunArgs = dockerRunCall[0].args;

    expect(outcome).toEqual(expect.objectContaining({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.SUCCESS,
      outputPath: '.tmp/evidence.json',
      sourceRevision: SOURCE_REVISION,
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.READY,
    }));
    expect(dockerRunArgs).toEqual(expect.arrayContaining([
      '--rm',
      '--pull', 'never',
      '--network', 'container:classifarr',
      '--user', '1000:1000',
      '--read-only',
      '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges:true',
      '--env', 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=30000',
      '--require-ready',
    ]));
    expect(dockerRunArgs).toContain(
      `type=bind,source=${fixtureRoot},target=/app/source,readonly`
    );
    expect(dockerRunArgs).toContain(
      `type=bind,source=${path.dirname(outputPath)},target=/app/output`
    );
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout[0])).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.READY,
    }));
  });

  test('blocks before Docker runs when the checkout is dirty', async () => {
    const commandRunner = createCommandRunner({
      workspaceRoot: fixtureRoot,
      worktreeStatus: ' M scripts/example.mjs\n',
    });

    const outcome = await runRunner({ commandRunner });

    expect(outcome).toEqual(expect.objectContaining({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.BLOCKED,
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS
        .BLOCKED_BY_WORKTREE,
    }));
    expect(commandRunner.mock.calls.some(([call]) => (
      call.command === 'docker' && call.args[0] === 'run'
    ))).toBe(false);
  });

  test('blocks an unlabeled or mismatched image before a database connection can run', async () => {
    const commandRunner = createCommandRunner({
      imageRevision: 'unknown',
      workspaceRoot: fixtureRoot,
    });

    const outcome = await runRunner({ commandRunner });

    expect(outcome).toEqual(expect.objectContaining({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.BLOCKED,
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS
        .BLOCKED_BY_IMAGE_PROVENANCE,
    }));
    expect(stderr).toEqual([
      'The target image is not revision-matched to the reviewed checkout.',
    ]);
    expect(commandRunner.mock.calls.some(([call]) => (
      call.command === 'docker' && call.args[0] === 'run'
    ))).toBe(false);
    expect(fs.existsSync(path.join(fixtureRoot, '.tmp'))).toBe(false);
  });

  test('fails when Git cannot verify the worktree state', async () => {
    const commandRunner = createCommandRunner({
      gitStatusExitCode: 1,
      workspaceRoot: fixtureRoot,
    });

    const outcome = await runRunner({ commandRunner });

    expect(outcome).toEqual(expect.objectContaining({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.FAILURE,
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.FAILED,
    }));
    expect(stderr).toEqual(['Could not verify the reviewed checkout.']);
    expect(commandRunner.mock.calls.some(([call]) => call.command === 'docker')).toBe(false);
  });

  test('rejects an output path outside .tmp without starting the helper', async () => {
    const commandRunner = createCommandRunner({ workspaceRoot: fixtureRoot });

    const outcome = await runRunner({
      commandRunner,
      outputPath: 'evidence.json',
    });

    expect(outcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.FAILURE);
    expect(stderr).toEqual(['Evidence output must be a new JSON file under .tmp.']);
    expect(commandRunner.mock.calls.some(([call]) => call.command === 'docker')).toBe(false);
  });

  test('retains blocked evidence as a non-zero diagnostic outcome', async () => {
    const outputPath = path.join(fixtureRoot, '.tmp', 'blocked.json');
    const commandRunner = createCommandRunner({
      workspaceRoot: fixtureRoot,
      dockerRun: () => {
        writeJson(outputPath, {
          readyForExecutionPlan: false,
          statusId: 'blocked_by_evidence',
          validation: { ok: true },
        });
        return { status: 1, stdout: '' };
      },
    });

    const outcome = await runRunner({
      commandRunner,
      outputPath: '.tmp/blocked.json',
    });

    expect(outcome).toEqual(expect.objectContaining({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.BLOCKED,
      outputPath: '.tmp/blocked.json',
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS
        .BLOCKED_BY_EVIDENCE,
    }));
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf8')).readyForExecutionPlan).toBe(false);
  });

  test('collects a bounded fail-closed diagnostic without an input artifact', async () => {
    const outputPath = path.join(fixtureRoot, '.tmp', 'automatic-diagnostic.json');
    const commandRunner = createCommandRunner({
      workspaceRoot: fixtureRoot,
      dockerRun: args => {
        writeJson(outputPath, {
          readyForExecutionPlan: false,
          statusId: 'blocked_by_deletion_gates',
          validation: { ok: true },
        });
        expect(args).not.toContain('--input');
        return { status: 1, stdout: '' };
      },
    });

    const outcome = await runRunner({
      commandRunner,
      inputPath: null,
      outputPath: '.tmp/automatic-diagnostic.json',
    });

    expect(outcome).toEqual(expect.objectContaining({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.BLOCKED,
      outputPath: '.tmp/automatic-diagnostic.json',
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS
        .BLOCKED_BY_EVIDENCE,
    }));
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(stderr).toEqual([]);
  });

  test('does not report a command failure as collected evidence', async () => {
    const commandRunner = createCommandRunner({
      workspaceRoot: fixtureRoot,
      dockerRun: () => ({ status: 2, stdout: '' }),
    });

    const outcome = await runRunner({ commandRunner });

    expect(outcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.FAILURE);
    expect(outcome.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.FAILED);
    expect(stderr).toEqual([
      'The maintenance runner did not produce a valid evidence bundle.',
    ]);
  });
});
