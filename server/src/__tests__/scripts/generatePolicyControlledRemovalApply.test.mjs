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

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionGate,
} from '../../services/policyCompatibilityDeletionExecutionGate.mjs';
import {
  buildPolicyControlledCompatibilityPathRemoval,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS,
} from '../../services/policyControlledRemovalApplyArtifact.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  buildReadyExecutionGateOperatorEvidence,
  buildReadyExecutionGatePreflightEvidenceArtifact,
  buildReadyExecutionPlanArtifact,
} from '../services/fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';

const GENERATOR_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/generate-policy-controlled-removal-apply.mjs',
    import.meta.url
  )
);
const GENERATED_AT = POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME;
const TARGET_PATH = 'compatibility/legacy.mjs';

function writeJson(rootPath, fileName, value) {
  const filePath = path.join(rootPath, '.artifacts', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function writeFixtureFile(rootPath, relativePath, contents = 'fixture\n') {
  const filePath = path.join(rootPath, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function executionPlan({ selectedPath = TARGET_PATH } = {}) {
  return {
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    manifest: {
      approved: true,
      approvedBy: 'storage-closure-maintainer',
      entryCount: 1,
      entries: [{
        categoryId: 'client_bridge_ui',
        actionId:
          POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.DELETE_FILE,
        path: selectedPath,
        deletionIntent: 'Remove one reviewed compatibility file from the sandbox.',
        replacementEvidence: {
          replacement: 'Native policy builder destination context replaces this UI.',
          tests: ['PolicyBuilderLibraryContext.test.js'],
        },
        ready: true,
      }],
    },
  };
}

function buildReadyRemovalBatch({ selectedPath = TARGET_PATH } = {}) {
  const executionPlanArtifact = buildReadyExecutionPlanArtifact({
    executionPlan: executionPlan({ selectedPath }),
  });
  const executionGate = buildPolicyCompatibilityDeletionExecutionGate({
    executionPlanArtifact,
    operatorEvidence: buildReadyExecutionGateOperatorEvidence({
      executionPlanArtifact,
    }),
    preflightEvidenceArtifact: buildReadyExecutionGatePreflightEvidenceArtifact({
      executionPlanArtifact,
    }),
    generatedAt: GENERATED_AT,
    now: GENERATED_AT,
  });

  return buildPolicyControlledCompatibilityPathRemoval({
    executionPlanArtifact,
    executionGate,
    selectedPaths: [selectedPath],
    maxBatchSize: 1,
    removalReason: 'Remove the one reviewed sandbox compatibility path.',
    reviewedBy: 'storage-closure-maintainer',
  });
}

function applyInput(overrides = {}) {
  return {
    executeApply: true,
    operatorConfirmation: {
      confirmed: true,
      confirmedBy: 'storage-closure-maintainer',
    },
    ...overrides,
  };
}

function runGenerator({
  fixtureRoot,
  removalBatch,
  input = applyInput(),
  applyFiles = false,
  allowBlocked = false,
} = {}) {
  const removalBatchPath = writeJson(fixtureRoot, 'removal-batch.json', removalBatch);
  const inputPath = writeJson(fixtureRoot, 'apply-input.json', input);
  const outputPath = path.join(fixtureRoot, '.artifacts', 'apply-result.json');
  const artifactOutputPath = path.join(fixtureRoot, '.artifacts', 'apply-artifact.json');
  const args = [
    GENERATOR_PATH,
    '--removal-batch', removalBatchPath,
    '--input', inputPath,
    '--output', outputPath,
    '--artifact-output', artifactOutputPath,
    '--generated-at', GENERATED_AT,
  ];

  if (applyFiles) {
    args.push('--apply-files');
  }

  if (allowBlocked) {
    args.push('--allow-blocked');
  }

  const result = spawnSync(process.execPath, args, {
    cwd: fixtureRoot,
    encoding: 'utf8',
  });

  return {
    ...result,
    outputPath,
    artifactOutputPath,
    stdoutJson: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

describe('generate-policy-controlled-removal-apply', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-removal-apply-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('does not delete or write output without the explicit apply-files flag', () => {
    const targetPath = writeFixtureFile(fixtureRoot, TARGET_PATH);
    const result = runGenerator({
      fixtureRoot,
      removalBatch: buildReadyRemovalBatch(),
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toBeNull();
    expect(result.stderr).toContain('artifact is blocked');
    expect(result.stderr).toContain('apply_result_not_applied');
    expect(fs.existsSync(targetPath)).toBe(true);
    expect(fs.existsSync(result.outputPath)).toBe(false);
    expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
  });

  test('writes a bounded blocked diagnostic only when explicitly requested', () => {
    const targetPath = writeFixtureFile(fixtureRoot, TARGET_PATH);
    const result = runGenerator({
      fixtureRoot,
      removalBatch: buildReadyRemovalBatch(),
      allowBlocked: true,
    });
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId: POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS.BLOCKED,
      applied: false,
      riskCount: expect.any(Number),
    }));
    expect(result.stdoutJson.riskCount).toBeGreaterThan(0);
    expect(artifact.applyResult.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
        .BLOCKED_BY_APPLY_RESULT
    );
    expect(artifact.sideEffects.filesDeleted).toBe(false);
    expect(fs.existsSync(targetPath)).toBe(true);
  });

  test('applies only the reviewed repo-relative file inside an isolated repository', () => {
    const targetPath = writeFixtureFile(fixtureRoot, TARGET_PATH);
    const retainedPath = writeFixtureFile(fixtureRoot, 'compatibility/retain.mjs');
    const result = runGenerator({
      fixtureRoot,
      removalBatch: buildReadyRemovalBatch(),
      applyFiles: true,
    });
    const applyResult = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId: POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS.APPLIED,
      applied: true,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(applyResult).toEqual(artifact.applyResult);
    expect(applyResult.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED
    );
    expect(applyResult.applyBatch).toEqual(expect.objectContaining({
      requestedCount: 1,
      appliedCount: 1,
    }));
    expect(artifact.sideEffects).toEqual(expect.objectContaining({
      filesDeleted: true,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    }));
    expect(fs.existsSync(targetPath)).toBe(false);
    expect(fs.existsSync(retainedPath)).toBe(true);
  });

  test('rejects a path that escapes the isolated repository without writing output', () => {
    const outsidePath = path.join(
      path.dirname(fixtureRoot),
      `classifarr-escape-sentinel-${path.basename(fixtureRoot)}.mjs`
    );
    const escapedPath = `../${path.basename(outsidePath)}`;
    fs.writeFileSync(outsidePath, 'outside sentinel\n');

    try {
      const result = runGenerator({
        fixtureRoot,
        removalBatch: buildReadyRemovalBatch({ selectedPath: escapedPath }),
        applyFiles: true,
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdoutJson).toBeNull();
      expect(result.stderr).toContain('escapes the repository');
      expect(fs.existsSync(outsidePath)).toBe(true);
      expect(fs.existsSync(result.outputPath)).toBe(false);
      expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
    } finally {
      fs.rmSync(outsidePath, { force: true });
    }
  });
});
