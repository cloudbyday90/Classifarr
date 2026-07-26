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
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS,
} from '../../services/policyControlledCompatibilityPathRemoval.mjs';
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
const EXECUTION_PLAN_ARTIFACT_FINGERPRINT = 'b'.repeat(64);
const EXECUTION_GATE_ARTIFACT_FINGERPRINT = 'c'.repeat(64);
const REMOVED_PATHS = Object.freeze([
  'client/src/components/policies/PolicyStarterTemplateAccelerator.vue',
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
      executionPlanArtifactFingerprint: EXECUTION_PLAN_ARTIFACT_FINGERPRINT,
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

function partialApplyResult(overrides = {}) {
  const entries = [
    { path: REMOVED_PATHS[0], actionId: 'delete_file' },
    { path: REMOVED_PATHS[1], actionId: 'delete_file' },
    {
      path: 'server/src/services/policyIntentMapper.mjs',
      actionId: 'delete_file',
    },
  ];

  return {
    statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS
      .BLOCKED_BY_ADAPTER,
    applied: false,
    validation: { ok: true, issueCount: 0, issues: [] },
    removalReview: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS
        .READY_FOR_REMOVAL_REVIEW,
      validationOk: true,
      readyForRemovalReview: true,
      selectedCount: entries.length,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      executionPlanArtifactFingerprint: EXECUTION_PLAN_ARTIFACT_FINGERPRINT,
      executionGateArtifactFingerprint: EXECUTION_GATE_ARTIFACT_FINGERPRINT,
    },
    applyBatch: {
      requestedCount: entries.length,
      checkedCount: 2,
      blockedEntry: entries[1],
      haltReasonId: 'adapter_failure',
      appliedCount: 1,
      entries,
      results: [{ ...entries[0], applied: true }],
    },
    ...overrides,
  };
}

function partialVerificationInput(overrides = {}) {
  const appliedPath = REMOVED_PATHS[0];

  return {
    importScan: {
      completed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      checkedPaths: [appliedPath],
      references: [],
    },
    runtimeChecks: [{
      checkId: 'partial-prefix-runtime-check',
      passed: true,
      checkedPaths: [appliedPath],
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    }],
    validationEvidence: {
      focused: {
        command: 'focused partial validation',
        passed: true,
        checkedPaths: [appliedPath],
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      full: {
        command: 'full partial validation',
        passed: true,
        checkedPaths: [appliedPath],
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
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

  test('writes a verified partial prefix only as an explicit non-authorizing diagnostic', () => {
    const withoutDiagnosticAllowance = runGenerator({
      fixtureRoot,
      applyEvidence: partialApplyResult(),
      input: partialVerificationInput(),
    });

    expect(withoutDiagnosticAllowance.status).toBe(1);
    expect(withoutDiagnosticAllowance.stderr).toContain('verified only a partial apply');
    expect(withoutDiagnosticAllowance.stderr).toContain('cannot authorize another batch');
    expect(fs.existsSync(withoutDiagnosticAllowance.outputPath)).toBe(false);

    const withDiagnosticAllowance = runGenerator({
      fixtureRoot,
      applyEvidence: partialApplyResult(),
      input: partialVerificationInput(),
      allowBlocked: true,
    });
    const artifact = JSON.parse(
      fs.readFileSync(withDiagnosticAllowance.artifactOutputPath, 'utf8')
    );

    expect(withDiagnosticAllowance.status).toBe(1);
    expect(artifact.statusId)
      .toBe(POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS
        .PARTIAL_APPLY_VERIFIED);
    expect(artifact.verified).toBe(false);
    expect(artifact.partialApplyVerified).toBe(true);
    expect(artifact.nextStep.stepId).toBe('resolve_removal_apply_blocker');
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
