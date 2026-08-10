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
  POLICY_RUNTIME_QUESTION_DECISION_STATUS_IDS,
} from './policyRuntimeQuestionDecisionPresentation.mjs';
import {
  buildPolicyRuntimeQuestionAnswerContract,
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
} from './policyRuntimeQuestionAnswerContract.mjs';

export const POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_INVENTORY_VERSION =
  'policy.runtime_historic_route_safety_refresh_inventory.v1';

export const POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_REASON_ID =
  'historical_route_safety_details_unavailable';

export const POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_MAX_RECORDS = 50;
export const POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_DEFAULT_RECORDS = 25;

const PENDING_STATUS_IDS = Object.freeze([
  'awaiting_decision',
  'pending_retry',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeBoundedInteger(value, fallback, maximum) {
  if (value === undefined || value === null || value === '') return fallback;

  const parsed = positiveInteger(value);
  if (!parsed) return fallback;

  return Math.min(parsed, maximum);
}

function parsePersistedObject(value) {
  if (typeof value !== 'string') return asObject(value);

  try {
    return asObject(JSON.parse(value));
  } catch {
    return {};
  }
}

function normalizeTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;

  seen.add(value);
  Object.values(value).forEach(child => deepFreeze(child, seen));
  return Object.freeze(value);
}

function hasOnlyAllowedFields(value, fields) {
  return Object.keys(asObject(value)).every(field => fields.has(field));
}

function buildRefreshRecord(row = {}) {
  const classificationId = positiveInteger(row.id);
  if (!classificationId) return null;

  const question = parsePersistedObject(row.policy_question);
  const answerContract = buildPolicyRuntimeQuestionAnswerContract({
    classification: {
      id: classificationId,
      title: row.title,
      year: row.year,
      media_type: row.media_type,
      status: row.status,
      confidence: row.confidence,
      method: row.method,
      metadata: parsePersistedObject(row.metadata),
    },
    question,
  });

  if (answerContract?.decision_summary?.deterministic?.status_id !==
      POLICY_RUNTIME_QUESTION_DECISION_STATUS_IDS.HISTORICAL_ROUTE_SAFETY_DETAILS_UNAVAILABLE) {
    return null;
  }

  return {
    classificationId,
    pendingStatus: PENDING_STATUS_IDS.includes(row.status) ? row.status : null,
    candidateItem: answerContract.candidate_item,
    reasonId: POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_REASON_ID,
    retry: {
      actionId: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.RETRY_CLASSIFICATION,
      available: true,
      execution: 'separate_authorized_command_required',
    },
  };
}

function validateInventoryReport(report = {}) {
  const source = asObject(report);
  const records = asArray(source.records);
  const plan = asObject(source.operatorRetryPlan);
  const sideEffects = asObject(source.sideEffects);
  const issues = [];

  if (source.version !== POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_INVENTORY_VERSION) {
    issues.push('invalid_version');
  }
  if (source.mode !== 'read_only') issues.push('inventory_not_read_only');
  if (records.length > POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_MAX_RECORDS) {
    issues.push('record_bound_exceeded');
  }
  if (records.some(record => record?.reasonId !==
      POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_REASON_ID ||
      record?.retry?.actionId !== POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.RETRY_CLASSIFICATION ||
      record?.retry?.execution !== 'separate_authorized_command_required' ||
      !hasOnlyAllowedFields(record, new Set([
        'classificationId',
        'pendingStatus',
        'candidateItem',
        'reasonId',
        'retry',
      ])) ||
      !hasOnlyAllowedFields(record?.candidateItem, new Set([
        'classification_id',
        'title',
        'year',
        'media_type',
      ])) ||
      !hasOnlyAllowedFields(record?.retry, new Set([
        'actionId',
        'available',
        'execution',
      ])))) {
    issues.push('invalid_refresh_record');
  }
  if (plan.execution !== 'not_executed' ||
      plan.actionId !== POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.RETRY_CLASSIFICATION ||
      !Array.isArray(plan.classificationIds) ||
      plan.classificationIds.length !== records.length ||
      plan.classificationIds.some((id, index) => id !== records[index]?.classificationId)) {
    issues.push('invalid_operator_retry_plan');
  }
  if (Object.values(sideEffects).some(value => value === true)) {
    issues.push('inventory_has_side_effect');
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export function normalizeHistoricRouteSafetyRefreshInventoryOptions({
  cursor = null,
  limit = POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_DEFAULT_RECORDS,
} = {}) {
  return {
    cursor: positiveInteger(cursor),
    limit: normalizeBoundedInteger(
      limit,
      POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_DEFAULT_RECORDS,
      POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_MAX_RECORDS,
    ),
  };
}

export async function loadHistoricRouteSafetyRefreshInventoryRows(dbClient, options = {}) {
  if (!dbClient || typeof dbClient.query !== 'function') {
    throw new TypeError('Historic route-safety refresh inventory requires a database query client.');
  }

  const { cursor, limit } = normalizeHistoricRouteSafetyRefreshInventoryOptions(options);
  const result = await dbClient.query(
    `SELECT
       ch.id,
       ch.status,
       ch.title,
       ch.year,
       ch.media_type,
       ch.confidence,
       ch.method,
     ch.policy_question,
       ch.metadata
     FROM classification_history AS ch
     WHERE ch.status IN ('awaiting_decision', 'pending_retry')
       AND ($1::bigint IS NULL OR ch.id > $1::bigint)
     ORDER BY ch.id ASC
     LIMIT $2`,
    [cursor, limit + 1],
  );
  const rows = asArray(result?.rows);
  const pageRows = rows.slice(0, limit);

  return {
    rows: pageRows,
    cursor,
    limit,
    hasNextPage: rows.length > limit,
    nextCursor: rows.length > limit ? positiveInteger(pageRows.at(-1)?.id) : null,
  };
}

export function buildHistoricRouteSafetyRefreshInventoryReport({
  rows = [],
  cursor = null,
  limit = POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_DEFAULT_RECORDS,
  hasNextPage = false,
  nextCursor = null,
  now = null,
} = {}) {
  const options = normalizeHistoricRouteSafetyRefreshInventoryOptions({ cursor, limit });
  const records = asArray(rows)
    .slice(0, options.limit)
    .map(buildRefreshRecord)
    .filter(Boolean);
  const report = {
    version: POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_INVENTORY_VERSION,
    mode: 'read_only',
    generatedAt: normalizeTimestamp(now),
    records,
    pagination: {
      cursor: options.cursor,
      limit: options.limit,
      hasNextPage: hasNextPage === true,
      nextCursor: hasNextPage === true ? positiveInteger(nextCursor) : null,
    },
    operatorRetryPlan: {
      actionId: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.RETRY_CLASSIFICATION,
      execution: 'not_executed',
      maximumClassificationIds: POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_MAX_RECORDS,
      classificationIds: records.map(record => record.classificationId),
      requiresSeparateAuthorization: true,
    },
    sideEffects: {
      classificationRowsMutated: false,
      retryCommandsExecuted: false,
      routesExecuted: false,
      learningWritten: false,
    },
  };

  return deepFreeze({
    ...report,
    validation: validateInventoryReport(report),
  });
}

export class PolicyRuntimeHistoricRouteSafetyRefreshInventoryService {
  constructor({ db, now = null } = {}) {
    if (!db || typeof db.withTransaction !== 'function') {
      throw new TypeError('Historic route-safety refresh inventory requires a transaction-capable database.');
    }

    this.db = db;
    this.now = now;
  }

  async run(options = {}) {
    const normalizedOptions = normalizeHistoricRouteSafetyRefreshInventoryOptions(options);

    return this.db.withTransaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const inventory = await loadHistoricRouteSafetyRefreshInventoryRows(client, normalizedOptions);

      return buildHistoricRouteSafetyRefreshInventoryReport({
        ...inventory,
        now: this.now,
      });
    });
  }
}

export {
  PENDING_STATUS_IDS as HISTORIC_ROUTE_SAFETY_REFRESH_PENDING_STATUS_IDS,
  validateInventoryReport as validateHistoricRouteSafetyRefreshInventoryReport,
};
