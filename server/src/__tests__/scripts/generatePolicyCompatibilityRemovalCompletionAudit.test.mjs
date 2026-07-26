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
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAuditArtifact.mjs';
import {
  MANIFEST_PATHS,
  REVIEW_ARTIFACT_FINGERPRINT,
  buildCompletionAuditExecutionPlan,
  buildCompletionAuditExecutionPlanArtifact,
  buildCompletionAuditInput,
  buildCompletionAuditNextBatchAuthorizationArtifact,
} from '../services/policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';

const GENERATOR_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/generate-policy-compatibility-removal-completion-audit.mjs',
    import.meta.url
  )
);
const GENERATED_AT = '2026-07-15T15:40:00.000Z';
const OTHER_REVIEW_ARTIFACT_FINGERPRINT = 'b'.repeat(64);

function writeJson(rootPath, fileName, value) {
  const filePath = path.join(rootPath, '.artifacts', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

async function buildGeneratorInputs({
  appliedPaths = MANIFEST_PATHS,
  input = buildCompletionAuditInput(),
} = {}) {
  const executionPlan = buildCompletionAuditExecutionPlan();
  const executionPlanArtifact = buildCompletionAuditExecutionPlanArtifact({
    executionPlan,
  });
  const nextBatchAuthorizationArtifact =
    await buildCompletionAuditNextBatchAuthorizationArtifact({
      executionPlan,
      executionPlanArtifact,
      appliedPaths,
    });

  return {
    nextBatchAuthorizationArtifact,
    executionPlanArtifact,
    input,
  };
}

function runGenerator({
  fixtureRoot,
  nextBatchAuthorizationArtifact,
  executionPlanArtifact,
  input,
  allowBlocked = false,
  requireComplete = false,
} = {}) {
  const authorizationPath = writeJson(
    fixtureRoot,
    'next-batch-authorization-artifact.json',
    nextBatchAuthorizationArtifact
  );
  const executionPlanArtifactPath = writeJson(
    fixtureRoot,
    'execution-plan-artifact.json',
    executionPlanArtifact
  );
  const inputPath = writeJson(fixtureRoot, 'completion-audit-input.json', input);
  const outputPath = path.join(fixtureRoot, '.artifacts', 'completion-audit.json');
  const artifactOutputPath = path.join(
    fixtureRoot,
    '.artifacts',
    'completion-audit-artifact.json'
  );
  const args = [
    GENERATOR_PATH,
    '--next-batch-authorization-artifact', authorizationPath,
    '--execution-plan-artifact', executionPlanArtifactPath,
    '--input', inputPath,
    '--output', outputPath,
    '--artifact-output', artifactOutputPath,
    '--generated-at', GENERATED_AT,
  ];

  if (allowBlocked) {
    args.push('--allow-blocked');
  }
  if (requireComplete) {
    args.push('--require-complete');
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

describe('generate-policy-compatibility-removal-completion-audit', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-completion-audit-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('exports a complete audit only from one coherent next-batch artifact chain', async () => {
    const inputs = await buildGeneratorInputs();
    const result = runGenerator({ fixtureRoot, requireComplete: true, ...inputs });
    const audit = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId:
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.COMPLETE,
      complete: true,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(audit).toEqual(artifact.audit);
    expect(artifact.nextBatchAuthorizationArtifact)
      .toEqual(inputs.nextBatchAuthorizationArtifact);
    expect(artifact.executionPlan).toEqual(inputs.executionPlanArtifact.executionPlan);
    expect(artifact.executionPlanArtifact).toEqual(inputs.executionPlanArtifact);
    expect(artifact.auditInput).toEqual(expect.objectContaining({
      ...inputs.input,
      executionPlanArtifactFingerprint:
        inputs.executionPlanArtifact.artifactFingerprint.fingerprint,
    }));
    expect(audit).toEqual(expect.objectContaining({
      statusId: 'complete',
      authorizationArtifact: expect.objectContaining({
        integrityOk: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      }),
      manifestInventory: expect.objectContaining({
        remainingCount: 0,
      }),
    }));
  });

  test('preserves remaining inventory as valid output while require-complete fails', async () => {
    const inputs = await buildGeneratorInputs({
      appliedPaths: [MANIFEST_PATHS[0]],
    });
    const result = runGenerator({ fixtureRoot, requireComplete: true, ...inputs });
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId:
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
          .REMAINING_INVENTORY,
      complete: false,
      remainingInventory: true,
    }));
    expect(artifact.audit.statusId).toBe('remaining_inventory');
    expect(artifact.audit.manifestInventory.remainingPaths)
      .toEqual([MANIFEST_PATHS[1], MANIFEST_PATHS[2]]);
  });

  test('fails closed without output for altered authorization, cross-review input, or final references', async () => {
    const intactInputs = await buildGeneratorInputs();
    const alteredAuthorizationArtifact = structuredClone(
      intactInputs.nextBatchAuthorizationArtifact
    );
    alteredAuthorizationArtifact.authorizationSummary.remainingCount = 1;
    const crossReviewInput = buildCompletionAuditInput({
      reviewArtifactFingerprint: OTHER_REVIEW_ARTIFACT_FINGERPRINT,
    });
    const referencedInput = buildCompletionAuditInput({
      finalImportScan: {
        completed: true,
        checkedPaths: MANIFEST_PATHS,
        references: [{
          path: MANIFEST_PATHS[0],
          referencedBy: 'server/src/routes/policiesRoutePolicyWrite.mjs',
        }],
      },
    });
    const cases = [
      [{ ...intactInputs, nextBatchAuthorizationArtifact: alteredAuthorizationArtifact },
        'blocked_by_authorization_artifact'],
      [{ ...intactInputs, input: crossReviewInput }, 'blocked_by_authorization_artifact'],
      [{ ...intactInputs, input: referencedInput }, 'blocked_by_final_scan'],
    ];

    cases.forEach(([inputs, expectedAuditStatusId]) => {
      const result = runGenerator({ fixtureRoot, ...inputs });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdoutJson).toBeNull();
      expect(result.stderr).toContain('artifact is blocked');
      expect(result.stderr).toContain(expectedAuditStatusId);
      expect(fs.existsSync(result.outputPath)).toBe(false);
      expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
    });
  });

  test('writes a blocked final-reference diagnostic only with explicit allowance', async () => {
    const inputs = await buildGeneratorInputs({
      input: buildCompletionAuditInput({
        finalImportScan: {
          completed: true,
          checkedPaths: MANIFEST_PATHS,
          references: [{
            path: MANIFEST_PATHS[0],
            referencedBy: 'server/src/routes/policiesRoutePolicyWrite.mjs',
          }],
        },
      }),
    });
    const result = runGenerator({ fixtureRoot, allowBlocked: true, ...inputs });
    const audit = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId:
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.BLOCKED,
      complete: false,
    }));
    expect(audit).toEqual(artifact.audit);
    expect(audit.statusId).toBe('blocked_by_final_scan');
    expect(audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'final_scan_reference_found' }),
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

  test('fails closed when a raw nested execution plan is supplied as the artifact', async () => {
    const inputs = await buildGeneratorInputs();
    const result = runGenerator({
      fixtureRoot,
      ...inputs,
      executionPlanArtifact: inputs.executionPlanArtifact.executionPlan,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toBeNull();
    expect(result.stderr).toContain('artifact is blocked');
    expect(result.stderr).toContain('execution_plan_artifact_invalid');
    expect(fs.existsSync(result.outputPath)).toBe(false);
    expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
  });

  test.each([
    ['pre-v2', artifact => {
      artifact.version = 'policy.post_removal_runtime_evidence_artifact.v1';
    }, 'runtime_evidence_contract_unsupported'],
    ['missing-plan-binding', artifact => {
      delete artifact.evidence.applyEvidence.removalReview
        .executionPlanArtifactFingerprint;
    }, 'execution_plan_fingerprint_missing'],
    ['cross-plan-binding', artifact => {
      artifact.evidence.applyEvidence.removalReview
        .executionPlanArtifactFingerprint = 'c'.repeat(64);
    }, 'execution_plan_fingerprint_mismatch'],
  ])(
    'does not export a completion artifact for %s runtime evidence',
    async (caseId, alterRuntimeEvidence, expectedReasonId) => {
      const inputs = await buildGeneratorInputs();
      const nextBatchAuthorizationArtifact = structuredClone(
        inputs.nextBatchAuthorizationArtifact
      );
      alterRuntimeEvidence(nextBatchAuthorizationArtifact.runtimeEvidenceArtifact);
      const strictRoot = path.join(fixtureRoot, `${caseId}-strict`);
      const strictResult = runGenerator({
        fixtureRoot: strictRoot,
        ...inputs,
        nextBatchAuthorizationArtifact,
      });

      expect(strictResult.error).toBeUndefined();
      expect(strictResult.status).toBe(1);
      expect(strictResult.stdoutJson).toBeNull();
      expect(strictResult.stderr).toContain('requires current runtime evidence');
      expect(strictResult.stderr).toContain(expectedReasonId);
      expect(fs.existsSync(strictResult.outputPath)).toBe(false);
      expect(fs.existsSync(strictResult.artifactOutputPath)).toBe(false);

      const diagnosticRoot = path.join(fixtureRoot, `${caseId}-diagnostic`);
      const diagnosticResult = runGenerator({
        fixtureRoot: diagnosticRoot,
        ...inputs,
        nextBatchAuthorizationArtifact,
        allowBlocked: true,
      });
      const diagnostic = JSON.parse(
        fs.readFileSync(diagnosticResult.outputPath, 'utf8')
      );

      expect(diagnosticResult.error).toBeUndefined();
      expect(diagnosticResult.status).toBe(1);
      expect(diagnostic).toEqual(expect.objectContaining({
        statusId: 'blocked',
        authoritative: false,
        exporterId: 'completion_audit',
        runtimeEvidenceContract: expect.objectContaining({
          reasonIds: expect.arrayContaining([expectedReasonId]),
        }),
        nextStep: expect.objectContaining({
          stepId: 'regenerate_current_runtime_evidence',
        }),
      }));
      expect(JSON.stringify(diagnostic)).not.toContain(MANIFEST_PATHS[0]);
      expect(fs.existsSync(diagnosticResult.artifactOutputPath)).toBe(false);
    }
  );
});
