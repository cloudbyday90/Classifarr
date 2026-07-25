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
  POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES,
  buildExecutionEvidenceInput,
  runPolicyCompatibilityDeletionExecutionPlanEvidenceBundleCli,
} from '../../../../scripts/lib/policyCompatibilityDeletionExecutionPlanEvidenceBundleRunner.mjs';

function writeJson(rootPath, fileName, value) {
  const filePath = path.join(rootPath, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

describe('policyCompatibilityDeletionExecutionPlanEvidenceBundleRunner', () => {
  let fixtureRoot;
  let database;
  let loadEvidenceBundle;
  let closeDatabasePool;
  let stdout;
  let stderr;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'classifarr-execution-plan-evidence-runner-')
    );
    database = { connection: 'test-only' };
    loadEvidenceBundle = jest.fn();
    closeDatabasePool = jest.fn().mockResolvedValue();
    stdout = [];
    stderr = [];
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  async function runCli({ argv, fileSystem = fs } = {}) {
    return runPolicyCompatibilityDeletionExecutionPlanEvidenceBundleCli({
      argv,
      db: database,
      loadEvidenceBundle,
      closeDatabasePool,
      cwd: fixtureRoot,
      fileSystem,
      pathModule: path,
      stdout: message => stdout.push(message),
      stderr: message => stderr.push(message),
    });
  }

  test('collects one bundle through injected dependencies and strips caller timestamps', async () => {
    writeJson(fixtureRoot, 'input.json', {
      generatedAt: '2026-07-16T01:00:00.000Z',
      now: '2026-07-16T01:00:10.000Z',
      convertedPolicy: { id: 14 },
      unconvertedPolicies: [{ id: 15 }],
      deletionManifestApproved: true,
    });
    const evidenceBundle = {
      readyForExecutionPlan: true,
      statusId: 'ready',
    };
    loadEvidenceBundle.mockResolvedValue(evidenceBundle);

    const outcome = await runCli({
      argv: [
        '--input', 'input.json',
        '--output', 'output.json',
        '--generated-at', '2026-07-16T01:01:00.000Z',
      ],
    });

    expect(outcome).toEqual({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.SUCCESS,
      evidenceBundle,
    });
    expect(loadEvidenceBundle).toHaveBeenCalledWith(database, {
      deletionManifestApproved: true,
      generatedAt: '2026-07-16T01:01:00.000Z',
    });
    expect(JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'output.json'), 'utf8')))
      .toEqual(evidenceBundle);
    expect(stdout).toEqual([JSON.stringify(evidenceBundle, null, 2)]);
    expect(stderr).toEqual([]);
    expect(closeDatabasePool).toHaveBeenCalledWith(database);
  });

  test('removes caller-supplied recovery and support-gate claims before collection', () => {
    expect(buildExecutionEvidenceInput({
      rollbackAvailable: true,
      legacyDeletionBlocked: false,
      supportDiagnosticsSafe: false,
      supportStanceId: 'unsupported_after_window',
      backupRestoreVerified: true,
    })).toEqual({ backupRestoreVerified: true });
  });

  test('writes a blocked diagnostic but exits non-zero only when readiness is required', async () => {
    const inputPath = writeJson(fixtureRoot, 'input.json', {});
    const evidenceBundle = {
      readyForExecutionPlan: false,
      statusId: 'blocked_by_evidence',
    };
    loadEvidenceBundle.mockResolvedValue(evidenceBundle);

    const defaultOutcome = await runCli({
      argv: ['--input', path.basename(inputPath), '--output', 'blocked-default.json'],
    });
    const requiredOutcome = await runCli({
      argv: [
        '--input', path.basename(inputPath),
        '--output', 'blocked-required.json',
        '--require-ready',
      ],
    });

    expect(defaultOutcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.SUCCESS);
    expect(requiredOutcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.BLOCKED);
    expect(fs.existsSync(path.join(fixtureRoot, 'blocked-default.json'))).toBe(true);
    expect(fs.existsSync(path.join(fixtureRoot, 'blocked-required.json'))).toBe(true);
    expect(loadEvidenceBundle).toHaveBeenCalledTimes(2);
  });

  test('rejects malformed arguments without echoing supplied values', async () => {
    const outcome = await runCli({
      argv: ['--unrecognized', 'api-key=never-log-this'],
    });

    expect(outcome).toEqual({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES
        .INPUT_OR_OUTPUT_ERROR,
      evidenceBundle: null,
    });
    expect(stderr.join('\n')).toContain('Unsupported command argument.');
    expect(stderr.join('\n')).not.toContain('api-key=never-log-this');
    expect(loadEvidenceBundle).not.toHaveBeenCalled();
    expect(closeDatabasePool).toHaveBeenCalledWith(database);
  });

  test('rejects unreadable or non-object JSON before collecting evidence', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'malformed.json'), '{ invalid json');

    const malformedOutcome = await runCli({
      argv: ['--input', 'malformed.json'],
    });
    const arrayInputPath = writeJson(fixtureRoot, 'array.json', []);
    const arrayOutcome = await runCli({
      argv: ['--input', path.basename(arrayInputPath)],
    });

    expect(malformedOutcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.INPUT_OR_OUTPUT_ERROR);
    expect(arrayOutcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.INPUT_OR_OUTPUT_ERROR);
    expect(stderr).toEqual(expect.arrayContaining([
      'Could not read execution-plan evidence input JSON.',
      'Execution-plan evidence input must be a JSON object.',
    ]));
    expect(loadEvidenceBundle).not.toHaveBeenCalled();
  });

  test('does not expose loader or output errors through the public CLI boundary', async () => {
    writeJson(fixtureRoot, 'input.json', {});
    loadEvidenceBundle.mockRejectedValue(new Error('postgres://operator:secret@host/database'));

    const loaderOutcome = await runCli({
      argv: ['--input', 'input.json'],
    });
    const failingFileSystem = {
      ...fs,
      writeFileSync: () => {
        throw new Error('/restricted/output.json api-key=never-log-this');
      },
    };
    loadEvidenceBundle.mockResolvedValue({ readyForExecutionPlan: true });
    const writerOutcome = await runCli({
      argv: ['--input', 'input.json', '--output', 'output.json'],
      fileSystem: failingFileSystem,
    });

    expect(loaderOutcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.BLOCKED);
    expect(writerOutcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.INPUT_OR_OUTPUT_ERROR);
    expect(stderr).toEqual(expect.arrayContaining([
      'Could not generate compatibility deletion execution-plan evidence bundle.',
      'Could not write compatibility deletion execution-plan evidence JSON.',
    ]));
    expect(stderr.join('\n')).not.toContain('postgres://operator:secret@host/database');
    expect(stderr.join('\n')).not.toContain('api-key=never-log-this');
  });

  test('converts a successful collection to a blocked result when cleanup fails', async () => {
    writeJson(fixtureRoot, 'input.json', {});
    loadEvidenceBundle.mockResolvedValue({ readyForExecutionPlan: true });
    closeDatabasePool.mockRejectedValue(new Error('database cleanup failed'));

    const outcome = await runCli({
      argv: ['--input', 'input.json'],
    });

    expect(outcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.BLOCKED);
    expect(outcome.evidenceBundle).toEqual({ readyForExecutionPlan: true });
    expect(stderr).toContain('Could not close compatibility deletion evidence resources.');
  });
});
