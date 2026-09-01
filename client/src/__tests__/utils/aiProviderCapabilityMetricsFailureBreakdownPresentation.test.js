/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildAiProviderCapabilityMetricsFailureBreakdownPresentation } from '@/utils/aiProviderCapabilityMetricsFailureBreakdownPresentation'

function report(overrides = {}) {
  return {
    version: 'ai.provider_capability_metrics_failure_breakdown.v1',
    window: { hours: 24 },
    totalFailureCount: '2',
    safeCategoryFailureCount: '2',
    uncategorizedFailureCount: '0',
    stages: [{ id: 'metric_persistence_write', count: '2' }],
    sqlstateCategories: [
      { id: 'connection_exception', count: '1' },
      { id: 'not_available', count: '1' },
    ],
    status: { id: 'complete' },
    ...overrides,
  }
}

describe('aiProviderCapabilityMetricsFailureBreakdownPresentation', () => {
  it('renders only fixed category labels and aggregate counts', () => {
    const presentation = buildAiProviderCapabilityMetricsFailureBreakdownPresentation(report({
      provider: 'private-provider',
      model: 'private-model',
      error: 'postgres://private-endpoint',
      sqlstateCategories: [
        { id: 'connection_exception', count: '1', rawSqlstate: '08006' },
        { id: 'not_available', count: '1', message: 'private error' },
        { id: 'untrusted-category', count: '999', label: 'Private label' },
      ],
    }))

    expect(presentation).toMatchObject({
      isVisible: true,
      statusId: 'complete',
      totalFailureCount: '2',
      safeCategoryFailureCount: '2',
      sqlstateCategories: [
        { id: 'connection_exception', label: 'Connection exception', count: '1' },
        { id: 'not_available', label: 'No SQLSTATE available', count: '1' },
      ],
    })
    expect(JSON.stringify(presentation)).not.toContain('private-provider')
    expect(JSON.stringify(presentation)).not.toContain('private-model')
    expect(JSON.stringify(presentation)).not.toContain('private-endpoint')
    expect(JSON.stringify(presentation)).not.toContain('08006')
    expect(JSON.stringify(presentation)).not.toContain('Private label')
  })

  it('keeps historical warnings aggregate-only when fixed categories are absent', () => {
    const presentation = buildAiProviderCapabilityMetricsFailureBreakdownPresentation(report({
      totalFailureCount: '1',
      safeCategoryFailureCount: '0',
      uncategorizedFailureCount: '1',
      stages: [{ id: 'metric_persistence_write', count: '0' }],
      sqlstateCategories: [],
      status: { id: 'awaiting_safe_categories' },
    }))

    expect(presentation).toMatchObject({
      isVisible: true,
      statusId: 'awaiting_safe_categories',
      sqlstateCategories: [],
    })
  })

  it('fails closed when aggregate counts or status are incoherent', () => {
    const presentation = buildAiProviderCapabilityMetricsFailureBreakdownPresentation(report({
      safeCategoryFailureCount: '9',
    }))

    expect(presentation).toMatchObject({
      isVisible: true,
      statusId: 'unavailable',
      safeCategoryFailureCount: '0',
      sqlstateCategories: [],
    })
  })
})
