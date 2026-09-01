/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const CAPABILITY_METRICS_PERSISTENCE_FAILURE_REASON_CODE =
  'ai_provider_capability_metrics_persistence_failed'

export const CAPABILITY_METRICS_ERROR_LOG_HANDOFF_ID = 'capability-metrics-persistence'

const SETTINGS_LOGS_TAB_ID = 'logs'

function normalizedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Builds the sole supported diagnostic handoff. It deliberately carries a
 * fixed reason code rather than a provider, model, media record, time range,
 * raw error, or server-provided navigation target.
 */
export function buildCapabilityMetricsErrorLogHandoffLocation() {
  return Object.freeze({
    name: 'Settings',
    query: Object.freeze({
      tab: SETTINGS_LOGS_TAB_ID,
      handoff: CAPABILITY_METRICS_ERROR_LOG_HANDOFF_ID,
      reasonCode: CAPABILITY_METRICS_PERSISTENCE_FAILURE_REASON_CODE,
    }),
  })
}

/**
 * Recognizes only the fixed handoff after a navigation. Arbitrary URL query
 * values never become a pre-applied diagnostic filter in the Logs interface.
 */
export function resolveCapabilityMetricsErrorLogHandoffReasonCode(query = {}) {
  return normalizedString(query?.handoff) === CAPABILITY_METRICS_ERROR_LOG_HANDOFF_ID
    && normalizedString(query?.reasonCode) === CAPABILITY_METRICS_PERSISTENCE_FAILURE_REASON_CODE
    ? CAPABILITY_METRICS_PERSISTENCE_FAILURE_REASON_CODE
    : null
}

export function removeCapabilityMetricsErrorLogHandoffQuery(query = {}) {
  const nextQuery = { ...query }
  delete nextQuery.handoff
  delete nextQuery.reasonCode
  return nextQuery
}
