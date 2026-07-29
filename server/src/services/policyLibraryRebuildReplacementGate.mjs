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
  buildPolicyLibraryRebuildReplacementContract,
} from './policyLibraryRebuildReplacementContract.mjs';
import {
  expirePriorExecutionGates,
  loadRoutingTarget,
  lockIntent,
  lockPolicy,
} from './policyLibraryRebuildSnapshotPersistence.mjs';
import {
  POLICY_LIBRARY_REBUILD_REPLACEMENT_STATE_IDS,
  insertNativeIntentHeader,
  insertNativeIntentRules,
  insertNativeRoutingTarget,
  insertNativeValidationStatus,
  insertReplacementMigrationEvent,
  lockExecutionGateByIdempotencyKey,
  lockRollbackSnapshot,
  markExecutionReplacementApplied,
} from './policyLibraryRebuildReplacementPersistence.mjs';
import {
  POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS,
  loadPolicyLibraryRebuildExecutionVerificationRunBinding,
} from './policyLibraryRebuildVerificationRunBinding.mjs';

const POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_VERSION =
  'policy.library_rebuild_replacement_gate.v1';

const POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS = Object.freeze({
  REPLACEMENT_APPLIED: 'replacement_applied',
  ALREADY_APPLIED: 'already_applied',
  BLOCKED_BY_INPUT: 'blocked_by_input',
  BLOCKED_BY_VERIFICATION_RUN: 'blocked_by_verification_run',
  BLOCKED_BY_CURRENT_STATE: 'blocked_by_current_state',
  BLOCKED_BY_TRANSACTION_BOUNDARY: 'blocked_by_transaction_boundary',
  FAILED_ROLLED_BACK: 'failed_rolled_back',
});

const POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS = Object.freeze({
  PERSISTED_SNAPSHOT_VERIFIED: 'persisted_snapshot_verified',
  VERIFICATION_RECEIPT_REVALIDATED: 'verification_receipt_revalidated',
  POLICY_AND_INTENT_LOCKED: 'policy_and_intent_locked',
  NATIVE_INTENT_REPLACED: 'native_intent_replaced',
  REPLACEMENT_EVENT_PERSISTED: 'replacement_event_persisted',
  EXISTING_REPLACEMENT_REUSED: 'existing_replacement_reused',
  VERIFICATION_RECEIPT_REQUIRED: 'verification_receipt_required',
  REPLACEMENT_BLOCKED: 'replacement_blocked',
  TRANSACTION_REQUIRED: 'transaction_required',
  TRANSACTION_ROLLED_BACK: 'transaction_rolled_back',
});

const POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS = Object.freeze({
  INVALID_PROPOSAL_OR_TRANSITION: 'invalid_proposal_or_transition',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  POLICY_CONTEXT_NOT_CURRENT: 'policy_context_not_current',
  EXECUTION_GATE_NOT_FOUND: 'execution_gate_not_found',
  EXECUTION_GATE_BINDING_MISMATCH: 'execution_gate_binding_mismatch',
  EXECUTION_GATE_NOT_SNAPSHOT_PERSISTED: 'execution_gate_not_snapshot_persisted',
  ...POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS,
  ROLLBACK_SNAPSHOT_NOT_CURRENT: 'rollback_snapshot_not_current',
  INTENT_CONTEXT_NOT_CURRENT: 'intent_context_not_current',
  REPLACEMENT_CONTRACT_INVALID: 'replacement_contract_invalid',
  ROUTING_TARGET_NOT_CURRENT: 'routing_target_not_current',
  REPLACEMENT_WRITE_FAILED: 'replacement_write_failed',
  UNSAFE_GATE_OUTPUT: 'unsafe_gate_output',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Library rebuild replacement requires a valid server execution time.');
  }

  return date;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasFingerprint(value) {
  return SHA256_FINGERPRINT_PATTERN.test(typeof value === 'string' ? value.trim() : '');
}

function buildBlockedResult({ statusId, now, riskId, message }) {
  return {
    version: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_VERSION,
    statusId,
    evaluatedAt: now.toISOString(),
    execution: null,
    application: {
      replacementApplied: false,
      canApplyReplacement: false,
      legacyPathsDeleted: false,
    },
    sideEffects: {
      nativeIntentCreated: false,
      nativeRulesWritten: false,
      routingWritten: false,
      validationWritten: false,
      migrationEventWritten: false,
      policyReplaced: false,
      legacyPathsDeleted: false,
    },
    reasons: [{
      reasonId: statusId === POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY
        ? POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS.TRANSACTION_REQUIRED
        : statusId === POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.FAILED_ROLLED_BACK
          ? POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS.TRANSACTION_ROLLED_BACK
          : statusId === POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_VERIFICATION_RUN
            ? POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS.VERIFICATION_RECEIPT_REQUIRED
            : POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS.REPLACEMENT_BLOCKED,
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

function buildAppliedResult({
  statusId,
  now,
  execution,
  verificationRun,
  idempotent,
  rulesInserted = 0,
}) {
  return {
    version: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_VERSION,
    statusId,
    evaluatedAt: now.toISOString(),
    execution: {
      gateId: Number(execution.id),
      policyId: Number(execution.policy_id),
      originalIntentId: Number(execution.intent_id),
      replacementIntentId: Number(execution.replacement_intent_id),
      replacementEventId: Number(execution.replacement_event_id),
      rollbackSnapshotId: Number(execution.rollback_snapshot_id),
      transitionFingerprint: execution.transition_fingerprint,
      proposalFingerprint: execution.proposal_fingerprint,
      verificationRunId: Number(verificationRun.id),
      verificationRunFingerprint: verificationRun.verifierFingerprint,
      verificationRunStatusId: verificationRun.verifierStatusId,
      appliedAt: execution.replacement_applied_at ?? now.toISOString(),
      idempotent,
    },
    application: {
      replacementApplied: true,
      canApplyReplacement: false,
      legacyPathsDeleted: false,
    },
    sideEffects: {
      nativeIntentCreated: !idempotent,
      nativeRulesWritten: !idempotent && rulesInserted > 0,
      routingWritten: !idempotent,
      validationWritten: !idempotent,
      migrationEventWritten: !idempotent,
      policyReplaced: !idempotent,
      legacyPathsDeleted: false,
    },
    reasons: [
      {
        reasonId: idempotent
          ? POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS.EXISTING_REPLACEMENT_REUSED
          : POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS.PERSISTED_SNAPSHOT_VERIFIED,
        severity: 'info',
      },
      {
        reasonId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS
          .VERIFICATION_RECEIPT_REVALIDATED,
        severity: 'info',
      },
      {
        reasonId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS.POLICY_AND_INTENT_LOCKED,
        severity: 'info',
      },
      {
        reasonId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS.NATIVE_INTENT_REPLACED,
        severity: 'info',
      },
      {
        reasonId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS.REPLACEMENT_EVENT_PERSISTED,
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

function executionMatchesTransition(execution, transition) {
  const context = asObject(transition.policyContext);
  return Number(execution?.policy_id) === Number(context.policyId) &&
    Number(execution?.intent_id) === Number(context.intentId) &&
    Number(execution?.library_id) === Number(context.libraryId) &&
    execution?.transition_fingerprint === transition?.transitionFingerprint?.fingerprint &&
    execution?.proposal_fingerprint === transition?.proposalFingerprint?.fingerprint &&
    execution?.rollback_plan_fingerprint === transition?.rollbackPlanFingerprint?.fingerprint;
}

function validatePolicyLibraryRebuildReplacementGate(result = {}) {
  const issues = [];
  const execution = asObject(result.execution);

  if (result.version !== POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_VERSION) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.UNSAFE_GATE_OUTPUT,
      message: 'Library rebuild replacement gate must use the current contract version.',
    });
  }

  if (
    [
      POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.REPLACEMENT_APPLIED,
      POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.ALREADY_APPLIED,
    ].includes(result.statusId) &&
    (!Number.isInteger(execution.gateId) ||
      !Number.isInteger(execution.originalIntentId) ||
      !Number.isInteger(execution.replacementIntentId) ||
      !Number.isInteger(execution.replacementEventId) ||
      !Number.isInteger(execution.rollbackSnapshotId) ||
      !hasFingerprint(execution.transitionFingerprint) ||
      !Number.isInteger(execution.verificationRunId) ||
      !hasFingerprint(execution.verificationRunFingerprint) ||
      execution.verificationRunStatusId !== 'no_migration_differences' ||
      result.application?.replacementApplied !== true ||
      result.application?.canApplyReplacement !== false)
  ) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.UNSAFE_GATE_OUTPUT,
      message: 'Applied replacement output must retain bounded gate, receipt, intent, event, snapshot, and fingerprint identifiers.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyLibraryRebuildReplacementGateAudit(result = null) {
  const auditedResult = result || {
    version: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_VERSION,
    statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.REPLACEMENT_APPLIED,
    execution: {
      gateId: 1,
      originalIntentId: 1,
      replacementIntentId: 2,
      replacementEventId: 1,
      rollbackSnapshotId: 1,
      transitionFingerprint: 'a'.repeat(64),
      verificationRunId: 1,
      verificationRunFingerprint: 'b'.repeat(64),
      verificationRunStatusId: 'no_migration_differences',
    },
    application: {
      replacementApplied: true,
      canApplyReplacement: false,
    },
  };
  const validation = validatePolicyLibraryRebuildReplacementGate(auditedResult);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: auditedResult.statusId || null,
    replacementApplied: auditedResult.application?.replacementApplied === true,
    canApplyReplacement: auditedResult.application?.canApplyReplacement === true,
    validation,
    nextStep: {
      stepId: 'strict_constraint_descriptors',
      label: 'Structured Rebuild Strict Constraints',
      reason: 'Native replacement remains auditable only when strict hard-limit semantics are preserved as validated structured descriptors.',
    },
  };
}

async function applyPolicyLibraryRebuildReplacement({
  dbClient,
  transition = {},
  proposal = {},
  now = new Date(),
} = {}) {
  const executionTime = normalizeDate(now);
  const suppliedTransitionValidation = validatePolicyLibraryRebuildAcceptanceTransition({
    transition,
    proposal,
    now: transition?.evaluatedAt || executionTime,
  });
  if (!suppliedTransitionValidation.ok) {
    return buildBlockedResult({
      statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_INPUT,
      now: executionTime,
      riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.INVALID_PROPOSAL_OR_TRANSITION,
      message: 'Replacement requires a valid accepted transition and rebuild proposal.',
    });
  }

  if (typeof dbClient?.withTransaction !== 'function') {
    return buildBlockedResult({
      statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY,
      now: executionTime,
      riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.TRANSACTION_BOUNDARY_REQUIRED,
      message: 'Library rebuild replacement requires an atomic database transaction.',
    });
  }

  const trustedTransition = deepClone(transition);
  const trustedProposal = deepClone(proposal);

  try {
    const result = await dbClient.withTransaction(async client => {
      const policy = await lockPolicy(client, trustedTransition.policyContext);
      if (!policy) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.POLICY_CONTEXT_NOT_CURRENT,
          message: 'Accepted rebuild policy context is not current.',
        });
      }

      await expirePriorExecutionGates(client, policy.id, executionTime);
      const execution = await lockExecutionGateByIdempotencyKey(
        client,
        trustedTransition.replayProtection.idempotencyKey
      );
      if (!execution) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.EXECUTION_GATE_NOT_FOUND,
          message: 'Replacement requires a persisted rollback snapshot execution gate.',
        });
      }

      if (!executionMatchesTransition(execution, trustedTransition)) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.EXECUTION_GATE_BINDING_MISMATCH,
          message: 'Persisted rollback evidence does not match this accepted rebuild transition.',
        });
      }

      if (![
        POLICY_LIBRARY_REBUILD_REPLACEMENT_STATE_IDS.REPLACEMENT_APPLIED,
        POLICY_LIBRARY_REBUILD_REPLACEMENT_STATE_IDS.SNAPSHOT_PERSISTED,
      ].includes(execution.state)) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.EXECUTION_GATE_NOT_SNAPSHOT_PERSISTED,
          message: 'Replacement requires a current persisted rollback snapshot gate.',
        });
      }

      if (execution.state === POLICY_LIBRARY_REBUILD_REPLACEMENT_STATE_IDS.SNAPSHOT_PERSISTED) {
        const currentTransitionValidation = validatePolicyLibraryRebuildAcceptanceTransition({
          transition: trustedTransition,
          proposal: trustedProposal,
          now: executionTime,
        });
        if (
          !currentTransitionValidation.ok ||
          trustedTransition.statusId !== POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.READY_FOR_MIGRATION_VERIFICATION
        ) {
          return buildBlockedResult({
            statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
            now: executionTime,
            riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.INVALID_PROPOSAL_OR_TRANSITION,
            message: 'Accepted rebuild transition is no longer current for replacement.',
          });
        }
      }

      const verificationBinding = await loadPolicyLibraryRebuildExecutionVerificationRunBinding({
        client,
        execution,
        transition: trustedTransition,
        proposal: trustedProposal,
      });
      if (verificationBinding.ok !== true || !verificationBinding.verificationRun) {
        const issue = verificationBinding.issues?.[0] || {};
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_VERIFICATION_RUN,
          now: executionTime,
          riskId: issue.riskId || POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS
            .VERIFICATION_RUN_EXECUTION_BINDING_MISSING,
          message: issue.message || 'Replacement requires the verification receipt bound to its persisted rebuild execution gate.',
        });
      }

      if (execution.state === POLICY_LIBRARY_REBUILD_REPLACEMENT_STATE_IDS.REPLACEMENT_APPLIED) {
        return buildAppliedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.ALREADY_APPLIED,
          now: executionTime,
          execution,
          verificationRun: verificationBinding.verificationRun,
          idempotent: true,
        });
      }

      const currentIntent = await lockIntent(client, trustedTransition.policyContext);
      if (!currentIntent || Number(currentIntent.id) !== Number(execution.intent_id)) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.INTENT_CONTEXT_NOT_CURRENT,
          message: 'Replacement native intent context is not current.',
        });
      }

      const rollbackSnapshot = await lockRollbackSnapshot({
        client,
        snapshotId: execution.rollback_snapshot_id,
        policyId: policy.id,
        intentId: currentIntent.id,
        now: executionTime,
      });
      if (!rollbackSnapshot) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.ROLLBACK_SNAPSHOT_NOT_CURRENT,
          message: 'Replacement rollback snapshot is unavailable, expired, restored, or no longer current.',
        });
      }

      const replacementContract = buildPolicyLibraryRebuildReplacementContract({
        proposal: trustedProposal,
        policy,
        previousIntent: currentIntent,
      });
      if (!replacementContract.ok || !replacementContract.contract) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.REPLACEMENT_CONTRACT_INVALID,
          message: 'Rebuild evidence cannot be translated to a complete native policy contract without guessing.',
        });
      }

      const routingTarget = await loadRoutingTarget(client, policy.library_id);
      if (!routingTarget?.arr_type || !routingTarget?.arr_config_id || !routingTarget?.arr_root_folder_path) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.ROUTING_TARGET_NOT_CURRENT,
          message: 'Replacement requires a current configured routing target.',
        });
      }

      const replacementIntent = await insertNativeIntentHeader({
        client,
        policy,
        previousIntent: currentIntent,
        contract: replacementContract.contract,
        now: executionTime,
      });
      const rulesInserted = await insertNativeIntentRules({
        client,
        intentId: replacementIntent.intentId,
        contract: replacementContract.contract,
      });
      await insertNativeRoutingTarget({
        client,
        intentId: replacementIntent.intentId,
        policy,
        routingTarget,
        now: executionTime,
      });
      await insertNativeValidationStatus({
        client,
        intentId: replacementIntent.intentId,
        contract: replacementContract.contract,
        now: executionTime,
      });
      const replacementEventId = await insertReplacementMigrationEvent({
        client,
        replacementIntent,
        previousIntent: currentIntent,
        execution,
        verificationRun: verificationBinding.verificationRun,
      });
      if (!replacementEventId) {
        throw new Error('Replacement migration event insert did not return an identifier.');
      }

      const markedGateId = await markExecutionReplacementApplied({
        client,
        executionId: execution.id,
        replacementIntentId: replacementIntent.intentId,
        replacementEventId,
        now: executionTime,
      });
      if (!markedGateId) {
        throw new Error('Replacement execution gate was not marked applied.');
      }

      return buildAppliedResult({
        statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.REPLACEMENT_APPLIED,
        now: executionTime,
        execution: {
          ...execution,
          replacement_intent_id: replacementIntent.intentId,
          replacement_event_id: replacementEventId,
          replacement_applied_at: executionTime.toISOString(),
        },
        verificationRun: verificationBinding.verificationRun,
        idempotent: false,
        rulesInserted,
      });
    });

    return {
      ...result,
      validation: result.validation?.ok === false
        ? result.validation
        : validatePolicyLibraryRebuildReplacementGate(result),
    };
  } catch {
    return buildBlockedResult({
      statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.FAILED_ROLLED_BACK,
      now: executionTime,
      riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.REPLACEMENT_WRITE_FAILED,
      message: 'Accepted rebuild replacement failed and the transaction was rolled back.',
    });
  }
}

export {
  POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS,
  POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS,
  POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS,
  POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_VERSION,
  applyPolicyLibraryRebuildReplacement,
  buildPolicyLibraryRebuildReplacementGateAudit,
  validatePolicyLibraryRebuildReplacementGate,
};
