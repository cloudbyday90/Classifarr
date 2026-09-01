/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import AiProviderCapabilityMetricsTelemetryDetails from '@/components/settings/AiProviderCapabilityMetricsTelemetryDetails.vue'

const failureBreakdown = {
  version: 'ai.provider_capability_metrics_failure_breakdown.v1',
  window: { hours: 24 },
  totalFailureCount: '1',
  safeCategoryFailureCount: '1',
  uncategorizedFailureCount: '0',
  stages: [{ id: 'metric_persistence_write', count: '1' }],
  sqlstateCategories: [{ id: 'connection_exception', count: '1' }],
  status: { id: 'complete' },
}

const failureCategoryCoverage = {
  version: 'ai.provider_capability_metrics_failure_category_coverage.v1',
  window: { days: 1, periodCount: 3 },
  periods: [
    { id: 'baseline', totalFailureCount: '0', safeCategoryFailureCount: '0', safeCategoryCoveragePercent: null },
    { id: 'previous', totalFailureCount: '0', safeCategoryFailureCount: '0', safeCategoryCoveragePercent: null },
    { id: 'current', totalFailureCount: '1', safeCategoryFailureCount: '1', safeCategoryCoveragePercent: '100' },
  ],
  status: { id: 'complete' },
}

const failureRecency = {
  version: 'ai.provider_capability_metrics_failure_recency.v1',
  window: { days: 1, periodCount: 3 },
  periods: [
    { id: 'baseline', persistenceFailureCount: '0' },
    { id: 'previous', persistenceFailureCount: '0' },
    { id: 'current', persistenceFailureCount: '1' },
  ],
  recency: { id: 'warning_in_latest_completed_day', completedDaysSinceLastWarning: 0 },
  status: { id: 'warning_in_latest_completed_day' },
}

describe('AiProviderCapabilityMetricsTelemetryDetails', () => {
  it('groups safe telemetry context behind one collapsed native disclosure', () => {
    const wrapper = mount(AiProviderCapabilityMetricsTelemetryDetails, {
      props: { failureBreakdown, failureCategoryCoverage, failureRecency },
    })

    const details = wrapper.get('[data-testid="capability-metrics-telemetry-details"]')
    expect(details.attributes('open')).toBeUndefined()
    expect(details.get('summary').text()).toBe('Review safe telemetry warning details')
    expect(wrapper.text()).toContain('Safe persistence-failure categories')
    expect(wrapper.text()).toContain('Completed-window safe category coverage')
    expect(wrapper.text()).toContain('Warning recorded in the latest completed day')
  })
})
