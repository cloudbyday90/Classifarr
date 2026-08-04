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
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS,
  buildPolicyRuntimePendingQuestionCleanupPlan,
} from './policyRuntimePendingQuestionCleanupPlan.mjs';
import {
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_INVENTORY_MAX_RECORDS,
  normalizeInventoryLimit,
} from './policyRuntimePendingQuestionCleanupInventoryRepository.mjs';
import { extractQuestionContext } from '../utils/policyQuestionContext.mjs';

const POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_INVENTORY_REPORT_VERSION =
  'policy.runtime_pending_question_cleanup_inventory.v1';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function parsePersistedJsonValue(value) {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parsePersistedObject(value) {
  return asObject(parsePersistedJsonValue(value));
}

function normalizeTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeContextTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function makeStateMap(rows, valueBuilder) {
  return new Map(asArray(rows)
    .map(row => [normalizePositiveInteger(row?.id), valueBuilder(row)])
    .filter(([id]) => id));
}

function buildInventoryEntry(row = {}) {
  const policyQuestion = parsePersistedObject(row.policy_question);
  const context = extractQuestionContext(policyQuestion);

  return {
    classification: {
      id: row.id,
      status: row.status,
      policy_question: policyQuestion,
      metadata: parsePersistedObject(row.metadata),
      clarification_response: parsePersistedJsonValue(row.clarification_response),
    },
    context,
  };
}

function collectPendingQuestionCleanupInventoryReferences(rows = []) {
  const entries = asArray(rows).map(buildInventoryEntry);
  const libraryIds = new Set();
  const policyIds = new Set();

  entries.forEach(({ context }) => {
    context.libraryIds.forEach(libraryId => libraryIds.add(libraryId));
    context.policyIds.forEach(policyId => policyIds.add(policyId));
  });

  return {
    entries,
    libraryIds: [...libraryIds].sort((left, right) => left - right),
    policyIds: [...policyIds].sort((left, right) => left - right),
  };
}

function buildContextState({
  context = {},
  libraryStateById,
  policyStateById,
} = {}) {
  const policyReferencesAreActive = context.policyIds.every(policyId =>
    policyStateById.get(policyId)?.enabled === true
  );
  const timestamps = [
    ...context.libraryIds.map(libraryId => libraryStateById.get(libraryId)?.updatedAt),
    ...context.policyIds.map(policyId => policyStateById.get(policyId)?.contextVersion),
  ]
    .map(normalizeContextTimestamp)
    .filter(Boolean)
    .map(value => new Date(value).getTime());
  const mostRecentTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : null;

  return {
    currentContextVersion: mostRecentTimestamp === null
      ? null
      : new Date(mostRecentTimestamp).toISOString(),
    contextEvaluated: policyReferencesAreActive,
  };
}

function createCountMap(keys) {
  return Object.fromEntries(keys.map(key => [key, 0]));
}

function countPlans(plans) {
  const actionCounts = createCountMap(Object.values(
    POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS,
  ));
  const statusCounts = createCountMap(Object.values(
    POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS,
  ));
  const reasonCounts = {};

  plans.forEach(plan => {
    actionCounts[plan.actionId] += 1;
    statusCounts[plan.statusId] += 1;
    plan.reasonIds.forEach(reasonId => {
      reasonCounts[reasonId] = (reasonCounts[reasonId] || 0) + 1;
    });
  });

  return {
    actionCounts,
    statusCounts,
    reasonCounts: Object.fromEntries(Object.entries(reasonCounts)
      .sort(([left], [right]) => left.localeCompare(right))),
  };
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;

  seen.add(value);
  Object.values(value).forEach(child => deepFreeze(child, seen));
  return Object.freeze(value);
}

function validatePolicyRuntimePendingQuestionCleanupInventoryReport(report = {}) {
  const source = asObject(report);
  const issues = [];
  const records = asArray(source.records);
  const sideEffects = asObject(source.sideEffects);

  if (source.version !== POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_INVENTORY_REPORT_VERSION) {
    issues.push('invalid_version');
  }
  if (source.mode !== 'dry_run') {
    issues.push('inventory_not_dry_run');
  }
  if (records.length > source.summary?.maxRecordCount) {
    issues.push('record_bound_exceeded');
  }
  if (source.summary?.emittedRecordCount !== records.length) {
    issues.push('emitted_record_count_mismatch');
  }
  if (records.some(record => record?.learning?.canWriteLearning !== false ||
      record?.audit?.ok !== true)) {
    issues.push('invalid_cleanup_plan');
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

function buildPolicyRuntimePendingQuestionCleanupInventoryReport({
  rows = [],
  totalPendingCount = 0,
  maxRecords = POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_INVENTORY_MAX_RECORDS,
  truncated = false,
  contextState = {},
  now = null,
} = {}) {
  const normalizedMaxRecords = normalizeInventoryLimit(maxRecords);
  const sourceRows = asArray(rows);
  const boundedRows = sourceRows.slice(0, normalizedMaxRecords);
  const normalizedTotalPendingCount = Math.max(
    0,
    Number(totalPendingCount) || 0,
    sourceRows.length,
  );
  const references = collectPendingQuestionCleanupInventoryReferences(boundedRows);
  const libraryStateById = makeStateMap(contextState.libraries, row => ({
    active: row?.is_active === true,
    updatedAt: normalizeContextTimestamp(row?.updated_at),
  }));
  const policyStateById = makeStateMap(contextState.policies, row => ({
    enabled: row?.enabled === true,
    contextVersion: normalizeContextTimestamp(row?.context_version),
  }));
  const activeLibraryIds = [...libraryStateById.entries()]
    .filter(([, state]) => state.active)
    .map(([libraryId]) => libraryId)
    .sort((left, right) => left - right);
  let contextUnavailableCount = 0;
  const records = references.entries.map(({ classification, context }) => {
    const state = buildContextState({
      context,
      libraryStateById,
      policyStateById,
    });
    if (!state.contextEvaluated) contextUnavailableCount += 1;

    return buildPolicyRuntimePendingQuestionCleanupPlan({
      classification,
      currentContextVersion: state.currentContextVersion,
      activeLibraryIds,
      contextEvaluated: state.contextEvaluated,
    });
  });
  const counts = countPlans(records);
  const report = {
    version: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_INVENTORY_REPORT_VERSION,
    mode: 'dry_run',
    generatedAt: normalizeTimestamp(now),
    records,
    summary: {
      totalPendingCount: normalizedTotalPendingCount,
      emittedRecordCount: records.length,
      maxRecordCount: normalizedMaxRecords,
      truncated: truncated === true || sourceRows.length > normalizedMaxRecords ||
        normalizedTotalPendingCount > normalizedMaxRecords,
      contextUnavailableCount,
      activeCandidateLibraryCount: activeLibraryIds.length,
      activePolicyCount: [...policyStateById.values()]
        .filter(policy => policy.enabled)
        .length,
      ...counts,
    },
    sideEffects: {
      classificationRowsMutated: false,
      questionsRegenerated: false,
      outcomesResolved: false,
      learningWritten: false,
      cleanupAuditWritten: false,
    },
  };

  return deepFreeze({
    ...report,
    validation: validatePolicyRuntimePendingQuestionCleanupInventoryReport(report),
  });
}

export {
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_INVENTORY_REPORT_VERSION,
  buildPolicyRuntimePendingQuestionCleanupInventoryReport,
  collectPendingQuestionCleanupInventoryReferences,
  validatePolicyRuntimePendingQuestionCleanupInventoryReport,
};
