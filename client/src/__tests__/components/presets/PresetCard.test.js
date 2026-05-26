/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PresetCard from '@/components/presets/PresetCard.vue'

vi.mock('@heroicons/vue/24/outline', () => ({
  PencilIcon: { template: '<svg data-test="pencil-icon" />' },
  TrashIcon: { template: '<svg data-test="trash-icon" />' },
  EyeIcon: { template: '<svg data-test="eye-icon" />' }
}))

vi.mock('@/constants/emojis', () => ({
  DEFAULT_EMOJI: '🎬'
}))

const CardStub = { template: '<div data-test="card"><slot /></div>' }
const BadgeStub = {
  props: ['variant'],
  template: '<span data-test="badge" :data-variant="variant"><slot /></span>'
}
const ButtonStub = {
  props: ['variant', 'size'],
  emits: ['click'],
  template: '<button :data-variant="variant" @click="$emit(\'click\')"><slot /></button>'
}

function mountCard(props = {}) {
  return mount(PresetCard, {
    props,
    global: {
      stubs: { Card: CardStub, Badge: BadgeStub, Button: ButtonStub }
    }
  })
}

const basePreset = {
  id: 1,
  name: 'Family Friendly',
  category: 'audience',
  description: 'Safe for the whole family',
  icon: '👨‍👩‍👧‍👦',
  signals: {}
}

describe('PresetCard.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('shows preset name and icon', () => {
      const wrapper = mountCard({ preset: basePreset })
      expect(wrapper.text()).toContain('Family Friendly')
      expect(wrapper.text()).toContain('👨‍👩‍👧‍👦')
    })

    it('falls back to default emoji when icon is missing', () => {
      const wrapper = mountCard({ preset: { ...basePreset, icon: null } })
      expect(wrapper.text()).toContain('🎬')
    })

    it('shows description when present', () => {
      const wrapper = mountCard({ preset: basePreset })
      expect(wrapper.text()).toContain('Safe for the whole family')
    })

    it('hides description when absent', () => {
      const preset = { ...basePreset, description: '' }
      const wrapper = mountCard({ preset })
      expect(wrapper.find('p').exists()).toBe(false)
    })

    it('shows formatted category badge', () => {
      const wrapper = mountCard({ preset: basePreset })
      const badge = wrapper.find('[data-test="badge"]')
      expect(badge.text()).toContain('Audience')
      expect(badge.attributes('data-variant')).toBe('info')
    })

    it('shows General for null category', () => {
      const wrapper = mountCard({ preset: { ...basePreset, category: null } })
      expect(wrapper.text()).toContain('General')
    })

    it('formats snake_case categories to Title Case', () => {
      const wrapper = mountCard({ preset: { ...basePreset, category: 'sci_fi_action' } })
      expect(wrapper.text()).toContain('Sci Fi Action')
    })

    it('maps category to correct badge variant', () => {
      const variants = {
        'audience': 'info',
        'genre': 'success',
        'rating': 'warning',
        'theme': 'info',
        'era': 'default',
        'studio': 'default',
        'language': 'default',
        'custom': 'default'
      }
      for (const [category, expectedVariant] of Object.entries(variants)) {
        const wrapper = mountCard({ preset: { ...basePreset, category } })
        expect(wrapper.find('[data-test="badge"]').attributes('data-variant')).toBe(expectedVariant)
      }
    })

    it('uses default variant for unknown categories', () => {
      const wrapper = mountCard({ preset: { ...basePreset, category: 'unknown' } })
      expect(wrapper.find('[data-test="badge"]').attributes('data-variant')).toBe('default')
    })
  })

  describe('signal summary', () => {
    it('shows certifications count with include mode', () => {
      const preset = {
        ...basePreset,
        signals: { certifications: { mode: 'include', include: ['G', 'PG'], exclude: [], max: null } }
      }
      const wrapper = mountCard({ preset })
      expect(wrapper.text()).toContain('2 ratings allowed')
    })

    it('shows certifications count with exclude mode', () => {
      const preset = {
        ...basePreset,
        signals: { certifications: { mode: 'exclude', include: [], exclude: ['R', 'NC-17'], max: null } }
      }
      const wrapper = mountCard({ preset })
      expect(wrapper.text()).toContain('2 ratings excluded')
    })

    it('shows certifications max rating', () => {
      const preset = {
        ...basePreset,
        signals: { certifications: { mode: 'max', include: [], exclude: [], max: 'PG-13' } }
      }
      const wrapper = mountCard({ preset })
      expect(wrapper.text()).toContain('Max: PG-13')
    })

    it('hides certifications when no relevant data', () => {
      const preset = {
        ...basePreset,
        signals: { certifications: { mode: 'include', include: [], exclude: [], max: null } }
      }
      const wrapper = mountCard({ preset })
      expect(wrapper.text()).not.toContain('ratings')
    })

    it('shows genre prefer and exclude counts', () => {
      const preset = {
        ...basePreset,
        signals: {
          certifications: { mode: 'include', include: [], exclude: [], max: null },
          genres: { prefer: ['Action', 'Comedy'], exclude: ['Horror'] }
        }
      }
      const wrapper = mountCard({ preset })
      expect(wrapper.text()).toContain('2 preferred')
      expect(wrapper.text()).toContain('1 excluded')
    })

    it('shows keyword prefer and exclude counts', () => {
      const preset = {
        ...basePreset,
        signals: {
          certifications: { mode: 'include', include: [], exclude: [], max: null },
          keywords: { prefer: ['magic'], exclude: ['violence', 'gore'] }
        }
      }
      const wrapper = mountCard({ preset })
      expect(wrapper.text()).toContain('1 preferred')
      expect(wrapper.text()).toContain('2 excluded')
    })

    it('hides genres section when empty', () => {
      const preset = {
        ...basePreset,
        signals: {
          certifications: { mode: 'include', include: [], exclude: [], max: null },
          genres: { prefer: [], exclude: [] }
        }
      }
      const wrapper = mountCard({ preset })
      expect(wrapper.text()).not.toContain('preferred')
    })
  })

  describe('actions', () => {
    it('shows View Details button in readonly mode', () => {
      const wrapper = mountCard({ preset: basePreset, readonly: true })
      expect(wrapper.text()).toContain('View Details')
      expect(wrapper.text()).not.toContain('Edit')
    })

    it('shows Edit and Delete buttons in edit mode', () => {
      const wrapper = mountCard({ preset: basePreset, readonly: false })
      expect(wrapper.text()).toContain('Edit')
      expect(wrapper.find('[aria-label="Delete preset Family Friendly"]').exists()).toBe(true)
    })

    it('emits view event when View Details is clicked', async () => {
      const wrapper = mountCard({ preset: basePreset, readonly: true })
      const buttons = wrapper.findAll('button')
      const viewBtn = buttons.find(b => b.text().includes('View Details'))
      await viewBtn.trigger('click')
      expect(wrapper.emitted('view')).toBeTruthy()
      expect(wrapper.emitted('view')[0]).toEqual([basePreset])
    })

    it('emits edit event when Edit is clicked', async () => {
      const wrapper = mountCard({ preset: basePreset, readonly: false })
      const buttons = wrapper.findAll('button')
      const editBtn = buttons.find(b => b.text().includes('Edit'))
      await editBtn.trigger('click')
      expect(wrapper.emitted('edit')).toBeTruthy()
      expect(wrapper.emitted('edit')[0]).toEqual([basePreset])
    })

    it('emits delete event when Delete is clicked', async () => {
      const wrapper = mountCard({ preset: basePreset, readonly: false })
      const deleteBtn = wrapper.find('[aria-label="Delete preset Family Friendly"]')
      await deleteBtn.trigger('click')
      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(wrapper.emitted('delete')[0]).toEqual([basePreset])
    })

    it('defaults readonly to false', () => {
      const wrapper = mountCard({ preset: basePreset })
      expect(wrapper.text()).toContain('Edit')
    })
  })
})
