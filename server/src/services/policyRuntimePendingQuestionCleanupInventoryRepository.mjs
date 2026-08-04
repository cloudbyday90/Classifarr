/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_INVENTORY_MAX_RECORDS = 200;
const PENDING_QUESTION_STATUS_IDS = Object.freeze([
  'awaiting_decision',
  'pending_retry',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizePositiveIntegerList(value) {
  return [...new Set(asArray(value)
    .map(normalizePositiveInteger)
    .filter(Boolean))];
}

function normalizeInventoryLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_INVENTORY_MAX_RECORDS;
  }

  return Math.max(1, Math.min(
    Math.trunc(number),
    POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_INVENTORY_MAX_RECORDS,
  ));
}

function normalizeNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function requireQueryClient(dbClient) {
  if (!dbClient || typeof dbClient.query !== 'function') {
    throw new TypeError('Pending-question cleanup inventory requires a database query client.');
  }
}

async function loadPendingQuestionCleanupInventoryRows(dbClient, {
  maxRecords = POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_INVENTORY_MAX_RECORDS,
} = {}) {
  requireQueryClient(dbClient);
  const normalizedMaxRecords = normalizeInventoryLimit(maxRecords);
  const result = await dbClient.query(
    `SELECT
       ch.id,
       ch.status,
       ch.policy_question,
       ch.metadata,
       ch.clarification_response,
       COUNT(*) OVER () AS total_pending_count
     FROM classification_history AS ch
     WHERE ch.status = ANY($1::text[])
     ORDER BY ch.id ASC
     LIMIT $2`,
    [PENDING_QUESTION_STATUS_IDS, normalizedMaxRecords + 1],
  );
  const rows = asArray(result?.rows);
  const totalPendingCount = Math.max(
    normalizeNonNegativeInteger(rows[0]?.total_pending_count),
    rows.length,
  );

  return {
    rows: rows.slice(0, normalizedMaxRecords),
    totalPendingCount,
    maxRecords: normalizedMaxRecords,
    truncated: totalPendingCount > normalizedMaxRecords,
  };
}

async function loadPendingQuestionCleanupContextState(dbClient, {
  libraryIds = [],
  policyIds = [],
} = {}) {
  requireQueryClient(dbClient);
  const normalizedLibraryIds = normalizePositiveIntegerList(libraryIds);
  const normalizedPolicyIds = normalizePositiveIntegerList(policyIds);
  const libraries = normalizedLibraryIds.length === 0
    ? []
    : asArray((await dbClient.query(
      `SELECT id, is_active, updated_at
       FROM libraries
       WHERE id = ANY($1::int[])`,
      [normalizedLibraryIds],
    )).rows);
  const policies = normalizedPolicyIds.length === 0
    ? []
    : asArray((await dbClient.query(
      `SELECT
         lp.id,
         COALESCE(lp.enabled, TRUE) AS enabled,
         GREATEST(
           COALESCE(lp.updated_at, to_timestamp(0)),
           COALESCE(MAX(cp.updated_at), to_timestamp(0))
         ) AS context_version
       FROM library_policies AS lp
       LEFT JOIN policy_presets AS pp ON pp.policy_id = lp.id
       LEFT JOIN content_presets AS cp ON cp.id = pp.preset_id
       WHERE lp.id = ANY($1::int[])
       GROUP BY lp.id, lp.enabled, lp.updated_at`,
      [normalizedPolicyIds],
    )).rows);

  return {
    libraries,
    policies,
  };
}

export {
  PENDING_QUESTION_STATUS_IDS,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_INVENTORY_MAX_RECORDS,
  loadPendingQuestionCleanupContextState,
  loadPendingQuestionCleanupInventoryRows,
  normalizeInventoryLimit,
};
