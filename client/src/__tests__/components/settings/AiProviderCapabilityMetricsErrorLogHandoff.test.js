/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AiProviderCapabilityMetricsErrorLogHandoff from '@/components/settings/AiProviderCapabilityMetricsErrorLogHandoff.vue'

const RouterLinkStub = {
  props: ['to'],
  template: '<a :data-route="JSON.stringify(to)"><slot /></a>',
}

function activeWarningReport() {
  return {
    version: 'ai.provider_capability_metrics_health_trend.v1',
    window: { days: 1, periodCount: 3 },
    periods: [
      { id: 'baseline', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
      { id: 'previous', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
      { id: 'current', activeMetricStreamCount: '1', persistenceFailureCount: '1' },
    ],
    status: { id: 'newly_observed_persistence_failures' },
  }
}

describe('AiProviderCapabilityMetricsErrorLogHandoff', () => {
  it('renders one descriptive fixed-filter link without raw trend detail', () => {
    const wrapper = mount(AiProviderCapabilityMetricsErrorLogHandoff, {
      props: {
        report: {
          ...activeWarningReport(),
          provider: 'private-provider',
          error: 'private raw error',
        },
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    expect(wrapper.text()).toContain('Review capability telemetry warnings')
    expect(wrapper.text()).toContain('Review related Error Logs')
    expect(wrapper.get('a').attributes('data-route')).toContain('capability-metrics-persistence')
    expect(wrapper.text()).not.toContain('private-provider')
    expect(wrapper.text()).not.toContain('private raw error')
  })

  it('does not render a link after warnings clear', () => {
    const wrapper = mount(AiProviderCapabilityMetricsErrorLogHandoff, {
      props: {
        report: {
          ...activeWarningReport(),
          periods: [
            { id: 'baseline', activeMetricStreamCount: '1', persistenceFailureCount: '1' },
            { id: 'previous', activeMetricStreamCount: '1', persistenceFailureCount: '1' },
            { id: 'current', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
          ],
          status: { id: 'persistence_failures_cleared' },
        },
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    expect(wrapper.find('a').exists()).toBe(false)
  })
})
