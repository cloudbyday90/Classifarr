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
  normalizeBaseSourceEventId,
} from './policyNativeProfileRefreshCircuit.mjs';
import {
  POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_RETENTION_DAYS,
} from './policyNativeProfileRefreshCircuitVocabulary.mjs';
import {
  POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_TABLE,
} from './policyNativeProfileRefreshCircuitRepository.mjs';
import {
  POLICY_PROFILE_REFRESH_OUTBOX_TABLE,
} from './policyProfileRefreshOutboxRepository.mjs';
import {
  POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS,
} from './policyProfileRefreshOutboxVocabulary.mjs';
import {
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS,
} from './policyProfileRefreshOutboxWorkerVocabulary.mjs';

function normalizePositiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeProtectedRevision(value = {}) {
  const libraryId = Number(value.libraryId);
  const sourceEventId = normalizeBaseSourceEventId(value.sourceEventId);
  return Number.isInteger(libraryId) && libraryId > 0 && sourceEventId
    ? { libraryId, sourceEventId }
    : null;
}

function buildProtectedRevisionArrays(protectedRevisions = []) {
  const revisions = protectedRevisions
    .map(normalizeProtectedRevision)
    .filter(Boolean);

  return {
    libraryIds: revisions.map(revision => revision.libraryId),
    sourceEventIds: revisions.map(revision => revision.sourceEventId),
  };
}

async function compactPolicyNativeProfileRefreshCircuitHistory({
  client,
  protectedRevisions = [],
  retentionDays = POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_RETENTION_DAYS,
} = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Native profile refresh circuit compaction requires a database client.');
  }
  const protectedRevisionArrays = buildProtectedRevisionArrays(protectedRevisions);
  const result = await client.query(
    `WITH protected_revisions AS (
       SELECT library_id, source_event_id
       FROM unnest($1::bigint[], $2::text[]) AS protected_revision(library_id, source_event_id)
     ),
     removed_circuits AS (
       DELETE FROM ${POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_TABLE} AS circuit
       WHERE circuit.updated_at < NOW() - ($3::integer * INTERVAL '1 day')
         AND NOT EXISTS (
           SELECT 1
           FROM protected_revisions AS protected_revision
           WHERE protected_revision.library_id = circuit.library_id
             AND protected_revision.source_event_id = circuit.source_event_id
         )
       RETURNING 1
     ),
     removed_outbox AS (
       DELETE FROM ${POLICY_PROFILE_REFRESH_OUTBOX_TABLE} AS outbox
       WHERE outbox.request_type = $4
         AND outbox.processing_state = ANY($5::text[])
         AND outbox.updated_at < NOW() - ($3::integer * INTERVAL '1 day')
         AND NOT EXISTS (
           SELECT 1
           FROM ${POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_TABLE} AS circuit
           WHERE circuit.library_id = outbox.library_id
             AND circuit.source_event_id = split_part(outbox.source_event_id, ':retry:', 1)
         )
         AND NOT EXISTS (
           SELECT 1
           FROM protected_revisions AS protected_revision
           WHERE protected_revision.library_id = outbox.library_id
             AND protected_revision.source_event_id = split_part(outbox.source_event_id, ':retry:', 1)
         )
       RETURNING 1
     )
     SELECT
       (SELECT COUNT(*)::integer FROM removed_circuits) AS circuits_compacted,
       (SELECT COUNT(*)::integer FROM removed_outbox) AS outbox_rows_compacted`,
    [
      protectedRevisionArrays.libraryIds,
      protectedRevisionArrays.sourceEventIds,
      normalizePositiveInteger(retentionDays, POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_RETENTION_DAYS),
      POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS.NATIVE_READINESS,
      [
        POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.COMPLETED,
        POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.FAILED,
      ],
    ],
  );
  const row = Array.isArray(result?.rows) ? result.rows[0] || {} : {};

  return {
    circuitsCompacted: Number(row.circuits_compacted) || 0,
    outboxRowsCompacted: Number(row.outbox_rows_compacted) || 0,
  };
}

const policyNativeProfileRefreshCircuitCompactionRepository = Object.freeze({
  compact: compactPolicyNativeProfileRefreshCircuitHistory,
});

export {
  buildProtectedRevisionArrays,
  compactPolicyNativeProfileRefreshCircuitHistory,
  policyNativeProfileRefreshCircuitCompactionRepository,
};
