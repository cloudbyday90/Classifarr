/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS,
  validatePolicyLibraryRebuildAcceptanceTransition,
} from './policyLibraryRebuildAcceptanceTransition.mjs';
import {
  POLICY_LIBRARY_REBUILD_EXECUTION_STATE_IDS,
  createExecutionGate,
  createMigrationEvent,
  createRollbackSnapshot,
  expirePriorExecutionGates,
  findActiveExecutionForPolicy,
  findExecutionByIdempotencyKey,
  loadPolicyPresets,
  loadRoutingTarget,
  lockIntent,
  lockPolicy,
  markExecutionSnapshotPersisted,
} from './policyLibraryRebuildSnapshotPersistence.mjs';
import {
  POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS,
  loadPolicyLibraryRebuildVerificationRunBinding,
} from './policyLibraryRebuildVerificationRunBinding.mjs';

const POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_VERSION =
  'policy.library_rebuild_snapshot_gate.v1';

const POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS = Object.freeze({
  ROLLBACK_SNAPSHOT_PERSISTED: 'rollback_snapshot_persisted',
  ALREADY_PERSISTED: 'already_persisted',
  BLOCKED_BY_TRANSITION: 'blocked_by_transition',
  BLOCKED_BY_CURRENT_STATE: 'blocked_by_current_state',
  BLOCKED_BY_VERIFICATION_RUN: 'blocked_by_verification_run',
  BLOCKED_BY_TRANSACTION_BOUNDARY: 'blocked_by_transaction_boundary',
  FAILED_ROLLED_BACK: 'failed_rolled_back',
});

const POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS = Object.freeze({
  TRANSITION_REVALIDATED: 'transition_revalidated',
  POLICY_AND_INTENT_LOCKED: 'policy_and_intent_locked',
  REPLAY_PROTECTION_PERSISTED: 'replay_protection_persisted',
  ROLLBACK_SNAPSHOT_PERSISTED: 'rollback_snapshot_persisted',
  MIGRATION_EVENT_PERSISTED: 'migration_event_persisted',
  REPLACEMENT_STILL_DISABLED: 'replacement_still_disabled',
  EXISTING_EXECUTION_REUSED: 'existing_execution_reused',
  CURRENT_STATE_BLOCKED: 'current_state_blocked',
  VERIFICATION_RUN_REQUIRED: 'verification_run_required',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  TRANSACTION_ROLLED_BACK: 'transaction_rolled_back',
});

const POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS = Object.freeze({
  INVALID_TRANSITION: 'invalid_transition',
  INVALID_TRANSITION_STATUS: 'invalid_transition_status',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  POLICY_CONTEXT_NOT_CURRENT: 'policy_context_not_current',
  INTENT_CONTEXT_NOT_CURRENT: 'intent_context_not_current',
  ACTIVE_EXECUTION_EXISTS: 'active_execution_exists',
  ...POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS,
  SNAPSHOT_INSERT_FAILED: 'snapshot_insert_failed',
  MIGRATION_EVENT_INSERT_FAILED: 'migration_event_insert_failed',
  EXECUTION_GATE_INSERT_FAILED: 'execution_gate_insert_failed',
  TRANSACTION_FAILED: 'transaction_failed',
  UNSAFE_GATE_OUTPUT: 'unsafe_gate_output',
  REPLACEMENT_ALLOWED: 'replacement_allowed',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Library rebuild snapshot persistence requires a valid server execution time.');
  }

  return date;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasFingerprint(value) {
  return SHA256_FINGERPRINT_PATTERN.test(typeof value === 'string' ? value.trim() : '');
}

function buildBlockedResult({
  statusId,
  now,
  riskId,
  message,
  transition = null,
}) {
  return {
    version: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_VERSION,
    statusId,
    evaluatedAt: now.toISOString(),
    execution: null,
    application: {
      canEnterMigrationVerification:
        transition?.application?.canEnterMigrationVerification === true,
      canApplyReplacement: false,
      persistedRollbackSnapshotPresent: false,
      replacementBlockedReason: 'migration_verification_required',
    },
    sideEffects: {
      acceptancePersisted: false,
      rollbackSnapshotCreated: false,
      migrationEventWritten: false,
      policyReplaced: false,
      policyDeleted: false,
      routingWritten: false,
      learningWritten: false,
    },
    reasons: [{
      reasonId: statusId === POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY
        ? POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS.TRANSACTION_BOUNDARY_REQUIRED
        : statusId === POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.FAILED_ROLLED_BACK
          ? POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS.TRANSACTION_ROLLED_BACK
          : statusId === POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_VERIFICATION_RUN
            ? POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS.VERIFICATION_RUN_REQUIRED
          : POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS.CURRENT_STATE_BLOCKED,
      severity: 'blocker',
      message,
    }],
    validation: {
      ok: false,
      issueCount: 1,
      issues: [{ riskId, message }],
    },
  };
}

function buildPersistedResult({
  statusId,
  now,
  execution,
  idempotent,
  snapshotCreated,
  migrationEventWritten,
}) {
  return {
    version: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_VERSION,
    statusId,
    evaluatedAt: now.toISOString(),
    execution: {
      gateId: Number(execution.id),
      policyId: Number(execution.policy_id),
      intentId: Number(execution.intent_id),
      libraryId: Number(execution.library_id),
      stateId: execution.state,
      transitionFingerprint: execution.transition_fingerprint,
      proposalFingerprint: execution.proposal_fingerprint,
      rollbackPlanFingerprint: execution.rollback_plan_fingerprint,
      verificationRunId: Number(execution.verification_run_id),
      verificationRunFingerprint: execution.verification_run_fingerprint,
      acceptanceExpiresAt: execution.acceptance_expires_at,
      rollbackSnapshotId: Number(execution.rollback_snapshot_id),
      migrationEventId: Number(execution.migration_event_id),
      idempotent,
    },
    application: {
      canEnterMigrationVerification: true,
      canApplyReplacement: false,
      persistedRollbackSnapshotPresent: true,
      replacementBlockedReason: 'migration_verification_required',
    },
    sideEffects: {
      acceptancePersisted: snapshotCreated,
      rollbackSnapshotCreated: snapshotCreated,
      migrationEventWritten,
      policyReplaced: false,
      policyDeleted: false,
      routingWritten: false,
      learningWritten: false,
    },
    reasons: [
      {
        reasonId: idempotent
          ? POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS.EXISTING_EXECUTION_REUSED
          : POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS.TRANSITION_REVALIDATED,
        severity: 'info',
      },
      {
        reasonId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS.POLICY_AND_INTENT_LOCKED,
        severity: 'info',
      },
      {
        reasonId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS.REPLAY_PROTECTION_PERSISTED,
        severity: 'info',
      },
      {
        reasonId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS.ROLLBACK_SNAPSHOT_PERSISTED,
        severity: 'info',
      },
      {
        reasonId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS.MIGRATION_EVENT_PERSISTED,
        severity: 'info',
      },
      {
        reasonId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS.REPLACEMENT_STILL_DISABLED,
        severity: 'info',
      },
    ],
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
  };
}

function validatePolicyLibraryRebuildSnapshotGate(result = {}) {
  const issues = [];
  const execution = asObject(result.execution);

  if (result.version !== POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_VERSION) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.UNSAFE_GATE_OUTPUT,
      message: 'Library rebuild snapshot gate must use the current contract version.',
    });
  }

  if (result.application?.canApplyReplacement === true) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.REPLACEMENT_ALLOWED,
      message: 'Rollback snapshot persistence must not authorize policy replacement.',
    });
  }

  if (
    [
      POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ROLLBACK_SNAPSHOT_PERSISTED,
      POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ALREADY_PERSISTED,
    ].includes(result.statusId)
  ) {
    if (!hasFingerprint(execution.transitionFingerprint) ||
        !hasFingerprint(execution.proposalFingerprint) ||
        !hasFingerprint(execution.rollbackPlanFingerprint) ||
        !Number.isInteger(execution.verificationRunId) ||
        !hasFingerprint(execution.verificationRunFingerprint) ||
        !Number.isInteger(execution.rollbackSnapshotId) ||
        !Number.isInteger(execution.migrationEventId) ||
        result.application?.persistedRollbackSnapshotPresent !== true) {
      issues.push({
        riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.UNSAFE_GATE_OUTPUT,
        message: 'Persisted rebuild snapshot output must retain bounded execution and snapshot identifiers.',
      });
    }
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyLibraryRebuildSnapshotGateAudit(result = null) {
  const auditedResult = result || {
    version: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_VERSION,
    statusId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ROLLBACK_SNAPSHOT_PERSISTED,
    execution: {
      transitionFingerprint: 'a'.repeat(64),
      proposalFingerprint: 'b'.repeat(64),
      rollbackPlanFingerprint: 'c'.repeat(64),
      verificationRunId: 1,
      verificationRunFingerprint: 'd'.repeat(64),
      rollbackSnapshotId: 1,
      migrationEventId: 1,
    },
    application: {
      canApplyReplacement: false,
      persistedRollbackSnapshotPresent: true,
    },
  };
  const validation = validatePolicyLibraryRebuildSnapshotGate(auditedResult);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: auditedResult.statusId || null,
    canApplyReplacement: auditedResult.application?.canApplyReplacement === true,
    persistedRollbackSnapshotPresent:
      auditedResult.application?.persistedRollbackSnapshotPresent === true,
    validation,
    nextStep: {
      stepId: 'library_rebuild_replacement_gate',
      label: 'Library Rebuild Replacement Gate',
      reason: 'A persisted rollback snapshot is now required before the transaction-gated native replacement contract can run.',
    },
  };
}

async function persistPolicyLibraryRebuildRollbackSnapshot({
  dbClient,
  transition = {},
  proposal = {},
  now = new Date(),
} = {}) {
  const executionTime = normalizeDate(now);
  const transitionValidation = validatePolicyLibraryRebuildAcceptanceTransition({
    transition,
    proposal,
    now: executionTime,
  });

  if (transitionValidation.ok !== true ||
      transition.statusId !== POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.READY_FOR_MIGRATION_VERIFICATION) {
    return buildBlockedResult({
      statusId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_TRANSITION,
      now: executionTime,
      riskId: transitionValidation.ok !== true
        ? POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.INVALID_TRANSITION
        : POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.INVALID_TRANSITION_STATUS,
      message: 'A current, validated accepted rebuild transition is required before rollback evidence can be persisted.',
      transition,
    });
  }

  if (typeof dbClient?.withTransaction !== 'function') {
    return buildBlockedResult({
      statusId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY,
      now: executionTime,
      riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.TRANSACTION_BOUNDARY_REQUIRED,
      message: 'Accepted rebuild rollback evidence requires an atomic database transaction.',
      transition,
    });
  }

  // Validate and clone before awaiting database work so caller-owned data cannot
  // change between authorization and persistence.
  const trustedTransition = deepClone(transition);
  const trustedProposal = deepClone(proposal);

  try {
    const result = await dbClient.withTransaction(async client => {
      const policy = await lockPolicy(client, trustedTransition.policyContext);
      if (!policy) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.POLICY_CONTEXT_NOT_CURRENT,
          message: 'Accepted rebuild policy context is not current.',
          transition: trustedTransition,
        });
      }

      const intent = await lockIntent(client, trustedTransition.policyContext);
      if (!intent) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.INTENT_CONTEXT_NOT_CURRENT,
          message: 'Accepted rebuild native intent context is not current.',
          transition: trustedTransition,
        });
      }

      const revalidation = validatePolicyLibraryRebuildAcceptanceTransition({
        transition: trustedTransition,
        proposal: trustedProposal,
        now: executionTime,
      });
      if (revalidation.ok !== true ||
          trustedTransition.statusId !== POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.READY_FOR_MIGRATION_VERIFICATION) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_TRANSITION,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.INVALID_TRANSITION,
          message: 'Accepted rebuild transition is no longer valid at persistence time.',
          transition: trustedTransition,
        });
      }

      const verificationBinding = await loadPolicyLibraryRebuildVerificationRunBinding({
        client,
        transition: trustedTransition,
        proposal: trustedProposal,
      });
      if (verificationBinding.ok !== true || !verificationBinding.verificationRun) {
        const issue = verificationBinding.issues?.[0] || {};
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_VERIFICATION_RUN,
          now: executionTime,
          riskId: issue.riskId || POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.VERIFICATION_RUN_MISSING,
          message: issue.message || 'A current no-difference migration verification receipt is required before rollback evidence can be created.',
          transition: trustedTransition,
        });
      }

      await expirePriorExecutionGates(client, trustedTransition.policyContext.policyId, executionTime);

      const priorExecution = await findExecutionByIdempotencyKey(
        client,
        trustedTransition.replayProtection.idempotencyKey
      );
      if (priorExecution?.state === POLICY_LIBRARY_REBUILD_EXECUTION_STATE_IDS.SNAPSHOT_PERSISTED) {
        return buildPersistedResult({
          statusId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ALREADY_PERSISTED,
          now: executionTime,
          execution: priorExecution,
          idempotent: true,
          snapshotCreated: false,
          migrationEventWritten: false,
        });
      }

      const activeExecution = await findActiveExecutionForPolicy(
        client,
        trustedTransition.policyContext.policyId
      );
      if (activeExecution) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.ACTIVE_EXECUTION_EXISTS,
          message: 'Another accepted rebuild execution is already active for this policy.',
          transition: trustedTransition,
        });
      }

      const gateId = await createExecutionGate(
        client,
        trustedTransition,
        verificationBinding.verificationRun,
        executionTime,
      );
      if (!gateId) {
        const error = new Error('Library rebuild execution gate insert did not return an identifier.');
        error.riskId = POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.EXECUTION_GATE_INSERT_FAILED;
        throw error;
      }

      const [presets, routingTarget] = await Promise.all([
        loadPolicyPresets(client, policy.id),
        loadRoutingTarget(client, policy.library_id),
      ]);
      const snapshotId = await createRollbackSnapshot({
        client,
        policy,
        intent,
        presets,
        routingTarget,
        transition: trustedTransition,
        now: executionTime,
      });
      if (!snapshotId) {
        const error = new Error('Accepted rebuild rollback snapshot did not match the current native intent.');
        error.riskId = POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.INTENT_CONTEXT_NOT_CURRENT;
        throw error;
      }

      const eventId = await createMigrationEvent({
        client,
        intent,
        transition: trustedTransition,
        snapshotId,
      });
      if (!eventId) {
        const error = new Error('Library rebuild migration event insert did not return an identifier.');
        error.riskId = POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.MIGRATION_EVENT_INSERT_FAILED;
        throw error;
      }

      await markExecutionSnapshotPersisted({
        client,
        gateId,
        snapshotId,
        eventId,
        now: executionTime,
      });

      return buildPersistedResult({
        statusId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.ROLLBACK_SNAPSHOT_PERSISTED,
        now: executionTime,
        execution: {
          id: gateId,
          policy_id: policy.id,
          intent_id: intent.id,
          library_id: policy.library_id,
          state: POLICY_LIBRARY_REBUILD_EXECUTION_STATE_IDS.SNAPSHOT_PERSISTED,
          transition_fingerprint: trustedTransition.transitionFingerprint.fingerprint,
          proposal_fingerprint: trustedTransition.proposalFingerprint.fingerprint,
          rollback_plan_fingerprint: trustedTransition.rollbackPlanFingerprint.fingerprint,
          verification_run_id: verificationBinding.verificationRun.id,
          verification_run_fingerprint: verificationBinding.verificationRun.verifierFingerprint,
          acceptance_expires_at: trustedTransition.acceptance.expiresAt,
          rollback_snapshot_id: snapshotId,
          migration_event_id: eventId,
        },
        idempotent: false,
        snapshotCreated: true,
        migrationEventWritten: true,
      });
    });

    return {
      ...result,
      validation: result.validation?.ok === false
        ? result.validation
        : validatePolicyLibraryRebuildSnapshotGate(result),
    };
  } catch (error) {
    return buildBlockedResult({
      statusId: POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS.FAILED_ROLLED_BACK,
      now: executionTime,
      riskId: error.riskId || POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS.TRANSACTION_FAILED,
      message: 'Accepted rebuild snapshot persistence failed and the transaction was rolled back.',
      transition: trustedTransition,
    });
  }
}

export {
  POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_REASON_IDS,
  POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_RISK_IDS,
  POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_SNAPSHOT_GATE_VERSION,
  buildPolicyLibraryRebuildSnapshotGateAudit,
  persistPolicyLibraryRebuildRollbackSnapshot,
  validatePolicyLibraryRebuildSnapshotGate,
};
