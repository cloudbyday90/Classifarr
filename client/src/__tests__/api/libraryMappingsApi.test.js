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
const mockPost = vi.fn()
const mockDelete = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    delete: (...args) => mockDelete(...args),
  },
}))

import {
  getMappings,
  getUnmappedLibraries,
  getArrInstances,
  autoDetectMappings,
  getRootFolders,
  saveMapping,
  deleteMapping,
} from '../../api/libraryMappingsApi'

describe('libraryMappingsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getMappings calls getDataRequest with media server id', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ library_id: 1 }])
    await getMappings('ms1')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/mappings/ms1')
  })

  it('getUnmappedLibraries calls getDataRequest with media server id', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 2, name: 'Unmapped' }])
    await getUnmappedLibraries('ms1')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/mappings/ms1/unmapped')
  })

  it('getArrInstances calls getDataRequest with media server id', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ radarr: [], sonarr: [] })
    await getArrInstances('ms1')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/mappings/ms1/arr-instances')
  })

  it('autoDetectMappings calls POST with media server id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { applied: [], suggestions: [] } })
    await autoDetectMappings('ms1')
    expect(mockPost).toHaveBeenCalledWith('/mappings/ms1/auto-detect')
  })

  it('getRootFolders calls getDataRequest with arr type and config id', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 1, path: '/media' }])
    await getRootFolders('radarr', 5)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/mappings/root-folders/radarr/5')
  })

  it('saveMapping calls POST with mapping data', async () => {
    const data = { library_id: 1, arr_type: 'radarr', arr_config_id: 5 }
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await saveMapping(data)
    expect(mockPost).toHaveBeenCalledWith('/mappings', data)
  })

  it('deleteMapping calls DELETE with library id', async () => {
    mockDelete.mockResolvedValueOnce({ data: {} })
    await deleteMapping(3)
    expect(mockDelete).toHaveBeenCalledWith('/mappings/library/3')
  })
})
