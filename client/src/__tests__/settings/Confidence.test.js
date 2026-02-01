/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Confidence from '@/views/settings/Confidence.vue'
import api from '@/api'

// Mock the API
vi.mock('@/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn()
  }
}))

// Mock the toast store
vi.mock('@/stores/toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}))

describe('Confidence Settings - Discord Display Options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load Discord display options from API', async () => {
    const mockSettings = {
      policy_auto_classify_threshold: { value: '85', default: '85' },
      policy_prompt_threshold: { value: '60', default: '60' },
      discord_include_signal_breakdown: { value: 'true', default: 'true' },
      discord_show_similar_items: { value: 'false', default: 'true' }
    }

    api.get.mockResolvedValueOnce({ data: mockSettings })
    api.get.mockResolvedValueOnce({ data: [] }) // audit history

    const wrapper = mount(Confidence)

    // Wait for component to load
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify API was called
    expect(api.get).toHaveBeenCalledWith('/api/settings/confidence')

    // Verify Discord settings were loaded
    expect(wrapper.vm.discordSettings.includeSignalBreakdown).toBe(true)
    expect(wrapper.vm.discordSettings.showSimilarItems).toBe(false)
  })

  it('should include Discord display options in save payload', async () => {
    const mockSettings = {
      policy_auto_classify_threshold: { value: '85', default: '85' },
      policy_prompt_threshold: { value: '60', default: '60' },
      discord_include_signal_breakdown: { value: 'true', default: 'true' },
      discord_show_similar_items: { value: 'true', default: 'true' },
      learning_genre_threshold: { value: '3', default: '3' },
      learning_keyword_threshold: { value: '5', default: '5' },
      learning_studio_threshold: { value: '2', default: '2' },
      learning_min_confidence_rate: { value: '75', default: '75' },
      learning_conflict_strategy: { value: 'escalate', default: 'escalate' },
      learning_auto_resolve_threshold: { value: '7', default: '7' },
      learning_max_per_user_day: { value: '50', default: '50' },
      learning_max_per_library_hour: { value: '20', default: '20' }
    }

    api.get.mockResolvedValueOnce({ data: mockSettings })
    api.get.mockResolvedValueOnce({ data: [] })
    api.put.mockResolvedValueOnce({ data: { success: true } })
    api.get.mockResolvedValueOnce({ data: [] }) // audit history reload

    const wrapper = mount(Confidence)

    // Wait for component to load
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    // Update Discord settings
    wrapper.vm.discordSettings.includeSignalBreakdown = false
    wrapper.vm.discordSettings.showSimilarItems = false

    // Save settings
    await wrapper.vm.saveAllSettings()

    // Verify the API was called with Discord settings
    expect(api.put).toHaveBeenCalledWith('/api/settings/confidence', 
      expect.objectContaining({
        discord_include_signal_breakdown: false,
        discord_show_similar_items: false
      })
    )
  })

  it('should render Discord display option checkboxes', async () => {
    const mockSettings = {
      policy_auto_classify_threshold: { value: '85', default: '85' },
      policy_prompt_threshold: { value: '60', default: '60' },
      discord_include_signal_breakdown: { value: 'true', default: 'true' },
      discord_show_similar_items: { value: 'true', default: 'true' },
      learning_genre_threshold: { value: '3', default: '3' },
      learning_keyword_threshold: { value: '5', default: '5' },
      learning_studio_threshold: { value: '2', default: '2' },
      learning_min_confidence_rate: { value: '75', default: '75' },
      learning_conflict_strategy: { value: 'escalate', default: 'escalate' },
      learning_auto_resolve_threshold: { value: '7', default: '7' },
      learning_max_per_user_day: { value: '50', default: '50' },
      learning_max_per_library_hour: { value: '20', default: '20' }
    }

    api.get.mockResolvedValueOnce({ data: mockSettings })
    api.get.mockResolvedValueOnce({ data: [] })

    const wrapper = mount(Confidence)

    // Wait for component to load
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify checkboxes are rendered
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes.length).toBeGreaterThanOrEqual(2)

    // Verify the text content includes Discord options
    const text = wrapper.text()
    expect(text).toContain('signal breakdown')
    expect(text).toContain('similar items')
  })

  it('should persist Discord options across page reloads', async () => {
    // First load - default values
    const mockSettingsInitial = {
      policy_auto_classify_threshold: { value: '85', default: '85' },
      policy_prompt_threshold: { value: '60', default: '60' },
      discord_include_signal_breakdown: { value: 'true', default: 'true' },
      discord_show_similar_items: { value: 'true', default: 'true' }
    }

    api.get.mockResolvedValueOnce({ data: mockSettingsInitial })
    api.get.mockResolvedValueOnce({ data: [] })

    const wrapper1 = mount(Confidence)
    await wrapper1.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(wrapper1.vm.discordSettings.includeSignalBreakdown).toBe(true)
    expect(wrapper1.vm.discordSettings.showSimilarItems).toBe(true)

    vi.clearAllMocks()

    // Second load - after user changed settings
    const mockSettingsUpdated = {
      policy_auto_classify_threshold: { value: '85', default: '85' },
      policy_prompt_threshold: { value: '60', default: '60' },
      discord_include_signal_breakdown: { value: 'false', default: 'true' },
      discord_show_similar_items: { value: 'false', default: 'true' }
    }

    api.get.mockResolvedValueOnce({ data: mockSettingsUpdated })
    api.get.mockResolvedValueOnce({ data: [] })

    const wrapper2 = mount(Confidence)
    await wrapper2.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify settings persisted
    expect(wrapper2.vm.discordSettings.includeSignalBreakdown).toBe(false)
    expect(wrapper2.vm.discordSettings.showSimilarItems).toBe(false)
  })
})
