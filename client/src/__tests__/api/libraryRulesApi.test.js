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
  getLibraryRules,
  addLibraryRule,
  deleteLibraryRule,
  getLibraryArrOptions,
  updateLibraryArrSettings,
  getLibraryProfile,
  regenerateLibraryProfile,
} from '../../api/libraryRulesApi'

describe('libraryRulesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getLibraryRules calls getDataRequest with id in URL', async () => {
    const rules = [{ id: 'r1', pattern: 'action' }]
    mockGetDataRequest.mockResolvedValueOnce(rules)
    const result = await getLibraryRules(5)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/libraries/5/rules')
    expect(result).toEqual(rules)
  })

  it('addLibraryRule calls POST with id in URL and data', async () => {
    const data = { pattern: 'comedy', label: 'Comedy' }
    mockPost.mockResolvedValueOnce({ data: { id: 'r2' } })
    const result = await addLibraryRule(5, data)
    expect(mockPost).toHaveBeenCalledWith('/libraries/5/rules', data)
    expect(result).toEqual({ data: { id: 'r2' } })
  })

  it('deleteLibraryRule calls DELETE with library id and rule id in URL', async () => {
    mockDelete.mockResolvedValueOnce({ status: 204 })
    const result = await deleteLibraryRule(5, 'r1')
    expect(mockDelete).toHaveBeenCalledWith('/libraries/5/rules/r1')
    expect(result).toEqual({ status: 204 })
  })

  it('getLibraryArrOptions calls getDataRequest with id in URL', async () => {
    const options = { profiles: [{ id: 1, name: 'HD' }] }
    mockGetDataRequest.mockResolvedValueOnce(options)
    const result = await getLibraryArrOptions(5)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/libraries/5/arr-options')
    expect(result).toEqual(options)
  })

  it('updateLibraryArrSettings calls PUT with id in URL and settings wrapped', async () => {
    const settings = { profileId: 3, rootFolder: '/media' }
    mockPut.mockResolvedValueOnce({ data: { updated: true } })
    const result = await updateLibraryArrSettings(5, settings)
    expect(mockPut).toHaveBeenCalledWith('/libraries/5/arr-settings', { settings })
    expect(result).toEqual({ data: { updated: true } })
  })

  it('getLibraryProfile calls getDataRequest with library id in URL', async () => {
    const profile = { mediaCount: 200, classified: 180 }
    mockGetDataRequest.mockResolvedValueOnce(profile)
    const result = await getLibraryProfile(10)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/libraries/10/profile')
    expect(result).toEqual(profile)
  })

  it('regenerateLibraryProfile calls POST with library id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    const result = await regenerateLibraryProfile(10)
    expect(mockPost).toHaveBeenCalledWith('/libraries/10/profile/refresh')
    expect(result).toEqual({ data: { success: true } })
  })
})
