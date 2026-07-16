/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_NATIVE_INTENT_REVERSION_RISK_IDS,
  POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS,
  POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS,
  POLICY_NATIVE_INTENT_REVERSION_VERSION,
  buildAppliedSummary,
  buildPolicyNativeIntentReversionResult,
  determineReversionTarget,
  isSnapshotExpired,
  normalizePositiveInteger,
  normalizeString,
  normalizeTimestamp,
  validateReversionAction,
  validateSnapshotManifest,
} from './policyNativeIntentReversionContract.mjs';
import {
  deactivateNativeIntentForReversion,
  insertNativeIntentReversionEvent,
  lockPolicyForNativeIntentReversion,
  lockPolicyNativeIntentsForReversion,
  lockRollbackSnapshotForNativeIntentReversion,
  markRollbackSnapshotRestored,
  reactivatePreviousNativeIntentForReversion,
} from './policyNativeIntentReversionPersistence.mjs';
import {
  nativeIntentReconciliationLifecycleService,
} from './nativeIntentReconciliationLifecycleService.mjs';


async function applyPolicyNativeIntentReversion({
  dbClient,
  policyId,
  snapshotId,
  action = {},
  now = new Date(),
} = {}) {
  const executionTime = normalizeTimestamp(now);
  const evaluatedAt = executionTime.toISOString();
  const normalizedPolicyId = normalizePositiveInteger(policyId);
  const normalizedSnapshotId = normalizePositiveInteger(snapshotId);
  const actionValidation = validateReversionAction(action);

  if (!normalizedPolicyId || !normalizedSnapshotId) {
    return buildPolicyNativeIntentReversionResult({
      statusId: POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_SNAPSHOT,
      evaluatedAt,
      policyId: normalizedPolicyId,
      snapshotId: normalizedSnapshotId,
      riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.SNAPSHOT_NOT_FOUND,
      message: 'Native authority reversion requires a positive policy and rollback snapshot identifier.',
    });
  }

  if (!actionValidation.ok) {
    return buildPolicyNativeIntentReversionResult({
      statusId: POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_ACTION,
      evaluatedAt,
      policyId: normalizedPolicyId,
      snapshotId: normalizedSnapshotId,
      riskId: actionValidation.riskId,
      message: actionValidation.message,
    });
  }

  if (typeof dbClient?.withTransaction !== 'function') {
    return buildPolicyNativeIntentReversionResult({
      statusId: POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY,
      evaluatedAt,
      policyId: normalizedPolicyId,
      snapshotId: normalizedSnapshotId,
      riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.TRANSACTION_BOUNDARY_REQUIRED,
      message: 'Native authority reversion requires an atomic database transaction.',
    });
  }

  try {
    return await dbClient.withTransaction(async client => {
      const policy = await lockPolicyForNativeIntentReversion(client, normalizedPolicyId);
      if (!policy) {
        return buildPolicyNativeIntentReversionResult({
          statusId: POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_AUTHORITY,
          evaluatedAt,
          policyId: normalizedPolicyId,
          snapshotId: normalizedSnapshotId,
          riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.POLICY_NOT_FOUND,
          message: 'Native authority reversion policy is not current.',
        });
      }

      const snapshot = await lockRollbackSnapshotForNativeIntentReversion(client, {
        snapshotId: normalizedSnapshotId,
        policyId: Number(policy.id),
      });
      if (!snapshot) {
        return buildPolicyNativeIntentReversionResult({
          statusId: POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_SNAPSHOT,
          evaluatedAt,
          policyId: Number(policy.id),
          snapshotId: normalizedSnapshotId,
          riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.SNAPSHOT_NOT_FOUND,
          message: 'Rollback snapshot does not belong to the current policy.',
        });
      }

      if (snapshot.restored_at) {
        return buildPolicyNativeIntentReversionResult({
          statusId: POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.ALREADY_REVERTED,
          evaluatedAt,
          policyId: Number(policy.id),
          snapshotId: Number(snapshot.id),
          snapshotMarkedRestored: true,
        });
      }

      if (isSnapshotExpired(snapshot, executionTime)) {
        return buildPolicyNativeIntentReversionResult({
          statusId: POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_SNAPSHOT,
          evaluatedAt,
          policyId: Number(policy.id),
          snapshotId: Number(snapshot.id),
          riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.SNAPSHOT_EXPIRED,
          message: 'Rollback snapshot has expired and can no longer restore policy authority.',
        });
      }

      const manifestValidation = validateSnapshotManifest({ snapshot, policy });
      if (!manifestValidation.ok) {
        return buildPolicyNativeIntentReversionResult({
          statusId: POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_SNAPSHOT,
          evaluatedAt,
          policyId: Number(policy.id),
          snapshotId: Number(snapshot.id),
          riskId: manifestValidation.riskId,
          message: manifestValidation.message,
        });
      }

      const intents = await lockPolicyNativeIntentsForReversion(client, {
        policyId: Number(policy.id),
        libraryId: Number(policy.library_id),
      });
      const target = determineReversionTarget({ snapshot, intents });
      if (!target.ok) {
        return buildPolicyNativeIntentReversionResult({
          statusId: POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.BLOCKED_BY_AUTHORITY,
          evaluatedAt,
          policyId: Number(policy.id),
          snapshotId: Number(snapshot.id),
          riskId: target.riskId,
          message: target.message,
        });
      }

      const restoredAt = executionTime.toISOString();
      const deactivated = await deactivateNativeIntentForReversion({
        client,
        intentId: Number(target.activeIntent.id),
        policyId: Number(policy.id),
        libraryId: Number(policy.library_id),
        restoredAt,
      });
      if (!deactivated) {
        throw new Error('Current native authority changed before reversion could deactivate it.');
      }

      if (target.targetId === POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS.PREVIOUS_NATIVE_INTENT) {
        const reactivated = await reactivatePreviousNativeIntentForReversion({
          client,
          intentId: Number(target.snapshotIntent.id),
          replacementIntentId: Number(target.activeIntent.id),
          policyId: Number(policy.id),
          libraryId: Number(policy.library_id),
          restoredAt,
        });
        if (!reactivated) {
          throw new Error('Prior native intent changed before reversion could reactivate it.');
        }
      }

      const restoredSnapshotId = await markRollbackSnapshotRestored({
        client,
        snapshotId: Number(snapshot.id),
        policyId: Number(policy.id),
        restoredAt,
      });
      if (!restoredSnapshotId) {
        throw new Error('Rollback snapshot was not available to mark as restored.');
      }

      const eventId = await insertNativeIntentReversionEvent({
        client,
        intentId: Number(target.snapshotIntent.id),
        policyId: Number(policy.id),
        actorType: actionValidation.normalizedAction.actorType,
        actorId: actionValidation.normalizedAction.actorId,
        sourceVersion: Number(target.activeIntent.intent_version),
        targetVersion: target.targetId === POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS.PREVIOUS_NATIVE_INTENT
          ? Number(target.snapshotIntent.intent_version)
          : null,
        reasonCode: actionValidation.normalizedAction.reasonCode,
        summary: buildAppliedSummary(target.targetId),
        metadata: {
          snapshotId: Number(snapshot.id),
          restorePath: normalizeString(snapshot.restore_path),
          targetId: target.targetId,
        },
      });
      if (!eventId) {
        throw new Error('Native authority reversion event did not return an identifier.');
      }

      // This is intentionally part of the same transaction as the reversion.
      // A committed rollback must never leave a window for reconciliation to
      // recreate native authority before the hold becomes visible.
      await nativeIntentReconciliationLifecycleService.recordReversionHold({
        client,
        policyId: Number(policy.id),
        sourceEventId: Number(eventId),
        heldAt: restoredAt,
      });

      return buildPolicyNativeIntentReversionResult({
        statusId: target.targetId === POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS.PREVIOUS_NATIVE_INTENT
          ? POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.APPLIED_TO_PREVIOUS_NATIVE_INTENT
          : POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.APPLIED_TO_COMPATIBILITY,
        evaluatedAt,
        policyId: Number(policy.id),
        snapshotId: Number(snapshot.id),
        targetId: target.targetId,
        applied: true,
        eventWritten: true,
        snapshotMarkedRestored: true,
      });
    });
  } catch {
    return buildPolicyNativeIntentReversionResult({
      statusId: POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS.FAILED_ROLLED_BACK,
      evaluatedAt,
      policyId: normalizedPolicyId,
      snapshotId: normalizedSnapshotId,
      riskId: POLICY_NATIVE_INTENT_REVERSION_RISK_IDS.TRANSACTION_FAILED,
      message: 'Native authority reversion failed and the transaction was rolled back.',
    });
  }
}

export {
  POLICY_NATIVE_INTENT_REVERSION_RISK_IDS,
  POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS,
  POLICY_NATIVE_INTENT_REVERSION_TARGET_IDS,
  POLICY_NATIVE_INTENT_REVERSION_VERSION,
  applyPolicyNativeIntentReversion,
  determineReversionTarget,
  validateReversionAction,
  validateSnapshotManifest,
};
