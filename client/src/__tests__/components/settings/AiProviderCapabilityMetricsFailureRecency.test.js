/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AiProviderCapabilityMetricsFailureRecency from '@/components/settings/AiProviderCapabilityMetricsFailureRecency.vue'

const report = {
  version: 'ai.provider_capability_metrics_failure_recency.v1',
  window: { days: 1, periodCount: 3 },
  periods: [
    { id: 'baseline', persistenceFailureCount: '1' },
    { id: 'previous', persistenceFailureCount: '1' },
    { id: 'current', persistenceFailureCount: '0' },
  ],
  recency: { id: 'cleared_for_one_completed_day', completedDaysSinceLastWarning: 1 },
  status: { id: 'cleared_for_one_completed_day' },
}

describe('AiProviderCapabilityMetricsFailureRecency', () => {
  it('renders a compact fixed age band without source diagnostics', () => {
    const wrapper = mount(AiProviderCapabilityMetricsFailureRecency, {
      props: {
        report: {
          ...report,
          provider: 'private-provider',
          model: 'private-model',
          error: 'postgres://private-endpoint',
        },
      },
    })

    expect(wrapper.text()).toContain('Warning cleared in the latest completed day')
    expect(wrapper.text()).toContain('Three server-defined completed UTC-day aggregates are used.')
    expect(wrapper.text()).not.toContain('private-provider')
    expect(wrapper.text()).not.toContain('private-model')
    expect(wrapper.text()).not.toContain('private-endpoint')
  })
})
