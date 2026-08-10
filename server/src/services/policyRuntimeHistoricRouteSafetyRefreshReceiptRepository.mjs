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
  HISTORIC_ROUTE_SAFETY_REFRESH_RECEIPT_ITEM_STATUS_IDS,
  POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_RECEIPT_VERSION,
  isHistoricRouteSafetyRefreshReceiptId,
} from './policyRuntimeHistoricRouteSafetyRefreshReceiptContract.mjs';

const {
  REQUESTED,
  QUEUED,
  SKIPPED,
  FAILED,
} = HISTORIC_ROUTE_SAFETY_REFRESH_RECEIPT_ITEM_STATUS_IDS;

const FINAL_RECEIPT_ITEM_STATUS_IDS = new Set([QUEUED, SKIPPED, FAILED]);
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

function normalizePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function assertQueryClient(client, operation) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError(`Historic route-safety refresh receipt ${operation} requires a database query client.`);
  }
}

function assertReceiptId(receiptId) {
  if (!isHistoricRouteSafetyRefreshReceiptId(receiptId)) {
    throw new TypeError('Historic route-safety refresh receipt ID must be a canonical UUID.');
  }
}

function normalizeClassificationIds(classificationIds) {
  if (!Array.isArray(classificationIds) || classificationIds.length === 0) {
    throw new TypeError('Historic route-safety refresh receipt requires selected classification IDs.');
  }

  const ids = classificationIds.map(normalizePositiveInteger);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    throw new TypeError('Historic route-safety refresh receipt classification IDs must be unique positive integers.');
  }

  return ids;
}

function normalizeExecutionRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new TypeError('Historic route-safety refresh receipt requires final execution records.');
  }

  const normalized = records.map((record) => {
    const classificationId = normalizePositiveInteger(record?.classificationId);
    const executionStatusId = record?.resultStatusId;
    const reasonId = typeof record?.reasonId === 'string' && /^[a-z0-9_]{1,120}$/.test(record.reasonId)
      ? record.reasonId
      : null;

    if (!classificationId || !FINAL_RECEIPT_ITEM_STATUS_IDS.has(executionStatusId) || !reasonId) {
      throw new TypeError('Historic route-safety refresh receipt execution record is invalid.');
    }

    return { classificationId, executionStatusId, reasonId };
  });

  if (new Set(normalized.map(record => record.classificationId)).size !== normalized.length) {
    throw new TypeError('Historic route-safety refresh receipt execution records must be unique.');
  }

  return normalized;
}

/**
 * Stores the narrow, durable receipt projection for the controlled historic
 * retry command. It never persists classification metadata or provider output.
 */
export class PolicyRuntimeHistoricRouteSafetyRefreshReceiptRepository {
  constructor({ db } = {}) {
    if (!db || typeof db.withTransaction !== 'function') {
      throw new TypeError('Historic route-safety refresh receipt repository requires a transaction-capable database.');
    }

    this.db = db;
  }

  async createReceipt({ receiptId, actorId, classificationIds } = {}) {
    assertReceiptId(receiptId);
    const ids = normalizeClassificationIds(classificationIds);
    if (typeof actorId !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(actorId)) {
      throw new TypeError('Historic route-safety refresh receipt actor ID is invalid.');
    }

    return this.db.withTransaction(async (client) => {
      assertQueryClient(client, 'creation');
      await client.query(
        `INSERT INTO policy_runtime_historic_route_safety_refresh_receipts (
           receipt_id,
           actor_id,
           requested_record_count,
           receipt_version
         )
         VALUES ($1::uuid, $2, $3, $4)`,
        [receiptId, actorId, ids.length, POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_RECEIPT_VERSION],
      );
      const itemResult = await client.query(
        `INSERT INTO policy_runtime_historic_route_safety_refresh_receipt_items (
           receipt_id,
           classification_id,
           execution_status
         )
         SELECT $1::uuid, selected.classification_id, $3
         FROM unnest($2::bigint[]) AS selected(classification_id)`,
        [receiptId, ids, REQUESTED],
      );

      if (itemResult.rowCount !== ids.length) {
        throw new Error('Historic route-safety refresh receipt item creation was incomplete.');
      }
    });
  }

  async markRetryQueued({ client, receiptId, classificationId, retryTaskId } = {}) {
    assertQueryClient(client, 'queue recording');
    assertReceiptId(receiptId);
    const normalizedClassificationId = normalizePositiveInteger(classificationId);
    const normalizedRetryTaskId = normalizePositiveInteger(retryTaskId);
    if (!normalizedClassificationId || !normalizedRetryTaskId) {
      throw new TypeError('Historic route-safety refresh queued retry IDs must be positive integers.');
    }

    const result = await client.query(
      `UPDATE policy_runtime_historic_route_safety_refresh_receipt_items
       SET execution_status = $3,
           reason_id = $4,
           retry_task_id = $5,
           queued_at = NOW()
       WHERE receipt_id = $1::uuid
         AND classification_id = $2
         AND execution_status = $6
       RETURNING classification_id`,
      [
        receiptId,
        normalizedClassificationId,
        QUEUED,
        'queued_for_current_runtime_evaluation',
        normalizedRetryTaskId,
        REQUESTED,
      ],
    );

    if (result.rowCount !== 1) {
      throw new Error('Historic route-safety refresh queued retry did not have a pending receipt item.');
    }
  }

  async finalizeReceipt({ receiptId, records } = {}) {
    assertReceiptId(receiptId);
    const normalizedRecords = normalizeExecutionRecords(records);
    const classificationIds = normalizedRecords.map(record => record.classificationId);
    const executionStatusIds = normalizedRecords.map(record => record.executionStatusId);
    const reasonIds = normalizedRecords.map(record => record.reasonId);

    return this.db.withTransaction(async (client) => {
      assertQueryClient(client, 'finalization');
      const itemResult = await client.query(
        `WITH supplied_records AS (
           SELECT *
           FROM unnest($2::bigint[], $3::text[], $4::text[])
             AS supplied(classification_id, execution_status, reason_id)
         )
         UPDATE policy_runtime_historic_route_safety_refresh_receipt_items AS item
         SET execution_status = supplied.execution_status,
             reason_id = supplied.reason_id,
             finalized_at = NOW()
         FROM supplied_records AS supplied
         WHERE item.receipt_id = $1::uuid
           AND item.classification_id = supplied.classification_id
           AND (
             (supplied.execution_status = $5 AND item.execution_status = $5)
             OR (
               supplied.execution_status IN ($6, $7)
               AND item.execution_status = $8
             )
           )
         RETURNING item.classification_id`,
        [receiptId, classificationIds, executionStatusIds, reasonIds, QUEUED, SKIPPED, FAILED, REQUESTED],
      );

      if (itemResult.rowCount !== normalizedRecords.length) {
        throw new Error('Historic route-safety refresh receipt finalization did not match every selected record.');
      }

      const receiptResult = await client.query(
        `UPDATE policy_runtime_historic_route_safety_refresh_receipts
         SET execution_finalized_at = NOW()
         WHERE receipt_id = $1::uuid
           AND requested_record_count = $2
           AND NOT EXISTS (
             SELECT 1
             FROM policy_runtime_historic_route_safety_refresh_receipt_items
             WHERE receipt_id = $1::uuid
               AND execution_status = $3
           )
         RETURNING receipt_id`,
        [receiptId, normalizedRecords.length, REQUESTED],
      );

      if (receiptResult.rowCount !== 1) {
        throw new Error('Historic route-safety refresh receipt could not be finalized.');
      }
    });
  }

  async loadReceipt(client, { receiptId } = {}) {
    assertQueryClient(client, 'reconciliation');
    assertReceiptId(receiptId);

    const receiptResult = await client.query(
      `SELECT
         receipt_id,
         requested_record_count,
         created_at,
         execution_finalized_at,
         receipt_version
       FROM policy_runtime_historic_route_safety_refresh_receipts
       WHERE receipt_id = $1::uuid`,
      [receiptId],
    );
    const receipt = receiptResult.rows[0] || null;
    if (!receipt) return { receipt: null, items: [] };

    const itemResult = await client.query(
      `SELECT
         item.classification_id,
         item.execution_status,
         item.reason_id,
         item.queued_at,
         item.finalized_at,
         source.id IS NOT NULL AS source_record_found,
         source.status AS source_status,
         queue.status AS queue_status,
         runtime.id AS runtime_classification_id,
         runtime.status AS runtime_status,
         runtime.lineage_depth
       FROM policy_runtime_historic_route_safety_refresh_receipt_items AS item
       LEFT JOIN classification_history AS source
         ON source.id = item.classification_id
       LEFT JOIN task_queue AS queue
         ON queue.id = item.retry_task_id
       LEFT JOIN LATERAL (
         WITH RECURSIVE retry_lineage AS (
           SELECT source.id, source.status, source.metadata, 0 AS lineage_depth
           WHERE source.id IS NOT NULL

           UNION ALL

           SELECT replacement.id,
                  replacement.status,
                  replacement.metadata,
                  retry_lineage.lineage_depth + 1
           FROM retry_lineage
           INNER JOIN classification_history AS replacement
             ON replacement.id = CASE
               WHEN (retry_lineage.metadata #>> '{classification_details,outcome_link,replacement_classification_id}') ~ $2
                 THEN (retry_lineage.metadata #>> '{classification_details,outcome_link,replacement_classification_id}')::bigint
               ELSE NULL
             END
           WHERE retry_lineage.lineage_depth < 8
         )
         SELECT id, status, lineage_depth
         FROM retry_lineage
         ORDER BY lineage_depth DESC
         LIMIT 1
       ) AS runtime ON TRUE
       WHERE item.receipt_id = $1::uuid
       ORDER BY item.classification_id ASC`,
      [receiptId, POSITIVE_INTEGER.source],
    );

    return { receipt, items: itemResult.rows };
  }
}
