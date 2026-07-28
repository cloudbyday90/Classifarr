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
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';
import {
  POLICY_NATIVE_PROFILE_REFRESH_SOURCE_ID,
} from './policyNativeProfileRefreshRequest.mjs';
import {
  POLICY_PROFILE_REFRESH_OUTBOX_TABLE,
  requireTransactionClient,
} from './policyProfileRefreshOutboxRepository.mjs';
import {
  POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS,
} from './policyProfileRefreshOutboxVocabulary.mjs';
import {
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS,
} from './policyProfileRefreshOutboxWorkerVocabulary.mjs';

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeFailureHistory(row = {}) {
  const failureCount = Number(row.failure_count);
  const failedOutboxId = normalizeIdentifier(row.id);

  if (!failedOutboxId || !Number.isInteger(failureCount) || failureCount <= 0) {
    return null;
  }

  return {
    failedOutboxId,
    failureCount,
    failureCode: normalizeString(row.failure_code, 80) || null,
  };
}

async function findPolicyNativeProfileRefreshFailureHistory({
  client,
  libraryId,
  sourceEventId,
} = {}) {
  requireTransactionClient(client);

  const normalizedLibraryId = normalizePositiveInteger(libraryId);
  const normalizedSourceEventId = normalizeString(sourceEventId, 160);
  if (!normalizedLibraryId || !normalizedSourceEventId || normalizedSourceEventId.includes(':retry:')) {
    return null;
  }

  const result = await client.query(
    `SELECT
       id,
       failure_code,
       COUNT(*) OVER ()::integer AS failure_count
     FROM ${POLICY_PROFILE_REFRESH_OUTBOX_TABLE}
     WHERE library_id = $1
       AND source_id = $2
       AND request_type = $3
       AND processing_state = $4
       AND (
         source_event_id = $5
         OR starts_with(source_event_id, $5 || ':retry:')
       )
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [
      normalizedLibraryId,
      POLICY_NATIVE_PROFILE_REFRESH_SOURCE_ID,
      POLICY_PROFILE_REFRESH_OUTBOX_REQUEST_TYPE_IDS.NATIVE_READINESS,
      POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.FAILED,
      normalizedSourceEventId,
    ],
  );

  return normalizeFailureHistory(result?.rows?.[0]);
}

const policyNativeProfileRefreshFailureRepository = Object.freeze({
  findHistory: findPolicyNativeProfileRefreshFailureHistory,
});

export {
  findPolicyNativeProfileRefreshFailureHistory,
  normalizeFailureHistory,
  policyNativeProfileRefreshFailureRepository,
};
