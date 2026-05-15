import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
}))

import {
  getAttachablePresets,
  getSystemPresets,
  getPresetUsageCount,
} from '../../api/presetCatalogApi'

describe('presetCatalogApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getAttachablePresets calls getDataRequest with correct URL and params', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 1 }])
    const result = await getAttachablePresets({ search: 'sci-fi' })
    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies/presets/all', {
      params: { search: 'sci-fi' },
    })
    expect(result).toEqual([{ id: 1 }])
  })

  it('getAttachablePresets defaults params to empty object', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getAttachablePresets()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies/presets/all', { params: {} })
  })

  it('getSystemPresets passes params with include_custom: false', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getSystemPresets({ category: 'genres' })
    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies/presets/all', {
      params: { category: 'genres', include_custom: false },
    })
  })

  it('getSystemPresets defaults to include_custom: false with no caller params', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getSystemPresets()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies/presets/all', {
      params: { include_custom: false },
    })
  })

  it('getPresetUsageCount calls getDataRequest with id in URL', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ count: 5 })
    const result = await getPresetUsageCount(42)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/policies/presets/42/usage')
    expect(result).toEqual({ count: 5 })
  })
})
