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
  EVIDENCE_REGENERATION_MANIFEST_PATHS,
  EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
  buildEvidenceRegenerationExecutionPlan,
  buildEvidenceRegenerationExecutionPlanArtifact,
  buildEvidenceRegenerationNextBatchAuthorizationArtifact,
  buildEvidenceRegenerationValidationEvidence,
} from '../services/fixtures/policyCompatibilityRemovalEvidenceRegenerationFixtures.mjs';

const GENERATOR_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/generate-policy-compatibility-removal-evidence.mjs',
    import.meta.url
  )
);
const GENERATED_AT = '2026-07-15T18:00:00.000Z';

function writeJson(rootPath, fileName, value) {
  const filePath = path.join(rootPath, '.artifacts', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

async function buildGeneratorInputs({
  plan = buildEvidenceRegenerationExecutionPlan(),
  appliedPaths = EVIDENCE_REGENERATION_MANIFEST_PATHS,
} = {}) {
  const executionPlanArtifact = buildEvidenceRegenerationExecutionPlanArtifact({
    executionPlan: plan,
  });
  return {
    executionPlanArtifact,
    nextBatchAuthorizationArtifact:
      await buildEvidenceRegenerationNextBatchAuthorizationArtifact({
        plan,
        executionPlanArtifact,
        appliedPaths,
      }),
    validationEvidence: buildEvidenceRegenerationValidationEvidence(),
  };
}

function runGenerator({
  fixtureRoot,
  executionPlanArtifact,
  nextBatchAuthorizationArtifact,
  reviewArtifactFingerprint = EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
  validationEvidence,
  allowBlocked = false,
  requireComplete = false,
} = {}) {
  const executionPlanArtifactPath = executionPlanArtifact === undefined
    ? null
    : writeJson(
      fixtureRoot,
      'execution-plan-artifact.json',
      executionPlanArtifact
    );
  const authorizationArtifactPath = nextBatchAuthorizationArtifact === undefined
    ? null
    : writeJson(
      fixtureRoot,
      'next-batch-authorization-artifact.json',
      nextBatchAuthorizationArtifact
    );
  const validationEvidencePath = validationEvidence === undefined
    ? null
    : writeJson(
      fixtureRoot,
      'validation-evidence.json',
      validationEvidence
    );
  const outputPath = path.join(fixtureRoot, '.artifacts', 'evidence.json');
  const artifactOutputPath = path.join(
    fixtureRoot,
    '.artifacts',
    'completion-audit-artifact.json'
  );
  const args = [
    GENERATOR_PATH,
    '--cwd', fixtureRoot,
    '--output', outputPath,
    '--completion-audit-artifact-output', artifactOutputPath,
    '--generated-at', GENERATED_AT,
  ];

  if (executionPlanArtifactPath) {
    args.push('--execution-plan-artifact', executionPlanArtifactPath);
  }
  if (authorizationArtifactPath) {
    args.push('--next-batch-authorization-artifact', authorizationArtifactPath);
  }
  if (reviewArtifactFingerprint !== '') {
    args.push('--review-artifact-fingerprint', reviewArtifactFingerprint);
  }
  if (validationEvidencePath) {
    args.push('--validation-evidence', validationEvidencePath);
  }

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

function writeOperationalReference(rootPath, manifestPath) {
  const consumerPath = path.join(rootPath, 'server', 'src', 'services', 'consumer.mjs');
  fs.mkdirSync(path.dirname(consumerPath), { recursive: true });
  fs.writeFileSync(
    consumerPath,
    `import '${manifestPath}';\nexport const consumer = true;\n`
  );
}

describe('generate-policy-compatibility-removal-evidence', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-evidence-regeneration-'));
    [
      'client/src',
      'server/src',
      'scripts',
      'database/migrations',
    ].forEach(repositoryPath => {
      fs.mkdirSync(path.join(fixtureRoot, repositoryPath), { recursive: true });
    });
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('exports one complete current evidence chain from coherent artifact inputs', async () => {
    const inputs = await buildGeneratorInputs();
    const result = runGenerator({ fixtureRoot, requireComplete: true, ...inputs });
    const evidence = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const completionAuditArtifact = JSON.parse(
      fs.readFileSync(result.artifactOutputPath, 'utf8')
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId:
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.COMPLETE,
      complete: true,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(evidence.completionAuditArtifact).toEqual(completionAuditArtifact);
    expect(evidence.pathState).toEqual(expect.objectContaining({
      existingCount: 0,
      removedCount: EVIDENCE_REGENERATION_MANIFEST_PATHS.length,
    }));
    expect(evidence.finalImportScan).toEqual(expect.objectContaining({
      completed: true,
      references: [],
    }));
  });

  test('keeps current remaining inventory observable while require-complete fails', async () => {
    const inputs = await buildGeneratorInputs({
      appliedPaths: [EVIDENCE_REGENERATION_MANIFEST_PATHS[1]],
    });
    const remainingPath = path.join(
      fixtureRoot,
      ...EVIDENCE_REGENERATION_MANIFEST_PATHS[0].split('/')
    );
    fs.mkdirSync(path.dirname(remainingPath), { recursive: true });
    fs.writeFileSync(remainingPath, 'export const retired = true;\n');

    const result = runGenerator({ fixtureRoot, requireComplete: true, ...inputs });
    const evidence = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId:
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS
          .REMAINING_INVENTORY,
      complete: false,
    }));
    expect(evidence.pathState.existingPaths)
      .toEqual([EVIDENCE_REGENERATION_MANIFEST_PATHS[0]]);
  });

  test('fails closed for predecessor plans and current operational references', async () => {
    const predecessorPlan = buildEvidenceRegenerationExecutionPlan({
      version: 'policy.compatibility_deletion_execution_plan.v0',
    });
    const predecessorInputs = await buildGeneratorInputs({ plan: predecessorPlan });
    const predecessorResult = runGenerator({ fixtureRoot, ...predecessorInputs });

    expect(predecessorResult.error).toBeUndefined();
    expect(predecessorResult.status).toBe(1);
    expect(predecessorResult.stdoutJson).toBeNull();
    expect(predecessorResult.stderr).toContain('evidence regeneration is blocked');
    expect(fs.existsSync(predecessorResult.outputPath)).toBe(false);
    expect(fs.existsSync(predecessorResult.artifactOutputPath)).toBe(false);

    const referenceInputs = await buildGeneratorInputs();
    writeOperationalReference(fixtureRoot, EVIDENCE_REGENERATION_MANIFEST_PATHS[0]);
    const referenceResult = runGenerator({ fixtureRoot, ...referenceInputs });

    expect(referenceResult.error).toBeUndefined();
    expect(referenceResult.status).toBe(1);
    expect(referenceResult.stdoutJson).toBeNull();
    expect(referenceResult.stderr).toContain('evidence regeneration is blocked');
    expect(fs.existsSync(referenceResult.outputPath)).toBe(false);
    expect(fs.existsSync(referenceResult.artifactOutputPath)).toBe(false);
  });

  test('fails closed when the current checkout cannot be fully scanned', async () => {
    const inputs = await buildGeneratorInputs();
    fs.rmSync(path.join(fixtureRoot, 'database'), { recursive: true, force: true });

    const result = runGenerator({ fixtureRoot, ...inputs });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toBeNull();
    expect(result.stderr).toContain('evidence regeneration is blocked');
    expect(result.stderr).toContain('source_scan_incomplete');
    expect(fs.existsSync(result.outputPath)).toBe(false);
    expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
  });

  test('writes bounded blocked diagnostics only with explicit operator allowance', async () => {
    const inputs = await buildGeneratorInputs();
    writeOperationalReference(fixtureRoot, EVIDENCE_REGENERATION_MANIFEST_PATHS[0]);

    const result = runGenerator({ fixtureRoot, allowBlocked: true, ...inputs });
    const evidence = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const completionAuditArtifact = JSON.parse(
      fs.readFileSync(result.artifactOutputPath, 'utf8')
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId:
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.BLOCKED,
      complete: false,
    }));
    expect(evidence.completionAuditArtifact).toEqual(completionAuditArtifact);
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'final_scan_reference_found' }),
    ]));
    expect(evidence.sideEffects).toEqual(expect.objectContaining({
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
      manifestWritten: false,
      gitCommandsRun: false,
    }));
  });

  test('reports missing approval-chain inputs only through explicit diagnostic allowance', () => {
    const strictResult = runGenerator({
      fixtureRoot,
      reviewArtifactFingerprint: '',
    });

    expect(strictResult.error).toBeUndefined();
    expect(strictResult.status).toBe(2);
    expect(strictResult.stdoutJson).toBeNull();
    expect(strictResult.stderr)
      .toContain('Missing required compatibility-removal evidence input(s)');
    expect(fs.existsSync(strictResult.outputPath)).toBe(false);
    expect(fs.existsSync(strictResult.artifactOutputPath)).toBe(false);

    const diagnosticResult = runGenerator({
      fixtureRoot,
      allowBlocked: true,
      reviewArtifactFingerprint: '',
    });
    const evidence = JSON.parse(fs.readFileSync(diagnosticResult.outputPath, 'utf8'));

    expect(diagnosticResult.error).toBeUndefined();
    expect(diagnosticResult.status).toBe(1);
    expect(diagnosticResult.stderr).toBe('');
    expect(diagnosticResult.stdoutJson).toEqual(expect.objectContaining({
      statusId:
        POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.BLOCKED,
      complete: false,
      inputEvidence: {
        executionPlanArtifactProvided: false,
        nextBatchAuthorizationArtifactProvided: false,
        reviewArtifactFingerprintProvided: false,
        validationEvidenceProvided: false,
      },
    }));
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'execution_plan_artifact_missing' }),
      expect.objectContaining({
        riskId: 'next_batch_authorization_artifact_missing',
      }),
      expect.objectContaining({ riskId: 'review_artifact_fingerprint_missing' }),
      expect.objectContaining({ riskId: 'validation_evidence_missing' }),
    ]));
    expect(evidence.sideEffects).toEqual(expect.objectContaining({
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
      manifestWritten: false,
      gitCommandsRun: false,
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
    expect(result.stderr).toContain('evidence regeneration is blocked');
    expect(result.stderr).toContain('execution_plan_artifact_invalid');
    expect(fs.existsSync(result.outputPath)).toBe(false);
    expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
  });
});
