/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from './aiProviderCapabilityMetricsLogging.mjs';

export const AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE =
  'metric_persistence_write';

export const AI_PROVIDER_CAPABILITY_METRICS_SQLSTATE_CATEGORY_IDS = Object.freeze([
  'connection_exception',
  'transaction_rollback',
  'insufficient_resources',
  'operator_intervention',
  'system_error',
  'other_database_condition',
  'not_available',
]);

const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

const SQLSTATE_CATEGORY_BY_CLASS = Object.freeze({
  '08': 'connection_exception',
  '40': 'transaction_rollback',
  '53': 'insufficient_resources',
  '57': 'operator_intervention',
  XX: 'system_error',
});

function normalizeSqlstate(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return SQLSTATE_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Maps only a PostgreSQL-standard SQLSTATE class to a fixed product category.
 * It never returns the error code or error text, because both can become
 * operationally sensitive diagnostic data.
 */
export function resolveAiProviderCapabilityMetricsSqlstateCategory(error = null) {
  const sqlstate = normalizeSqlstate(error?.code ?? error?.sqlState);
  if (!sqlstate) return 'not_available';

  return SQLSTATE_CATEGORY_BY_CLASS[sqlstate.slice(0, 2)]
    || 'other_database_condition';
}

/**
 * Creates the sole safe persistence-warning metadata contract. In particular,
 * provider/model values, arbitrary error messages, stacks, and raw SQLSTATEs
 * are deliberately omitted before the event reaches the general logger.
 */
export function buildAiProviderCapabilityMetricsFailureMetadata(error = null) {
  return Object.freeze({
    reasonCode: AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
    capabilityMetricsFailureStage: AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
    capabilityMetricsSqlstateCategory:
      resolveAiProviderCapabilityMetricsSqlstateCategory(error),
  });
}
