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

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
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
  api.get.mockImplementation((url) => {
    if (url === '/settings/ai') {
      return Promise.resolve({ data: { ...defaultConfig, ...configOverrides } })
    }
    if (url === '/rag/graph/fill-rate') {
      return Promise.resolve({
        data: {
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
        }
      })
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`))
  })
}

describe('GraphTab.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(api.get).toHaveBeenCalledWith('/settings/ai')
  })

  it('loads fill-rate on mount', async () => {
    mockApiSuccess()
    mount(GraphTab)
    await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/rag/graph/fill-rate')
  })

  it('displays fill-rate percentages when data loads', async () => {
    mockApiSuccess({ rag_graph_enabled: true })
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('80%')
    expect(wrapper.text()).toContain('90%')
  })

  it('shows fill-rate error message on API failure', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/settings/ai') return Promise.resolve({ data: defaultConfig })
      if (url === '/rag/graph/fill-rate') return Promise.reject(new Error('Network error'))
      return Promise.reject(new Error(`Unexpected GET ${url}`))
    })
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('Failed to load fill-rate data')
  })

  it('calls PUT /settings/ai on save', async () => {
    mockApiSuccess()
    api.put.mockResolvedValue({ data: {} })
    const wrapper = mount(GraphTab)
    await flushPromises()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save'))
    await saveBtn.trigger('click')
    await flushPromises()
    expect(api.put).toHaveBeenCalledWith('/settings/ai', expect.objectContaining({
      rag_graph_enabled: false,
      rag_graph_weight: 0.20,
    }))
  })

  it('shows save confirmation message on successful save', async () => {
    mockApiSuccess()
    api.put.mockResolvedValue({ data: {} })
    const wrapper = mount(GraphTab)
    await flushPromises()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save'))
    await saveBtn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Configuration saved')
  })

  it('shows error message on failed save', async () => {
    mockApiSuccess()
    api.put.mockRejectedValue({ response: { data: { error: 'DB error' } } })
    const wrapper = mount(GraphTab)
    await flushPromises()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save'))
    await saveBtn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('DB error')
  })

  it('falls back to generic error message when save error has no response body', async () => {
    mockApiSuccess()
    api.put.mockRejectedValue(new Error('Network error'))
    const wrapper = mount(GraphTab)
    await flushPromises()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save'))
    await saveBtn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Failed to save configuration')
  })

  it('handles loadConfig gracefully when /settings/ai fails', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/settings/ai') return Promise.reject(new Error('Server error'))
      if (url === '/rag/graph/fill-rate') return Promise.resolve({
        data: {
          total: 0,
          has_collection: 0, pct_collection: 0,
          has_director: 0,   pct_director:   0,
          has_studio: 0,     pct_studio:     0,
          has_cast: 0,       pct_cast:       0,
          has_genres: 0,     pct_genres:     0,
        }
      })
      return Promise.reject(new Error(`Unexpected GET ${url}`))
    })
    // Should not throw — just use default config values
    const wrapper = mount(GraphTab)
    await flushPromises()
    expect(wrapper.text()).toContain('Graph Retrieval')
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
      api.get.mockImplementation((url) => {
        if (url === '/settings/ai') return Promise.resolve({ data: { ...defaultConfig, rag_graph_enabled: true } })
        if (url === '/rag/graph/fill-rate') return Promise.resolve({
          data: {
            total: 100,
            has_collection: 10, pct_collection: 10,
            has_director: 10,   pct_director:   10,
            has_studio: 10,     pct_studio:     10,
            has_cast: 10,       pct_cast:       10,
            has_genres: 10,     pct_genres:     10,
          }
        })
        return Promise.reject(new Error(`Unexpected GET ${url}`))
      })
      const wrapper = mount(GraphTab)
      await flushPromises()
      const bars = wrapper.findAll('.h-2.rounded-full')
      const redBars = bars.filter(b => b.classes().includes('bg-red-500'))
      expect(redBars.length).toBeGreaterThan(0)
    })
  })
})
