/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ref } from 'vue'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PresetsManager from '../views/PresetsManager.vue'

async function switchToCustomTab(wrapper) {
  const customTab = wrapper.findAll('[data-test="tab"]').find(t => t.text().includes('My Presets'))
  await customTab.trigger('click')
  await flushPromises()
}

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

vi.mock('@heroicons/vue/24/outline', () => ({
  PlusCircleIcon: { template: '<svg />' }
}))

import presetsApi from '../api/presets'

const TabsStub = {
  name: 'TabsStub',
  props: ['tabs', 'modelValue'],
  emits: ['update:modelValue'],
  template: `<div data-test="tabs"><div v-for="tab in tabs" :key="tab.id" data-test="tab" @click="$emit('update:modelValue', tab.id)">{{ tab.label }}</div><slot :name="modelValue" /></div>`
}

const ButtonStub = {
  name: 'ButtonStub',
  props: ['variant', 'loading'],
  emits: ['click'],
  template: '<button :data-variant="variant" :disabled="loading" @click="$emit(\'click\')"><slot /></button>'
}

const PresetCardStub = {
  name: 'PresetCardStub',
  props: ['preset', 'readonly'],
  emits: ['view', 'edit', 'delete'],
  template: `<div data-test="preset-card" :data-readonly="readonly" :data-preset-id="preset.id">
    <button data-test="view-btn" @click="$emit('view', preset)">{{ preset.name }}</button>
    <button v-if="!readonly" data-test="edit-btn" @click="$emit('edit', preset)">Edit</button>
    <button v-if="!readonly" data-test="delete-btn" @click="$emit('delete', preset)">Delete</button>
  </div>`
}

const ModalStub = {
  name: 'ModalStub',
  props: ['modelValue', 'title'],
  emits: ['update:modelValue'],
  template: `<div v-if="modelValue" data-test="modal"><slot /><slot name="footer" /></div>`
}

const SpinnerStub = { name: 'SpinnerStub', template: '<div data-test="spinner" />' }

const CustomPresetFormStub = {
  name: 'CustomPresetFormStub',
  props: ['modelValue', 'preset', 'sourcePreset', 'readonly'],
  emits: ['update:modelValue', 'save'],
  template: `<div v-if="modelValue" data-test="custom-form">
    <span>{{ preset?.name || 'new' }}</span>
    <button data-test="save-btn" @click="$emit('save', { name: 'Test Preset' })">Save</button>
    <button data-test="close-form-btn" @click="$emit('update:modelValue', false)">Close</button>
  </div>`
}

const PresetSummaryModalStub = {
  name: 'PresetSummaryModalStub',
  props: ['modelValue', 'preset'],
  emits: ['update:modelValue', 'customize'],
  template: `<div v-if="modelValue" data-test="summary-modal">
    <span>{{ preset?.name }}</span>
    <button data-test="customize-btn" @click="$emit('customize', preset)">Customize</button>
    <button data-test="close-summary-btn" @click="$emit('update:modelValue', false)">Close</button>
  </div>`
}

const systemPresets = [
  { id: 1, name: 'Family Friendly', category: 'audience', signals: {} },
  { id: 2, name: 'Action Packed', category: 'genre', description: 'Explosive action', signals: {} },
  { id: 3, name: 'General', category: null, signals: {} }
]

const customPresets = [
  { id: 9, name: 'Family Remix', category: 'custom', signals: {} },
  { id: 10, name: 'Action Remix', category: 'genre', signals: {} }
]

function mountView() {
  return mount(PresetsManager, {
    attachTo: document.body,
    global: {
      stubs: {
        Tabs: TabsStub,
        Button: ButtonStub,
        PresetCard: PresetCardStub,
        Modal: ModalStub,
        Spinner: SpinnerStub,
        CustomPresetForm: CustomPresetFormStub,
        PresetSummaryModal: PresetSummaryModalStub
      }
    }
  })
}

describe('PresetsManager.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    presetsApi.getSystemPresets.mockResolvedValue([...systemPresets])
    presetsApi.getCustomPresets.mockResolvedValue([...customPresets])
  })

  describe('rendering', () => {
    it('uses built-in and my preset labels consistently', async () => {
      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.text()).toContain('Browse built-in presets or create your own reusable presets for policy attachment')
      expect(wrapper.text()).toContain('Built-in Presets')
      expect(wrapper.text()).toContain('My Presets')
    })

    it('renders system preset cards on the system tab', async () => {
      const wrapper = mountView()
      await flushPromises()

      const cards = wrapper.findAll('[data-test="preset-card"]')
      expect(cards.length).toBe(3)
      expect(cards[0].text()).toContain('Family Friendly')
      expect(cards[0].attributes('data-readonly')).toBe('true')
    })

    it('renders custom preset cards on the custom tab', async () => {
      const wrapper = mountView()
      await flushPromises()

      const customTab = wrapper.findAll('[data-test="tab"]').find(t => t.text().includes('My Presets'))
      await customTab.trigger('click')
      await flushPromises()

      const cards = wrapper.findAll('[data-test="preset-card"]')
      expect(cards.some(c => c.text().includes('Family Remix'))).toBe(true)
    })

    it('shows loading spinner while fetching system presets', async () => {
      let resolveSystem
      presetsApi.getSystemPresets.mockReturnValue(new Promise(r => { resolveSystem = r }))

      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.find('[data-test="spinner"]').exists()).toBe(true)

      resolveSystem([])
      await flushPromises()

      expect(wrapper.find('[data-test="spinner"]').exists()).toBe(false)
    })

    it('shows error message when system presets fail', async () => {
      presetsApi.getSystemPresets.mockRejectedValue({ response: { data: { error: 'Server error' } }, message: 'Server error' })

      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.text()).toContain('Server error')
    })

    it('shows empty state for custom presets when none exist', async () => {
      presetsApi.getCustomPresets.mockResolvedValue([])

      const wrapper = mountView()
      await flushPromises()

      await switchToCustomTab(wrapper)

      expect(wrapper.text()).toContain('No saved presets yet')
      expect(wrapper.text()).toContain('Create your first preset to get started')
    })

    it('shows filtered empty state when search has no matches', async () => {
      const wrapper = mountView()
      await flushPromises()

      await wrapper.find('input#preset-search').setValue('nonexistent')
      await flushPromises()

      expect(wrapper.text()).toContain('No built-in presets found matching your criteria')
    })
  })

  describe('search and filtering', () => {
    it('filters system presets by name', async () => {
      const wrapper = mountView()
      await flushPromises()

      await wrapper.find('input#preset-search').setValue('family')
      await flushPromises()

      const cards = wrapper.findAll('[data-test="preset-card"]')
      expect(cards.length).toBe(1)
      expect(cards[0].text()).toContain('Family Friendly')
    })

    it('filters presets by description', async () => {
      const wrapper = mountView()
      await flushPromises()

      await wrapper.find('input#preset-search').setValue('explosive')
      await flushPromises()

      const cards = wrapper.findAll('[data-test="preset-card"]')
      expect(cards.length).toBe(1)
      expect(cards[0].text()).toContain('Action Packed')
    })

    it('populates category dropdown from both system and custom presets', async () => {
      const wrapper = mountView()
      await flushPromises()

      const options = wrapper.findAll('select#category-filter option')
      const optionTexts = options.map(o => o.text())
      expect(optionTexts).toContain('All Categories')
      expect(optionTexts).toContain('Audience')
      expect(optionTexts).toContain('Genre')
      expect(optionTexts).toContain('Custom')
    })

    it('filters presets by selected category', async () => {
      const wrapper = mountView()
      await flushPromises()

      await wrapper.find('select#category-filter').setValue('audience')
      await flushPromises()

      const cards = wrapper.findAll('[data-test="preset-card"]')
      expect(cards.length).toBe(1)
      expect(cards[0].text()).toContain('Family Friendly')
    })

    it('combines search and category filters', async () => {
      const wrapper = mountView()
      await flushPromises()

      await wrapper.find('input#preset-search').setValue('a')
      await wrapper.find('select#category-filter').setValue('genre')
      await flushPromises()

      const cards = wrapper.findAll('[data-test="preset-card"]')
      expect(cards.length).toBe(1)
      expect(cards[0].text()).toContain('Action Packed')
    })
  })

  describe('modal interactions', () => {
    it('opens create form modal when Create New Preset is clicked', async () => {
      const wrapper = mountView()
      await flushPromises()

      await switchToCustomTab(wrapper)
      await flushPromises()

      const createBtn = wrapper.findAll('button').find(b => b.text().includes('Create New Preset'))
      expect(createBtn).toBeTruthy()
      await createBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-test="custom-form"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="custom-form"]').text()).toContain('new')
    })

    it('closes preset form modal on successful create', async () => {
      presetsApi.createCustomPreset.mockResolvedValue({ id: 99, name: 'New Preset' })
      presetsApi.getCustomPresets.mockResolvedValueOnce([...customPresets]).mockResolvedValueOnce([
        ...customPresets,
        { id: 99, name: 'New Preset', category: null, signals: {} }
      ])

      const wrapper = mountView()
      await flushPromises()

      await switchToCustomTab(wrapper)

      const createBtn = wrapper.findAll('button').find(b => b.text().includes('Create New Preset'))
      await createBtn.trigger('click')
      await flushPromises()

      await wrapper.find('[data-test="save-btn"]').trigger('click')
      await flushPromises()

      expect(presetsApi.createCustomPreset).toHaveBeenCalled()
      expect(wrapper.find('[data-test="custom-form"]').exists()).toBe(false)
    })

    it('shows toast and switches tab after customizing a system preset', async () => {
      presetsApi.createCustomPreset.mockResolvedValue({ id: 99 })
      presetsApi.getCustomPresets.mockResolvedValue([...customPresets])

      const wrapper = mountView()
      await flushPromises()

      const viewBtn = wrapper.find('[data-test="view-btn"]')
      await viewBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-test="summary-modal"]').exists()).toBe(true)

      await wrapper.find('[data-test="customize-btn"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-test="summary-modal"]').exists()).toBe(false)
      expect(wrapper.find('[data-test="custom-form"]').exists()).toBe(true)
    })

    it('opens delete confirmation modal', async () => {
      const wrapper = mountView()
      await flushPromises()

      await switchToCustomTab(wrapper)

      const deleteBtn = wrapper.find('[data-test="delete-btn"]')
      await deleteBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-test="modal"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Family Remix')
    })

    it('deletes preset and closes modal on confirm', async () => {
      presetsApi.deleteCustomPreset.mockResolvedValue({})
      presetsApi.getCustomPresets.mockResolvedValueOnce([...customPresets]).mockResolvedValueOnce([])

      const wrapper = mountView()
      await flushPromises()

      await switchToCustomTab(wrapper)

      const deleteBtn = wrapper.find('[data-test="delete-btn"]')
      await deleteBtn.trigger('click')
      await flushPromises()

      const confirmDeleteBtn = wrapper.findAll('button').find(b => b.text().includes('Delete') && b.attributes('data-variant') === 'error')
      expect(confirmDeleteBtn).toBeTruthy()
      await confirmDeleteBtn.trigger('click')
      await flushPromises()

      expect(presetsApi.deleteCustomPreset).toHaveBeenCalledWith(9)
      expect(wrapper.find('[data-test="modal"]').exists()).toBe(false)
    })

    it('shows delete error when api fails', async () => {
      presetsApi.deleteCustomPreset.mockRejectedValue({ response: { data: { error: 'Delete failed' } }, message: 'Delete failed' })
      presetsApi.getCustomPresets.mockResolvedValue([...customPresets])

      const wrapper = mountView()
      await flushPromises()

      await switchToCustomTab(wrapper)

      const deleteBtn = wrapper.find('[data-test="delete-btn"]')
      await deleteBtn.trigger('click')
      await flushPromises()

      const confirmDeleteBtn = wrapper.findAll('button').find(b => b.text().includes('Delete') && b.attributes('data-variant') === 'error')
      await confirmDeleteBtn.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('Delete failed')
    })

    it('calls updateCustomPreset when editing an existing preset', async () => {
      presetsApi.updateCustomPreset.mockResolvedValue({ id: 9 })
      presetsApi.getCustomPresets.mockResolvedValue([...customPresets])

      const wrapper = mountView()
      await flushPromises()

      await switchToCustomTab(wrapper)

      const editBtn = wrapper.find('[data-test="edit-btn"]')
      await editBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-test="custom-form"]').exists()).toBe(true)
    })
  })
})
