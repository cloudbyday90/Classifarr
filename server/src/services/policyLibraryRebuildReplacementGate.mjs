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
  POLICY_MIGRATION_VERIFIER_STATUS_IDS,
  validatePolicyMigrationVerifierReport,
} from './policyMigrationVerifierRollback.mjs';

const POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_VERSION =
  'policy.library_rebuild_replacement_gate.v1';

const POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS = Object.freeze({
  REPLACEMENT_APPLIED: 'replacement_applied',
  ALREADY_APPLIED: 'already_applied',
  BLOCKED_BY_INPUT: 'blocked_by_input',
  BLOCKED_BY_VERIFIER: 'blocked_by_verifier',
  BLOCKED_BY_CURRENT_STATE: 'blocked_by_current_state',
  BLOCKED_BY_TRANSACTION_BOUNDARY: 'blocked_by_transaction_boundary',
  FAILED_ROLLED_BACK: 'failed_rolled_back',
});

const POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS = Object.freeze({
  PERSISTED_SNAPSHOT_VERIFIED: 'persisted_snapshot_verified',
  VERIFIER_REVALIDATED: 'verifier_revalidated',
  POLICY_AND_INTENT_LOCKED: 'policy_and_intent_locked',
  NATIVE_INTENT_REPLACED: 'native_intent_replaced',
  REPLACEMENT_EVENT_PERSISTED: 'replacement_event_persisted',
  EXISTING_REPLACEMENT_REUSED: 'existing_replacement_reused',
  REPLACEMENT_BLOCKED: 'replacement_blocked',
  TRANSACTION_REQUIRED: 'transaction_required',
  TRANSACTION_ROLLED_BACK: 'transaction_rolled_back',
});

const POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS = Object.freeze({
  INVALID_PROPOSAL_OR_TRANSITION: 'invalid_proposal_or_transition',
  INVALID_VERIFIER_REPORT: 'invalid_verifier_report',
  VERIFIER_DIFFERENCES_REMAIN: 'verifier_differences_remain',
  VERIFIER_BINDING_MISMATCH: 'verifier_binding_mismatch',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  POLICY_CONTEXT_NOT_CURRENT: 'policy_context_not_current',
  EXECUTION_GATE_NOT_FOUND: 'execution_gate_not_found',
  EXECUTION_GATE_BINDING_MISMATCH: 'execution_gate_binding_mismatch',
  EXECUTION_GATE_NOT_SNAPSHOT_PERSISTED: 'execution_gate_not_snapshot_persisted',
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

function buildAppliedResult({ statusId, now, execution, idempotent, rulesInserted = 0 }) {
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
        reasonId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_REASON_IDS.VERIFIER_REVALIDATED,
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

function validateVerifierBinding({ transition, verifierReport }) {
  const transitionFingerprint = transition?.transitionFingerprint?.fingerprint;
  const proposalFingerprint = transition?.proposalFingerprint?.fingerprint;
  const reportTransitionFingerprint =
    verifierReport?.acceptanceTransition?.transitionFingerprint?.fingerprint;
  const reportProposalFingerprint =
    verifierReport?.acceptanceTransition?.proposalFingerprint?.fingerprint;

  if (
    !hasFingerprint(transitionFingerprint) ||
    !hasFingerprint(proposalFingerprint) ||
    reportTransitionFingerprint !== transitionFingerprint ||
    reportProposalFingerprint !== proposalFingerprint
  ) {
    return false;
  }

  return verifierReport?.statusId === POLICY_MIGRATION_VERIFIER_STATUS_IDS.NO_MIGRATION_DIFFERENCES &&
    Number(verifierReport?.differenceSummary?.totalCount) === 0 &&
    Number(verifierReport?.differenceSummary?.emittedCount) === 0 &&
    verifierReport?.differenceSummary?.truncated === false &&
    Array.isArray(verifierReport?.differences) && verifierReport.differences.length === 0;
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
      result.application?.replacementApplied !== true ||
      result.application?.canApplyReplacement !== false)
  ) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.UNSAFE_GATE_OUTPUT,
      message: 'Applied replacement output must retain bounded gate, intent, event, snapshot, and fingerprint identifiers.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

async function applyPolicyLibraryRebuildReplacement({
  dbClient,
  transition = {},
  proposal = {},
  verifierReport = {},
  now = new Date(),
} = {}) {
  const executionTime = normalizeDate(now);
  const suppliedTransitionValidation = validatePolicyLibraryRebuildAcceptanceTransition({
    transition,
    proposal,
    now: transition?.evaluatedAt || executionTime,
  });
  const verifierValidation = validatePolicyMigrationVerifierReport(verifierReport);

  if (!suppliedTransitionValidation.ok || verifierValidation.ok !== true) {
    return buildBlockedResult({
      statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_INPUT,
      now: executionTime,
      riskId: suppliedTransitionValidation.ok
        ? POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.INVALID_VERIFIER_REPORT
        : POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.INVALID_PROPOSAL_OR_TRANSITION,
      message: 'Replacement requires a valid accepted transition, rebuild proposal, and migration verifier report.',
    });
  }

  if (!validateVerifierBinding({ transition, verifierReport })) {
    return buildBlockedResult({
      statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_VERIFIER,
      now: executionTime,
      riskId: verifierReport?.statusId === POLICY_MIGRATION_VERIFIER_STATUS_IDS.NO_MIGRATION_DIFFERENCES
        ? POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.VERIFIER_BINDING_MISMATCH
        : POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.VERIFIER_DIFFERENCES_REMAIN,
      message: 'Replacement requires a no-difference migration verifier report bound to the accepted rebuild transition.',
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
  const trustedVerifierReport = deepClone(verifierReport);

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

      if (execution.state === POLICY_LIBRARY_REBUILD_REPLACEMENT_STATE_IDS.REPLACEMENT_APPLIED) {
        return buildAppliedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.ALREADY_APPLIED,
          now: executionTime,
          execution,
          idempotent: true,
        });
      }

      if (execution.state !== POLICY_LIBRARY_REBUILD_REPLACEMENT_STATE_IDS.SNAPSHOT_PERSISTED) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.EXECUTION_GATE_NOT_SNAPSHOT_PERSISTED,
          message: 'Replacement requires a current persisted rollback snapshot gate.',
        });
      }

      const currentTransitionValidation = validatePolicyLibraryRebuildAcceptanceTransition({
        transition: trustedTransition,
        proposal: trustedProposal,
        now: executionTime,
      });
      if (
        !currentTransitionValidation.ok ||
        trustedTransition.statusId !== POLICY_LIBRARY_REBUILD_ACCEPTANCE_STATUS_IDS.READY_FOR_MIGRATION_VERIFICATION ||
        !validateVerifierBinding({ transition: trustedTransition, verifierReport: trustedVerifierReport })
      ) {
        return buildBlockedResult({
          statusId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_STATUS_IDS.BLOCKED_BY_CURRENT_STATE,
          now: executionTime,
          riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_GATE_RISK_IDS.VERIFIER_BINDING_MISMATCH,
          message: 'Accepted rebuild or migration verifier evidence is no longer current for replacement.',
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
        verifierReport: trustedVerifierReport,
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
  validatePolicyLibraryRebuildReplacementGate,
};
