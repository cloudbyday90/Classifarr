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

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    put: (...args) => mockPut(...args),
  },
}))

import {
  getPatternConfig,
  updatePatternConfig,
  getCostSummary,
} from '../../api/patternStatsApi'

describe('patternStatsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPatternConfig calls getDataRequest with /patterns/config', async () => {
    mockGetDataRequest.mockResolvedValueOnce({})
    await getPatternConfig()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/patterns/config')
  })

  it('updatePatternConfig calls PUT with config', async () => {
    mockPut.mockResolvedValueOnce({ data: {} })
    await updatePatternConfig({ enabled: true })
    expect(mockPut).toHaveBeenCalledWith('/patterns/config', { enabled: true })
  })

  it('getCostSummary calls getDataRequest with /patterns/cost-summary', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ total: 0 })
    await getCostSummary()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/patterns/cost-summary')
  })
})
