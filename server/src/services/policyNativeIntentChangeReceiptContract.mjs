/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';

export const POLICY_NATIVE_INTENT_CHANGE_RECEIPT_TABLE =
  'policy_native_intent_change_receipts';
export const POLICY_NATIVE_INTENT_CHANGE_RECEIPT_VERSION = 1;
export const POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RESULT_STATUS_ID = 'applied';

const ALLOWED_COMMAND_IDS = new Set([
  'update_purpose',
  'update_hard_limits',
  'update_avoid_rules',
  'update_helpful_matches',
  'update_routing_target',
  'update_review_triggers',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeString(value, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function normalizeAppliedCommandIds(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > ALLOWED_COMMAND_IDS.size) {
    return null;
  }

  const commandIds = value.map(commandId => normalizeString(commandId, 80));
  if (commandIds.some(commandId => !commandId || !ALLOWED_COMMAND_IDS.has(commandId))) {
    return null;
  }

  return commandIds;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }

  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError('Native intent change receipt values must be JSON serializable.');
  }
  return serialized;
}

function normalizeCommand(command) {
  const value = asObject(command);
  const commandId = normalizeString(value.commandId ?? value.command_id, 80);
  if (!commandId || value.values === undefined) {
    throw new TypeError('Native intent change receipts require canonical admitted commands.');
  }

  // Stable serialization verifies exact semantics while preserving command order.
  stableJson(value.values);
  return { commandId, values: value.values };
}

export function buildPolicyNativeIntentChangeCommandFingerprint({
  policyId,
  actorId,
  expectedRevision,
  changeCommands,
} = {}) {
  const normalizedPolicyId = normalizePositiveInteger(policyId);
  const normalizedActorId = normalizePositiveInteger(actorId);
  const normalizedExpectedRevision = normalizePositiveInteger(expectedRevision);
  const commands = Array.isArray(changeCommands) ? changeCommands.map(normalizeCommand) : [];

  if (!normalizedPolicyId || !normalizedActorId || !normalizedExpectedRevision || commands.length === 0) {
    throw new TypeError('Native intent change receipts require an actor, policy, revision, and admitted commands.');
  }

  return createHash('sha256')
    .update(stableJson({
      version: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_VERSION,
      policyId: normalizedPolicyId,
      actorId: normalizedActorId,
      expectedRevision: normalizedExpectedRevision,
      changeCommands: commands,
    }), 'utf8')
    .digest('hex');
}

export function normalizePolicyNativeIntentChangeReceiptRow(value) {
  const row = asObject(value);
  const id = normalizePositiveInteger(row.id);
  const policyId = normalizePositiveInteger(row.policy_id ?? row.policyId);
  const actorId = normalizePositiveInteger(row.actor_id ?? row.actorId);
  const sourceIntentVersion = normalizePositiveInteger(
    row.source_intent_version ?? row.sourceIntentVersion,
  );
  const targetIntentId = normalizePositiveInteger(row.target_intent_id ?? row.targetIntentId);
  const targetIntentVersion = normalizePositiveInteger(
    row.target_intent_version ?? row.targetIntentVersion,
  );
  const migrationEventId = normalizePositiveInteger(row.migration_event_id ?? row.migrationEventId);
  const receiptVersion = Number(row.receipt_version ?? row.receiptVersion);
  const idempotencyKey = normalizeString(row.idempotency_key ?? row.idempotencyKey, 128);
  const commandFingerprint = normalizeString(
    row.command_fingerprint ?? row.commandFingerprint,
    64,
  );
  const resultStatusId = normalizeString(row.result_status_id ?? row.resultStatusId, 32);
  const appliedCommandIds = normalizeAppliedCommandIds(
    row.applied_command_ids ?? row.appliedCommandIds,
  );

  if (
    !id || !policyId || !actorId || !sourceIntentVersion || !targetIntentId ||
    !targetIntentVersion || !migrationEventId || receiptVersion !== POLICY_NATIVE_INTENT_CHANGE_RECEIPT_VERSION ||
    !idempotencyKey || !/^[A-Za-z0-9][A-Za-z0-9_-]{31,127}$/u.test(idempotencyKey) ||
    !commandFingerprint || !/^[a-f0-9]{64}$/u.test(commandFingerprint) ||
    !appliedCommandIds ||
    resultStatusId !== POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RESULT_STATUS_ID
  ) {
    return null;
  }

  return {
    id,
    receiptVersion,
    policyId,
    actorId,
    idempotencyKey,
    commandFingerprint,
    sourceIntentVersion,
    targetIntentId,
    targetIntentVersion,
    migrationEventId,
    resultStatusId,
    appliedCommandIds,
    createdAt: row.created_at ?? row.createdAt ?? null,
  };
}

export function receiptMatchesNativeIntentChange({
  receipt,
  policyId,
  actorId,
  commandFingerprint,
} = {}) {
  const normalizedReceipt = normalizePolicyNativeIntentChangeReceiptRow(receipt);
  return normalizedReceipt !== null &&
    normalizedReceipt.policyId === normalizePositiveInteger(policyId) &&
    normalizedReceipt.actorId === normalizePositiveInteger(actorId) &&
    normalizedReceipt.commandFingerprint === normalizeString(commandFingerprint, 64);
}

export function buildPolicyNativeIntentChangeReceiptRecord({
  policyId,
  actorId,
  idempotencyKey,
  commandFingerprint,
  sourceIntentVersion,
  targetIntentId,
  targetIntentVersion,
  migrationEventId,
  appliedCommandIds,
  createdAt,
} = {}) {
  const record = normalizePolicyNativeIntentChangeReceiptRow({
    id: 1,
    receipt_version: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_VERSION,
    policy_id: policyId,
    actor_id: actorId,
    idempotency_key: idempotencyKey,
    command_fingerprint: commandFingerprint,
    source_intent_version: sourceIntentVersion,
    target_intent_id: targetIntentId,
    target_intent_version: targetIntentVersion,
    migration_event_id: migrationEventId,
    applied_command_ids: appliedCommandIds,
    result_status_id: POLICY_NATIVE_INTENT_CHANGE_RECEIPT_RESULT_STATUS_ID,
    created_at: createdAt,
  });

  if (!record) {
    throw new TypeError('Native intent change receipt data is invalid.');
  }

  return record;
}
