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
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS,
} from '../../services/policyPostRemovalRuntimeVerificationArtifact.mjs';

const GENERATOR_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/generate-policy-post-removal-verification.mjs',
    import.meta.url
  )
);
const GENERATED_AT = '2026-07-15T15:10:00.000Z';
const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const REMOVED_PATHS = Object.freeze([
  'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
  'server/src/services/policyIntentImpactPreview.mjs',
]);

function writeJson(rootPath, fileName, value) {
  const filePath = path.join(rootPath, '.artifacts', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function applyResult(overrides = {}) {
  return {
    statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
    applied: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    removalReview: {
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    },
    applyBatch: {
      requestedCount: REMOVED_PATHS.length,
      results: REMOVED_PATHS.map(path => ({
        path,
        actionId: 'delete_file',
        applied: true,
      })),
    },
    ...overrides,
  };
}

function verificationInput(overrides = {}) {
  return {
    importScan: {
      completed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      checkedPaths: REMOVED_PATHS,
      references: [],
    },
    runtimeChecks: [
      {
        checkId: 'policy-builder-imports',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      {
        checkId: 'policy-write-runtime',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
    ],
    validationEvidence: {
      focused: {
        command: 'node ./scripts/run-jest.mjs --testPathPatterns="policy" --no-coverage',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      full: {
        command: 'npm --prefix server test',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
    },
    ...overrides,
  };
}

function runGenerator({
  fixtureRoot,
  applyEvidence = applyResult(),
  input = verificationInput(),
  allowBlocked = false,
} = {}) {
  const applyResultPath = writeJson(fixtureRoot, 'apply-result.json', applyEvidence);
  const inputPath = writeJson(fixtureRoot, 'verification-input.json', input);
  const outputPath = path.join(fixtureRoot, '.artifacts', 'runtime-verification.json');
  const runtimeEvidenceOutputPath = path.join(
    fixtureRoot,
    '.artifacts',
    'runtime-evidence.json'
  );
  const artifactOutputPath = path.join(fixtureRoot, '.artifacts', 'verification-artifact.json');
  const args = [
    GENERATOR_PATH,
    '--apply-result', applyResultPath,
    '--input', inputPath,
    '--output', outputPath,
    '--runtime-evidence-output', runtimeEvidenceOutputPath,
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
    runtimeEvidenceOutputPath,
    artifactOutputPath,
    stdoutJson: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

describe('generate-policy-post-removal-verification', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-post-removal-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('exports one verified public artifact chain from the nested controlled-apply result', () => {
    const result = runGenerator({ fixtureRoot });
    const verification = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const runtimeEvidence = JSON.parse(fs.readFileSync(result.runtimeEvidenceOutputPath, 'utf8'));
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId: POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.VERIFIED,
      verified: true,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(verification).toEqual(artifact.verification);
    expect(runtimeEvidence).toEqual(artifact.runtimeEvidenceArtifact);
    expect(runtimeEvidence.provenance).toEqual(expect.objectContaining({
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      appliedPaths: REMOVED_PATHS,
    }));
    expect(artifact.nextStep).toEqual(expect.objectContaining({
      stepId: 'next_compatibility_removal_batch_authorization',
    }));
  });

  test('fails closed without writing output when reference scan coverage is incomplete', () => {
    const result = runGenerator({
      fixtureRoot,
      input: verificationInput({
        importScan: {
          completed: true,
          reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
          checkedPaths: [REMOVED_PATHS[0]],
          references: [],
        },
      }),
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toBeNull();
    expect(result.stderr).toContain('artifact is blocked');
    expect(result.stderr).toContain('blocked_by_import_references');
    expect(fs.existsSync(result.outputPath)).toBe(false);
    expect(fs.existsSync(result.runtimeEvidenceOutputPath)).toBe(false);
    expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
  });

  test('writes a bounded blocked diagnostic only with explicit allowance', () => {
    const result = runGenerator({
      fixtureRoot,
      allowBlocked: true,
      input: verificationInput({
        importScan: {
          completed: true,
          reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
          checkedPaths: REMOVED_PATHS,
          references: [{
            path: REMOVED_PATHS[1],
            referencedBy: 'server/src/routes/policiesRoutePolicyWrite.mjs',
          }],
        },
      }),
    });
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId: POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS.BLOCKED,
      verified: false,
    }));
    expect(artifact.verification.statusId).toBe('blocked_by_import_references');
    expect(artifact.runtimeEvidenceArtifact.provenance.reviewArtifactFingerprint)
      .toBe(REVIEW_ARTIFACT_FINGERPRINT);
    expect(artifact.sideEffects).toEqual({
      storageChanged: false,
      gitCommandsRun: false,
    });
  });

  test('fails closed when verification evidence is bound to another removal review', () => {
    const result = runGenerator({
      fixtureRoot,
      input: verificationInput({
        runtimeChecks: [{
          checkId: 'policy-builder-imports',
          passed: true,
          reviewArtifactFingerprint: 'b'.repeat(64),
        }],
      }),
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toBeNull();
    expect(result.stderr).toContain('artifact is blocked');
    expect(result.stderr).toContain('blocked_by_evidence_integrity');
    expect(fs.existsSync(result.outputPath)).toBe(false);
    expect(fs.existsSync(result.runtimeEvidenceOutputPath)).toBe(false);
    expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
  });
});
