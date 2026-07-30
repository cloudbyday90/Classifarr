/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import {
  POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS,
  validatePolicyMigrationVerificationRunResult,
} from './policyMigrationVerificationRunContract.mjs';
import {
  createPolicyMigrationVerificationRunHandoff,
} from './policyMigrationVerificationRunHandoff.mjs';
import {
  POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS,
  POLICY_LIBRARY_REBUILD_CUTOVER_STAGE_IDS,
  POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS,
  buildPolicyLibraryRebuildCutoverResult,
  validatePolicyLibraryRebuildCutoverResult,
} from './policyLibraryRebuildCutoverContract.mjs';
import {
  POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS,
  applyPolicyLibraryRebuildReplacement,
  validatePolicyLibraryRebuildReplacementGate,
} from './policyLibraryRebuildReplacementGate.mjs';
import {
  POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS,
  POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS,
  persistPolicyLibraryRebuildRollbackSnapshot,
  validatePolicyLibraryRebuildSnapshotGate,
} from './policyLibraryRebuildSnapshotGate.mjs';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeExecutionTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasRisk(result, riskId) {
  return asObject(asObject(result).validation).issues?.some(
    issue => asObject(issue).riskId === riskId,
  ) === true;
}

function snapshotHasForbiddenSideEffect(result) {
  const snapshot = asObject(result);
  const application = asObject(snapshot.application);
  const sideEffects = asObject(snapshot.sideEffects);

  return application.canApplyReplacement === true ||
    sideEffects.policyReplaced === true ||
    sideEffects.policyDeleted === true ||
    sideEffects.routingWritten === true ||
    sideEffects.learningWritten === true;
}

function replacementHasForbiddenSideEffect(result) {
  const replacement = asObject(result);
  const application = asObject(replacement.application);
  const sideEffects = asObject(replacement.sideEffects);

  return application.legacyPathsDeleted === true ||
    sideEffects.legacyPathsDeleted === true;
}

function isSnapshotReady(result) {
  return [
    POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ROLLBACK_SNAPSHOT_PERSISTED,
    POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ALREADY_PERSISTED,
  ].includes(asObject(result).statusId) &&
    validatePolicyLibraryRebuildSnapshotGate(result).ok === true &&
    !snapshotHasForbiddenSideEffect(result);
}

function needsVerificationReceipt(result) {
  return asObject(result).statusId ===
    POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_VERIFICATION_RUN &&
    hasRisk(result, POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.VERIFICATION_RUN_MISSING) &&
    !snapshotHasForbiddenSideEffect(result);
}

function isReplacementApplied(result) {
  return [
    POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.REPLACEMENT_APPLIED,
    POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.ALREADY_APPLIED,
  ].includes(asObject(result).statusId) &&
    validatePolicyLibraryRebuildReplacementGate(result).ok === true &&
    !replacementHasForbiddenSideEffect(result);
}

function buildBoundaryUnavailableResult(now) {
  return buildPolicyLibraryRebuildCutoverResult({
    statusId: POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.ORCHESTRATION_BOUNDARY_UNAVAILABLE,
    now,
    stop: {
      stageId: POLICY_LIBRARY_REBUILD_CUTOVER_STAGE_IDS.CUTOVER,
      reasonId: POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.ORCHESTRATION_BOUNDARY_REQUIRED,
    },
  });
}

function buildFailedResult(now, riskId) {
  return buildPolicyLibraryRebuildCutoverResult({
    statusId: POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.FAILED,
    now,
    stop: {
      stageId: POLICY_LIBRARY_REBUILD_CUTOVER_STAGE_IDS.CUTOVER,
      reasonId: riskId,
    },
  });
}

function buildSnapshotBlockedResult({ now, snapshotResult, checkpoints }) {
  return buildPolicyLibraryRebuildCutoverResult({
    statusId: asObject(snapshotResult).statusId ===
      POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_TRANSITION
      ? POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.BLOCKED_BY_TRANSITION
      : POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.SNAPSHOT_BLOCKED,
    now,
    checkpoints,
    stop: {
      stageId: POLICY_LIBRARY_REBUILD_CUTOVER_STAGE_IDS.ROLLBACK_SNAPSHOT,
      reasonId: POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.SNAPSHOT_BLOCKED,
    },
  });
}

function buildVerificationStoppedResult({ now, handoffResult }) {
  const handoffValidation = validatePolicyMigrationVerificationRunResult(handoffResult);

  if (!handoffValidation.ok) {
    return buildFailedResult(now, POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.UNSAFE_VERIFICATION_HANDOFF);
  }

  return buildPolicyLibraryRebuildCutoverResult({
    statusId: POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.VERIFICATION_NOT_READY,
    now,
    checkpoints: {
      verification: 'not_attempted',
    },
    stop: {
      stageId: POLICY_LIBRARY_REBUILD_CUTOVER_STAGE_IDS.VERIFICATION,
      reasonId: POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.VERIFICATION_NOT_READY,
    },
  });
}

function buildReplacementStoppedResult({ now, replacementResult, checkpoints }) {
  if (replacementHasForbiddenSideEffect(replacementResult)) {
    return buildFailedResult(now, POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.UNSAFE_REPLACEMENT_GATE);
  }

  return buildPolicyLibraryRebuildCutoverResult({
    statusId: POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.REPLACEMENT_BLOCKED,
    now,
    checkpoints,
    stop: {
      stageId: POLICY_LIBRARY_REBUILD_CUTOVER_STAGE_IDS.REPLACEMENT,
      reasonId: POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.REPLACEMENT_BLOCKED,
    },
  });
}

function buildCompletedResult({ now, replacementResult, checkpoints }) {
  const replacement = asObject(replacementResult);
  const replacementApplied = replacement.statusId ===
    POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.REPLACEMENT_APPLIED;
  const result = buildPolicyLibraryRebuildCutoverResult({
    statusId: replacementApplied
      ? POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.CUTOVER_APPLIED
      : POLICY_LIBRARY_REBUILD_CUTOVER_STATUS_IDS.ALREADY_APPLIED,
    now,
    execution: replacement.execution,
    checkpoints: {
      ...checkpoints,
      replacement: replacementApplied ? 'applied' : 'reused',
    },
  });

  return validatePolicyLibraryRebuildCutoverResult(result).ok
    ? result
    : buildFailedResult(now, POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.UNSAFE_CUTOVER_OUTPUT);
}

function createPolicyLibraryRebuildCutoverOrchestrator({
  dbClient = defaultDb,
  verificationRunHandoff = createPolicyMigrationVerificationRunHandoff({ db: dbClient }),
  persistRollbackSnapshot = persistPolicyLibraryRebuildRollbackSnapshot,
  applyReplacement = applyPolicyLibraryRebuildReplacement,
} = {}) {
  async function persistSnapshot({ proposal, transition, now }) {
    return persistRollbackSnapshot({
      dbClient,
      proposal: deepClone(proposal),
      transition: deepClone(transition),
      now,
    });
  }

  async function run({ proposal = {}, transition = {}, now = new Date() } = {}) {
    const executionTime = normalizeExecutionTime(now);
    if (!executionTime) {
      return buildFailedResult(new Date(), POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.INVALID_EXECUTION_TIME);
    }

    if (typeof dbClient?.withTransaction !== 'function' ||
        typeof verificationRunHandoff?.recordMigrationVerificationRun !== 'function' ||
        typeof persistRollbackSnapshot !== 'function' || typeof applyReplacement !== 'function') {
      return buildBoundaryUnavailableResult(executionTime);
    }

    const trustedProposal = deepClone(proposal);
    const trustedTransition = deepClone(transition);
    let snapshotResult;
    let verificationCheckpoint = 'existing_receipt';

    try {
      // The snapshot gate is the durable retry checkpoint. A valid persisted
      // receipt/snapshot proceeds without invoking the verifier again.
      snapshotResult = await persistSnapshot({
        proposal: trustedProposal,
        transition: trustedTransition,
        now: executionTime,
      });

      if (snapshotHasForbiddenSideEffect(snapshotResult)) {
        return buildFailedResult(executionTime, POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.UNSAFE_SNAPSHOT_GATE);
      }

      if (!isSnapshotReady(snapshotResult)) {
        if (!needsVerificationReceipt(snapshotResult)) {
          return buildSnapshotBlockedResult({
            now: executionTime,
            snapshotResult,
            checkpoints: { verification: 'not_attempted' },
          });
        }

        const handoffResult = await verificationRunHandoff.recordMigrationVerificationRun({
          proposal: deepClone(trustedProposal),
          acceptanceTransition: deepClone(trustedTransition),
          now: executionTime,
        });
        const handoffValidation = validatePolicyMigrationVerificationRunResult(handoffResult);
        if (!handoffValidation.ok || ![
          POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTED,
          POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.REPLAYED,
        ].includes(asObject(handoffResult).statusId)) {
          return buildVerificationStoppedResult({ now: executionTime, handoffResult });
        }

        verificationCheckpoint = asObject(handoffResult).statusId ===
          POLICY_MIGRATION_VERIFICATION_RUN_STATUS_IDS.PERSISTED
          ? 'persisted'
          : 'replayed';
        snapshotResult = await persistSnapshot({
          proposal: trustedProposal,
          transition: trustedTransition,
          now: executionTime,
        });
        if (snapshotHasForbiddenSideEffect(snapshotResult) || !isSnapshotReady(snapshotResult)) {
          return snapshotHasForbiddenSideEffect(snapshotResult)
            ? buildFailedResult(executionTime, POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.UNSAFE_SNAPSHOT_GATE)
            : buildSnapshotBlockedResult({
              now: executionTime,
              snapshotResult,
              checkpoints: { verification: verificationCheckpoint },
            });
        }
      }

      const snapshotCheckpoint = asObject(snapshotResult).statusId ===
        POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ROLLBACK_SNAPSHOT_PERSISTED
        ? 'persisted'
        : 'reused';
      const replacementResult = await applyReplacement({
        dbClient,
        proposal: deepClone(trustedProposal),
        transition: deepClone(trustedTransition),
        now: executionTime,
      });
      const checkpoints = {
        verification: verificationCheckpoint,
        rollbackSnapshot: snapshotCheckpoint,
      };

      if (!isReplacementApplied(replacementResult)) {
        return buildReplacementStoppedResult({ now: executionTime, replacementResult, checkpoints });
      }

      return buildCompletedResult({ now: executionTime, replacementResult, checkpoints });
    } catch {
      return buildFailedResult(
        executionTime,
        POLICY_LIBRARY_REBUILD_CUTOVER_RISK_IDS.UNEXPECTED_ORCHESTRATION_FAILURE,
      );
    }
  }

  return {
    run,
  };
}

export {
  createPolicyLibraryRebuildCutoverOrchestrator,
};
