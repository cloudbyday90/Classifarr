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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';
import {
  buildReadyExecutionPlanArtifact,
} from '../services/fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';
import {
  buildNextBatchAuthorizationPathStateSource,
} from '../services/fixtures/policyNextCompatibilityRemovalBatchAuthorizationFixtures.mjs';

const GENERATOR_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/generate-policy-next-batch-authorization.mjs',
    import.meta.url
  )
);
const GENERATED_AT = '2026-07-15T15:20:00.000Z';
const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const OTHER_REVIEW_ARTIFACT_FINGERPRINT = 'b'.repeat(64);
const MANIFEST_PATHS = Object.freeze([
  'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
  'server/src/services/policyIntentImpactPreview.mjs',
  'server/src/services/policyIntentReplayPreview.mjs',
]);

function writeJson(rootPath, fileName, value) {
  const filePath = path.join(rootPath, '.artifacts', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function executionPlan(overrides = {}) {
  const entries = overrides.entries || MANIFEST_PATHS.map(path => ({
    categoryId: 'old_preview_replay_diagnostics',
    actionId: 'delete_file',
    path,
    replacementEvidence: {
      replacementPath: 'server/src/services/policyNativeIntentProjection.mjs',
    },
    ready: true,
  }));

  return {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    },
    manifest: {
      approved: true,
      approvedBy: 'policy-maintainer',
      entryCount: entries.length,
      entries,
    },
    ...overrides,
  };
}

function runtimeEvidenceArtifact(appliedPaths = [MANIFEST_PATHS[0]]) {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      applied: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      removalReview: {
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      applyBatch: {
        requestedCount: appliedPaths.length,
        results: appliedPaths.map(path => ({
          path,
          actionId: 'delete_file',
          applied: true,
        })),
      },
    },
    importScan: {
      completed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      checkedPaths: appliedPaths,
      references: [],
    },
    runtimeChecks: [{
      checkId: 'policy-runtime-imports',
      passed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    }],
    validationEvidence: {
      focused: {
        command: 'focused validation',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      full: {
        command: 'full validation',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
    },
  });
}

function authorizationInput(overrides = {}) {
  return {
    requestedPaths: [MANIFEST_PATHS[1]],
    maxBatchSize: 2,
    authorizationReason: 'Continue the verified compatibility-removal sequence.',
    authorizedBy: 'policy-maintainer',
    reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    ...overrides,
  };
}

function buildArtifactInputs({
  plan = executionPlan(),
  runtimeArtifact = runtimeEvidenceArtifact(),
  input = authorizationInput(),
} = {}) {
  const executionPlanArtifact = buildReadyExecutionPlanArtifact({
    executionPlan: plan,
    generatedAt: GENERATED_AT,
  });
  const appliedPaths = runtimeArtifact.provenance.appliedPaths;
  const { pathStateEvidence } = buildNextBatchAuthorizationPathStateSource({
    executionPlan: plan,
    executionPlanArtifact,
    existingPaths: MANIFEST_PATHS.filter(path => !appliedPaths.includes(path)),
    generatedAt: GENERATED_AT,
  });

  return {
    runtimeArtifact,
    executionPlanArtifact,
    pathStateEvidence,
    input,
  };
}

function runGenerator({
  fixtureRoot,
  runtimeArtifact,
  executionPlanArtifact,
  pathStateEvidence,
  input,
  allowBlocked = false,
} = {}) {
  const runtimeEvidencePath = writeJson(
    fixtureRoot,
    'runtime-evidence-artifact.json',
    runtimeArtifact
  );
  const executionPlanPath = writeJson(
    fixtureRoot,
    'execution-plan-artifact.json',
    executionPlanArtifact
  );
  const pathStateEvidencePath = writeJson(
    fixtureRoot,
    'path-state-evidence.json',
    pathStateEvidence
  );
  const inputPath = writeJson(fixtureRoot, 'authorization-input.json', input);
  const outputPath = path.join(fixtureRoot, '.artifacts', 'authorization.json');
  const artifactOutputPath = path.join(
    fixtureRoot,
    '.artifacts',
    'authorization-artifact.json'
  );
  const args = [
    GENERATOR_PATH,
    '--runtime-evidence-artifact', runtimeEvidencePath,
    '--execution-plan-artifact', executionPlanPath,
    '--path-state-evidence', pathStateEvidencePath,
    '--input', inputPath,
    '--output', outputPath,
    '--artifact-output', artifactOutputPath,
    '--generated-at', GENERATED_AT,
  ];

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

describe('generate-policy-next-batch-authorization', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-next-batch-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('exports a ready authorization only from one coherent artifact chain', () => {
    const inputs = buildArtifactInputs();
    const result = runGenerator({ fixtureRoot, ...inputs });
    const authorization = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId:
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
          .READY_FOR_NEXT_BATCH,
      readyForNextBatch: true,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(authorization).toEqual(artifact.authorization);
    expect(artifact.runtimeEvidenceArtifact).toEqual(inputs.runtimeArtifact);
    expect(artifact.executionPlanArtifact).toEqual(inputs.executionPlanArtifact);
    expect(artifact.pathStateEvidence).toEqual(inputs.pathStateEvidence);
    expect(authorization).toEqual(expect.objectContaining({
      statusId: 'ready_for_next_batch',
      authorizedBatch: expect.objectContaining({
        entries: [expect.objectContaining({
          path: MANIFEST_PATHS[1],
        })],
      }),
      runtimeEvidenceArtifact: expect.objectContaining({
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      }),
      pathStateEvidence: expect.objectContaining({
        executionPlanArtifactFingerprint:
          inputs.executionPlanArtifact.artifactFingerprint.fingerprint,
      }),
    }));
  });

  test('fails closed without output for unknown or cross-review authorization input', () => {
    const unknownPathInputs = buildArtifactInputs({
      input: authorizationInput({
        requestedPaths: ['server/src/services/not-in-manifest.mjs'],
      }),
    });
    const crossReviewInputs = buildArtifactInputs({
      input: authorizationInput({
        reviewArtifactFingerprint: OTHER_REVIEW_ARTIFACT_FINGERPRINT,
      }),
    });

    [
      [unknownPathInputs, 'blocked_by_selection'],
      [crossReviewInputs, 'blocked_by_runtime_evidence_integrity'],
    ].forEach(([inputs, expectedStatusId]) => {
      const result = runGenerator({ fixtureRoot, ...inputs });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdoutJson).toBeNull();
      expect(result.stderr).toContain('artifact is blocked');
      expect(result.stderr).toContain(expectedStatusId);
      expect(fs.existsSync(result.outputPath)).toBe(false);
      expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
    });
  });

  test('fails closed without output when runtime evidence applies a path outside the plan', () => {
    const inputs = buildArtifactInputs({
      runtimeArtifact: runtimeEvidenceArtifact([
        'server/src/services/removed-from-another-manifest.mjs',
      ]),
    });
    const result = runGenerator({ fixtureRoot, ...inputs });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toBeNull();
    expect(result.stderr).toContain('artifact is blocked');
    expect(result.stderr).toContain('blocked_by_runtime_evidence_integrity');
    expect(fs.existsSync(result.outputPath)).toBe(false);
    expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
  });

  test('writes a blocked diagnostic only with explicit allowance for an already removed path', () => {
    const inputs = buildArtifactInputs({
      input: authorizationInput({
        requestedPaths: [MANIFEST_PATHS[0]],
      }),
    });
    const result = runGenerator({ fixtureRoot, allowBlocked: true, ...inputs });
    const authorization = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId:
        POLICY_NEXT_COMPATIBILITY_REMOVAL_BATCH_AUTHORIZATION_ARTIFACT_STATUS_IDS
          .BLOCKED,
      readyForNextBatch: false,
    }));
    expect(authorization).toEqual(artifact.authorization);
    expect(authorization.statusId).toBe('blocked_by_selection');
    expect(authorization.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'requested_path_already_removed' }),
    ]));
    expect(artifact.sideEffects).toEqual(expect.objectContaining({
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
      manifestWritten: false,
      routesRemoved: false,
      testsRemoved: false,
    }));
  });
});
