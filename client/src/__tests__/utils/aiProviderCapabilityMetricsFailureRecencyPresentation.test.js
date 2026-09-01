/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildAiProviderCapabilityMetricsFailureRecencyPresentation } from '@/utils/aiProviderCapabilityMetricsFailureRecencyPresentation'

function report(overrides = {}) {
  return {
    version: 'ai.provider_capability_metrics_failure_recency.v1',
    window: { days: 1, periodCount: 3 },
    periods: [
      { id: 'baseline', persistenceFailureCount: '1' },
      { id: 'previous', persistenceFailureCount: '1' },
      { id: 'current', persistenceFailureCount: '0' },
    ],
    recency: { id: 'cleared_for_one_completed_day', completedDaysSinceLastWarning: 1 },
    status: { id: 'cleared_for_one_completed_day' },
    ...overrides,
  }
}

describe('aiProviderCapabilityMetricsFailureRecencyPresentation', () => {
  it('renders only the locally derived fixed age band', () => {
    const presentation = buildAiProviderCapabilityMetricsFailureRecencyPresentation(report({
      provider: 'private-provider',
      model: 'private-model',
      error: 'postgres://private-endpoint',
      periods: [
        { id: 'baseline', persistenceFailureCount: '1', rawSqlstate: '08006' },
        { id: 'previous', persistenceFailureCount: '1', message: 'private error' },
        { id: 'current', persistenceFailureCount: '0', provider: 'private-provider' },
      ],
    }))

    expect(presentation).toMatchObject({
      isVisible: true,
      statusId: 'cleared_for_one_completed_day',
      heading: 'Warning cleared in the latest completed day',
    })
    expect(JSON.stringify(presentation)).not.toContain('private-provider')
    expect(JSON.stringify(presentation)).not.toContain('private-model')
    expect(JSON.stringify(presentation)).not.toContain('private-endpoint')
    expect(JSON.stringify(presentation)).not.toContain('08006')
  })

  it('distinguishes latest and older-only warnings while hiding an empty completed window', () => {
    const latest = buildAiProviderCapabilityMetricsFailureRecencyPresentation(report({
      periods: [
        { id: 'baseline', persistenceFailureCount: '0' },
        { id: 'previous', persistenceFailureCount: '0' },
        { id: 'current', persistenceFailureCount: '1' },
      ],
      recency: { id: 'warning_in_latest_completed_day', completedDaysSinceLastWarning: 0 },
      status: { id: 'warning_in_latest_completed_day' },
    }))
    const olderOnly = buildAiProviderCapabilityMetricsFailureRecencyPresentation(report({
      periods: [
        { id: 'baseline', persistenceFailureCount: '1' },
        { id: 'previous', persistenceFailureCount: '0' },
        { id: 'current', persistenceFailureCount: '0' },
      ],
      recency: { id: 'older_completed_warning_only', completedDaysSinceLastWarning: 2 },
      status: { id: 'older_completed_warning_only' },
    }))
    const empty = buildAiProviderCapabilityMetricsFailureRecencyPresentation(report({
      periods: [
        { id: 'baseline', persistenceFailureCount: '0' },
        { id: 'previous', persistenceFailureCount: '0' },
        { id: 'current', persistenceFailureCount: '0' },
      ],
      recency: { id: 'no_completed_persistence_warnings', completedDaysSinceLastWarning: null },
      status: { id: 'no_completed_persistence_warnings' },
    }))

    expect(latest.statusId).toBe('warning_in_latest_completed_day')
    expect(olderOnly.statusId).toBe('older_completed_warning_only')
    expect(empty).toEqual(expect.objectContaining({ isVisible: false }))
  })

  it('fails closed when counts or the claimed age band are incoherent', () => {
    const presentation = buildAiProviderCapabilityMetricsFailureRecencyPresentation(report({
      periods: [
        { id: 'baseline', persistenceFailureCount: '1' },
        { id: 'previous', persistenceFailureCount: 'invalid' },
        { id: 'current', persistenceFailureCount: '0' },
      ],
      recency: { id: 'older_completed_warning_only', completedDaysSinceLastWarning: 2 },
      status: { id: 'older_completed_warning_only' },
    }))

    expect(presentation).toMatchObject({
      isVisible: true,
      statusId: 'unavailable',
    })
  })
})
