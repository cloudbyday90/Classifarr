/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildCapabilityMetricsErrorLogHandoffLocation } from './capabilityMetricsErrorLogHandoff'
import { buildAiProviderCapabilityMetricsHealthTrendPresentation } from './aiProviderCapabilityMetricsHealthTrendPresentation'

const ACTIVE_WARNING_STATUS_IDS = new Set([
  'newly_observed_persistence_failures',
  'persistent_persistence_failures',
  'recurring_persistence_failures',
])

const NOT_RECOMMENDED = Object.freeze({
  isRecommended: false,
  statusId: 'not_recommended',
  heading: '',
  message: '',
  actionLabel: '',
  location: null,
})

/**
 * Derives one static diagnostic next step from the already fail-closed trend
 * presentation. This boundary never copies source prose, model information,
 * provider details, raw logs, or a server-provided URL into the UI.
 */
export function buildCapabilityMetricsErrorLogHandoffPresentation(report = null) {
  const trend = buildAiProviderCapabilityMetricsHealthTrendPresentation(report)
  if (!ACTIVE_WARNING_STATUS_IDS.has(trend.statusId)) return NOT_RECOMMENDED

  return Object.freeze({
    isRecommended: true,
    statusId: trend.statusId,
    heading: 'Review capability telemetry warnings',
    message: 'Open the protected Error Logs view with the fixed capability-metric persistence reason filter applied. This is diagnostic only.',
    actionLabel: 'Review related Error Logs',
    location: buildCapabilityMetricsErrorLogHandoffLocation(),
  })
}
