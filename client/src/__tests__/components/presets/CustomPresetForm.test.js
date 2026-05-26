/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CustomPresetForm from '@/components/presets/CustomPresetForm.vue'

vi.mock('@/constants/emojis', () => ({
  EMOJI_OPTIONS: [
    { label: 'Movies', emojis: [{ value: '🎬', label: 'Clapperboard' }] }
  ],
  DEFAULT_EMOJI: '🎬'
}))

const ModalStub = {
  props: ['modelValue', 'title'],
  emits: ['update:modelValue'],
  template: `<div v-if="modelValue" data-test="modal"><div data-test="modal-title">{{ title }}</div><slot /><slot name="footer" /></div>`
}

const ButtonStub = {
  props: ['variant', 'loading'],
  emits: ['click'],
  template: '<button :data-variant="variant" :disabled="loading" @click="$emit(\'click\')"><slot /></button>'
}

const TagInputStub = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template: '<div data-test="tag-input">{{ modelValue }}</div>'
}

function mountForm(props = {}) {
  return mount(CustomPresetForm, {
    props: {
      modelValue: true,
      ...props
    },
    global: {
      stubs: { Modal: ModalStub, Button: ButtonStub, TagInput: TagInputStub }
    }
  })
}

describe('CustomPresetForm.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('modal title', () => {
    it('shows Create Custom Preset when no preset or sourcePreset', () => {
      const wrapper = mountForm()
      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Create Custom Preset')
    })

    it('shows Edit Custom Preset when editing existing preset', () => {
      const wrapper = mountForm({ preset: { id: 1, name: 'Test', signals: {} } })
      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Edit Custom Preset')
    })

    it('shows source preset name when customizing', () => {
      const wrapper = mountForm({ sourcePreset: { id: 1, name: 'Family', signals: {} } })
      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Family (Custom Preset)')
    })

    it('shows Preset Details in readonly mode', () => {
      const wrapper = mountForm({ readonly: true, preset: { id: 1, name: 'Test', signals: {} } })
      expect(wrapper.find('[data-test="modal-title"]').text()).toBe('Preset Details')
    })
  })

  describe('form initialization', () => {
    it('initializes with default values when creating new preset', () => {
      const wrapper = mountForm()
      expect(wrapper.find('input[type="text"]').element.value).toBe('')
      expect(wrapper.find('select').element.value).toBe('🎬')
    })

    it('pre-populates form from preset when editing', async () => {
      const wrapper = mountForm({ modelValue: false, preset: {
        id: 1,
        name: 'My Preset',
        description: 'A great preset',
        icon: '🎭',
        category: 'genre',
        signals: {
          certifications: { mode: 'exclude', include: [], exclude: ['R'], max: null },
          genres: { prefer: ['Action'], exclude: [] },
          keywords: { prefer: [], exclude: [] }
        }
      }})
      await wrapper.setProps({ modelValue: true })
      await flushPromises()

      expect(wrapper.find('input[type="text"]').element.value).toBe('My Preset')
      expect(wrapper.find('textarea').element.value).toBe('A great preset')
    })

    it('pre-populates form from sourcePreset when customizing', async () => {
      const wrapper = mountForm({ modelValue: false, sourcePreset: {
        id: 1,
        name: 'Source Preset',
        icon: '🎭',
        category: 'audience',
        signals: {
          certifications: { mode: 'include', include: ['G'], exclude: [], max: null },
          genres: { prefer: [], exclude: ['Horror'] },
          keywords: { prefer: ['magic'], exclude: [] }
        }
      }})
      await wrapper.setProps({ modelValue: true })
      await flushPromises()

      expect(wrapper.find('input[type="text"]').element.value).toBe('Source Preset')
    })
  })

  describe('form interaction', () => {
    it('updates name field via v-model', async () => {
      const wrapper = mountForm()
      const nameInput = wrapper.find('input[type="text"]')
      await nameInput.setValue('New Preset Name')
      expect(nameInput.element.value).toBe('New Preset Name')
    })

    it('updates description field via v-model', async () => {
      const wrapper = mountForm()
      const textarea = wrapper.find('textarea')
      await textarea.setValue('A test description')
      expect(textarea.element.value).toBe('A test description')
    })

    it('updates category via v-model', async () => {
      const wrapper = mountForm()
      const selects = wrapper.findAll('select')
      const categorySelect = selects.find(s => {
        const options = s.findAll('option')
        return options.some(o => o.text().includes('Genre'))
      })
      await categorySelect.setValue('genre')
      expect(categorySelect.element.value).toBe('genre')
    })

    it('shows certification mode options', () => {
      const wrapper = mountForm()
      expect(wrapper.text()).toContain('Include (allow these ratings)')
      expect(wrapper.text()).toContain('Exclude (block these ratings)')
      expect(wrapper.text()).toContain('Maximum rating allowed')
    })

    it('shows available genre checkboxes', () => {
      const wrapper = mountForm()
      expect(wrapper.text()).toContain('Action')
      expect(wrapper.text()).toContain('Comedy')
      expect(wrapper.text()).toContain('Horror')
    })
  })

  describe('form submission', () => {
    it('shows error when name is empty', async () => {
      const wrapper = mountForm()
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.text()).toContain('Please enter a preset name')
    })

    it('emits save with form data when valid', async () => {
      const wrapper = mountForm()
      await wrapper.find('input[type="text"]').setValue('Test Preset')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('save')).toBeTruthy()
      const savedData = wrapper.emitted('save')[0][0]
      expect(savedData.name).toBe('Test Preset')
      expect(savedData.category).toBe('custom')
      expect(savedData.signals).toBeDefined()
    })

    it('trims name whitespace on save', async () => {
      const wrapper = mountForm()
      await wrapper.find('input[type="text"]').setValue('  Spaced Preset  ')
      await wrapper.find('form').trigger('submit.prevent')

      const savedData = wrapper.emitted('save')[0][0]
      expect(savedData.name).toBe('Spaced Preset')
    })

    it('trims description whitespace on save', async () => {
      const wrapper = mountForm()
      await wrapper.find('input[type="text"]').setValue('Preset')
      await wrapper.find('textarea').setValue('  Trimmed  ')
      await wrapper.find('form').trigger('submit.prevent')

      const savedData = wrapper.emitted('save')[0][0]
      expect(savedData.description).toBe('Trimmed')
    })

    it('shows Create button text for new preset', () => {
      const wrapper = mountForm()
      const buttons = wrapper.findAll('button')
      const submitBtn = buttons.find(b => b.text().includes('Create Preset'))
      expect(submitBtn).toBeTruthy()
    })

    it('shows Update button text for editing', () => {
      const wrapper = mountForm({ preset: { id: 1, name: 'Edit Me', signals: {} } })
      const buttons = wrapper.findAll('button')
      const submitBtn = buttons.find(b => b.text().includes('Update Preset'))
      expect(submitBtn).toBeTruthy()
    })

    it('shows Create button text for customizing', () => {
      const wrapper = mountForm({ sourcePreset: { id: 1, name: 'Source', signals: {} } })
      const buttons = wrapper.findAll('button')
      const submitBtn = buttons.find(b => b.text().includes('Create Preset'))
      expect(submitBtn).toBeTruthy()
    })
  })

  describe('close behavior', () => {
    it('emits update:modelValue false when Cancel is clicked', async () => {
      const wrapper = mountForm()
      const buttons = wrapper.findAll('button')
      const cancelBtn = buttons.find(b => b.text().includes('Cancel'))
      await cancelBtn.trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('shows Close button in readonly mode instead of Cancel/Save', () => {
      const wrapper = mountForm({ readonly: true, preset: { id: 1, name: 'View', signals: {} } })
      const buttons = wrapper.findAll('button')
      expect(buttons.some(b => b.text().includes('Close'))).toBe(true)
      expect(buttons.some(b => b.text().includes('Cancel'))).toBe(false)
    })

    it('disables form fields in readonly mode', () => {
      const wrapper = mountForm({ readonly: true, preset: { id: 1, name: 'View', signals: {} } })
      const fieldset = wrapper.find('fieldset')
      expect(fieldset.attributes('disabled')).toBeDefined()
    })
  })

  describe('v-model support', () => {
    it('closes modal when modelValue becomes false', async () => {
      const wrapper = mountForm()
      expect(wrapper.find('[data-test="modal"]').exists()).toBe(true)

      await wrapper.setProps({ modelValue: false })
      expect(wrapper.find('[data-test="modal"]').exists()).toBe(false)
    })

    it('resets form when modal reopens', async () => {
      const wrapper = mountForm()
      await wrapper.find('input[type="text"]').setValue('Some Name')
      await wrapper.setProps({ modelValue: false })
      await wrapper.setProps({ modelValue: true })
      await flushPromises()

      expect(wrapper.find('input[type="text"]').element.value).toBe('')
    })
  })
})
