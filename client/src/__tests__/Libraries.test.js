/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Libraries from '@/views/Libraries.vue'

const {
  state,
  makeRef,
  apiMock,
  mockToast,
  mockPush,
  mockFetchLibraries,
  mockStartPolling,
  mockStopPolling,
  mockShowLockdownNotification,
} = vi.hoisted(() => {
  const state = {
    libraries: [
      { id: 1, name: 'Movies', media_type: 'movie', arr_type: 'radarr', priority: 1, is_active: true },
      { id: 2, name: 'TV Shows', media_type: 'tv', arr_type: 'sonarr', priority: 2, is_active: false },
    ],
    loading: false,
    canSyncLibraries: true,
    lockdownTooltip: 'Media server not configured',
    firstUnavailableService: null,
    isRunning: false,
    canStartSync: true,
    syncType: null,
    progress: 0,
    currentLibrary: '',
    statusText: '',
  }

  function makeRef(key) {
    return {
      __v_isRef: true,
      get value() { return state[key] },
      set value(v) { state[key] = v },
    }
  }

  return {
    state,
    makeRef,
    apiMock: { syncMediaServer: vi.fn() },
    mockToast: { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() },
    mockPush: vi.fn(),
    mockFetchLibraries: vi.fn().mockResolvedValue(),
    mockStartPolling: vi.fn(),
    mockStopPolling: vi.fn(),
    mockShowLockdownNotification: vi.fn(),
  }
})

vi.mock('@/api', () => ({ default: apiMock }))

vi.mock('@/stores/toast', () => ({
  useToast: () => mockToast,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({}),
}))

vi.mock('pinia', () => ({
  storeToRefs: () => ({
    libraries: makeRef('libraries'),
    loading: makeRef('loading'),
  }),
}))

vi.mock('@/stores/libraries', () => ({
  useLibrariesStore: () => ({
    fetchLibraries: mockFetchLibraries,
  }),
}))

vi.mock('@/stores/syncStatus', () => ({
  useSyncStatusStore: () => ({
    get isRunning() { return state.isRunning },
    get canStartSync() { return state.canStartSync },
    get type() { return state.syncType },
    get progress() { return state.progress },
    get currentLibrary() { return state.currentLibrary },
    get statusText() { return state.statusText },
    startPolling: mockStartPolling,
    stopPolling: mockStopPolling,
  }),
  SYNC_TYPE: { LIBRARY_SYNC: 'library_sync' },
}))

vi.mock('@/composables/useServiceRequirements', () => ({
  useServiceRequirements: () => ({
    canUseFeature: makeRef('canSyncLibraries'),
    lockdownTooltip: makeRef('lockdownTooltip'),
    firstUnavailableService: makeRef('firstUnavailableService'),
  }),
}))

vi.mock('@/composables/useServiceLockdownToast', () => ({
  useServiceLockdownDialog: () => ({
    showLockdownNotification: mockShowLockdownNotification,
  }),
}))

vi.mock('@/components/common/Card.vue', () => ({
  default: {
    name: 'Card',
    template: '<div data-testid="library-card"><slot /></div>',
  },
}))

vi.mock('@/components/common/Button.vue', () => ({
  default: {
    name: 'Button',
    props: ['disabled', 'loading', 'title'],
    emits: ['click'],
    template: '<button :disabled="disabled" :title="title" @click="$emit(\'click\')"><slot /></button>',
  },
}))

vi.mock('@/components/common/Badge.vue', () => ({
  default: {
    name: 'Badge',
    props: ['variant'],
    template: '<span><slot /></span>',
  },
}))

vi.mock('@/components/MappingWarningBanner.vue', () => ({
  default: {
    name: 'MappingWarningBanner',
    template: '<div data-testid="mapping-warning-banner"></div>',
  },
}))

const defaultLibraries = [
  { id: 1, name: 'Movies', media_type: 'movie', arr_type: 'radarr', priority: 1, is_active: true },
  { id: 2, name: 'TV Shows', media_type: 'tv', arr_type: 'sonarr', priority: 2, is_active: false },
]

function resetState() {
  state.libraries = [
    { id: 1, name: 'Movies', media_type: 'movie', arr_type: 'radarr', priority: 1, is_active: true },
    { id: 2, name: 'TV Shows', media_type: 'tv', arr_type: 'sonarr', priority: 2, is_active: false },
  ]
  state.loading = false
  state.canSyncLibraries = true
  state.lockdownTooltip = 'Media server not configured'
  state.firstUnavailableService = null
  state.isRunning = false
  state.canStartSync = true
  state.syncType = null
  state.progress = 0
  state.currentLibrary = ''
  state.statusText = ''
}

function createWrapper() {
  return mount(Libraries, {
    global: {
      mocks: {
        $router: { push: mockPush },
      },
    },
  })
}

describe('Libraries.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
    apiMock.syncMediaServer.mockResolvedValue({})
  })

  describe('Rendering', () => {
    it('renders the page heading', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('h1').text()).toBe('Libraries')
    })

    it('renders MappingWarningBanner', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[data-testid="mapping-warning-banner"]').exists()).toBe(true)
    })

    it('shows loading state when loading is true', async () => {
      state.loading = true
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.text()).toContain('Loading libraries...')
    })

    it('does not show library cards while loading', async () => {
      state.loading = true
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.findAll('[data-testid="library-card"]')).toHaveLength(0)
    })

    it('shows empty state when no libraries found', async () => {
      state.libraries = []
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.text()).toContain('No libraries found')
      expect(wrapper.text()).toContain('Configure Media Server')
    })

    it('renders library cards with correct data', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.text()).toContain('Movies')
      expect(wrapper.text()).toContain('movie')
      expect(wrapper.text()).toContain('radarr')
      expect(wrapper.text()).toContain('TV Shows')
      expect(wrapper.text()).toContain('tv')
      expect(wrapper.text()).toContain('sonarr')
    })

    it('shows priority values on library cards', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.text()).toContain('Priority:')
    })

    it('shows Active and Inactive badges', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.text()).toContain('Active')
      expect(wrapper.text()).toContain('Inactive')
    })

    it('hides arr_type row when not present', async () => {
      state.libraries = [
        { id: 3, name: 'Music', media_type: 'music', arr_type: null, priority: 3, is_active: true },
      ]
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.text()).not.toContain('ARR:')
    })

    it('shows arr_type row when present', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.text()).toContain('ARR:')
    })

    it('renders correct number of library cards', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.findAll('[data-testid="library-card"]')).toHaveLength(2)
    })
  })

  describe('Sync button states', () => {
    it('is enabled when canStartSync and canSyncLibraries are both true', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeUndefined()
    })

    it('is disabled when canStartSync is false', async () => {
      state.canStartSync = false
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
    })

    it('is disabled when canSyncLibraries is false', async () => {
      state.canSyncLibraries = false
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      expect(button.attributes('disabled')).toBeDefined()
    })

    it('shows lock icon and tooltip when media server unavailable', async () => {
      state.canSyncLibraries = false
      state.lockdownTooltip = 'Plex is not connected'
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      expect(button.text()).toContain('🔒')
      expect(button.attributes('title')).toBe('Plex is not connected')
    })

    it('does not show lock icon when media server is available', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      expect(button.text()).not.toContain('🔒')
      expect(button.attributes('title')).toBeUndefined()
    })

    it('shows Syncing... X% during library sync', async () => {
      state.isRunning = true
      state.syncType = 'library_sync'
      state.progress = 42
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      expect(button.text()).toContain('Syncing... 42%')
    })

    it('shows statusText during other sync types', async () => {
      state.isRunning = true
      state.syncType = 'other_type'
      state.statusText = 'Classifying media...'
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      expect(button.text()).toContain('Classifying media...')
    })

    it('shows Sync Libraries when idle and available', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      expect(button.text()).toContain('Sync Libraries')
    })
  })

  describe('Sync click behavior', () => {
    it('shows lockdown notification when media server unavailable', async () => {
      state.canSyncLibraries = false
      state.firstUnavailableService = 'mediaServer'
      const wrapper = createWrapper()
      await flushPromises()
      wrapper.findComponent({ name: 'Button' }).vm.$emit('click')
      await flushPromises()
      expect(mockShowLockdownNotification).toHaveBeenCalledWith('mediaServer')
      expect(apiMock.syncMediaServer).not.toHaveBeenCalled()
    })

    it('calls syncMediaServer when media server is available', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      await button.trigger('click')
      await flushPromises()
      expect(apiMock.syncMediaServer).toHaveBeenCalled()
    })
  })

  describe('syncLibraries success', () => {
    it('calls api.syncMediaServer then fetchLibraries with no error toast', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      await button.trigger('click')
      await flushPromises()
      expect(apiMock.syncMediaServer).toHaveBeenCalled()
      expect(mockFetchLibraries).toHaveBeenCalledTimes(2)
      expect(mockToast.error).not.toHaveBeenCalled()
      expect(mockToast.warning).not.toHaveBeenCalled()
    })
  })

  describe('syncLibraries 409 conflict', () => {
    it('shows toast.warning with message from response', async () => {
      apiMock.syncMediaServer.mockRejectedValue({
        response: { status: 409, data: { message: 'Sync already in progress' } },
      })
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      await button.trigger('click')
      await flushPromises()
      expect(mockToast.warning).toHaveBeenCalledWith(
        'Sync already in progress',
        'Sync In Progress',
      )
      expect(mockFetchLibraries).toHaveBeenCalledTimes(1)
    })

    it('shows default message when response has no message', async () => {
      apiMock.syncMediaServer.mockRejectedValue({
        response: { status: 409, data: {} },
      })
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      await button.trigger('click')
      await flushPromises()
      expect(mockToast.warning).toHaveBeenCalledWith(
        'Sync already in progress',
        'Sync In Progress',
      )
    })
  })

  describe('syncLibraries generic error', () => {
    it('shows toast.error with error message', async () => {
      apiMock.syncMediaServer.mockRejectedValue(new Error('Network failure'))
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      await button.trigger('click')
      await flushPromises()
      expect(mockToast.error).toHaveBeenCalledWith('Network failure', 'Sync Failed')
      expect(mockFetchLibraries).toHaveBeenCalledTimes(1)
    })

    it('shows default message when error has no message', async () => {
      apiMock.syncMediaServer.mockRejectedValue({})
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('button')
      await button.trigger('click')
      await flushPromises()
      expect(mockToast.error).toHaveBeenCalledWith(
        'An error occurred while syncing libraries',
        'Sync Failed',
      )
    })
  })

  describe('Progress bar', () => {
    it('is visible during sync with progress percentage and currentLibrary', async () => {
      state.isRunning = true
      state.syncType = 'library_sync'
      state.progress = 75
      state.currentLibrary = 'Movies Library'
      const wrapper = createWrapper()
      await flushPromises()
      const progressBar = wrapper.find('.bg-gray-800')
      expect(progressBar.exists()).toBe(true)
      expect(progressBar.text()).toContain('Movies Library')
      const progressFill = wrapper.find('.bg-primary')
      expect(progressFill.exists()).toBe(true)
      expect(progressFill.attributes('style')).toContain('75%')
    })

    it('shows Processing... when currentLibrary is empty', async () => {
      state.isRunning = true
      state.syncType = 'library_sync'
      state.progress = 0
      state.currentLibrary = ''
      const wrapper = createWrapper()
      await flushPromises()
      const progressBar = wrapper.find('.bg-gray-800')
      expect(progressBar.text()).toContain('Processing...')
    })

    it('is hidden when not syncing', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.bg-gray-800').exists()).toBe(false)
    })
  })

  describe('Library card click', () => {
    it('navigates to /libraries/{id} on first card click', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      const cards = wrapper.findAll('[data-testid="library-card"]')
      await cards[0].trigger('click')
      expect(mockPush).toHaveBeenCalledWith('/libraries/1')
    })

    it('navigates to correct library id on second card click', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      const cards = wrapper.findAll('[data-testid="library-card"]')
      await cards[1].trigger('click')
      expect(mockPush).toHaveBeenCalledWith('/libraries/2')
    })
  })

  describe('Configure button', () => {
    it('navigates to /settings?tab=mediaserver when clicked', async () => {
      state.libraries = []
      const wrapper = createWrapper()
      await flushPromises()
      const buttons = wrapper.findAll('button')
      const configureButton = buttons.find(b => b.text().includes('Configure Media Server'))
      expect(configureButton).toBeDefined()
      await configureButton.trigger('click')
      expect(mockPush).toHaveBeenCalledWith('/settings?tab=mediaserver')
    })
  })

  describe('Lifecycle', () => {
    it('calls fetchLibraries and startPolling on mount', async () => {
      createWrapper()
      await flushPromises()
      expect(mockFetchLibraries).toHaveBeenCalledTimes(1)
      expect(mockStartPolling).toHaveBeenCalledTimes(1)
    })

    it('calls stopPolling on unmount', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      wrapper.unmount()
      expect(mockStopPolling).toHaveBeenCalledTimes(1)
    })
  })
})
