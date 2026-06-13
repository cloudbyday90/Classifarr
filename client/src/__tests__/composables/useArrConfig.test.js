/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetRadarrConfig = vi.fn()
const mockAddRadarrConfig = vi.fn()
const mockUpdateRadarrConfig = vi.fn()
const mockDeleteRadarrConfig = vi.fn()
const mockTestRadarrConnection = vi.fn()
const mockGetRadarrQualityProfiles = vi.fn()
const mockGetMediaServers = vi.fn()

vi.mock('@/api', () => ({
  default: {
    getRadarrConfig: (...args) => mockGetRadarrConfig(...args),
    addRadarrConfig: (...args) => mockAddRadarrConfig(...args),
    updateRadarrConfig: (...args) => mockUpdateRadarrConfig(...args),
    deleteRadarrConfig: (...args) => mockDeleteRadarrConfig(...args),
    testRadarrConnection: (...args) => mockTestRadarrConnection(...args),
    getRadarrQualityProfiles: (...args) => mockGetRadarrQualityProfiles(...args),
    getMediaServers: (...args) => mockGetMediaServers(...args),
  }
}))

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
}

vi.mock('@/stores/toast', () => ({
  useToast: () => mockToast
}))

import { useArrConfig } from '@/composables/useArrConfig'

describe('useArrConfig composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.confirm = vi.fn(() => true)
  })

  it('initializes state with correct defaults', () => {
    const { configs, isEditing, isAddingNew, editForm } = useArrConfig('radarr')

    expect(configs.value).toEqual([])
    expect(isEditing.value).toBe(false)
    expect(isAddingNew.value).toBe(false)
    expect(editForm.value.name).toBe('Radarr')
    expect(editForm.value.port).toBe(7878)
  })

  it('startAddingNew resets form to defaults', () => {
    const { startAddingNew, editForm, isAddingNew } = useArrConfig('radarr')

    editForm.value.name = 'Custom Name'
    startAddingNew()

    expect(editForm.value.name).toBe('Radarr')
    expect(isAddingNew.value).toBe(true)
  })

  it('testConnection on failure does not trigger auto-save', async () => {
    mockTestRadarrConnection.mockResolvedValueOnce({
      data: {
        success: false,
        error: { message: 'Failed connection' }
      }
    })

    const { testConnection, isAddingNew } = useArrConfig('radarr')
    isAddingNew.value = true

    await testConnection(true)

    expect(mockTestRadarrConnection).toHaveBeenCalled()
    expect(mockToast.error).toHaveBeenCalledWith('Failed connection')
    expect(mockAddRadarrConfig).not.toHaveBeenCalled()
  })

  it('testConnection on success for new config triggers auto-save', async () => {
    mockTestRadarrConnection.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          qualityProfiles: [{ id: 1, name: 'Standard' }]
        }
      }
    })
    mockAddRadarrConfig.mockResolvedValueOnce({
      data: { id: 42, name: 'Radarr Instance' }
    })
    mockGetRadarrConfig.mockResolvedValueOnce([
      { id: 42, name: 'Radarr Instance', host: 'localhost', port: 7878 }
    ])
    mockGetRadarrQualityProfiles.mockResolvedValueOnce([
      { id: 1, name: 'Standard' }
    ])

    const { testConnection, isAddingNew, isEditing, editingId } = useArrConfig('radarr')
    isAddingNew.value = true

    await testConnection(true)

    expect(mockTestRadarrConnection).toHaveBeenCalled()
    expect(mockAddRadarrConfig).toHaveBeenCalled()
    expect(mockToast.success).toHaveBeenCalledWith('Connection successful! Instance saved.')
    expect(isAddingNew.value).toBe(false)
    expect(isEditing.value).toBe(true)
    expect(editingId.value).toBe(42)
  })

  it('testConnection on success for existing config triggers update auto-save', async () => {
    mockTestRadarrConnection.mockResolvedValueOnce({
      data: {
        success: true,
        data: { qualityProfiles: [] }
      }
    })
    mockUpdateRadarrConfig.mockResolvedValueOnce({
      data: { id: 12, name: 'Updated Config' }
    })
    mockGetRadarrConfig.mockResolvedValueOnce([
      { id: 12, name: 'Updated Config', host: 'localhost', port: 7878 }
    ])

    const { testConnection, isEditing, editingId } = useArrConfig('radarr')
    isEditing.value = true
    editingId.value = 12

    await testConnection(true)

    expect(mockTestRadarrConnection).toHaveBeenCalled()
    expect(mockUpdateRadarrConfig).toHaveBeenCalledWith(12, expect.any(Object))
    expect(mockToast.success).toHaveBeenCalledWith('Connection successful! Settings auto-saved.')
    expect(isEditing.value).toBe(true)
  })

  it('deleteConfig calls api and reloads configuration', async () => {
    mockDeleteRadarrConfig.mockResolvedValueOnce({ success: true })
    mockGetRadarrConfig.mockResolvedValueOnce([])

    const { deleteConfig } = useArrConfig('radarr')
    await deleteConfig(15)

    expect(window.confirm).toHaveBeenCalled()
    expect(mockDeleteRadarrConfig).toHaveBeenCalledWith(15)
    expect(mockToast.success).toHaveBeenCalledWith('Instance deleted')
  })
})
