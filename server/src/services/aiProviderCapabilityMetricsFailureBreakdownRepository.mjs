/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
  AI_PROVIDER_CAPABILITY_METRICS_SQLSTATE_CATEGORY_IDS,
} from './aiProviderCapabilityMetricsFailureCategories.mjs';
import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from './aiProviderCapabilityMetricsLogging.mjs';

function buildSqlstateCountColumns() {
  return AI_PROVIDER_CAPABILITY_METRICS_SQLSTATE_CATEGORY_IDS.map((categoryId, index) => {
    const parameterIndex = index + 7;
    return `
      COUNT(*) FILTER (
        WHERE metadata->>'capabilityMetricsFailureStage' = $6
          AND metadata->>'capabilityMetricsSqlstateCategory' = $${parameterIndex}
      )::text AS sqlstate_${categoryId}_count`;
  }).join(',');
}

export const LOAD_AI_PROVIDER_CAPABILITY_METRICS_FAILURE_BREAKDOWN_SQL = `
  WITH persistence_failures AS (
    SELECT
      COUNT(*)::text AS total_failure_count,
      COUNT(*) FILTER (
        WHERE metadata->>'capabilityMetricsFailureStage' = $6
      )::text AS metric_persistence_write_count,${buildSqlstateCountColumns()}
    FROM error_log
    WHERE module = $3
      AND (
        metadata->>'reasonCode' = $5
        OR message = $4
      )
      AND created_at >= ($1::timestamptz AT TIME ZONE 'UTC')
      AND created_at < ($2::timestamptz AT TIME ZONE 'UTC')
  )
  SELECT * FROM persistence_failures
`;

function assertAggregateWindow({ start, end } = {}) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) ||
      !(end instanceof Date) || Number.isNaN(end.getTime()) || start >= end) {
    throw new TypeError('A valid capability-metrics failure-breakdown range is required.');
  }
}

/**
 * Reads a fixed rolling aggregate. The SQL never selects raw metadata, error
 * text, stacks, provider/model fields, or an arbitrary SQLSTATE value.
 */
export async function loadAiProviderCapabilityMetricsFailureBreakdown(database, window = {}) {
  if (!database || typeof database.query !== 'function') {
    throw new TypeError('Capability-metrics failure breakdown requires a query-capable database.');
  }
  assertAggregateWindow(window);

  const result = await database.query(LOAD_AI_PROVIDER_CAPABILITY_METRICS_FAILURE_BREAKDOWN_SQL, [
    window.start.toISOString(),
    window.end.toISOString(),
    AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
    AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
    AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
    AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
    ...AI_PROVIDER_CAPABILITY_METRICS_SQLSTATE_CATEGORY_IDS,
  ]);

  return result?.rows?.[0] || null;
}
