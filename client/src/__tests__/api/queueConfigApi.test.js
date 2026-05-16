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
const mockGetSettingsRequest = vi.fn()
const mockUpdateSettingsRequest = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  getSettingsRequest: (...args) => mockGetSettingsRequest(...args),
  updateSettingsRequest: (...args) => mockUpdateSettingsRequest(...args),
}))

import {
  getQueueStats,
  getQueueSettings,
  updateQueueSettings,
} from '../../api/queueConfigApi'

describe('queueConfigApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getQueueStats calls getDataRequest with /queue/stats', async () => {
    const stats = { pending: 5, processing: 1, completed: 100, failed: 2 }
    mockGetDataRequest.mockResolvedValueOnce(stats)
    const result = await getQueueStats()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/queue/stats')
    expect(result).toEqual(stats)
  })

  it('getQueueSettings calls getSettingsRequest with queue', async () => {
    const settings = { workerEnabled: true, concurrentWorkers: 2 }
    mockGetSettingsRequest.mockResolvedValueOnce(settings)
    const result = await getQueueSettings()
    expect(mockGetSettingsRequest).toHaveBeenCalledWith('queue')
    expect(result).toEqual(settings)
  })

  it('updateQueueSettings calls updateSettingsRequest with queue and settings', async () => {
    const settings = { workerEnabled: false, concurrentWorkers: 1 }
    mockUpdateSettingsRequest.mockResolvedValueOnce({ data: { ok: true } })
    const result = await updateQueueSettings(settings)
    expect(mockUpdateSettingsRequest).toHaveBeenCalledWith('queue', settings)
    expect(result).toEqual({ data: { ok: true } })
  })
})
