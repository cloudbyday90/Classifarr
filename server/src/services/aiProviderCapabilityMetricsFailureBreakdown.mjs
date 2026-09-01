/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
} from './aiProviderCapabilityMetricsFailureCategories.mjs';

export const AI_PROVIDER_CAPABILITY_METRICS_FAILURE_BREAKDOWN_VERSION =
  'ai.provider_capability_metrics_failure_breakdown.v1';

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+$/;

const FAILURE_STAGE_DETAILS = Object.freeze([
  Object.freeze({
    id: AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
    label: 'Metric persistence write',
  }),
]);

const SQLSTATE_CATEGORY_DETAILS = Object.freeze([
  Object.freeze({ id: 'connection_exception', label: 'Connection exception' }),
  Object.freeze({ id: 'transaction_rollback', label: 'Transaction rollback' }),
  Object.freeze({ id: 'insufficient_resources', label: 'Insufficient resources' }),
  Object.freeze({ id: 'operator_intervention', label: 'Operator intervention' }),
  Object.freeze({ id: 'system_error', label: 'Database system error' }),
  Object.freeze({ id: 'other_database_condition', label: 'Other database condition' }),
  Object.freeze({ id: 'not_available', label: 'No SQLSTATE available' }),
]);

function normalizeNonNegativeDecimal(value) {
  const normalized = String(value ?? '').trim();
  if (!NON_NEGATIVE_DECIMAL_PATTERN.test(normalized)) return '0';

  return normalized.replace(/^0+(?=\d)/, '');
}

function addNonNegativeDecimals(values) {
  return values.reduce((total, value) => total + BigInt(normalizeNonNegativeDecimal(value)), 0n).toString();
}

function subtractNonNegativeDecimals(minuend, subtrahend) {
  const difference = BigInt(normalizeNonNegativeDecimal(minuend))
    - BigInt(normalizeNonNegativeDecimal(subtrahend));
  return (difference > 0n ? difference : 0n).toString();
}

function countColumnForSqlstateCategory(categoryId) {
  return `sqlstate_${categoryId}_count`;
}

function buildStatus({ totalFailureCount, safeCategoryFailureCount }) {
  if (totalFailureCount === '0') {
    return Object.freeze({
      id: 'not_applicable',
      label: 'No recent persistence warnings',
      message: 'No capability-metric persistence warning is available for category breakdown.',
    });
  }

  if (safeCategoryFailureCount === totalFailureCount) {
    return Object.freeze({
      id: 'complete',
      label: 'Safe categories are available',
      message: 'Each recent warning has a fixed persistence stage and bounded SQLSTATE class.',
    });
  }

  if (safeCategoryFailureCount === '0') {
    return Object.freeze({
      id: 'awaiting_safe_categories',
      label: 'Safe categories are not yet available',
      message: 'Recent warning records predate the fixed category contract or did not retain a safe category.',
    });
  }

  return Object.freeze({
    id: 'partial',
    label: 'Safe categories are partially available',
    message: 'Some recent warning records have fixed categories; older or uncategorized records remain aggregate-only.',
  });
}

/**
 * Builds a bounded diagnostic projection from counts only. Labels are fixed in
 * source, and all database strings except decimal counts are discarded.
 */
export function buildAiProviderCapabilityMetricsFailureBreakdownReport({
  row = null,
  window = null,
} = {}) {
  const stages = FAILURE_STAGE_DETAILS.map(({ id, label }) => Object.freeze({
    id,
    label,
    count: normalizeNonNegativeDecimal(row?.[`${id}_count`]),
  }));
  const sqlstateCategories = SQLSTATE_CATEGORY_DETAILS.map(({ id, label }) => Object.freeze({
    id,
    label,
    count: normalizeNonNegativeDecimal(row?.[countColumnForSqlstateCategory(id)]),
  }));
  const totalFailureCount = normalizeNonNegativeDecimal(row?.total_failure_count);
  const safeCategoryFailureCount = addNonNegativeDecimals(
    sqlstateCategories.map(category => category.count),
  );

  return Object.freeze({
    version: AI_PROVIDER_CAPABILITY_METRICS_FAILURE_BREAKDOWN_VERSION,
    window: Object.freeze({
      hours: 24,
      startAt: window?.start instanceof Date && !Number.isNaN(window.start.getTime())
        ? window.start.toISOString()
        : null,
      endAt: window?.end instanceof Date && !Number.isNaN(window.end.getTime())
        ? window.end.toISOString()
        : null,
    }),
    totalFailureCount,
    safeCategoryFailureCount,
    uncategorizedFailureCount: subtractNonNegativeDecimals(
      totalFailureCount,
      safeCategoryFailureCount,
    ),
    stages: Object.freeze(stages),
    sqlstateCategories: Object.freeze(sqlstateCategories),
    status: buildStatus({ totalFailureCount, safeCategoryFailureCount }),
  });
}

export {
  FAILURE_STAGE_DETAILS,
  SQLSTATE_CATEGORY_DETAILS,
  countColumnForSqlstateCategory,
};
