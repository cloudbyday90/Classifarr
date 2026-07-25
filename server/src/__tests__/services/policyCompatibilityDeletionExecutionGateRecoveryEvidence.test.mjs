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

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_STATUS_IDS,
  buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidence,
  validatePolicyCompatibilityDeletionExecutionGateRecoveryEvidence,
} from '../../services/policyCompatibilityDeletionExecutionGateRecoveryEvidence.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  buildReadyBackupRestoreVerificationEvidence,
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';

function readyExecutionPlanArtifact({
  generatedAt = POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
} = {}) {
  return buildReadyExecutionPlanArtifact({
    generatedAt,
    executionPlan: {
      statusId: 'ready_for_execution_gate',
      readyForExecutionGate: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      manifest: { approved: true, entryCount: 0, entries: [] },
    },
  });
}

describe('policyCompatibilityDeletionExecutionGateRecoveryEvidence', () => {
  test('binds a current database-owned restore verification result to one execution-plan artifact', () => {
    const executionPlanArtifact = readyExecutionPlanArtifact();
    const evidence = buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidence({
      executionPlanArtifact,
      backupRestoreVerificationEvidence: buildReadyBackupRestoreVerificationEvidence(),
      generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_STATUS_IDS.READY);
    expect(evidence.ready).toBe(true);
    expect(evidence.validation.ok).toBe(true);
    expect(evidence.executionPlanArtifactFingerprint)
      .toBe(executionPlanArtifact.artifactFingerprint.fingerprint);
    expect(evidence.source).toEqual(expect.objectContaining({
      databaseOwned: true,
      sourceId: 'policy_backup_restore_verifications',
      actorRequired: false,
      rawBackupPayloadExposed: false,
      backupPathExposed: false,
    }));
    expect(evidence.artifactFingerprint.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  test('blocks recovery evidence collected before its execution-plan artifact', () => {
    const executionPlanArtifact = readyExecutionPlanArtifact({
      generatedAt: '2026-07-14T20:00:00.000Z',
    });
    const evidence = buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidence({
      executionPlanArtifact,
      backupRestoreVerificationEvidence: buildReadyBackupRestoreVerificationEvidence({
        generatedAt: '2026-07-14T19:59:58.000Z',
      }),
      generatedAt: '2026-07-14T19:59:58.000Z',
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_STATUS_IDS
        .BLOCKED_BY_FRESHNESS);
    expect(evidence.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
        .RECOVERY_EVIDENCE_PRECEDES_ARTIFACT,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
        .BACKUP_RESTORE_EVIDENCE_PRECEDES_ARTIFACT,
    ]));
  });

  test('blocks a non-verified persisted restore verification result', () => {
    const executionPlanArtifact = readyExecutionPlanArtifact();
    const evidence = buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidence({
      executionPlanArtifact,
      backupRestoreVerificationEvidence: {
        ...buildReadyBackupRestoreVerificationEvidence(),
        statusId: 'blocked_by_restore_gate',
        backupRestoreVerified: false,
      },
      generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    });

    expect(evidence.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_STATUS_IDS
        .BLOCKED_BY_RECOVERY_VERIFICATION);
    expect(evidence.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
        .BACKUP_RESTORE_EVIDENCE_NOT_VERIFIED,
    ]));
  });

  test('rejects an altered recovery evidence artifact during validation', () => {
    const executionPlanArtifact = readyExecutionPlanArtifact();
    const evidence = buildPolicyCompatibilityDeletionExecutionGateRecoveryEvidence({
      executionPlanArtifact,
      backupRestoreVerificationEvidence: buildReadyBackupRestoreVerificationEvidence(),
      generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    });
    const validation = validatePolicyCompatibilityDeletionExecutionGateRecoveryEvidence({
      ...evidence,
      source: { ...evidence.source, databaseOwned: false },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS.SOURCE_MISMATCH,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_RECOVERY_EVIDENCE_RISK_IDS
        .ARTIFACT_FINGERPRINT_INVALID,
    ]));
  });
});
