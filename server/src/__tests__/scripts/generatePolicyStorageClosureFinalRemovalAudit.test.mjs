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
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS,
} from '../../services/policyCompatibilityRemovalCompletionAudit.mjs';
import {
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';
import {
  POLICY_STORAGE_CLOSURE_FINAL_REMOVAL_AUDIT_STATUS_IDS,
} from '../../services/policyStorageClosureFinalRemovalAudit.mjs';
import {
  buildReadyExecutionPlanArtifact,
} from '../services/fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';
import {
  buildNextBatchAuthorizationPathStateSource,
} from '../services/fixtures/policyNextCompatibilityRemovalBatchAuthorizationFixtures.mjs';

const GENERATOR_PATH = fileURLToPath(
  new URL('../../../../scripts/generate-policy-storage-closure-final-removal-audit.mjs', import.meta.url)
);
const REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const MANIFEST_PATHS = Object.freeze([
  'server/src/services/retiredCompatibilityService.mjs',
  'client/src/components/RetiredCompatibilityPanel.vue',
]);

function writeFile(rootPath, repositoryPath, content) {
  const filePath = path.join(rootPath, repositoryPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeJson(rootPath, fileName, value) {
  const filePath = path.join(rootPath, '.artifacts', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function buildExecutionPlan() {
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
      entryCount: MANIFEST_PATHS.length,
      entries: MANIFEST_PATHS.map(path => ({
        categoryId: 'legacy_compatibility_path',
        actionId: 'delete_file',
        path,
        replacementEvidence: {
          replacementPath: 'server/src/services/policyNativeIntentProjection.mjs',
        },
        ready: true,
      })),
    },
  };
}

function buildRuntimeEvidenceArtifact() {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      applied: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      removalReview: { reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT },
      applyBatch: {
        requestedCount: MANIFEST_PATHS.length,
        results: MANIFEST_PATHS.map(path => ({
          path,
          actionId: 'delete_file',
          applied: true,
        })),
      },
    },
    importScan: {
      completed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      checkedPaths: MANIFEST_PATHS,
      references: [],
    },
    runtimeChecks: [{
      checkId: 'policy-runtime-imports',
      passed: true,
      reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
    }],
    validationEvidence: {
      focused: {
        command: 'focused runtime validation',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      full: {
        command: 'full runtime validation',
        passed: true,
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
    },
  });
}

async function buildArtifactChain({
  useCrossArtifactPathStateEvidence = false,
} = {}) {
  const executionPlan = buildExecutionPlan();
  const executionPlanArtifact = buildReadyExecutionPlanArtifact({
    executionPlan,
    generatedAt: '2026-07-15T12:00:00.000Z',
  });
  const pathStateSource = buildNextBatchAuthorizationPathStateSource({
    executionPlan,
    executionPlanArtifact,
    existingPaths: [],
    generatedAt: '2026-07-15T12:01:00.000Z',
  });
  const nextBatchAuthorizationArtifact =
    await buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
      runtimeEvidenceArtifact: buildRuntimeEvidenceArtifact(),
      ...pathStateSource,
      input: {
        requestedPaths: [],
        maxBatchSize: MANIFEST_PATHS.length,
        authorizationReason: '',
        authorizedBy: '',
        reviewArtifactFingerprint: REVIEW_ARTIFACT_FINGERPRINT,
      },
      generatedAt: '2026-07-15T12:02:00.000Z',
    });
  const pathStateEvidence = useCrossArtifactPathStateEvidence
    ? buildNextBatchAuthorizationPathStateSource({
      executionPlan,
      executionPlanArtifact: buildReadyExecutionPlanArtifact({
        executionPlan,
        generatedAt: '2026-07-15T12:03:00.000Z',
      }),
      existingPaths: [],
      generatedAt: '2026-07-15T12:03:00.000Z',
    }).pathStateEvidence
    : pathStateSource.pathStateEvidence;

  return {
    executionPlanArtifact,
    pathStateEvidence,
    nextBatchAuthorizationArtifact,
    validationEvidence: {
      focused: { command: 'focused closure validation', passed: true },
      full: { command: 'full closure validation', passed: true },
    },
  };
}

function runGenerator({
  fixtureRoot,
  artifactChain,
} = {}) {
  const executionPlanArtifactPath = writeJson(
    fixtureRoot,
    'execution-plan-artifact.json',
    artifactChain.executionPlanArtifact
  );
  const pathStateEvidencePath = writeJson(
    fixtureRoot,
    'path-state-evidence.json',
    artifactChain.pathStateEvidence
  );
  const nextBatchAuthorizationArtifactPath = writeJson(
    fixtureRoot,
    'next-batch-authorization-artifact.json',
    artifactChain.nextBatchAuthorizationArtifact
  );
  const validationEvidencePath = writeJson(
    fixtureRoot,
    'validation-evidence.json',
    artifactChain.validationEvidence
  );
  const outputPath = path.join(fixtureRoot, '.artifacts', 'final-removal-audit.json');
  const result = spawnSync(process.execPath, [
    GENERATOR_PATH,
    '--cwd', fixtureRoot,
    '--execution-plan-artifact', executionPlanArtifactPath,
    '--path-state-evidence', pathStateEvidencePath,
    '--next-batch-authorization-artifact', nextBatchAuthorizationArtifactPath,
    '--review-artifact-fingerprint', REVIEW_ARTIFACT_FINGERPRINT,
    '--validation-evidence', validationEvidencePath,
    '--output', outputPath,
    '--require-complete',
  ], {
    encoding: 'utf8',
  });

  return {
    ...result,
    outputPath,
    stdoutJson: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

describe('generate-policy-storage-closure-final-removal-audit', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'classifarr-final-removal-audit-')
    );
    writeFile(
      fixtureRoot,
      'server/src/services/currentNativeIntentService.mjs',
      'export const currentNativeIntentService = true;\n'
    );
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('completes a replay-verified artifact chain without source or storage mutation', async () => {
    const result = runGenerator({
      fixtureRoot,
      artifactChain: await buildArtifactChain(),
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      complete: true,
      statusId: POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS.COMPLETE,
      finalImportScan: expect.objectContaining({
        completed: true,
        checkedPaths: MANIFEST_PATHS,
        references: [],
      }),
    }));
    expect(result.stdoutJson.audit.sideEffects).toEqual({
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
      manifestWritten: false,
      gitCommandsRun: false,
    });
    expect(JSON.parse(fs.readFileSync(result.outputPath, 'utf8'))).toEqual(
      expect.objectContaining({ complete: true })
    );
    expect(fs.readFileSync(
      path.join(fixtureRoot, 'server/src/services/currentNativeIntentService.mjs'),
      'utf8'
    )).toBe('export const currentNativeIntentService = true;\n');
  });

  test('fails closed when the current source scan finds a live manifest import', async () => {
    writeFile(
      fixtureRoot,
      'server/src/routes/currentPolicyRoute.mjs',
      "import '../services/retiredCompatibilityService.mjs';\n"
    );

    const result = runGenerator({
      fixtureRoot,
      artifactChain: await buildArtifactChain(),
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      complete: false,
      statusId: POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_STATUS_IDS
        .BLOCKED_BY_FINAL_SCAN,
      finalImportScan: expect.objectContaining({
        references: [expect.objectContaining({
          path: MANIFEST_PATHS[0],
          referencedBy: 'server/src/routes/currentPolicyRoute.mjs',
        })],
      }),
    }));
    expect(result.stdoutJson.audit.finalImportScan.referenceCount).toBe(1);
    expect(result.stdoutJson.audit.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: 'final_scan_reference_found',
        path: MANIFEST_PATHS[0],
        referencedBy: 'server/src/routes/currentPolicyRoute.mjs',
      }),
    ]));
  });

  test('fails closed when the supplied checkout snapshot belongs to another plan artifact', async () => {
    const result = runGenerator({
      fixtureRoot,
      artifactChain: await buildArtifactChain({
        useCrossArtifactPathStateEvidence: true,
      }),
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      complete: false,
      statusId: POLICY_STORAGE_CLOSURE_FINAL_REMOVAL_AUDIT_STATUS_IDS
        .BLOCKED_BY_PATH_STATE_EVIDENCE,
      pathStateEvidenceBinding: expect.objectContaining({
        artifactFingerprintMatches: false,
        ok: false,
      }),
    }));
  });
});
