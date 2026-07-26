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
  asObject,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

const POLICY_PROFILE_REFRESH_OUTBOX_TABLE = 'policy_profile_refresh_outbox';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

function requireTransactionClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Profile refresh outbox persistence requires a transaction client.');
  }
}

function normalizeOutboxRow(row = {}) {
  const source = asObject(row);

  return {
    id: normalizeIdentifier(source.id),
    sourceId: normalizeString(source.source_id ?? source.sourceId, 80) || null,
    sourceEventId: normalizeString(source.source_event_id ?? source.sourceEventId, 160) || null,
    classificationId: normalizeIdentifier(source.classification_id ?? source.classificationId),
    libraryId: normalizeIdentifier(source.library_id ?? source.libraryId),
    learningOperationId: normalizeString(
      source.learning_operation_id ?? source.learningOperationId,
      80,
    ) || null,
    learningTierId: normalizeString(source.learning_tier_id ?? source.learningTierId, 40) || null,
    candidateKey: normalizeString(source.candidate_key ?? source.candidateKey, 160) || null,
    refreshReasonId: normalizeString(
      source.refresh_reason_id ?? source.refreshReasonId,
      80,
    ) || null,
    createdAt: source.created_at ?? source.createdAt ?? null,
  };
}

async function insertPolicyProfileRefreshOutboxRecord({ client, record = {} } = {}) {
  requireTransactionClient(client);

  const source = asObject(record);
  const result = await client.query(
    `INSERT INTO ${POLICY_PROFILE_REFRESH_OUTBOX_TABLE} (
       source_id,
       source_event_id,
       classification_id,
       library_id,
       learning_operation_id,
       learning_tier_id,
       candidate_key,
       refresh_reason_id,
       source_system
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (source_id, source_event_id) DO NOTHING
     RETURNING
       id,
       source_id,
       source_event_id,
       classification_id,
       library_id,
       learning_operation_id,
       learning_tier_id,
       candidate_key,
       refresh_reason_id,
       created_at`,
    [
      source.sourceId,
      source.sourceEventId,
      source.classificationId,
      source.libraryId,
      source.learningOperationId,
      source.learningTierId,
      source.candidateKey,
      source.refreshReasonId,
      source.sourceSystem,
    ],
  );

  return normalizeOutboxRow(firstRow(result));
}

async function findPolicyProfileRefreshOutboxRecord({
  client,
  sourceId,
  sourceEventId,
} = {}) {
  requireTransactionClient(client);

  const result = await client.query(
    `SELECT
       id,
       source_id,
       source_event_id,
       classification_id,
       library_id,
       learning_operation_id,
       learning_tier_id,
       candidate_key,
       refresh_reason_id,
       created_at
     FROM ${POLICY_PROFILE_REFRESH_OUTBOX_TABLE}
     WHERE source_id = $1
       AND source_event_id = $2`,
    [sourceId, sourceEventId],
  );

  return normalizeOutboxRow(firstRow(result));
}

async function enqueuePolicyProfileRefresh({ client, record = {} } = {}) {
  const inserted = await insertPolicyProfileRefreshOutboxRecord({ client, record });
  if (inserted.id) {
    return { outbox: inserted, replayed: false };
  }

  const existing = await findPolicyProfileRefreshOutboxRecord({
    client,
    sourceId: record.sourceId,
    sourceEventId: record.sourceEventId,
  });
  if (!existing.id) {
    throw new Error('Profile refresh outbox conflict did not yield an existing record.');
  }

  return { outbox: existing, replayed: true };
}

const policyProfileRefreshOutboxRepository = Object.freeze({
  enqueue: enqueuePolicyProfileRefresh,
  find: findPolicyProfileRefreshOutboxRecord,
});

export {
  POLICY_PROFILE_REFRESH_OUTBOX_TABLE,
  enqueuePolicyProfileRefresh,
  findPolicyProfileRefreshOutboxRecord,
  insertPolicyProfileRefreshOutboxRecord,
  normalizeOutboxRow,
  policyProfileRefreshOutboxRepository,
  requireTransactionClient,
};
