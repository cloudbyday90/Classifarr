/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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
