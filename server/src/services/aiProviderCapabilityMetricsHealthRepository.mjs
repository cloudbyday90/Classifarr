/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from './aiProviderCapabilityMetricsLogging.mjs';

export const LOAD_AI_PROVIDER_CAPABILITY_METRICS_HEALTH_SQL = `
  WITH persisted AS (
    SELECT
      COUNT(*)::text AS active_metric_stream_count,
      MAX(last_observed_at) AS last_persisted_at
    FROM ai_provider_capability_metrics
    WHERE last_observed_at >= $1::timestamptz
      AND last_observed_at < $2::timestamptz
  ), persistence_failures AS (
    SELECT
      COUNT(*)::text AS persistence_failure_count,
      MAX(created_at) AS last_failure_at
    FROM error_log
    WHERE module = $3
      AND (
        metadata->>'reasonCode' = $5
        OR message = $4
      )
      AND created_at >= ($1::timestamptz AT TIME ZONE 'UTC')
      AND created_at < ($2::timestamptz AT TIME ZONE 'UTC')
  )
  SELECT
    persisted.active_metric_stream_count,
    persisted.last_persisted_at,
    persistence_failures.persistence_failure_count,
    persistence_failures.last_failure_at
  FROM persisted
  CROSS JOIN persistence_failures
`;

function assertAggregateWindow({ start, end } = {}) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) ||
      !(end instanceof Date) || Number.isNaN(end.getTime()) || start >= end) {
    throw new TypeError('A valid capability-metrics health observation range is required.');
  }
}

/**
 * Reads only two aggregate counts and their latest timestamps. Provider/model
 * dimensions and raw error text stay inside their source tables.
 */
export async function loadAiProviderCapabilityMetricsHealth(database, window = {}) {
  if (!database || typeof database.query !== 'function') {
    throw new TypeError('Capability-metrics health requires a query-capable database.');
  }
  assertAggregateWindow(window);

  const result = await database.query(LOAD_AI_PROVIDER_CAPABILITY_METRICS_HEALTH_SQL, [
    window.start.toISOString(),
    window.end.toISOString(),
    AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
    AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
    AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
  ]);

  return result?.rows?.[0] || null;
}

export {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
};
