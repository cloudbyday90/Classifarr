/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildCapabilityMetricsErrorLogHandoffPresentation } from '@/utils/capabilityMetricsErrorLogHandoffPresentation'

function activeWarningReport() {
  return {
    version: 'ai.provider_capability_metrics_health_trend.v1',
    window: { days: 1, periodCount: 3 },
    periods: [
      { id: 'baseline', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
      { id: 'previous', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
      { id: 'current', activeMetricStreamCount: '1', persistenceFailureCount: '2' },
    ],
    status: { id: 'newly_observed_persistence_failures' },
  }
}

describe('capabilityMetricsErrorLogHandoffPresentation', () => {
  it('returns one fixed advisory link for a coherent active warning trend', () => {
    const presentation = buildCapabilityMetricsErrorLogHandoffPresentation({
      ...activeWarningReport(),
      provider: 'private-provider',
      error: 'private stack detail',
      status: { id: 'newly_observed_persistence_failures', message: 'untrusted source prose' },
    })

    expect(presentation).toMatchObject({
      isRecommended: true,
      heading: 'Review capability telemetry warnings',
      actionLabel: 'Review related Error Logs',
      location: { name: 'Settings', query: { tab: 'logs' } },
    })
    expect(JSON.stringify(presentation)).not.toContain('private-provider')
    expect(JSON.stringify(presentation)).not.toContain('private stack detail')
    expect(JSON.stringify(presentation)).not.toContain('untrusted source prose')
  })

  it('fails closed when the trend becomes cleared or incoherent', () => {
    expect(buildCapabilityMetricsErrorLogHandoffPresentation({
      ...activeWarningReport(),
      periods: [
        { id: 'baseline', activeMetricStreamCount: '1', persistenceFailureCount: '1' },
        { id: 'previous', activeMetricStreamCount: '1', persistenceFailureCount: '1' },
        { id: 'current', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
      ],
      status: { id: 'persistence_failures_cleared' },
    }).isRecommended).toBe(false)

    expect(buildCapabilityMetricsErrorLogHandoffPresentation({
      ...activeWarningReport(),
      status: { id: 'persistence_failures_cleared' },
    }).isRecommended).toBe(false)
  })
})
