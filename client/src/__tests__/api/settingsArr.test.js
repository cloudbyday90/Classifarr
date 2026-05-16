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
const mockPut = vi.fn()
const mockDelete = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  },
}))

import {
  getRadarrConfig,
  addRadarrConfig,
  updateRadarrConfig,
  deleteRadarrConfig,
  testRadarrConnection,
  getRadarrQualityProfiles,
  getSonarrConfig,
  addSonarrConfig,
  updateSonarrConfig,
  deleteSonarrConfig,
  testSonarrConnection,
  getSonarrQualityProfiles,
} from '../../api/settingsArr'

describe('settingsArr - radarr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getRadarrConfig calls getDataRequest with /settings/radarr', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 1 }])
    const result = await getRadarrConfig()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/radarr')
    expect(result).toEqual([{ id: 1 }])
  })

  it('addRadarrConfig calls apiClient.post with URL and data', async () => {
    const data = { name: 'Radarr1', url: 'http://localhost' }
    mockPost.mockResolvedValueOnce({ data: { id: 10 } })
    const result = await addRadarrConfig(data)
    expect(mockPost).toHaveBeenCalledWith('/settings/radarr', data)
    expect(result).toEqual({ data: { id: 10 } })
  })

  it('updateRadarrConfig calls apiClient.put with id in URL and data', async () => {
    const data = { name: 'Updated' }
    mockPut.mockResolvedValueOnce({ data: { ok: true } })
    const result = await updateRadarrConfig(3, data)
    expect(mockPut).toHaveBeenCalledWith('/settings/radarr/3', data)
    expect(result).toEqual({ data: { ok: true } })
  })

  it('deleteRadarrConfig calls apiClient.delete with id in URL', async () => {
    mockDelete.mockResolvedValueOnce({ status: 204 })
    const result = await deleteRadarrConfig(7)
    expect(mockDelete).toHaveBeenCalledWith('/settings/radarr/7')
    expect(result).toEqual({ status: 204 })
  })

  it('testRadarrConnection calls apiClient.post with test URL and config', async () => {
    const config = { url: 'http://radarr:7878', apiKey: 'abc' }
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    const result = await testRadarrConnection(config)
    expect(mockPost).toHaveBeenCalledWith('/settings/radarr/test', config)
    expect(result).toEqual({ data: { success: true } })
  })

  it('getRadarrQualityProfiles calls getDataRequest with id in URL', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 1, name: 'HD' }])
    const result = await getRadarrQualityProfiles(5)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/radarr/5/quality-profiles')
    expect(result).toEqual([{ id: 1, name: 'HD' }])
  })
})

describe('settingsArr - sonarr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getSonarrConfig calls getDataRequest with /settings/sonarr', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 2 }])
    const result = await getSonarrConfig()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/sonarr')
    expect(result).toEqual([{ id: 2 }])
  })

  it('addSonarrConfig calls apiClient.post with URL and data', async () => {
    const data = { name: 'Sonarr1', url: 'http://localhost' }
    mockPost.mockResolvedValueOnce({ data: { id: 20 } })
    const result = await addSonarrConfig(data)
    expect(mockPost).toHaveBeenCalledWith('/settings/sonarr', data)
    expect(result).toEqual({ data: { id: 20 } })
  })

  it('updateSonarrConfig calls apiClient.put with id in URL and data', async () => {
    const data = { name: 'Updated' }
    mockPut.mockResolvedValueOnce({ data: { ok: true } })
    const result = await updateSonarrConfig(4, data)
    expect(mockPut).toHaveBeenCalledWith('/settings/sonarr/4', data)
    expect(result).toEqual({ data: { ok: true } })
  })

  it('deleteSonarrConfig calls apiClient.delete with id in URL', async () => {
    mockDelete.mockResolvedValueOnce({ status: 204 })
    const result = await deleteSonarrConfig(9)
    expect(mockDelete).toHaveBeenCalledWith('/settings/sonarr/9')
    expect(result).toEqual({ status: 204 })
  })

  it('testSonarrConnection calls apiClient.post with test URL and config', async () => {
    const config = { url: 'http://sonarr:8989', apiKey: 'xyz' }
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    const result = await testSonarrConnection(config)
    expect(mockPost).toHaveBeenCalledWith('/settings/sonarr/test', config)
    expect(result).toEqual({ data: { success: true } })
  })

  it('getSonarrQualityProfiles calls getDataRequest with id in URL', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 2, name: 'SD' }])
    const result = await getSonarrQualityProfiles(6)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/sonarr/6/quality-profiles')
    expect(result).toEqual([{ id: 2, name: 'SD' }])
  })
})
