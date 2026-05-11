/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  formatEmbeddingMode,
  getBackfillStatusLabel,
  getImageEmbeddingStatusPresentation,
  getLastFetchedLabel,
  getTextEmbeddingStatusPresentation,
} from '@/utils/ragEmbeddingDisplay'

describe('ragEmbeddingDisplay utility helpers', () => {
  it('formats separate embedding modes with a shared label', () => {
    expect(formatEmbeddingMode('separate_ollama')).toBe('separate')
    expect(formatEmbeddingMode('separate_local', { fallback: 'disabled' })).toBe('separate')
    expect(formatEmbeddingMode('', { fallback: 'disabled' })).toBe('disabled')
  })

  it('builds text status presentation from provider flags', () => {
    expect(getTextEmbeddingStatusPresentation({ providerOnline: true })).toEqual({
      label: 'Online',
      dotClass: 'bg-green-500',
      textClass: 'text-green-400',
    })

    expect(getTextEmbeddingStatusPresentation({ providerConfigured: true })).toEqual({
      label: 'Configured',
      dotClass: 'bg-yellow-500',
      textClass: 'text-yellow-400',
    })

    expect(getTextEmbeddingStatusPresentation({})).toEqual({
      label: 'Offline',
      dotClass: 'bg-red-500',
      textClass: 'text-red-400',
    })
  })

  it('builds image status presentation from normalized runtime state', () => {
    expect(getImageEmbeddingStatusPresentation({ state: 'disabled' }).label).toBe('Disabled')
    expect(getImageEmbeddingStatusPresentation({ state: 'configured' })).toEqual({
      label: 'Ready (Configured)',
      dotClass: 'bg-yellow-500',
      textClass: 'text-yellow-400',
    })
    expect(getImageEmbeddingStatusPresentation({ state: 'not_configured' }).textClass).toBe('text-gray-400')
    expect(getImageEmbeddingStatusPresentation({ state: 'online' }).dotClass).toBe('bg-green-500')
    expect(getImageEmbeddingStatusPresentation({ state: 'unknown' }).label).toBe('Offline')
  })

  it('formats backfill and fetch recency labels', () => {
    expect(getBackfillStatusLabel({ enabled: false })).toBe('Off')
    expect(getBackfillStatusLabel({ enabled: true, presentation: { statusLabel: 'On' }, time: '03:00' })).toBe('On (03:00)')
    expect(getBackfillStatusLabel({ enabled: true }, { disabled: true })).toBe('Off')

    expect(getLastFetchedLabel(null)).toBe('Models not fetched yet')
    expect(getLastFetchedLabel('2026-05-11T12:00:00.000Z', { now: new Date('2026-05-11T12:10:00.000Z').getTime() })).toBe('Last fetched 10m ago')
  })
})