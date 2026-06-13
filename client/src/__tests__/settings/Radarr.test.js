/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import Radarr from '@/views/settings/Radarr.vue'

// Reactive state for the mocked composable
const mockArrConfigState = {
  configs: ref([]),
  mediaServers: ref([]),
  loading: ref(false),
  saving: ref(false),
  isEditing: ref(false),
  isAddingNew: ref(false),
  editingId: ref(null),
  loadingProfiles: ref(false),
  qualityProfiles: ref([]),
  editForm: ref({
    name: 'Radarr',
    protocol: 'http',
    host: 'localhost',
    port: 7878,
    base_path: '',
    api_key: '',
    verify_ssl: true,
    timeout: 30,
    media_server_id: null,
    quality_profile_id: null
  }),
  loadMediaServers: vi.fn(),
  loadConfigs: vi.fn(),
  getMediaServerName: vi.fn((id) => id ? `Media Server ${id}` : 'Not linked'),
  startEditing: vi.fn(),
  startAddingNew: vi.fn(),
  cancelEdit: vi.fn(),
  testConnection: vi.fn(),
  testConnectionFor: vi.fn(),
  saveConfig: vi.fn(),
  saveNewConfig: vi.fn(),
  deleteConfig: vi.fn()
}

vi.mock('@/composables/useArrConfig', () => ({
  useArrConfig: () => mockArrConfigState
}))

const PasswordInputStub = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template: '<input type="password" :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />'
}

const LibraryMappingPanelStub = {
  props: ['arrType', 'arrConfigId', 'mediaServerId', 'readonly'],
  template: '<div data-test="library-mapping-panel">Mappings (arr-config-id: {{ arrConfigId }}, media-server-id: {{ mediaServerId }})</div>'
}

function mountView() {
  return mount(Radarr, {
    global: {
      stubs: {
        PasswordInput: PasswordInputStub,
        LibraryMappingPanel: LibraryMappingPanelStub
      }
    }
  })
}

describe('Radarr.vue View', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mocked composable ref values to initial defaults
    mockArrConfigState.configs.value = []
    mockArrConfigState.mediaServers.value = []
    mockArrConfigState.loading.value = false
    mockArrConfigState.saving.value = false
    mockArrConfigState.isEditing.value = false
    mockArrConfigState.isAddingNew.value = false
    mockArrConfigState.editingId.value = null
    mockArrConfigState.loadingProfiles.value = false
    mockArrConfigState.qualityProfiles.value = []
    mockArrConfigState.editForm.value = {
      name: 'Radarr',
      protocol: 'http',
      host: 'localhost',
      port: 7878,
      base_path: '',
      api_key: '',
      verify_ssl: true,
      timeout: 30,
      media_server_id: null,
      quality_profile_id: null
    }
  })

  it('renders instructions and empty config form when no configurations exist', () => {
    const wrapper = mountView()
    
    expect(wrapper.text()).toContain('Configure Radarr')
    expect(wrapper.text()).toContain('Setup Instructions')
    expect(wrapper.text()).toContain('to verify and automatically save the instance settings')
    
    // Verify inputs render
    const nameInput = wrapper.find('input[placeholder="Radarr 4K"]')
    expect(nameInput.exists()).toBe(true)
  })

  it('renders list of instances and action buttons when configurations exist', () => {
    mockArrConfigState.configs.value = [
      { id: 1, name: 'Radarr Main', host: '192.168.1.100', port: 7878, media_server_id: 10 }
    ]
    mockArrConfigState.mediaServers.value = [
      { id: 10, name: 'Plex Main' }
    ]

    const wrapper = mountView()

    expect(wrapper.text()).toContain('Radarr Main')
    expect(wrapper.text()).toContain('192.168.1.100')
    expect(wrapper.text()).toContain('7878')
    
    const buttons = wrapper.findAll('button')
    expect(buttons.some(b => b.text().includes('Change Settings'))).toBe(true)
    expect(buttons.some(b => b.text().includes('Delete'))).toBe(true)
    expect(buttons.some(b => b.text().includes('Test Connection'))).toBe(true)
  })

  it('renders editing form and mapping panel when editing is active', async () => {
    mockArrConfigState.configs.value = [
      { id: 1, name: 'Radarr Main', host: '192.168.1.100', port: 7878, media_server_id: 10 }
    ]
    mockArrConfigState.isEditing.value = true
    mockArrConfigState.editingId.value = 1
    mockArrConfigState.editForm.value = {
      id: 1,
      name: 'Radarr Main',
      protocol: 'http',
      host: '192.168.1.100',
      port: 7878,
      media_server_id: 10
    }

    const wrapper = mountView()

    expect(wrapper.text()).toContain('Editing: Radarr Main')
    expect(wrapper.text()).toContain('Setup Instructions')
    expect(wrapper.find('[data-test="library-mapping-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="library-mapping-panel"]').text()).toContain('arr-config-id: 1')
    expect(wrapper.find('[data-test="library-mapping-panel"]').text()).toContain('media-server-id: 10')
  })

  it('clicking Test Connection triggers composable action', async () => {
    const wrapper = mountView()
    
    const testBtn = wrapper.findAll('button').find(b => b.text().includes('Test Connection'))
    expect(testBtn).toBeDefined()
    
    await testBtn.trigger('click')
    expect(mockArrConfigState.testConnection).toHaveBeenCalled()
  })

  it('clicking Delete triggers deleteConfig composable action', async () => {
    mockArrConfigState.configs.value = [
      { id: 1, name: 'Radarr Main', host: '192.168.1.100', port: 7878 }
    ]
    const wrapper = mountView()
    
    const deleteBtn = wrapper.findAll('button').find(b => b.text().includes('Delete'))
    expect(deleteBtn).toBeDefined()
    await deleteBtn.trigger('click')
    
    expect(mockArrConfigState.deleteConfig).toHaveBeenCalledWith(1)
  })
})
