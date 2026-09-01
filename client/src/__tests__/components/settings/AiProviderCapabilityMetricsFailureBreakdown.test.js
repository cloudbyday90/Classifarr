/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AiProviderCapabilityMetricsFailureBreakdown from '@/components/settings/AiProviderCapabilityMetricsFailureBreakdown.vue'

const completeReport = {
  version: 'ai.provider_capability_metrics_failure_breakdown.v1',
  window: { hours: 24 },
  totalFailureCount: '1',
  safeCategoryFailureCount: '1',
  uncategorizedFailureCount: '0',
  stages: [{ id: 'metric_persistence_write', count: '1' }],
  sqlstateCategories: [{ id: 'connection_exception', count: '1' }],
  status: { id: 'complete' },
}

describe('AiProviderCapabilityMetricsFailureBreakdown', () => {
  it('renders a compact, user-controlled safe breakdown without raw diagnostics', () => {
    const wrapper = mount(AiProviderCapabilityMetricsFailureBreakdown, {
      props: {
        report: {
          ...completeReport,
          provider: 'private-provider',
          model: 'private-model',
          error: 'postgres://private-endpoint',
        },
      },
    })

    expect(wrapper.text()).toContain('Safe persistence-failure categories')
    expect(wrapper.text()).toContain('View safe category counts')
    expect(wrapper.text()).toContain('No provider, model, media, endpoint')
    expect(wrapper.text()).not.toContain('private-provider')
    expect(wrapper.text()).not.toContain('private-model')
    expect(wrapper.text()).not.toContain('private-endpoint')
  })

  it('does not render when no active warning aggregate is present', () => {
    const wrapper = mount(AiProviderCapabilityMetricsFailureBreakdown, {
      props: {
        report: { ...completeReport, totalFailureCount: '0' },
      },
    })

    expect(wrapper.html()).toBe('<!--v-if-->')
  })
})
