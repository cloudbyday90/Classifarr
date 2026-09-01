/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from './aiProviderCapabilityMetricsLogging.mjs';

export const LOAD_AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_SQL = `
  WITH requested_windows AS (
    SELECT *
    FROM (VALUES
      ('baseline'::text, $1::timestamptz, $2::timestamptz),
      ('previous'::text, $3::timestamptz, $4::timestamptz),
      ('current'::text, $5::timestamptz, $6::timestamptz)
    ) AS requested_windows(period_id, start_at, end_at)
  ), persisted AS (
    SELECT
      requested_windows.period_id,
      COUNT(metrics.last_observed_at)::text AS active_metric_stream_count
    FROM requested_windows
    LEFT JOIN ai_provider_capability_metrics AS metrics
      ON metrics.last_observed_at >= requested_windows.start_at
      AND metrics.last_observed_at < requested_windows.end_at
    GROUP BY requested_windows.period_id
  ), persistence_failures AS (
    SELECT
      requested_windows.period_id,
      COUNT(error_log.created_at)::text AS persistence_failure_count
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
    requested_windows.period_id,
    persisted.active_metric_stream_count,
    persistence_failures.persistence_failure_count
  FROM requested_windows
  INNER JOIN persisted USING (period_id)
  INNER JOIN persistence_failures USING (period_id)
  ORDER BY CASE requested_windows.period_id
    WHEN 'baseline' THEN 1
    WHEN 'previous' THEN 2
    WHEN 'current' THEN 3
  END
`;

function assertTrendWindow(window = {}) {
  const expectedPeriodIds = ['baseline', 'previous', 'current'];
  if (!Array.isArray(window.periods) || window.periods.length !== expectedPeriodIds.length) {
    throw new TypeError('A fixed three-window capability-metrics health trend range is required.');
  }

  const periodsById = new Map(window.periods.map((period) => [period?.id, period]));
  if (periodsById.size !== expectedPeriodIds.length) {
    throw new TypeError('A fixed three-window capability-metrics health trend range is required.');
  }

  let precedingEnd = null;
  for (const id of expectedPeriodIds) {
    const period = periodsById.get(id);
    const durationMs = period?.end?.getTime?.() - period?.start?.getTime?.();
    if (!(period?.start instanceof Date) || Number.isNaN(period.start.getTime()) ||
        !(period?.end instanceof Date) || Number.isNaN(period.end.getTime()) ||
        durationMs !== 24 * 60 * 60 * 1000 ||
        (precedingEnd && period.start.getTime() !== precedingEnd.getTime())) {
      throw new TypeError('A fixed three-window capability-metrics health trend range is required.');
    }
    precedingEnd = period.end;
  }
}

/**
 * Reads only per-period aggregate counts. The time periods originate in a
 * server-owned builder; callers cannot choose an interval or a dimension.
 */
export async function loadAiProviderCapabilityMetricsHealthTrend(database, window = {}) {
  if (!database || typeof database.query !== 'function') {
    throw new TypeError('Capability-metrics health trend requires a query-capable database.');
  }
  assertTrendWindow(window);

  const byId = new Map(window.periods.map((period) => [period.id, period]));
  const result = await database.query(LOAD_AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_SQL, [
    byId.get('baseline').start.toISOString(),
    byId.get('baseline').end.toISOString(),
    byId.get('previous').start.toISOString(),
    byId.get('previous').end.toISOString(),
    byId.get('current').start.toISOString(),
    byId.get('current').end.toISOString(),
    AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
    AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
    AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
  ]);

  return Array.isArray(result?.rows) ? result.rows : [];
}
