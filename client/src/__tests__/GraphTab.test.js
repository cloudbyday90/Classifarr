/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import GraphTab from '../views/rag/GraphTab.vue'
import api from '../api'

let consoleErrorSpy

vi.mock('../api', () => ({
  default: {
    put: vi.fn(),
    getAIConfig: vi.fn(),
    updateAIConfig: vi.fn(),
    getRagGraphFillRate: vi.fn(),
  },
}))

const defaultConfig = {
  rag_graph_enabled: false,
  rag_graph_weight: 0.20,
  rag_graph_collection_enabled: true,
  rag_graph_director_enabled: true,
  rag_graph_studio_enabled: false,
  rag_graph_cast_enabled: false,
  rag_graph_genre_enabled: false,
  rag_graph_min_matches_to_apply: 1,
  rag_graph_candidates_limit: 20,
}

const mockApiSuccess = (configOverrides = {}) => {
  api.getAIConfig.mockResolvedValue({ ...defaultConfig, ...configOverrides })
  api.getRagGraphFillRate.mockResolvedValue({
    total: 100,
    has_collection: 80,
    has_director: 90,
    has_studio: 60,
    has_cast: 70,
    has_genres: 85,
    pct_collection: 80,
    pct_director: 90,
    pct_studio: 60,
    pct_cast: 70,
    pct_genres: 85,
  })
}

describe('GraphTab.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('renders the Graph Retrieval header badge', async () => {
    mockApiSuccess()
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('Graph Retrieval')
  })

  it('shows Disabled status when rag_graph_enabled is false', async () => {
    mockApiSuccess({ rag_graph_enabled: false })
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('Disabled')
  })

  it('shows Enabled status when rag_graph_enabled is true', async () => {
    mockApiSuccess({ rag_graph_enabled: true })
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('Enabled')
  })

  it('shows disabled hint text when graph is off', async () => {
    mockApiSuccess({ rag_graph_enabled: false })
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('Graph retrieval is disabled')
  })

  it('hides config panels when disabled', async () => {
    mockApiSuccess({ rag_graph_enabled: false })
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Fusion Weight')
  })

  it('shows config panels when enabled', async () => {
    mockApiSuccess({ rag_graph_enabled: true })
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('Fusion Weight')
  })

  it('shows active dimension count as 0 when disabled', async () => {
    mockApiSuccess({ rag_graph_enabled: false })
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('Active dimensions:')
    expect(wrapper.text()).toContain('0')
  })

  it('shows correct active dimension count when enabled with defaults', async () => {
    // collection + director = 2 active by default
    mockApiSuccess({
      rag_graph_enabled: true,
      rag_graph_collection_enabled: true,
      rag_graph_director_enabled: true,
      rag_graph_studio_enabled: false,
      rag_graph_cast_enabled: false,
      rag_graph_genre_enabled: false,
    })
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('2')
  })

  it('loads config from /settings/ai on mount', async () => {
    mockApiSuccess({ rag_graph_weight: 0.35 })
    mount(GraphTab)
    await flushPromises()
    expect(api.getAIConfig).toHaveBeenCalled()
  })

  it('loads fill-rate on mount', async () => {
    mockApiSuccess()
    mount(GraphTab)
    await flushPromises()
    expect(api.getRagGraphFillRate).toHaveBeenCalled()
  })

  it('displays fill-rate percentages when data loads', async () => {
    mockApiSuccess({ rag_graph_enabled: true })
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('80%')
    expect(wrapper.text()).toContain('90%')
  })

  it('shows fill-rate error message on API failure', async () => {
    api.getAIConfig.mockResolvedValue(defaultConfig)
    api.getRagGraphFillRate.mockRejectedValue(new Error('Network error'))
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('Failed to load fill-rate data')
  })

  it('calls PUT /settings/ai on save', async () => {
    mockApiSuccess()
    api.updateAIConfig.mockResolvedValue({ data: {} })
    const wrapper = mount(GraphTab)
    await flushPromises()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save'))
    await saveBtn.trigger('click')
    await flushPromises()
    expect(api.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      rag_graph_enabled: false,
      rag_graph_weight: 0.20,
    }))
  })

  it('shows save confirmation message on successful save', async () => {
    mockApiSuccess()
    api.updateAIConfig.mockResolvedValue({ data: {} })
    const wrapper = mount(GraphTab)
    await flushPromises()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save'))
    await saveBtn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Configuration saved')
  })

  it('shows error message on failed save', async () => {
    mockApiSuccess()
    api.updateAIConfig.mockRejectedValue({ response: { data: { error: 'DB error' } } })
    const wrapper = mount(GraphTab)
    await flushPromises()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save'))
    await saveBtn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('DB error')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save graph retrieval config:', expect.anything())
  })

  it('falls back to generic error message when save error has no response body', async () => {
    mockApiSuccess()
    api.updateAIConfig.mockRejectedValue(new Error('Network error'))
    const wrapper = mount(GraphTab)
    await flushPromises()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save'))
    await saveBtn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Failed to save configuration')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save graph retrieval config:', expect.anything())
  })

  it('handles loadConfig gracefully when /settings/ai fails', async () => {
    api.getAIConfig.mockRejectedValue(new Error('Server error'))
    api.getRagGraphFillRate.mockResolvedValue({
      total: 0,
      has_collection: 0, pct_collection: 0,
      has_director: 0,   pct_director:   0,
      has_studio: 0,     pct_studio:     0,
      has_cast: 0,       pct_cast:       0,
      has_genres: 0,     pct_genres:     0,
    })
    // Should not throw — just use default config values
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('Graph Retrieval')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load graph retrieval config:', expect.any(Error))
  })

  describe('fillRateBarClass helper', () => {
    it('returns green for pct >= 80', async () => {
      mockApiSuccess({ rag_graph_enabled: true })
      const wrapper = mount(GraphTab)
      await flushPromises()
      // 90% director bar should have green class
      const bars = wrapper.findAll('.h-2.rounded-full')
      const greenBars = bars.filter(b => b.classes().includes('bg-green-500'))
      expect(greenBars.length).toBeGreaterThan(0)
    })

    it('returns red for pct < 50', async () => {
      api.getAIConfig.mockResolvedValue({ ...defaultConfig, rag_graph_enabled: true })
      api.getRagGraphFillRate.mockResolvedValue({
        total: 100,
        has_collection: 10, pct_collection: 10,
        has_director: 10,   pct_director:   10,
        has_studio: 10,     pct_studio:     10,
        has_cast: 10,       pct_cast:       10,
        has_genres: 10,     pct_genres:     10,
      })
      const wrapper = mount(GraphTab)
      await flushPromises()
      const bars = wrapper.findAll('.h-2.rounded-full')
      const redBars = bars.filter(b => b.classes().includes('bg-red-500'))
      expect(redBars.length).toBeGreaterThan(0)
    })
  })
})
