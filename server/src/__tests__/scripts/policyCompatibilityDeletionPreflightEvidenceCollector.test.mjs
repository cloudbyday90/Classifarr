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
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS,
  runPolicyCompatibilityDeletionPreflightEvidenceCollector,
} from '../../../../scripts/lib/policyCompatibilityDeletionPreflightEvidenceCollector.mjs';
import {
  buildReadyExecutionPlanArtifact,
} from '../services/fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';

const GENERATED_AT = '2026-07-14T20:00:00.000Z';
const SOURCE_REVISION = '0123456789abcdef0123456789abcdef01234567';
const MANIFEST_PATH = 'server/src/services/legacyCompatibilityBridge.mjs';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createDirectoryLink(targetPath, linkPath) {
  fs.symlinkSync(
    targetPath,
    linkPath,
    process.platform === 'win32' ? 'junction' : 'dir'
  );
}

function buildReadyArtifact({ manifestPath = MANIFEST_PATH } = {}) {
  return buildReadyExecutionPlanArtifact({
    generatedAt: GENERATED_AT,
    executionPlan: {
      statusId: 'ready_for_execution_gate',
      readyForExecutionGate: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      manifest: {
        approved: true,
        approvedBy: 'policy-maintainer',
        entries: [{ path: manifestPath }],
      },
    },
  });
}

function createCommandRunner({
  catFileExitCode = 0,
  gitStatusExitCode = 0,
  worktreeStatus = '',
  workspaceRoot,
} = {}) {
  return jest.fn(({ command, args }) => {
    if (command !== 'git') return { status: 1, stdout: '' };

    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
      return { status: 0, stdout: `${workspaceRoot}\n` };
    }
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
      return { status: 0, stdout: `${SOURCE_REVISION}\n` };
    }
    if (args[0] === 'status') {
      return { status: gitStatusExitCode, stdout: worktreeStatus };
    }
    if (args[0] === 'cat-file') {
      return { status: catFileExitCode, stdout: '' };
    }

    return { status: 1, stdout: '' };
  });
}

describe('policyCompatibilityDeletionPreflightEvidenceCollector', () => {
  let fixtureRoot;
  let stderr;
  let stdout;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'classifarr-preflight-evidence-collector-')
    );
    fs.mkdirSync(path.join(fixtureRoot, path.dirname(MANIFEST_PATH)), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, MANIFEST_PATH), 'export const legacy = true;\n');
    writeJson(path.join(fixtureRoot, '.artifacts', 'execution-plan.json'), buildReadyArtifact());
    stderr = [];
    stdout = [];
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  async function runCollector({
    args = [],
    commandRunner = createCommandRunner({ workspaceRoot: fixtureRoot }),
  } = {}) {
    return runPolicyCompatibilityDeletionPreflightEvidenceCollector({
      argv: [
        '--execution-plan-artifact', '.artifacts/execution-plan.json',
        '--output', '.tmp/preflight-evidence.json',
        ...args,
      ],
      commandRunner,
      cwd: fixtureRoot,
      now: () => new Date(GENERATED_AT),
      stderr: message => stderr.push(message),
      stdout: message => stdout.push(message),
    });
  }

  test('collects bounded current artifact, checkout, manifest, and runtime-reference evidence', async () => {
    const commandRunner = createCommandRunner({ workspaceRoot: fixtureRoot });
    const outcome = await runCollector({ commandRunner });
    const outputPath = path.join(fixtureRoot, '.tmp', 'preflight-evidence.json');
    const evidence = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    expect(outcome).toEqual(expect.objectContaining({
      exitCode: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.SUCCESS,
      outputPath: '.tmp/preflight-evidence.json',
      sourceRevision: SOURCE_REVISION,
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS.OBSERVED,
    }));
    expect(evidence).toEqual(expect.objectContaining({
      statusId: 'observed',
      executionPlanArtifact: expect.objectContaining({
        artifactPath: '.artifacts/execution-plan.json',
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      checkout: expect.objectContaining({
        clean: true,
        sourceRevision: SOURCE_REVISION,
      }),
      manifest: expect.objectContaining({
        entries: [{ index: 0, path: MANIFEST_PATH, statusId: 'observed' }],
      }),
      runtimeEvidence: expect.objectContaining({ statusId: 'observed' }),
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(commandRunner.mock.calls.some(([call]) => call.command === 'docker')).toBe(false);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout[0])).toEqual(expect.objectContaining({ statusId: 'observed' }));
  });

  test('writes bounded blocked evidence when the reviewed checkout is dirty', async () => {
    const commandRunner = createCommandRunner({
      workspaceRoot: fixtureRoot,
      worktreeStatus: ' M server/src/services/example.mjs\n',
    });
    const outcome = await runCollector({ commandRunner });
    const evidence = JSON.parse(fs.readFileSync(
      path.join(fixtureRoot, '.tmp', 'preflight-evidence.json'),
      'utf8'
    ));

    expect(outcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.BLOCKED);
    expect(outcome.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS.INVALID);
    expect(evidence.checkout).toEqual(expect.objectContaining({ clean: false, statusId: 'invalid' }));
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'checkout_not_clean' }),
    ]));
  });

  test('writes missing evidence when the artifact or its source-revision path is unavailable', async () => {
    fs.rmSync(path.join(fixtureRoot, '.artifacts', 'execution-plan.json'));

    const outcome = await runCollector();
    const evidence = JSON.parse(fs.readFileSync(
      path.join(fixtureRoot, '.tmp', 'preflight-evidence.json'),
      'utf8'
    ));

    expect(outcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.BLOCKED);
    expect(outcome.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS.MISSING);
    expect(evidence.executionPlanArtifact.statusId).toBe('missing');
  });

  test('fails closed when a manifest path no longer exists at the reviewed source revision', async () => {
    const commandRunner = createCommandRunner({
      catFileExitCode: 1,
      workspaceRoot: fixtureRoot,
    });

    const outcome = await runCollector({ commandRunner });
    const evidence = JSON.parse(fs.readFileSync(
      path.join(fixtureRoot, '.tmp', 'preflight-evidence.json'),
      'utf8'
    ));

    expect(outcome.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS.MISSING);
    expect(evidence.manifest.entries[0].statusId).toBe('missing');
  });

  test('rejects an unsafe manifest path without running it through Git', async () => {
    writeJson(
      path.join(fixtureRoot, '.artifacts', 'execution-plan.json'),
      buildReadyArtifact({ manifestPath: '../outside.mjs' })
    );
    const commandRunner = createCommandRunner({ workspaceRoot: fixtureRoot });

    const outcome = await runCollector({ commandRunner });

    expect(outcome.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS.INVALID);
    expect(commandRunner.mock.calls.some(([call]) => (
      call.command === 'git' && call.args[0] === 'cat-file'
    ))).toBe(false);
  });

  test('rejects caller-controlled time and output paths outside the ignored temporary directory', async () => {
    const invalidArgumentOutcome = await runCollector({ args: ['--now', GENERATED_AT] });

    expect(invalidArgumentOutcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.FAILURE);
    expect(stderr).toEqual(expect.arrayContaining(['Unsupported command argument.']));

    stderr = [];
    const outputOutcome = await runCollector({
      args: ['--output', 'preflight-evidence.json'],
    });

    expect(outputOutcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.FAILURE);
    expect(stderr).toEqual(['Preflight evidence output must be a new JSON file under .tmp.']);
  });

  test('fails closed instead of following a symbolic .tmp output directory', async () => {
    const externalDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'classifarr-preflight-evidence-external-')
    );

    try {
      createDirectoryLink(externalDirectory, path.join(fixtureRoot, '.tmp'));

      const outcome = await runCollector();

      expect(outcome).toEqual(expect.objectContaining({
        exitCode: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.FAILURE,
        statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS.FAILED,
      }));
      expect(fs.existsSync(path.join(externalDirectory, 'preflight-evidence.json'))).toBe(false);
      expect(stderr).toEqual(expect.arrayContaining([
        expect.stringContaining('Preflight evidence output directories cannot use symbolic links.'),
      ]));
    } finally {
      fs.rmSync(externalDirectory, { recursive: true, force: true });
    }
  });
});
