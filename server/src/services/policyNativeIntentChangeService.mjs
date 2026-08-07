/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS,
  POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS,
  buildPolicyNativeIntentChangeAdmission,
} from './policyNativeIntentChangeAdmission.mjs';
import {
  POLICY_NATIVE_INTENT_CHANGE_RESULT_RISK_IDS,
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS,
  buildPolicyNativeIntentChangeResult,
} from './policyNativeIntentChangeResult.mjs';
import {
  copyRoutingTargetFromPreviousIntent,
  copyRulesFromPreviousIntent,
  deactivateActiveNativeIntentForChange,
  insertNativeIntentChangeEvent,
  insertNewNativeIntentVersion,
  insertRoutingTargetForChange,
  insertRulesForCollection,
  lockActiveNativeIntentForChange,
  lockPolicyForNativeIntentChange,
  updateReviewBehavior,
} from './policyNativeIntentChangePersistence.mjs';

const ADMISSION_TO_RESULT_STATUS = Object.freeze({
  [POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.ADMITTED]:
    POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED,
  [POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.STALE_REVISION]:
    POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.STALE_REVISION,
  [POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.POLICY_REPLACED]:
    POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.POLICY_REPLACED,
  [POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RECOVERY_REQUIRED]:
    POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.RECOVERY_REQUIRED,
  [POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.AUTHORIZATION_REJECTED]:
    POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.AUTHORIZATION_REJECTED,
  [POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.UNAVAILABLE_AUTHORITY]:
    POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.UNAVAILABLE_AUTHORITY,
  [POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.UNKNOWN_COMMAND]:
    POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.UNKNOWN_COMMAND,
  [POLICY_NATIVE_INTENT_CHANGE_ADMISSION_STATUS_IDS.RETRYABLE]:
    POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.RETRYABLE,
});

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

async function applyPolicyNativeIntentChange({
  dbClient,
  policyId,
  expectedRevision,
  actorId,
  actorRole,
  idempotencyKey,
  changeCommands = [],
  authorityState = {},
  legacyPayload = null,
  now = new Date(),
} = {}) {
  const normalizedPolicyId = normalizePositiveInteger(policyId);

  const admission = buildPolicyNativeIntentChangeAdmission({
    policyId: normalizedPolicyId,
    expectedRevision,
    actorId,
    actorRole,
    idempotencyKey,
    changeCommands,
    authorityState,
    legacyPayload,
  });

  if (!admission.admitted) {
    return buildPolicyNativeIntentChangeResult({
      statusId: ADMISSION_TO_RESULT_STATUS[admission.statusId] ??
        POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.RETRYABLE,
      policyId: normalizedPolicyId,
      actorId,
      expectedRevision,
      risks: admission.risks,
    });
  }

  if (typeof dbClient?.withTransaction !== 'function') {
    return buildPolicyNativeIntentChangeResult({
      statusId: POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY,
      policyId: normalizedPolicyId,
      actorId,
      expectedRevision,
      risks: [{
        riskId: POLICY_NATIVE_INTENT_CHANGE_RESULT_RISK_IDS.TRANSACTION_BOUNDARY_REQUIRED,
        message: 'Native intent change requires a transaction-capable database client.',
      }],
    });
  }

  const appliedCommandIds = admission.admittedCommands.map(cmd => cmd.commandId);

  try {
    return await dbClient.withTransaction(async client => {
      const policy = await lockPolicyForNativeIntentChange(client, normalizedPolicyId);

      if (!policy) {
        return buildPolicyNativeIntentChangeResult({
          statusId: POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.RETRYABLE,
          policyId: normalizedPolicyId,
          actorId,
          expectedRevision,
          risks: [{
            riskId: POLICY_NATIVE_INTENT_CHANGE_RESULT_RISK_IDS.POLICY_NOT_FOUND,
            message: 'Policy not found.',
          }],
        });
      }

      const activeIntent = await lockActiveNativeIntentForChange(client, {
        policyId: normalizedPolicyId,
        libraryId: policy.library_id,
      });

      if (!activeIntent) {
        return buildPolicyNativeIntentChangeResult({
          statusId: POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.UNAVAILABLE_AUTHORITY,
          policyId: normalizedPolicyId,
          actorId,
          expectedRevision,
          risks: [{
            riskId: POLICY_NATIVE_INTENT_CHANGE_RESULT_RISK_IDS.NO_ACTIVE_INTENT_AFTER_LOCK,
            message: 'No active native intent found after locking the policy row.',
          }],
        });
      }

      const lockedRevision = Number(activeIntent.intent_version);
      if (lockedRevision !== Number(expectedRevision)) {
        return buildPolicyNativeIntentChangeResult({
          statusId: POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.STALE_REVISION,
          policyId: normalizedPolicyId,
          actorId,
          expectedRevision,
          currentRevision: lockedRevision,
          risks: [{
            riskId: POLICY_NATIVE_INTENT_CHANGE_RESULT_RISK_IDS.REVISION_MISMATCH_AFTER_LOCK,
            message: 'Revision changed between admission and transaction lock.',
          }],
        });
      }

      const deactivated = await deactivateActiveNativeIntentForChange({
        client,
        intentId: activeIntent.id,
        updated_at: now,
      });

      if (!deactivated) {
        throw new Error('Failed to deactivate the current active intent (CAS guard failed).');
      }

      const newVersion = lockedRevision + 1;
      const newIntent = await insertNewNativeIntentVersion({
        client,
        policyId: normalizedPolicyId,
        libraryId: policy.library_id,
        intentVersion: newVersion,
        source: activeIntent.source || 'native_intent',
        inferenceState: activeIntent.inference_state || 'inferred',
        validationStatus: activeIntent.validation_status || 'valid',
        createdAt: now,
      });

      if (!newIntent?.id) {
        throw new Error('Failed to insert the new native intent version.');
      }

      const COMMAND_TO_COLLECTION = {
        [POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_PURPOSE]: 'purpose',
        [POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_HARD_LIMITS]: 'hard_limits',
        [POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_AVOID_RULES]: 'avoid',
        [POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_HELPFUL_MATCHES]: 'helpful_hints',
      };

      const changedCollections = appliedCommandIds
        .map(id => COMMAND_TO_COLLECTION[id])
        .filter(Boolean);

      const hasRoutingChange = appliedCommandIds.includes(
        POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_ROUTING_TARGET);
      const hasReviewTriggerChange = appliedCommandIds.includes(
        POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_REVIEW_TRIGGERS);

      await copyRulesFromPreviousIntent({
        client,
        oldIntentId: activeIntent.id,
        newIntentId: newIntent.id,
        excludeCollections: changedCollections,
      });

      for (const command of admission.admittedCommands) {
        const collection = COMMAND_TO_COLLECTION[command.commandId];
        if (collection) {
          await insertRulesForCollection({
            client,
            intentId: newIntent.id,
            collection,
            entries: command.values,
          });
        }
      }

      if (hasRoutingChange) {
        const routingCommand = admission.admittedCommands.find(
          cmd => cmd.commandId === POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_ROUTING_TARGET);
        await insertRoutingTargetForChange({
          client,
          intentId: newIntent.id,
          libraryId: policy.library_id,
          routingTarget: routingCommand?.values?.[0] ?? {},
        });
      } else {
        await copyRoutingTargetFromPreviousIntent({
          client,
          oldIntentId: activeIntent.id,
          newIntentId: newIntent.id,
          libraryId: policy.library_id,
        });
      }

      if (hasReviewTriggerChange) {
        const reviewCommand = admission.admittedCommands.find(
          cmd => cmd.commandId === POLICY_NATIVE_INTENT_CHANGE_COMMAND_IDS.UPDATE_REVIEW_TRIGGERS);
        const reviewBehavior = reviewCommand?.values?.[0] ?? activeIntent.review_behavior ?? {};
        await updateReviewBehavior({
          client,
          intentId: newIntent.id,
          reviewBehavior,
        });
      }

      const eventId = await insertNativeIntentChangeEvent({
        client,
        intentId: newIntent.id,
        policyId: normalizedPolicyId,
        actorType: 'manual_operator',
        actorId,
        sourceVersion: lockedRevision,
        targetVersion: newVersion,
        reasonCode: 'native_intent_change',
        summary: `Applied ${appliedCommandIds.length} change command(s): ${appliedCommandIds.join(', ')}`,
        metadata: { appliedCommandIds },
      });

      return buildPolicyNativeIntentChangeResult({
        statusId: POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED,
        policyId: normalizedPolicyId,
        actorId,
        expectedRevision,
        currentRevision: lockedRevision,
        newIntentId: newIntent.id,
        newIntentVersion: newVersion,
        appliedCommandIds,
        migrationEventId: eventId,
      });
    });
  } catch {
    return buildPolicyNativeIntentChangeResult({
      statusId: POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.FAILED_ROLLED_BACK,
      policyId: normalizedPolicyId,
      actorId,
      expectedRevision,
      risks: [{
        riskId: POLICY_NATIVE_INTENT_CHANGE_RESULT_RISK_IDS.TRANSACTION_FAILED,
        message: 'Native intent change failed and the transaction was rolled back.',
      }],
    });
  }
}

export {
  POLICY_NATIVE_INTENT_CHANGE_RESULT_RISK_IDS,
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS,
  applyPolicyNativeIntentChange,
};
