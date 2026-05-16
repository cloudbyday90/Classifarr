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
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    patch: (...args) => mockPatch(...args),
    delete: (...args) => mockDelete(...args),
  },
}))

import {
  getApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  revealApiKey,
} from '../../api/adminApiKeys'

describe('adminApiKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getApiKeys calls getDataRequest with /keys', async () => {
    const keys = [{ id: 1, name: 'API Key 1' }]
    mockGetDataRequest.mockResolvedValueOnce(keys)
    const result = await getApiKeys()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/keys')
    expect(result).toEqual(keys)
  })

  it('createApiKey calls POST with data', async () => {
    const data = { name: 'New Key', permissions: ['read'] }
    mockPost.mockResolvedValueOnce({ data: { id: 2, key: 'abc123' } })
    const result = await createApiKey(data)
    expect(mockPost).toHaveBeenCalledWith('/keys', data)
    expect(result).toEqual({ data: { id: 2, key: 'abc123' } })
  })

  it('updateApiKey calls PATCH with id in URL and data', async () => {
    const data = { name: 'Renamed Key' }
    mockPatch.mockResolvedValueOnce({ data: { updated: true } })
    const result = await updateApiKey(5, data)
    expect(mockPatch).toHaveBeenCalledWith('/keys/5', data)
    expect(result).toEqual({ data: { updated: true } })
  })

  it('deleteApiKey calls DELETE with id in URL', async () => {
    mockDelete.mockResolvedValueOnce({ status: 204 })
    const result = await deleteApiKey(3)
    expect(mockDelete).toHaveBeenCalledWith('/keys/3')
    expect(result).toEqual({ status: 204 })
  })

  it('revealApiKey calls getDataRequest with id in URL', async () => {
    const revealed = { id: 7, key: 'secret-key-value' }
    mockGetDataRequest.mockResolvedValueOnce(revealed)
    const result = await revealApiKey(7)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/keys/7')
    expect(result).toEqual(revealed)
  })
})
