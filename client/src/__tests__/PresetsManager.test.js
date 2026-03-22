/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PresetsManager from '../views/PresetsManager.vue'

const mockToast = {
  success: vi.fn(),
  error: vi.fn()
}

vi.mock('../api/presets', () => ({
  default: {
    getSystemPresets: vi.fn(),
    getCustomPresets: vi.fn(),
    createCustomPreset: vi.fn(),
    updateCustomPreset: vi.fn(),
    deleteCustomPreset: vi.fn()
  }
}))

vi.mock('../stores/toast', () => ({
  useToast: () => mockToast
}))

import presetsApi from '../api/presets'

describe('PresetsManager.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    presetsApi.getSystemPresets.mockResolvedValue({
      data: [{ id: 1, name: 'Family', category: 'audience', signals: {} }]
    })
    presetsApi.getCustomPresets.mockResolvedValue({
      data: [{ id: 9, name: 'Family Remix', category: 'custom', signals: {} }]
    })
  })

  it('uses built-in and my preset labels consistently', async () => {
    const wrapper = mount(PresetsManager, {
      attachTo: document.body,
      global: {
        stubs: {
          CustomPresetForm: true,
          PresetSummaryModal: true,
          PresetCard: true,
          Spinner: true,
          Modal: true,
          Button: true
        }
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Browse built-in presets or create your own reusable presets for policy attachment')
    expect(wrapper.text()).toContain('Built-in Presets')
    expect(wrapper.text()).toContain('My Presets')
  })
})
