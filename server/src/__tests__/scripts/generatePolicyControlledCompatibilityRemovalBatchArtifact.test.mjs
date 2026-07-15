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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionGate.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS,
} from '../../services/policyControlledCompatibilityRemovalBatchArtifact.mjs';
import {
  POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS,
  buildPolicyControlledRemovalApplyArtifact,
} from '../../services/policyControlledRemovalApplyArtifact.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  buildReadyExecutionGatePreflightEvidence,
  buildReadyExecutionPlanArtifact,
} from '../services/fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';

const GENERATOR_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/generate-policy-controlled-compatibility-removal-batch-artifact.mjs',
    import.meta.url
  )
);
const GENERATED_AT = POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME;
const MANIFEST_PATH =
  'client/src/components/policies/PolicyStarterTemplateMechanics.vue';

function writeJson(rootPath, fileName, value) {
  const filePath = path.join(rootPath, '.artifacts', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function executionPlan(overrides = {}) {
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
        path: MANIFEST_PATH,
        deletionIntent: 'Remove bridge-only UI after native replacement.',
        replacementEvidence: {
          replacement:
            'Native policy builder destination context replaces this UI.',
          tests: ['PolicyBuilderLibraryContext.test.js'],
        },
        ready: true,
      }],
    },
    ...overrides,
  };
}

function readyExecutionPlanArtifact(overrides = {}) {
  return buildReadyExecutionPlanArtifact({
    executionPlan: executionPlan(),
    overrides,
  });
}

function readyInput({ executionPlanArtifact, overrides = {} } = {}) {
  return {
    preflightEvidence: buildReadyExecutionGatePreflightEvidence({
      executionPlanArtifact,
    }),
    selectedPaths: [MANIFEST_PATH],
    maxBatchSize: 1,
    removalReason:
      'First controlled batch removes one bridge-only UI file from the approved manifest.',
    reviewedBy: 'storage-closure-maintainer',
    ...overrides,
  };
}

function runGenerator({
  fixtureRoot,
  executionPlanArtifact,
  input,
  allowBlocked = false,
} = {}) {
  const executionPlanArtifactPath = writeJson(
    fixtureRoot,
    'execution-plan-artifact.json',
    executionPlanArtifact
  );
  const inputPath = writeJson(fixtureRoot, 'removal-batch-input.json', input);
  const outputPath = path.join(fixtureRoot, '.artifacts', 'removal-batch.json');
  const artifactOutputPath = path.join(
    fixtureRoot,
    '.artifacts',
    'removal-batch-artifact.json'
  );
  const args = [
    GENERATOR_PATH,
    '--execution-plan-artifact', executionPlanArtifactPath,
    '--input', inputPath,
    '--output', outputPath,
    '--artifact-output', artifactOutputPath,
    '--generated-at', GENERATED_AT,
    '--now', GENERATED_AT,
  ];

  if (allowBlocked) {
    args.push('--allow-blocked');
  }

  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });

  return {
    ...result,
    outputPath,
    artifactOutputPath,
    stdoutJson: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

describe('generate-policy-controlled-compatibility-removal-batch-artifact', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'classifarr-removal-batch-artifact-')
    );
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('writes a replayable reviewed batch that the controlled apply layer accepts', async () => {
    const executionPlanArtifact = readyExecutionPlanArtifact();
    const result = runGenerator({
      fixtureRoot,
      executionPlanArtifact,
      input: readyInput({ executionPlanArtifact }),
    });
    const removalBatch = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));
    const downstream = await buildPolicyControlledRemovalApplyArtifact({
      removalBatch,
      input: {
        executeApply: false,
        operatorConfirmation: {
          confirmed: false,
          confirmedBy: null,
        },
      },
      applyAdapter: {
        async applyEntry() {
          throw new Error('Apply adapter must not run while executeApply is false.');
        },
      },
      generatedAt: GENERATED_AT,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      generatedAt: GENERATED_AT,
      statusId: POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.READY,
      ready: true,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(removalBatch).toEqual(artifact.removalBatch);
    expect(artifact.executionGate).toEqual(expect.objectContaining({
      statusId:
        POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_STATUS_IDS
          .READY_FOR_CONTROLLED_DELETION,
      allowControlledDeletion: true,
      validation: expect.objectContaining({ ok: true }),
      executionPlan: expect.objectContaining({
        artifactFingerprint:
          executionPlanArtifact.artifactFingerprint.fingerprint,
      }),
    }));
    expect(removalBatch.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.READY_FOR_REMOVAL_REVIEW
    );
    expect(removalBatch.reviewArtifact.fingerprint).toEqual(expect.any(String));
    expect(downstream.statusId).toBe(POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_STATUS_IDS.BLOCKED);
    expect(downstream.applyResult.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.BLOCKED_BY_CONFIRMATION
    );
    expect(downstream.applyResult.removalReview).toEqual(expect.objectContaining({
      readyForRemovalReview: true,
      reviewArtifactFingerprint: removalBatch.reviewArtifact.fingerprint,
      executionPlanArtifactFingerprint:
        executionPlanArtifact.artifactFingerprint.fingerprint,
    }));
    expect(Object.values(artifact.sideEffects).some(Boolean)).toBe(false);
    expect(Object.values(downstream.sideEffects).some(Boolean)).toBe(false);
  });

  test('does not write batch output when preflight evidence binds a different artifact', () => {
    const executionPlanArtifact = readyExecutionPlanArtifact();
    const result = runGenerator({
      fixtureRoot,
      executionPlanArtifact,
      input: readyInput({
        executionPlanArtifact,
        overrides: {
          preflightEvidence: buildReadyExecutionGatePreflightEvidence({
            executionPlanArtifact,
            overrides: {
              executionPlanArtifactFingerprint: 'a'.repeat(64),
            },
          }),
        },
      }),
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toBeNull();
    expect(result.stderr).toContain('artifact is blocked');
    expect(result.stderr).toContain('blocked_by_preflight_evidence');
    expect(fs.existsSync(result.outputPath)).toBe(false);
    expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
  });

  test('writes a bounded blocked diagnostic only with explicit operator intent', () => {
    const executionPlanArtifact = readyExecutionPlanArtifact();
    const result = runGenerator({
      fixtureRoot,
      executionPlanArtifact,
      input: readyInput({
        executionPlanArtifact,
        overrides: {
          selectedPaths: ['server/src/services/notInManifest.mjs'],
        },
      }),
      allowBlocked: true,
    });
    const removalBatch = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId: POLICY_CONTROLLED_COMPATIBILITY_REMOVAL_BATCH_ARTIFACT_STATUS_IDS.BLOCKED,
      ready: false,
      riskCount: expect.any(Number),
    }));
    expect(result.stdoutJson.riskCount).toBeGreaterThan(0);
    expect(removalBatch.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS.BLOCKED_BY_SELECTION
    );
    expect(removalBatch.removalBatch.entries).toEqual([]);
    expect(artifact.ready).toBe(false);
    expect(Object.values(artifact.sideEffects).some(Boolean)).toBe(false);
  });
});
