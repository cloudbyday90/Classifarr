/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

import {
  POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS,
  buildPolicyMigrationVerificationRunRecord,
  buildPolicyMigrationVerificationRunResult,
} from '../../services/policyMigrationVerificationRunContract.mjs';
import {
  POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS,
  POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS,
  buildPolicyLibraryRebuildCutoverAudit,
  validatePolicyLibraryRebuildCutoverResult,
} from '../../services/policyLibraryRebuildCutoverContract.mjs';
import {
  createPolicyLibraryRebuildCutoverOrchestrator,
} from '../../services/policyLibraryRebuildCutoverOrchestrator.mjs';
import {
  POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_VERSION,
} from '../../services/policyLibraryRebuildReplacementGate.mjs';
import {
  POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS,
  POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_VERSION,
} from '../../services/policyLibraryRebuildSnapshotGate.mjs';
import {
  readyCoordinatorResult,
} from '../helpers/policyMigrationVerificationRunFixture.mjs';

const NOW = '2026-07-29T14:00:00.000Z';
const FINGERPRINTS = Object.freeze({
  transition: 'a'.repeat(64),
  proposal: 'b'.repeat(64),
  rollback: 'c'.repeat(64),
  verifier: 'd'.repeat(64),
});

function proposal() {
  return { proposalFingerprint: FINGERPRINTS.proposal };
}

function transition() {
  return {
    policyContext: { policyId: 44, intentId: 101, libraryId: 6 },
    transitionFingerprint: { fingerprint: FINGERPRINTS.transition },
    proposalFingerprint: { fingerprint: FINGERPRINTS.proposal },
    rollbackPlanFingerprint: { fingerprint: FINGERPRINTS.rollback },
    replayProtection: { idempotencyKey: 'policy:rebuild:44:1' },
  };
}

function snapshotResult(statusId, overrides = {}) {
  const persisted = statusId === POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS
    .ROLLBACK_SNAPSHOT_PERSISTED;
  const reused = statusId === POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ALREADY_PERSISTED;

  return {
    version: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_VERSION,
    statusId,
    evaluatedAt: NOW,
    execution: persisted || reused ? {
      gateId: 801,
      policyId: 44,
      intentId: 101,
      libraryId: 6,
      stateId: 'snapshot_persisted',
      transitionFingerprint: FINGERPRINTS.transition,
      proposalFingerprint: FINGERPRINTS.proposal,
      rollbackPlanFingerprint: FINGERPRINTS.rollback,
      verificationRunId: 701,
      verificationRunFingerprint: FINGERPRINTS.verifier,
      rollbackSnapshotId: 901,
      migrationEventId: 951,
      idempotent: reused,
    } : null,
    application: {
      canEnterMigrationVerification: true,
      canApplyReplacement: false,
      persistedRollbackSnapshotPresent: persisted || reused,
      replacementBlockedReason: 'migration_verification_required',
    },
    sideEffects: {
      acceptancePersisted: persisted,
      rollbackSnapshotCreated: persisted,
      migrationEventWritten: persisted,
      policyReplaced: false,
      policyDeleted: false,
      routingWritten: false,
      learningWritten: false,
    },
    validation: persisted || reused
      ? { ok: true, issueCount: 0, issues: [] }
      : {
        ok: false,
        issueCount: 1,
        issues: [{ riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.VERIFICATION_RUN_MISSING }],
      },
    ...overrides,
  };
}

function replacementResult(statusId, overrides = {}) {
  const applied = statusId === POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.REPLACEMENT_APPLIED;
  const reused = statusId === POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.ALREADY_APPLIED;

  return {
    version: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_VERSION,
    statusId,
    evaluatedAt: NOW,
    execution: applied || reused ? {
      gateId: 801,
      policyId: 44,
      originalIntentId: 101,
      replacementIntentId: 202,
      replacementEventId: 303,
      rollbackSnapshotId: 901,
      transitionFingerprint: FINGERPRINTS.transition,
      proposalFingerprint: FINGERPRINTS.proposal,
      verificationRunId: 701,
      verificationRunFingerprint: FINGERPRINTS.verifier,
      verificationRunStatusId: 'no_migration_differences',
      appliedAt: NOW,
      idempotent: reused,
    } : null,
    application: {
      replacementApplied: applied || reused,
      canApplyReplacement: false,
      legacyPathsDeleted: false,
    },
    sideEffects: {
      nativeIntentCreated: applied,
      nativeRulesWritten: applied,
      routingWritten: applied,
      validationWritten: applied,
      migrationEventWritten: applied,
      policyReplaced: applied,
      legacyPathsDeleted: false,
    },
    validation: applied || reused
      ? { ok: true, issueCount: 0, issues: [] }
      : { ok: false, issueCount: 1, issues: [{ riskId: 'replacement_blocked' }] },
    ...overrides,
  };
}

function persistedHandoff(statusId = POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTED) {
  const coordinatorResult = readyCoordinatorResult();
  const record = buildPolicyMigrationVerificationRunRecord(coordinatorResult);

  return buildPolicyMigrationVerificationRunResult({
    statusId,
    coordinatorResult,
    verificationRun: { ...record, id: 701 },
  });
}

function createOrchestrator({
  snapshotResponses = [],
  handoffResult = persistedHandoff(),
  replacement = replacementResult(POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.REPLACEMENT_APPLIED),
} = {}) {
  const persistRollbackSnapshot = jest.fn();
  for (const response of snapshotResponses) {
    persistRollbackSnapshot.mockResolvedValueOnce(response);
  }

  const recordMigrationVerificationRun = jest.fn().mockResolvedValue(handoffResult);
  const applyReplacement = jest.fn().mockResolvedValue(replacement);
  const dbClient = { withTransaction: jest.fn() };
  const orchestrator = createPolicyLibraryRebuildCutoverOrchestrator({
    dbClient,
    verificationRunHandoff: { recordMigrationVerificationRun },
    persistRollbackSnapshot,
    applyReplacement,
  });

  return {
    orchestrator,
    persistRollbackSnapshot,
    recordMigrationVerificationRun,
    applyReplacement,
  };
}

describe('policyLibraryRebuildCutoverOrchestrator', () => {
  test('persists one receipt only when the snapshot gate reports it missing, then cuts over', async () => {
    const { orchestrator, persistRollbackSnapshot, recordMigrationVerificationRun, applyReplacement } =
      createOrchestrator({
        snapshotResponses: [
          snapshotResult(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_VERIFICATION_RUN),
          snapshotResult(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ROLLBACK_SNAPSHOT_PERSISTED),
        ],
      });

    const result = await orchestrator.run({ proposal: proposal(), transition: transition(), now: NOW });

    expect(result.statusId).toBe(POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.CUTOVER_APPLIED);
    expect(result.checkpoints).toEqual({
      verification: 'persisted',
      rollbackSnapshot: 'persisted',
      replacement: 'applied',
    });
    expect(recordMigrationVerificationRun).toHaveBeenCalledWith(expect.objectContaining({
      acceptanceTransition: transition(),
      now: new Date(NOW),
    }));
    expect(persistRollbackSnapshot).toHaveBeenCalledTimes(2);
    expect(applyReplacement).toHaveBeenCalledTimes(1);
    expect(validatePolicyLibraryRebuildCutoverResult(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
    expect(JSON.stringify(result)).not.toContain('representativeClassifications');
  });

  test('reuses an existing snapshot and receipt without rerunning verification', async () => {
    const { orchestrator, persistRollbackSnapshot, recordMigrationVerificationRun, applyReplacement } =
      createOrchestrator({
        snapshotResponses: [
          snapshotResult(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ALREADY_PERSISTED),
        ],
        replacement: replacementResult(POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.ALREADY_APPLIED),
      });

    const result = await orchestrator.run({ proposal: proposal(), transition: transition(), now: NOW });

    expect(result.statusId).toBe(POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.ALREADY_APPLIED);
    expect(result.checkpoints).toEqual({
      verification: 'existing_receipt',
      rollbackSnapshot: 'reused',
      replacement: 'reused',
    });
    expect(persistRollbackSnapshot).toHaveBeenCalledTimes(1);
    expect(recordMigrationVerificationRun).not.toHaveBeenCalled();
    expect(applyReplacement).toHaveBeenCalledTimes(1);
    expect(result.sideEffects).toEqual(expect.objectContaining({
      replacementApplied: false,
      routingWritten: false,
      policyDeleted: false,
      legacyDeletionAuthorized: false,
      idempotentReplay: true,
    }));
  });

  test('does not replace or recompute a receipt when the snapshot gate finds invalid persisted evidence', async () => {
    const blockedSnapshot = snapshotResult(
      POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_VERIFICATION_RUN,
      {
        validation: {
          ok: false,
          issueCount: 1,
          issues: [{ riskId: 'verification_run_review_required' }],
        },
      },
    );
    const { orchestrator, recordMigrationVerificationRun, applyReplacement } = createOrchestrator({
      snapshotResponses: [blockedSnapshot],
    });

    const result = await orchestrator.run({ proposal: proposal(), transition: transition(), now: NOW });

    expect(result.statusId).toBe(POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.SNAPSHOT_BLOCKED);
    expect(recordMigrationVerificationRun).not.toHaveBeenCalled();
    expect(applyReplacement).not.toHaveBeenCalled();
    expect(result.stop).toEqual({
      stageId: 'rollback_snapshot',
      reasonId: POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.SNAPSHOT_BLOCKED,
    });
  });

  test('stops before snapshot retry and replacement when receipt persistence is not ready', async () => {
    const { orchestrator, persistRollbackSnapshot, applyReplacement } = createOrchestrator({
      snapshotResponses: [
        snapshotResult(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_VERIFICATION_RUN),
      ],
      handoffResult: buildPolicyMigrationVerificationRunResult({
        statusId: POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.NOT_READY,
      }),
    });

    const result = await orchestrator.run({ proposal: proposal(), transition: transition(), now: NOW });

    expect(result.statusId).toBe(POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.VERIFICATION_NOT_READY);
    expect(persistRollbackSnapshot).toHaveBeenCalledTimes(1);
    expect(applyReplacement).not.toHaveBeenCalled();
  });

  test('stops before replacement when receipt persistence succeeds but snapshot persistence does not', async () => {
    const blockedSnapshot = snapshotResult(
      POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
      {
        validation: {
          ok: false,
          issueCount: 1,
          issues: [{ riskId: 'policy_context_not_current' }],
        },
      },
    );
    const { orchestrator, applyReplacement } = createOrchestrator({
      snapshotResponses: [
        snapshotResult(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_VERIFICATION_RUN),
        blockedSnapshot,
      ],
    });

    const result = await orchestrator.run({ proposal: proposal(), transition: transition(), now: NOW });

    expect(result.statusId).toBe(POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.SNAPSHOT_BLOCKED);
    expect(result.checkpoints.verification).toBe('persisted');
    expect(applyReplacement).not.toHaveBeenCalled();
  });

  test('continues from a replayed receipt and stops compactly when replacement is blocked', async () => {
    const { orchestrator, recordMigrationVerificationRun } = createOrchestrator({
      snapshotResponses: [
        snapshotResult(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_VERIFICATION_RUN),
        snapshotResult(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ALREADY_PERSISTED),
      ],
      handoffResult: persistedHandoff(POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.REPLAYED),
      replacement: replacementResult(
        POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
      ),
    });

    const result = await orchestrator.run({ proposal: proposal(), transition: transition(), now: NOW });

    expect(result.statusId).toBe(POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.REPLACEMENT_BLOCKED);
    expect(result.checkpoints).toEqual({
      verification: 'replayed',
      rollbackSnapshot: 'reused',
      replacement: 'not_applied',
    });
    expect(recordMigrationVerificationRun).toHaveBeenCalledTimes(1);
    expect(result.sideEffects).toEqual(expect.objectContaining({
      replacementApplied: false,
      routingWritten: false,
      policyDeleted: false,
      legacyDeletionAuthorized: false,
    }));
  });

  test('fails closed on unsafe stage side effects and keeps legacy deletion disabled', async () => {
    const unsafeSnapshot = snapshotResult(
      POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ALREADY_PERSISTED,
      { sideEffects: { routingWritten: true } },
    );
    const { orchestrator, recordMigrationVerificationRun, applyReplacement } = createOrchestrator({
      snapshotResponses: [unsafeSnapshot],
    });

    const result = await orchestrator.run({ proposal: proposal(), transition: transition(), now: NOW });

    expect(result.statusId).toBe(POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.FAILED);
    expect(result.stop).toEqual({
      stageId: 'cutover',
      reasonId: POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.UNSAFE_SNAPSHOT_GATE,
    });
    expect(recordMigrationVerificationRun).not.toHaveBeenCalled();
    expect(applyReplacement).not.toHaveBeenCalled();
    expect(result.sideEffects.legacyDeletionAuthorized).toBe(false);
    expect(result.sideEffects.policyDeleted).toBe(false);
  });

  test('audits its compact output and points to the legacy deletion readiness gate', async () => {
    const { orchestrator } = createOrchestrator({
      snapshotResponses: [
        snapshotResult(POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ALREADY_PERSISTED),
      ],
    });
    const result = await orchestrator.run({ proposal: proposal(), transition: transition(), now: NOW });
    const audit = buildPolicyLibraryRebuildCutoverAudit(result);

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      legacyDeletionAuthorized: false,
      nextStep: expect.objectContaining({
        stepId: 'library_rebuild_legacy_deletion_readiness_gate',
      }),
    }));
  });
});
