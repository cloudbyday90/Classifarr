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
const mockPut = vi.fn()
const mockPost = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    put: (...args) => mockPut(...args),
    post: (...args) => mockPost(...args),
  },
}))

import {
  getConfidenceSettings,
  updateConfidenceSettings,
  getConfidenceHistory,
  revertConfidenceSetting,
  exportConfidenceSettings,
} from '../../api/settingsConfidence'

describe('settingsConfidenceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getConfidenceSettings calls getDataRequest', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ threshold: 70 })
    await getConfidenceSettings()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/confidence')
  })

  it('updateConfidenceSettings calls PUT with data', async () => {
    mockPut.mockResolvedValueOnce({ data: {} })
    await updateConfidenceSettings({ threshold: 80 })
    expect(mockPut).toHaveBeenCalledWith('/settings/confidence', { threshold: 80 })
  })

  it('getConfidenceHistory passes params', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    await getConfidenceHistory({ limit: 10 })
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/confidence/history', { params: { limit: 10 } })
  })

  it('revertConfidenceSetting calls POST with audit id', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    await revertConfidenceSetting(42)
    expect(mockPost).toHaveBeenCalledWith('/settings/confidence/revert/42')
  })

  it('exportConfidenceSettings calls POST', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    await exportConfidenceSettings()
    expect(mockPost).toHaveBeenCalledWith('/settings/confidence/export')
  })
})
