/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildAiProviderCapabilityMetricsHealthPresentation } from '@/utils/aiProviderCapabilityMetricsHealthPresentation'

describe('aiProviderCapabilityMetricsHealthPresentation', () => {
  it('renders only a coherent fixed aggregate status and drops source strings', () => {
    const presentation = buildAiProviderCapabilityMetricsHealthPresentation({
      version: 'ai.provider_capability_metrics_health.v1',
      activeMetricStreamCount: '2',
      persistenceFailureCount: '1',
      lastPersistedAt: '2026-08-31T12:00:00.000Z',
      lastFailureAt: '2026-08-31T12:01:00.000Z',
      status: { id: 'persistence_failures_detected', message: 'untrusted failure text' },
      provider: 'private-provider',
      model: 'private-model',
      error: '<script>do not render</script>',
    })

    expect(presentation).toMatchObject({
      statusId: 'persistence_failures_detected',
      activeMetricStreamCount: '2',
      persistenceFailureCount: '1',
    })
    expect(JSON.stringify(presentation)).not.toContain('private-provider')
    expect(JSON.stringify(presentation)).not.toContain('private-model')
    expect(JSON.stringify(presentation)).not.toContain('untrusted failure text')
    expect(JSON.stringify(presentation)).not.toContain('<script>')
  })

  it('fails closed when count/status relationships or report version are invalid', () => {
    expect(buildAiProviderCapabilityMetricsHealthPresentation({
      version: 'ai.provider_capability_metrics_health.v1',
      activeMetricStreamCount: '0',
      persistenceFailureCount: '1',
      status: { id: 'operational' },
    }).statusId).toBe('unavailable')

    expect(buildAiProviderCapabilityMetricsHealthPresentation({
      version: 'unknown',
      activeMetricStreamCount: '1',
      persistenceFailureCount: '0',
      status: { id: 'operational' },
    }).statusId).toBe('unavailable')
  })
})
