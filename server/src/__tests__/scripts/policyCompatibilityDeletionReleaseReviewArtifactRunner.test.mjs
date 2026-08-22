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

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION,
} from '../../services/policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs';
import {
  buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint,
} from '../../services/policyCompatibilityDeletionReleasePrerequisiteEvidence.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES,
  runPolicyCompatibilityDeletionReleaseReviewArtifact,
} from '../../../../scripts/lib/policyCompatibilityDeletionReleaseReviewArtifactRunner.mjs';

const EVIDENCE_TIME = '2026-08-22T12:00:00.000Z';

function writeJson(rootPath, fileName, value) {
  const filePath = path.join(rootPath, fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function currentEvidenceBundle() {
  const evidence = {
    currentPolicyInventory: {
      version: 'policy.compatibility_deletion_current_inventory.v1',
      generatedAt: EVIDENCE_TIME,
      statusId: 'all_enabled_policies_native',
      validationOk: true,
      unconvertedPolicyCount: 0,
    },
    reconciliationStateInventory: {
      version: 'policy.compatibility_deletion_reconciliation_state_inventory.v1',
      generatedAt: EVIDENCE_TIME,
      statusId: 'no_requires_maintenance_states',
      validationOk: true,
      requiresMaintenanceStateCount: 0,
    },
    cutoverVerification: {
      version: 'policy.native_runtime_cutover_verification.v1',
      generatedAt: EVIDENCE_TIME,
      statusId: 'ready_for_cutover_monitoring',
      validationOk: true,
    },
    deletionGatePlan: {
      version: 'policy.compatibility_deletion_gates.v1',
      generatedAt: EVIDENCE_TIME,
      statusId: 'ready_to_delete',
      validationOk: true,
      unconvertedPolicyCount: 0,
      requiresMaintenanceStateCount: 0,
    },
    backupRestoreEvidence: {
      version: 'policy.backup_restore_verification_evidence.v1',
      generatedAt: EVIDENCE_TIME,
      statusId: 'verified',
      validationOk: true,
      backupRestoreVerified: true,
      latestVerifiedAt: EVIDENCE_TIME,
    },
  };
  const residualCompatibilityReferences = [];

  return {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION,
    generatedAt: EVIDENCE_TIME,
    statusId: 'blocked_by_readiness',
    readyForExecutionPlan: false,
    riskCount: 1,
    risks: [{ riskId: 'release_prerequisite_evidence_not_ready' }],
    freshness: { maximumEvidenceAgeMs: 300000 },
    evidence,
    deletionReadiness: {
      residualCompatibilityReferences,
      releasePrerequisiteContextFingerprint:
        buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint({
          ...evidence,
          residualCompatibilityReferences,
        }),
    },
  };
}

describe('policyCompatibilityDeletionReleaseReviewArtifactRunner', () => {
  let fixtureRoot;
  let stderr;
  let stdout;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'classifarr-release-review-artifact-')
    );
    stderr = [];
    stdout = [];
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  function run(argv, now = EVIDENCE_TIME) {
    return runPolicyCompatibilityDeletionReleaseReviewArtifact({
      argv,
      cwd: fixtureRoot,
      now,
      stderr: message => stderr.push(message),
      stdout: message => stdout.push(message),
    });
  }

  test('writes one bounded non-approving review artifact under .tmp', () => {
    writeJson(fixtureRoot, 'input/current-evidence.json', currentEvidenceBundle());

    const outcome = run([
      '--input', 'input/current-evidence.json',
      '--output', '.tmp/release-review/request.json',
      '--generated-at', EVIDENCE_TIME,
    ]);
    const outputPath = path.join(fixtureRoot, '.tmp/release-review/request.json');
    const artifact = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    expect(outcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES.SUCCESS);
    expect(artifact).toEqual(expect.objectContaining({
      reviewRequired: true,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(JSON.stringify(artifact)).not.toContain('approvedBy');
    expect(stderr).toEqual([]);
    expect(stdout).toHaveLength(1);
  });

  test('retains a blocked stale-source diagnostic without treating it as a review request', () => {
    writeJson(fixtureRoot, 'input/current-evidence.json', currentEvidenceBundle());

    const outcome = run([
      '--input', 'input/current-evidence.json',
      '--output', '.tmp/release-review/stale-request.json',
      '--generated-at', '2026-08-22T12:05:00.001Z',
    ], '2026-08-22T12:05:00.001Z');

    expect(outcome.exitCode)
      .toBe(POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES.BLOCKED);
    expect(outcome.artifact.reviewRequired).toBe(false);
    expect(outcome.artifact.sourceRisks).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'evidence_bundle_stale' }),
    ]));
    expect(outcome.artifact.validation.ok).toBe(true);
  });

  test('rejects unsafe outputs and malformed input without echoing supplied values', () => {
    writeJson(fixtureRoot, 'input/current-evidence.json', currentEvidenceBundle());

    const outsideOutput = run([
      '--input', 'input/current-evidence.json',
      '--output', 'release-review.json',
    ]);
    const malformedOption = run([
      '--unknown', 'api-key=never-log-this',
    ]);

    expect(outsideOutput.exitCode).toBe(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES
        .INPUT_OR_OUTPUT_ERROR
    );
    expect(malformedOption.exitCode).toBe(
      POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES
        .INPUT_OR_OUTPUT_ERROR
    );
    expect(stderr.join('\n')).toContain('Review artifact output must be a new JSON file under .tmp.');
    expect(stderr.join('\n')).toContain('Unsupported command argument.');
    expect(stderr.join('\n')).not.toContain('api-key=never-log-this');
  });
});
