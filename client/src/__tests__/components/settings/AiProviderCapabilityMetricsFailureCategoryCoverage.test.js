/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AiProviderCapabilityMetricsFailureCategoryCoverage from '@/components/settings/AiProviderCapabilityMetricsFailureCategoryCoverage.vue'

const report = {
  version: 'ai.provider_capability_metrics_failure_category_coverage.v1',
  window: { days: 1, periodCount: 3 },
  periods: [
    { id: 'baseline', totalFailureCount: '1', safeCategoryFailureCount: '0', safeCategoryCoveragePercent: '0' },
    { id: 'previous', totalFailureCount: '1', safeCategoryFailureCount: '1', safeCategoryCoveragePercent: '100' },
    { id: 'current', totalFailureCount: '2', safeCategoryFailureCount: '1', safeCategoryCoveragePercent: '50' },
  ],
  status: { id: 'partial' },
}

describe('AiProviderCapabilityMetricsFailureCategoryCoverage', () => {
  it('renders a compact fixed aggregate without source diagnostics', () => {
    const wrapper = mount(AiProviderCapabilityMetricsFailureCategoryCoverage, {
      props: {
        report: {
          ...report,
          provider: 'private-provider',
          model: 'private-model',
          error: 'postgres://private-endpoint',
        },
      },
    })

    expect(wrapper.text()).toContain('Completed-window safe category coverage is partial')
    expect(wrapper.text()).toContain('50% safely categorized')
    expect(wrapper.text()).toContain('Completed UTC-day aggregates exclude the in-progress day.')
    expect(wrapper.text()).not.toContain('private-provider')
    expect(wrapper.text()).not.toContain('private-model')
    expect(wrapper.text()).not.toContain('private-endpoint')
  })
})
