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
  getGeneralSettings,
  updateGeneralSettings,
} from '../../api/settingsGeneralApi'

describe('settingsGeneralApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getGeneralSettings calls getDataRequest with /settings', async () => {
    const settings = { app_name: 'Classifarr', theme: 'dark' }
    mockGetDataRequest.mockResolvedValueOnce(settings)
    const result = await getGeneralSettings()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/settings')
    expect(result).toEqual(settings)
  })

  it('updateGeneralSettings calls PUT with data', async () => {
    const data = { app_name: 'MyApp', theme: 'light' }
    mockPut.mockResolvedValueOnce({ data: { success: true } })
    const result = await updateGeneralSettings(data)
    expect(mockPut).toHaveBeenCalledWith('/settings', data)
    expect(result).toEqual({ data: { success: true } })
  })
})
