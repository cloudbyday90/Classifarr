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
import { mount, flushPromises } from '@vue/test-utils'
import Confidence from '@/views/settings/Confidence.vue'
import api from '@/api'

vi.mock('@/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    getConfidenceSettings: vi.fn(),
    updateConfidenceSettings: vi.fn(),
    getConfidenceHistory: vi.fn(),
    revertConfidenceSetting: vi.fn(),
    exportConfidenceSettings: vi.fn(),
    getAIConfig: vi.fn(),
    getAIConfigForUpdate: vi.fn(),
    updateAIConfig: vi.fn(),
    getLatestRagFallbackIncident: vi.fn()
  }
}))

vi.mock('@/stores/toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}))

const baseConfidenceSettings = {
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
const AI_SETTINGS_WRITE_PRECONDITION = '"00000000-0000-4000-8000-000000000404"'

function mockGetRoutes({
  confidence = baseConfidenceSettings,
  ai = {
    rag_loop_auto_fallback_enabled: true,
    rag_loop_auto_recover_enabled: false
  },
  incident = { incident: null, fallback_state: null, checked_at: null },
  history = []
} = {}) {
  api.getConfidenceSettings.mockResolvedValue(confidence)
  api.getAIConfig.mockResolvedValue(ai)
  api.getAIConfigForUpdate.mockImplementation(async () => ({
    config: await api.getAIConfig(),
    writePrecondition: AI_SETTINGS_WRITE_PRECONDITION,
  }))
  api.getLatestRagFallbackIncident.mockResolvedValue(incident)
  api.getConfidenceHistory.mockResolvedValue(history)
}

describe('Confidence Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.updateConfidenceSettings.mockResolvedValue({ data: { success: true } })
    api.updateAIConfig.mockResolvedValue({ data: { success: true } })
  })

  it('loads discord and rag-loop safety settings from APIs', async () => {
    mockGetRoutes({
      ai: {
        rag_loop_auto_fallback_enabled: false,
        rag_loop_auto_recover_enabled: true
      },
      confidence: {
        ...baseConfidenceSettings,
        discord_show_similar_items: { value: 'false', default: 'true' }
      }
    })

    const wrapper = mount(Confidence)
    await flushPromises()

    expect(api.getConfidenceSettings).toHaveBeenCalled()
    expect(api.getAIConfigForUpdate).toHaveBeenCalled()
    expect(api.getLatestRagFallbackIncident).toHaveBeenCalled()

    expect(wrapper.vm.discordSettings.includeSignalBreakdown).toBe(true)
    expect(wrapper.vm.discordSettings.showSimilarItems).toBe(false)
    expect(wrapper.vm.ragLoopSettings.autoFallbackEnabled).toBe(false)
    expect(wrapper.vm.ragLoopSettings.autoRecoverEnabled).toBe(true)
  })

  it('saves confidence payload and rag-loop safety toggles', async () => {
    mockGetRoutes()
    const wrapper = mount(Confidence)
    await flushPromises()

    wrapper.vm.discordSettings.includeSignalBreakdown = false
    wrapper.vm.discordSettings.showSimilarItems = false
    wrapper.vm.ragLoopSettings.autoFallbackEnabled = false
    wrapper.vm.ragLoopSettings.autoRecoverEnabled = true

    await wrapper.vm.saveAllSettings()
    await flushPromises()

    expect(api.updateConfidenceSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        discord_include_signal_breakdown: false,
        discord_show_similar_items: false
      })
    )
    expect(api.updateAIConfig).toHaveBeenCalledWith({
      rag_loop_auto_fallback_enabled: false,
      rag_loop_auto_recover_enabled: true
    }, AI_SETTINGS_WRITE_PRECONDITION)
  })

  it('renders fallback incident panel when incident exists', async () => {
    mockGetRoutes({
      incident: {
        incident: {
          incident_id: 'incident-123',
          triggered_at: '2026-02-11T10:00:00.000Z',
          from_mode: 'apply',
          to_mode: 'shadow'
        },
        fallback_state: {
          auto_fallback_enabled: true
        },
        checked_at: '2026-02-11T10:01:00.000Z'
      }
    })

    const wrapper = mount(Confidence)
    await flushPromises()

    expect(wrapper.text()).toContain('Automatic fallback detected')
    expect(wrapper.text()).toContain('incident-123')
    expect(wrapper.text()).toContain('Copy Report')
  })

  it('renders normalized audit history with friendly values and disables non-revertable rows', async () => {
    mockGetRoutes({
      history: [
        {
          id: 101,
          setting_key: 'policy_auto_classify_threshold',
          old_value: '80',
          new_value: '85',
          changed_at: '2026-02-19T15:00:00.000Z',
          changed_by_username: 'admin',
          change_reason: 'Threshold tuning'
        },
        {
          // camelCase/legacy shape with no numeric id -> should render but not revertable
          settingKey: 'discord_include_signal_breakdown',
          oldValue: 'false',
          newValue: 'true',
          changedAt: 'not-a-date',
          changedByUsername: 'ops',
          changeReason: 'Enable details for triage'
        },
        {
          // should be filtered because it has no useful content
          id: 303
        }
      ]
    })

    const wrapper = mount(Confidence)
    await flushPromises()

    expect(wrapper.text()).toContain('Auto-Classify Threshold')
    expect(wrapper.text()).toContain('Threshold tuning')
    expect(wrapper.text()).toContain('Discord: Include Signal Breakdown')
    expect(wrapper.text()).toContain('Enabled')
    expect(wrapper.text()).toContain('Disabled')
    expect(wrapper.text()).toContain('Unknown')

    const revertButtons = wrapper.findAll('button').filter((b) => b.text().includes('Revert'))
    expect(revertButtons.length).toBe(2)
    expect(revertButtons[0].attributes('disabled')).toBeUndefined()
    expect(revertButtons[1].attributes('disabled')).toBeDefined()
  })
})
