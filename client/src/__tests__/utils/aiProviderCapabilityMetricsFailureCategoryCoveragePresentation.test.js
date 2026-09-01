/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildAiProviderCapabilityMetricsFailureCategoryCoveragePresentation } from '@/utils/aiProviderCapabilityMetricsFailureCategoryCoveragePresentation'

function report(overrides = {}) {
  return {
    version: 'ai.provider_capability_metrics_failure_category_coverage.v1',
    window: { days: 1, periodCount: 3 },
    periods: [
      { id: 'baseline', totalFailureCount: '1', safeCategoryFailureCount: '0', safeCategoryCoveragePercent: '0' },
      { id: 'previous', totalFailureCount: '2', safeCategoryFailureCount: '2', safeCategoryCoveragePercent: '100' },
      { id: 'current', totalFailureCount: '3', safeCategoryFailureCount: '2', safeCategoryCoveragePercent: '67' },
    ],
    status: { id: 'partial' },
    ...overrides,
  }
}

describe('aiProviderCapabilityMetricsFailureCategoryCoveragePresentation', () => {
  it('renders only fixed completed-window labels and count-derived coverage', () => {
    const presentation = buildAiProviderCapabilityMetricsFailureCategoryCoveragePresentation(report({
      provider: 'private-provider',
      model: 'private-model',
      error: 'postgres://private-endpoint',
      periods: [
        { id: 'baseline', totalFailureCount: '1', safeCategoryFailureCount: '0', safeCategoryCoveragePercent: '0', rawSqlstate: '08006' },
        { id: 'previous', totalFailureCount: '2', safeCategoryFailureCount: '2', safeCategoryCoveragePercent: '100', message: 'private error' },
        { id: 'current', totalFailureCount: '3', safeCategoryFailureCount: '2', safeCategoryCoveragePercent: '67', provider: 'private-provider' },
      ],
    }))

    expect(presentation).toMatchObject({
      isVisible: true,
      statusId: 'partial',
      periods: [
        { id: 'baseline', label: 'Oldest completed day', safeCategoryCoveragePercent: '0' },
        { id: 'previous', label: 'Previous completed day', safeCategoryCoveragePercent: '100' },
        { id: 'current', label: 'Latest completed day', safeCategoryCoveragePercent: '67' },
      ],
    })
    expect(JSON.stringify(presentation)).not.toContain('private-provider')
    expect(JSON.stringify(presentation)).not.toContain('private-model')
    expect(JSON.stringify(presentation)).not.toContain('private-endpoint')
    expect(JSON.stringify(presentation)).not.toContain('08006')
  })

  it('does not create a panel when no completed warning aggregate exists', () => {
    const presentation = buildAiProviderCapabilityMetricsFailureCategoryCoveragePresentation(report({
      periods: [
        { id: 'baseline', totalFailureCount: '0', safeCategoryFailureCount: '0', safeCategoryCoveragePercent: null },
        { id: 'previous', totalFailureCount: '0', safeCategoryFailureCount: '0', safeCategoryCoveragePercent: null },
        { id: 'current', totalFailureCount: '0', safeCategoryFailureCount: '0', safeCategoryCoveragePercent: null },
      ],
      status: { id: 'no_completed_persistence_warnings' },
    }))

    expect(presentation).toEqual(expect.objectContaining({ isVisible: false }))
  })

  it('fails closed when a count or percentage is incoherent', () => {
    const presentation = buildAiProviderCapabilityMetricsFailureCategoryCoveragePresentation(report({
      periods: [
        { id: 'baseline', totalFailureCount: '1', safeCategoryFailureCount: '0', safeCategoryCoveragePercent: '0' },
        { id: 'previous', totalFailureCount: '2', safeCategoryFailureCount: '2', safeCategoryCoveragePercent: '100' },
        { id: 'current', totalFailureCount: '3', safeCategoryFailureCount: '9', safeCategoryCoveragePercent: '300' },
      ],
    }))

    expect(presentation).toMatchObject({
      isVisible: true,
      statusId: 'unavailable',
      periods: [],
    })
  })
})
