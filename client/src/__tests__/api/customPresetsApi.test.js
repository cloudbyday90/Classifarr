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
  getCustomPresets,
  createCustomPreset,
  updateCustomPreset,
  deleteCustomPreset,
} from '../../api/customPresetsApi'

describe('customPresetsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getCustomPresets calls getDataRequest with correct URL', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 1 }])
    const result = await getCustomPresets()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/presets/custom')
    expect(result).toEqual([{ id: 1 }])
  })

  it('createCustomPreset calls apiClient.post with URL and data', async () => {
    const data = { name: 'Test', signals: {} }
    mockPost.mockResolvedValueOnce({ data: { id: 10 } })
    const result = await createCustomPreset(data)
    expect(mockPost).toHaveBeenCalledWith('/presets/custom', data)
    expect(result).toEqual({ data: { id: 10 } })
  })

  it('updateCustomPreset calls apiClient.put with id in URL and data', async () => {
    const data = { name: 'Updated' }
    mockPut.mockResolvedValueOnce({ data: { ok: true } })
    const result = await updateCustomPreset(3, data)
    expect(mockPut).toHaveBeenCalledWith('/presets/custom/3', data)
    expect(result).toEqual({ data: { ok: true } })
  })

  it('deleteCustomPreset calls apiClient.delete with id in URL', async () => {
    mockDelete.mockResolvedValueOnce({ status: 204 })
    const result = await deleteCustomPreset(7)
    expect(mockDelete).toHaveBeenCalledWith('/presets/custom/7')
    expect(result).toEqual({ status: 204 })
  })
})
