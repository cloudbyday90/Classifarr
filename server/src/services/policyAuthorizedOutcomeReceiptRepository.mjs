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
  POLICY_FINAL_OUTCOME_STATUS_IDS,
} from './policyFinalOutcomeNormalizer.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS,
  buildPolicyAuthorizedOutcomePersistenceCommandAudit,
} from './policyAuthorizedOutcomePersistenceCommand.mjs';
import {
  buildPolicyAuthorizedOutcomeReceiptFingerprint,
} from './policyAuthorizedOutcomeReceiptFingerprint.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS,
  POLICY_AUTHORIZED_OUTCOME_RECEIPT_REASON_IDS,
  POLICY_AUTHORIZED_OUTCOME_RECEIPT_TABLE,
} from './policyAuthorizedOutcomeReceiptVocabulary.mjs';
import {
  asObject,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

const MAX_POSTGRES_BIGINT = 9223372036854775807n;
const WRITABLE_LEARNING_TIER_IDS = new Set([
  'exact_item_memory',
  'compatibility_evidence',
  'identity_evidence',
]);

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

function normalizeDatabaseIdentifier(value, { required = false } = {}) {
  const identifier = normalizeIdentifier(value);
  if (!identifier) return required ? null : null;

  try {
    return BigInt(identifier) <= MAX_POSTGRES_BIGINT ? identifier : null;
  } catch {
    return null;
  }
}

function normalizeReceiptRow(row = {}) {
  const source = asObject(row);

  return {
    id: normalizeDatabaseIdentifier(source.id),
    receiptVersion: Number(source.receipt_version ?? source.receiptVersion) || 1,
    sourceId: normalizeString(source.source_id ?? source.sourceId, 80) || null,
    sourceEventId: normalizeString(source.source_event_id ?? source.sourceEventId, 160) || null,
    commandFingerprint: normalizeString(
      source.command_fingerprint ?? source.commandFingerprint,
      64,
    ) || null,
    classificationId: normalizeDatabaseIdentifier(
      source.classification_id ?? source.classificationId,
      { required: true },
    ),
    destinationLibraryId: normalizeDatabaseIdentifier(
      source.destination_library_id ?? source.destinationLibraryId,
    ),
    finalOutcomeStatusId: normalizeString(
      source.final_outcome_status_id ?? source.finalOutcomeStatusId,
      80,
    ) || null,
    persistenceStatusId: normalizeString(
      source.persistence_status_id ?? source.persistenceStatusId,
      32,
    ) || null,
    learningTierId: normalizeString(source.learning_tier_id ?? source.learningTierId, 40) || null,
    createdAt: source.created_at ?? source.createdAt ?? null,
  };
}

function createPolicyAuthorizedOutcomeSourceEventReceiptRecord(command = {}) {
  const source = asObject(command);
  const audit = buildPolicyAuthorizedOutcomePersistenceCommandAudit(source);
  const currentState = asObject(source.currentState);
  const finalOutcome = asObject(source.finalOutcome);
  const operations = asObject(source.operations);
  const learning = operations.learning === null ? null : asObject(operations.learning);
  const classificationId = normalizeDatabaseIdentifier(currentState.classificationId, { required: true });
  const destinationLibraryId = normalizeDatabaseIdentifier(finalOutcome.destinationLibraryId);
  const sourceId = normalizeString(source.sourceId, 80);
  const sourceEventId = normalizeString(source.sourceEventId, 160);
  const finalOutcomeStatusId = normalizeString(finalOutcome.status, 80);
  const persistenceStatusId = normalizeString(source.statusId, 32);
  const learningTierId = learning ? normalizeString(learning.tierId, 40) || null : null;

  if (source.ok !== true || audit.ok !== true) {
    throw new TypeError('Source-event receipts require an admitted authorized persistence command.');
  }
  if (!sourceId || !sourceEventId || !classificationId ||
      !Object.values(POLICY_FINAL_OUTCOME_STATUS_IDS).includes(finalOutcomeStatusId)) {
    throw new TypeError('Source-event receipts require complete bounded outcome correlation.');
  }
  if (!Object.values(POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS)
    .filter(statusId => statusId !== POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.BLOCKED)
    .includes(persistenceStatusId)) {
    throw new TypeError('Source-event receipts require a persistable command status.');
  }
  if (persistenceStatusId === POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.READY &&
      !WRITABLE_LEARNING_TIER_IDS.has(learningTierId)) {
    throw new TypeError('Ready source-event receipts require an allowlisted learning tier.');
  }
  if (persistenceStatusId === POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.OUTCOME_ONLY &&
      learningTierId !== null) {
    throw new TypeError('Outcome-only source-event receipts cannot include a learning tier.');
  }

  return {
    sourceId,
    sourceEventId,
    commandFingerprint: buildPolicyAuthorizedOutcomeReceiptFingerprint(source),
    classificationId,
    destinationLibraryId,
    finalOutcomeStatusId,
    persistenceStatusId,
    learningTierId,
  };
}

function buildClaimResult({ statusId, receipt, reasonId }) {
  return {
    statusId,
    claimed: statusId === POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS.CLAIMED,
    replayed: statusId === POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS.REPLAYED,
    accepted: statusId !== POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS.SOURCE_EVENT_MISMATCH,
    reasonId,
    receipt,
  };
}

async function insertPolicyAuthorizedOutcomeSourceEventReceipt({ client, record }) {
  const result = await client.query(
    `INSERT INTO ${POLICY_AUTHORIZED_OUTCOME_RECEIPT_TABLE} (
       source_id,
       source_event_id,
       command_fingerprint,
       classification_id,
       destination_library_id,
       final_outcome_status_id,
       persistence_status_id,
       learning_tier_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (source_id, source_event_id) DO NOTHING
     RETURNING
       id,
       receipt_version,
       source_id,
       source_event_id,
       command_fingerprint,
       classification_id,
       destination_library_id,
       final_outcome_status_id,
       persistence_status_id,
       learning_tier_id,
       created_at`,
    [
      record.sourceId,
      record.sourceEventId,
      record.commandFingerprint,
      record.classificationId,
      record.destinationLibraryId,
      record.finalOutcomeStatusId,
      record.persistenceStatusId,
      record.learningTierId,
    ],
  );

  return normalizeReceiptRow(firstRow(result));
}

async function findPolicyAuthorizedOutcomeSourceEventReceipt({ client, sourceId, sourceEventId }) {
  const result = await client.query(
    `SELECT
       id,
       receipt_version,
       source_id,
       source_event_id,
       command_fingerprint,
       classification_id,
       destination_library_id,
       final_outcome_status_id,
       persistence_status_id,
       learning_tier_id,
       created_at
     FROM ${POLICY_AUTHORIZED_OUTCOME_RECEIPT_TABLE}
     WHERE source_id = $1
       AND source_event_id = $2`,
    [sourceId, sourceEventId],
  );

  return normalizeReceiptRow(firstRow(result));
}

async function claimPolicyAuthorizedOutcomeSourceEventReceipt({ client, command } = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Source-event receipt claims require a caller-owned transaction client.');
  }

  const record = createPolicyAuthorizedOutcomeSourceEventReceiptRecord(command);
  const insertedReceipt = await insertPolicyAuthorizedOutcomeSourceEventReceipt({ client, record });

  if (insertedReceipt.id) {
    return buildClaimResult({
      statusId: POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS.CLAIMED,
      reasonId: POLICY_AUTHORIZED_OUTCOME_RECEIPT_REASON_IDS.CLAIMED,
      receipt: insertedReceipt,
    });
  }

  const existingReceipt = await findPolicyAuthorizedOutcomeSourceEventReceipt({
    client,
    sourceId: record.sourceId,
    sourceEventId: record.sourceEventId,
  });
  if (!existingReceipt.id) {
    throw new Error('Source-event receipt conflict did not yield an existing receipt.');
  }

  if (existingReceipt.commandFingerprint === record.commandFingerprint) {
    return buildClaimResult({
      statusId: POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS.REPLAYED,
      reasonId: POLICY_AUTHORIZED_OUTCOME_RECEIPT_REASON_IDS.REPLAYED,
      receipt: existingReceipt,
    });
  }

  return buildClaimResult({
    statusId: POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS.SOURCE_EVENT_MISMATCH,
    reasonId: POLICY_AUTHORIZED_OUTCOME_RECEIPT_REASON_IDS.SOURCE_EVENT_MISMATCH,
    receipt: existingReceipt,
  });
}

export {
  POLICY_AUTHORIZED_OUTCOME_RECEIPT_CLAIM_STATUS_IDS,
  POLICY_AUTHORIZED_OUTCOME_RECEIPT_REASON_IDS,
  claimPolicyAuthorizedOutcomeSourceEventReceipt,
  createPolicyAuthorizedOutcomeSourceEventReceiptRecord,
  findPolicyAuthorizedOutcomeSourceEventReceipt,
};
