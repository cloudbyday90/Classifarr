/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AiProviderCapabilityMetricsHealthSummary from '@/components/settings/AiProviderCapabilityMetricsHealthSummary.vue'

function mountSummary(props = {}) {
  return mount(AiProviderCapabilityMetricsHealthSummary, { props })
}

describe('AiProviderCapabilityMetricsHealthSummary', () => {
  it('shows a concise aggregate without provider, model, or error details', () => {
    const wrapper = mountSummary({
      report: {
        version: 'ai.provider_capability_metrics_health.v1',
        activeMetricStreamCount: '2',
        persistenceFailureCount: '1',
        status: { id: 'persistence_failures_detected' },
        provider: 'private-provider',
        model: 'private-model',
        error: 'private endpoint failure',
      },
      lastUpdatedAt: '2026-08-31T12:00:00.000Z',
    })

    expect(wrapper.text()).toContain('Capability telemetry needs attention')
    expect(wrapper.get('[data-testid="capability-metrics-active-streams"]').text()).toBe('2')
    expect(wrapper.get('[data-testid="capability-metrics-persistence-warnings"]').text()).toBe('1')
    expect(wrapper.text()).toContain('Updates automatically while this page is visible.')
    expect(wrapper.text()).not.toContain('private-provider')
    expect(wrapper.text()).not.toContain('private-model')
    expect(wrapper.text()).not.toContain('private endpoint failure')
  })

  it('announces a meaningful health transition without announcing refresh timestamps', async () => {
    const wrapper = mountSummary({
      report: {
        version: 'ai.provider_capability_metrics_health.v1',
        activeMetricStreamCount: '0',
        persistenceFailureCount: '0',
        status: { id: 'no_recent_activity' },
      },
    })

    await wrapper.setProps({
      report: {
        version: 'ai.provider_capability_metrics_health.v1',
        activeMetricStreamCount: '1',
        persistenceFailureCount: '0',
        status: { id: 'operational' },
      },
      lastUpdatedAt: '2026-08-31T12:02:00.000Z',
    })

    expect(wrapper.get('[role="status"]').text())
      .toContain('Capability telemetry status changed: Capability telemetry is recording.')
  })
})
