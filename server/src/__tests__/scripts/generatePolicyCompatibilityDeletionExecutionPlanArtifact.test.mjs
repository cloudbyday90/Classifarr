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
  POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS,
  POLICY_COMPATIBILITY_DELETION_GATES_VERSION,
} from '../../services/policyCompatibilityDeletionGates.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION,
} from '../../services/policyCompatibilityDeletionCurrentInventory.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION,
} from '../../services/policyCompatibilityDeletionReconciliationStateInventory.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlanArtifact.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
} from '../../services/policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS,
  POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
} from '../../services/policyNativeRuntimeCutoverVerification.mjs';
import {
  buildPolicyBackupRestoreVerificationEvidence,
} from '../../services/policyBackupRestoreVerificationEvidence.mjs';
import {
  resolvePolicyStorageClosureExecutionPlanSource,
} from '../../services/policyStorageClosureExecutionPlanSource.mjs';
import {
  buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence,
} from '../helpers/policyCompatibilityDeletionReleasePrerequisiteEvidence.mjs';

const GENERATOR_PATH = fileURLToPath(
  new URL(
    '../../../../scripts/generate-policy-compatibility-deletion-execution-plan-artifact.mjs',
    import.meta.url
  )
);
const COLLECTION_TIME = '2026-07-15T12:00:00.000Z';
const GENERATED_AT = '2026-07-15T12:01:00.000Z';
const MANIFEST_PATH = 'client/src/components/policies/PolicyStarterTemplateAccelerator.vue';

function readyBackupRestoreEvidence() {
  return buildPolicyBackupRestoreVerificationEvidence({
    generatedAt: COLLECTION_TIME,
    record: {
      verification_version: 1,
      restore_mode: 'replace',
      backup_version: '2.0',
      verification_status: 'verified',
      schema_parity_verified: true,
      native_authority_verified: true,
      policy_library_mismatch_count: 0,
      verified_at: COLLECTION_TIME,
      restore_gate_state: 'ready',
      restore_gate_reason_id: 'restore_verified',
      restore_gate_verified_at: COLLECTION_TIME,
    },
  });
}

function writeJson(rootPath, fileName, value) {
  const filePath = path.join(rootPath, '.artifacts', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function readyEvidenceBundle() {
  const evidence = {
    currentPolicyInventory: {
      version: POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION,
      generatedAt: COLLECTION_TIME,
      statusId:
        POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS
          .ALL_ENABLED_POLICIES_NATIVE,
      allEnabledPoliciesNative: true,
      policyCounts: { unconvertedPolicyCount: 0 },
      validation: { ok: true },
    },
    reconciliationStateInventory: {
      version:
        POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION,
      generatedAt: COLLECTION_TIME,
      statusId:
        POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS
          .NO_REQUIRES_MAINTENANCE_STATES,
      hasNoRequiresMaintenanceStates: true,
      requiresMaintenanceStateCount: 0,
      validation: { ok: true },
    },
    cutoverVerification: {
      version: POLICY_NATIVE_RUNTIME_CUTOVER_VERIFICATION_VERSION,
      generatedAt: COLLECTION_TIME,
      statusId:
        POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS.READY_FOR_CUTOVER_MONITORING,
      validation: { ok: true },
    },
    deletionGatePlan: {
      version: POLICY_COMPATIBILITY_DELETION_GATES_VERSION,
      generatedAt: COLLECTION_TIME,
      statusId: 'ready_to_delete',
      readyToDelete: true,
      unconvertedPolicyCount: 0,
      requiresMaintenanceStateCount: 0,
      categories: [{
        categoryId: POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.CLIENT_BRIDGE_UI,
        paths: [MANIFEST_PATH],
        deletionIntent: 'Delete bridge-only UI after native replacement.',
      }],
      blockers: [],
      validation: { ok: true },
    },
    backupRestoreEvidence: readyBackupRestoreEvidence(),
  };

  return buildPolicyCompatibilityDeletionExecutionPlanEvidenceBundle({
    ...evidence,
    releasePrerequisiteEvidence:
      buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence(evidence, {
        generatedAt: COLLECTION_TIME,
      }),
    generatedAt: COLLECTION_TIME,
    now: COLLECTION_TIME,
  });
}

function readyInput(overrides = {}) {
  return {
    evidenceBundle: readyEvidenceBundle(),
    replacementEvidence: {
      [POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.CLIENT_BRIDGE_UI]: {
        replacement: 'Native policy builder destination context replaces this UI.',
        tests: ['PolicyBuilderLibraryContext.test.js'],
      },
    },
    rollbackStance:
      'Rollback snapshots remain available until the approved post-window stance.',
    supportStance:
      'Converted native policies use bounded support diagnostics after deletion.',
    manifestApproved: true,
    approvedBy: 'storage-closure-maintainer',
    ...overrides,
  };
}

function runGenerator({
  fixtureRoot,
  input,
  allowBlocked = false,
} = {}) {
  const inputPath = writeJson(fixtureRoot, 'execution-plan-input.json', input);
  const outputPath = path.join(fixtureRoot, '.artifacts', 'execution-plan.json');
  const artifactOutputPath = path.join(
    fixtureRoot,
    '.artifacts',
    'execution-plan-artifact.json'
  );
  const args = [
    GENERATOR_PATH,
    '--input', inputPath,
    '--output', outputPath,
    '--artifact-output', artifactOutputPath,
    '--generated-at', GENERATED_AT,
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

describe('generate-policy-compatibility-deletion-execution-plan-artifact', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'classifarr-execution-plan-artifact-')
    );
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('writes an authoritative wrapper artifact consumable by storage closure', () => {
    const result = runGenerator({
      fixtureRoot,
      input: readyInput(),
    });
    const executionPlan = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));
    const source = resolvePolicyStorageClosureExecutionPlanSource({
      executionPlanArtifact: artifact,
    });
    const rawPlanSource = resolvePolicyStorageClosureExecutionPlanSource({
      executionPlanArtifact: executionPlan,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      generatedAt: GENERATED_AT,
      statusId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.READY,
      ready: true,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(executionPlan).toEqual(artifact.executionPlan);
    expect(executionPlan.statusId).toBe(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE
    );
    expect(source).toEqual(expect.objectContaining({
      ok: true,
      manifestPaths: [MANIFEST_PATH],
    }));
    expect(rawPlanSource.ok).toBe(false);
    expect(Object.values(artifact.sideEffects).some(Boolean)).toBe(false);
  });

  test('does not write plan output for blocked input without the diagnostic override', () => {
    const result = runGenerator({
      fixtureRoot,
      input: readyInput({
        manifestApproved: false,
        approvedBy: null,
      }),
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdoutJson).toBeNull();
    expect(result.stderr).toContain('artifact is blocked');
    expect(result.stderr).toContain('execution_plan_not_ready');
    expect(fs.existsSync(result.outputPath)).toBe(false);
    expect(fs.existsSync(result.artifactOutputPath)).toBe(false);
  });

  test('writes a bounded blocked diagnostic only when explicitly requested', () => {
    const result = runGenerator({
      fixtureRoot,
      input: readyInput({
        manifestApproved: false,
        approvedBy: null,
      }),
      allowBlocked: true,
    });
    const artifact = JSON.parse(fs.readFileSync(result.artifactOutputPath, 'utf8'));
    const source = resolvePolicyStorageClosureExecutionPlanSource({
      executionPlanArtifact: artifact,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdoutJson).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.BLOCKED,
      ready: false,
      riskCount: expect.any(Number),
    }));
    expect(result.stdoutJson.riskCount).toBeGreaterThan(0);
    expect(fs.existsSync(result.outputPath)).toBe(true);
    expect(source.ok).toBe(false);
    expect(Object.values(artifact.sideEffects).some(Boolean)).toBe(false);
  });
});
