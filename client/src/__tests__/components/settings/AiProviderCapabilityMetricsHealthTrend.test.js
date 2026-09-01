/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AiProviderCapabilityMetricsHealthTrend from '@/components/settings/AiProviderCapabilityMetricsHealthTrend.vue'

function report(statusId = 'newly_observed_persistence_failures') {
  return {
    version: 'ai.provider_capability_metrics_health_trend.v1',
    window: { days: 1, periodCount: 3 },
    periods: [
      { id: 'baseline', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
      { id: 'previous', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
      { id: 'current', activeMetricStreamCount: '1', persistenceFailureCount: '1' },
    ],
    status: { id: statusId },
  }
}

describe('AiProviderCapabilityMetricsHealthTrend', () => {
  it('shows only a compact fixed aggregate and no raw source detail', () => {
    const wrapper = mount(AiProviderCapabilityMetricsHealthTrend, {
      props: {
        report: {
          ...report(),
          provider: 'private-provider',
          model: 'private-model',
          error: 'private endpoint failure',
        },
      },
    })

    expect(wrapper.text()).toContain('Persistence warnings are newly observed')
    expect(wrapper.text()).toContain('Earlier completed day')
    expect(wrapper.text()).toContain('Latest completed day')
    expect(wrapper.text()).toContain('1 streams')
    expect(wrapper.text()).not.toContain('private-provider')
    expect(wrapper.text()).not.toContain('private-model')
    expect(wrapper.text()).not.toContain('private endpoint failure')
  })

  it('announces only a meaningful trend transition', async () => {
    const wrapper = mount(AiProviderCapabilityMetricsHealthTrend, {
      props: { report: report() },
    })

    await wrapper.setProps({
      report: {
        ...report('persistence_failures_cleared'),
        periods: [
          { id: 'baseline', activeMetricStreamCount: '1', persistenceFailureCount: '1' },
          { id: 'previous', activeMetricStreamCount: '1', persistenceFailureCount: '1' },
          { id: 'current', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
        ],
      },
    })

    expect(wrapper.get('[role="status"]').text())
      .toContain('Capability telemetry trend changed: Persistence warnings have cleared.')
  })
})
