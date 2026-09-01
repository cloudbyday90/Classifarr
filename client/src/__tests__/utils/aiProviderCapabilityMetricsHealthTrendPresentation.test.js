/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildAiProviderCapabilityMetricsHealthTrendPresentation } from '@/utils/aiProviderCapabilityMetricsHealthTrendPresentation'

function report({ statusId = 'newly_observed_persistence_failures', periods = null } = {}) {
  return {
    version: 'ai.provider_capability_metrics_health_trend.v1',
    window: { days: 1, periodCount: 3 },
    periods: periods || [
      { id: 'baseline', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
      { id: 'previous', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
      { id: 'current', activeMetricStreamCount: '1', persistenceFailureCount: '1' },
    ],
    status: { id: statusId, message: 'untrusted failure text' },
    provider: 'private-provider',
    model: 'private-model',
    error: '<script>do not render</script>',
  }
}

describe('aiProviderCapabilityMetricsHealthTrendPresentation', () => {
  it('renders a coherent fixed trend without exposing source strings', () => {
    const presentation = buildAiProviderCapabilityMetricsHealthTrendPresentation(report())

    expect(presentation).toMatchObject({
      statusId: 'newly_observed_persistence_failures',
      periods: [
        { id: 'baseline', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
        { id: 'previous', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
        { id: 'current', activeMetricStreamCount: '1', persistenceFailureCount: '1' },
      ],
    })
    expect(JSON.stringify(presentation)).not.toContain('private-provider')
    expect(JSON.stringify(presentation)).not.toContain('private-model')
    expect(JSON.stringify(presentation)).not.toContain('untrusted failure text')
    expect(JSON.stringify(presentation)).not.toContain('<script>')
  })

  it('fails closed for an inconsistent status, version, or period contract', () => {
    expect(buildAiProviderCapabilityMetricsHealthTrendPresentation(report({
      statusId: 'persistent_persistence_failures',
    })).statusId).toBe('unavailable')

    expect(buildAiProviderCapabilityMetricsHealthTrendPresentation({
      ...report(),
      version: 'unknown',
    }).statusId).toBe('unavailable')

    expect(buildAiProviderCapabilityMetricsHealthTrendPresentation(report({
      periods: [{ id: 'current', activeMetricStreamCount: '1', persistenceFailureCount: '1' }],
    })).statusId).toBe('unavailable')
  })
})
