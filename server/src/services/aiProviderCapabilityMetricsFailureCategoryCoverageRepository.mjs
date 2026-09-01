/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
  AI_PROVIDER_CAPABILITY_METRICS_SQLSTATE_CATEGORY_IDS,
} from './aiProviderCapabilityMetricsFailureCategories.mjs';
import {
  AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS,
} from './aiProviderCapabilityMetricsHealthTrend.mjs';
import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from './aiProviderCapabilityMetricsLogging.mjs';

function buildSqlstateCategoryPredicate() {
  return AI_PROVIDER_CAPABILITY_METRICS_SQLSTATE_CATEGORY_IDS
    .map((_categoryId, index) => `$${index + 11}`)
    .join(', ');
}

export const LOAD_AI_PROVIDER_CAPABILITY_METRICS_FAILURE_CATEGORY_COVERAGE_SQL = `
  WITH requested_windows AS (
    SELECT *
    FROM (VALUES
      ('baseline'::text, $1::timestamptz, $2::timestamptz),
      ('previous'::text, $3::timestamptz, $4::timestamptz),
      ('current'::text, $5::timestamptz, $6::timestamptz)
    ) AS requested_windows(period_id, start_at, end_at)
  ), persistence_failures AS (
    SELECT
      requested_windows.period_id,
      COUNT(error_log.created_at)::text AS total_failure_count,
      COUNT(error_log.created_at) FILTER (
        WHERE error_log.metadata->>'capabilityMetricsFailureStage' = $10
          AND error_log.metadata->>'capabilityMetricsSqlstateCategory' IN (${buildSqlstateCategoryPredicate()})
      )::text AS safe_category_failure_count
    FROM requested_windows
    LEFT JOIN error_log
      ON error_log.module = $7
      AND (
        error_log.metadata->>'reasonCode' = $9
        OR error_log.message = $8
      )
      AND error_log.created_at >= (requested_windows.start_at AT TIME ZONE 'UTC')
      AND error_log.created_at < (requested_windows.end_at AT TIME ZONE 'UTC')
    GROUP BY requested_windows.period_id
  )
  SELECT
    period_id,
    total_failure_count,
    safe_category_failure_count
  FROM persistence_failures
  ORDER BY CASE period_id
    WHEN 'baseline' THEN 1
    WHEN 'previous' THEN 2
    WHEN 'current' THEN 3
  END
`;

function assertCoverageWindow(window = {}) {
  if (!Array.isArray(window.periods)
    || window.periods.length !== AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS.length) {
    throw new TypeError('A fixed three-window capability-metrics category-coverage range is required.');
  }

  const periodsById = new Map(window.periods.map((period) => [period?.id, period]));
  if (periodsById.size !== AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS.length) {
    throw new TypeError('A fixed three-window capability-metrics category-coverage range is required.');
  }

  let precedingEnd = null;
  for (const id of AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_PERIOD_IDS) {
    const period = periodsById.get(id);
    const durationMs = period?.end?.getTime?.() - period?.start?.getTime?.();
    if (!(period?.start instanceof Date) || Number.isNaN(period.start.getTime())
      || !(period?.end instanceof Date) || Number.isNaN(period.end.getTime())
      || durationMs !== 24 * 60 * 60 * 1000
      || (precedingEnd && period.start.getTime() !== precedingEnd.getTime())) {
      throw new TypeError('A fixed three-window capability-metrics category-coverage range is required.');
    }
    precedingEnd = period.end;
  }
}

/**
 * Reads only server-owned, adjacent completed UTC-day aggregates. The query
 * cannot return raw log metadata, error text, provider/model values, or a
 * caller-selected category, period, or diagnostic dimension.
 */
export async function loadAiProviderCapabilityMetricsFailureCategoryCoverage(database, window = {}) {
  if (!database || typeof database.query !== 'function') {
    throw new TypeError('Capability-metrics category coverage requires a query-capable database.');
  }
  assertCoverageWindow(window);

  const byId = new Map(window.periods.map((period) => [period.id, period]));
  const result = await database.query(LOAD_AI_PROVIDER_CAPABILITY_METRICS_FAILURE_CATEGORY_COVERAGE_SQL, [
    byId.get('baseline').start.toISOString(),
    byId.get('baseline').end.toISOString(),
    byId.get('previous').start.toISOString(),
    byId.get('previous').end.toISOString(),
    byId.get('current').start.toISOString(),
    byId.get('current').end.toISOString(),
    AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
    AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
    AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
    AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
    ...AI_PROVIDER_CAPABILITY_METRICS_SQLSTATE_CATEGORY_IDS,
  ]);

  return Array.isArray(result?.rows) ? result.rows : [];
}
