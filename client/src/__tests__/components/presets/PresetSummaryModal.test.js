/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PresetSummaryModal from '@/components/presets/PresetSummaryModal.vue'

const presetsApiMock = vi.hoisted(() => ({
  getPresetUsageCount: vi.fn()
}))

vi.mock('@/api/presets', () => ({
  default: presetsApiMock
}))

const ModalStub = {
  props: ['modelValue', 'title'],
  emits: ['update:modelValue'],
  template: `<div v-if="modelValue" data-test="modal"><div data-test="modal-title">{{ title }}</div><slot /><slot name="footer" /></div>`
}

const ButtonStub = {
  props: ['variant'],
  emits: ['click'],
  template: '<button :data-variant="variant" @click="$emit(\'click\')"><slot /></button>'
}

const BadgeStub = {
  props: ['variant'],
  template: '<span data-test="badge" :data-variant="variant"><slot /></span>'
}

function mountModal(props = {}) {
  return mount(PresetSummaryModal, {
    props: {
      modelValue: true,
      preset: basePreset,
      ...props
    },
    global: {
      stubs: { Modal: ModalStub, Button: ButtonStub, Badge: BadgeStub }
    }
  })
}

const basePreset = {
  id: 1,
  name: 'Family Friendly',
  icon: '👨‍👩‍👧‍👦',
  description: 'Safe for the whole family',
  signals: {
    certifications: { mode: 'include', include: ['G', 'PG'], exclude: [], max: null },
    genres: { prefer: ['Animation', 'Comedy'], exclude: ['Horror'] },
    keywords: { prefer: ['wholesome'], exclude: ['violence'] }
  }
}

describe('PresetSummaryModal.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    presetsApiMock.getPresetUsageCount.mockResolvedValue({ count: 3 })
  })

  describe('rendering', () => {
    it('shows preset name in title', () => {
      const wrapper = mountModal()
      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Family Friendly')
    })

    it('shows Preset Details when preset is null', () => {
      const wrapper = mountModal({ preset: null })
      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Preset Details')
    })

    it('shows preset icon', () => {
      const wrapper = mountModal()
      expect(wrapper.text()).toContain('👨‍👩‍👧‍👦')
    })

    it('falls back to default emoji when icon is missing', () => {
      const wrapper = mountModal({ preset: { ...basePreset, icon: null } })
      expect(wrapper.text()).toContain('🎬')
    })

    it('shows description when present', () => {
      const wrapper = mountModal()
      expect(wrapper.text()).toContain('Safe for the whole family')
    })

    it('hides description when absent', () => {
      const preset = { ...basePreset, description: '' }
      const wrapper = mountModal({ preset })
      expect(wrapper.text()).not.toContain('Safe for the whole family')
    })

    it('shows usage count from API', async () => {
      const wrapper = mountModal()
      await flushPromises()

      expect(presetsApiMock.getPresetUsageCount).toHaveBeenCalledWith(1)
      expect(wrapper.text()).toContain('Used in 3 policies')
    })

    it('shows singular policy for count of 1', async () => {
      presetsApiMock.getPresetUsageCount.mockResolvedValue({ count: 1 })
      const wrapper = mountModal()
      await flushPromises()

      expect(wrapper.text()).toContain('Used in 1 policy')
    })

    it('hides usage count when API fails', async () => {
      presetsApiMock.getPresetUsageCount.mockRejectedValue(new Error('fail'))
      const wrapper = mountModal()
      await flushPromises()

      expect(wrapper.text()).not.toContain('Used in')
    })

    it('hides usage count when preset has no id', async () => {
      const wrapper = mountModal({ preset: { ...basePreset, id: null } })
      await flushPromises()

      expect(presetsApiMock.getPresetUsageCount).not.toHaveBeenCalled()
    })
  })

  describe('content ratings section', () => {
    it('shows include ratings as badges', () => {
      const wrapper = mountModal()
      expect(wrapper.text()).toContain('Content Ratings')
      expect(wrapper.text()).toContain('Include (allow these ratings)')
      expect(wrapper.text()).toContain('Allowed:')
      expect(wrapper.text()).toContain('G')
      expect(wrapper.text()).toContain('PG')
    })

    it('shows exclude ratings', () => {
      const preset = {
        ...basePreset,
        signals: {
          ...basePreset.signals,
          certifications: { mode: 'exclude', include: [], exclude: ['R', 'NC-17'], max: null }
        }
      }
      const wrapper = mountModal({ preset })
      expect(wrapper.text()).toContain('Excluded:')
      expect(wrapper.text()).toContain('R')
      expect(wrapper.text()).toContain('NC-17')
    })

    it('shows max rating', () => {
      const preset = {
        ...basePreset,
        signals: {
          ...basePreset.signals,
          certifications: { mode: 'max', include: [], exclude: [], max: 'PG-13' }
        }
      }
      const wrapper = mountModal({ preset })
      expect(wrapper.text()).toContain('Maximum:')
      expect(wrapper.text()).toContain('PG-13')
    })

    it('hides ratings section when no data', () => {
      const preset = {
        ...basePreset,
        signals: {
          certifications: { mode: 'include', include: [], exclude: [], max: null },
          genres: { prefer: [], exclude: [] },
          keywords: { prefer: [], exclude: [] }
        }
      }
      const wrapper = mountModal({ preset })
      expect(wrapper.text()).not.toContain('Content Ratings')
    })

    it('formats include mode label', () => {
      const wrapper = mountModal()
      expect(wrapper.text()).toContain('Include (allow these ratings)')
    })
  })

  describe('genres section', () => {
    it('shows preferred genres', () => {
      const wrapper = mountModal()
      expect(wrapper.text()).toContain('Genres')
      expect(wrapper.text()).toContain('Preferred:')
      expect(wrapper.text()).toContain('Animation')
      expect(wrapper.text()).toContain('Comedy')
    })

    it('shows excluded genres', () => {
      const wrapper = mountModal()
      expect(wrapper.text()).toContain('Excluded:')
      expect(wrapper.text()).toContain('Horror')
    })

    it('hides genres section when no data', () => {
      const preset = {
        ...basePreset,
        signals: {
          certifications: { mode: 'include', include: ['G'], exclude: [], max: null },
          genres: { prefer: [], exclude: [] },
          keywords: { prefer: [], exclude: [] }
        }
      }
      const wrapper = mountModal({ preset })
      expect(wrapper.text()).not.toContain('Genres')
    })

    it('shows (none) when genre section has no prefer or exclude', () => {
      const preset = {
        ...basePreset,
        signals: {
          certifications: { mode: 'include', include: ['G'], exclude: [], max: null },
          genres: { prefer: [], exclude: [] },
          keywords: { prefer: ['magic'], exclude: [] }
        }
      }
      const wrapper = mountModal({ preset })
      expect(wrapper.text()).not.toContain('Genres')
    })
  })

  describe('keywords section', () => {
    it('shows preferred keywords', () => {
      const wrapper = mountModal()
      expect(wrapper.text()).toContain('Keywords')
      expect(wrapper.text()).toContain('wholesome')
    })

    it('shows excluded keywords', () => {
      const wrapper = mountModal()
      expect(wrapper.text()).toContain('violence')
    })

    it('hides keywords section when no data', () => {
      const preset = {
        ...basePreset,
        signals: {
          certifications: { mode: 'include', include: ['G'], exclude: [], max: null },
          genres: { prefer: ['Action'], exclude: [] },
          keywords: { prefer: [], exclude: [] }
        }
      }
      const wrapper = mountModal({ preset })
      expect(wrapper.text()).not.toContain('Keywords')
    })
  })

  describe('actions', () => {
    it('emits customize when Customize button is clicked', async () => {
      const wrapper = mountModal()
      const buttons = wrapper.findAll('button')
      const customizeBtn = buttons.find(b => b.text().includes('Customize'))
      await customizeBtn.trigger('click')

      expect(wrapper.emitted('customize')).toBeTruthy()
      expect(wrapper.emitted('customize')[0]).toEqual([basePreset])
    })

    it('emits update:modelValue false when Close is clicked', async () => {
      const wrapper = mountModal()
      const buttons = wrapper.findAll('button')
      const closeBtn = buttons.find(b => b.text().includes('Close'))
      await closeBtn.trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('hides modal when modelValue becomes false', async () => {
      const wrapper = mountModal()
      expect(wrapper.find('[data-test="modal"]').exists()).toBe(true)

      await wrapper.setProps({ modelValue: false })
      expect(wrapper.find('[data-test="modal"]').exists()).toBe(false)
    })
  })

  describe('usage count lifecycle', () => {
    it('fetches usage count on mount when preset has id', async () => {
      mountModal()
      await flushPromises()
      expect(presetsApiMock.getPresetUsageCount).toHaveBeenCalledWith(1)
    })

    it('resets usage count when modal closes', async () => {
      const wrapper = mountModal()
      await flushPromises()

      await wrapper.setProps({ modelValue: false })
      await flushPromises()

      expect(wrapper.text()).not.toContain('Used in')
    })

    it('refetches usage count when modal reopens with new preset', async () => {
      const wrapper = mountModal()
      await flushPromises()

      await wrapper.setProps({ modelValue: false })
      await flushPromises()

      await wrapper.setProps({ modelValue: true, preset: { ...basePreset, id: 2 } })
      await flushPromises()

      expect(presetsApiMock.getPresetUsageCount).toHaveBeenCalledTimes(2)
    })
  })
})
