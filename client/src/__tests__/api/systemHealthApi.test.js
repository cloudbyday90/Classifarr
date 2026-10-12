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

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
  },
}))

import {
  getSystemHealth,
  getSystemServicesHealth,
  getSystemStatus,
  getImageIndexProgress,
  refreshSystemHealth,
  resetOmdbCircuitBreaker,
  browseFolders,
} from '../../api/systemHealthApi'

describe('systemHealthApi', () => {
  it('returns explicit detailed aggregate counts without mutation', async () => {
    const result = { overall: 'unknown', summary: { active: 1, unknown: 1, healthy: 0, disabled: 2 } }
    mockGetDataRequest.mockResolvedValueOnce(result)
    expect(await getSystemServicesHealth()).toBe(result)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/system/health/services')
    expect(mockPost).not.toHaveBeenCalled()
  })
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads repair progress without request parameters or mutations', async () => {
    const report = { status: 'waiting' }
    mockGetDataRequest.mockResolvedValueOnce(report)
    expect(await getImageIndexProgress()).toBe(report)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/stats/image-index-progress')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('getSystemHealth calls getDataRequest with /system/health', async () => {
    const health = { status: 'healthy', database: 'connected', freshnessPolicy: { intervalMs: 900000 },
      details: { database: { effectiveStatus: 'unknown', observedStatus: 'healthy', freshness: { state: 'stale' } } } }
    mockGetDataRequest.mockResolvedValueOnce(health)
    const result = await getSystemHealth()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/system/health')
    expect(result).toBe(health)
  })

  it('getSystemStatus calls getDataRequest with /system/status', async () => {
    const status = { uptime: 3600, pgvector: { selection: { status: 'legacy', report: null } } }
    mockGetDataRequest.mockResolvedValueOnce(status)
    expect(await getSystemStatus()).toEqual(status)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/system/status')
  })

  it('refreshSystemHealth calls POST with /system/health/refresh', async () => {
    mockPost.mockResolvedValueOnce({ data: { refreshed: true } })
    await refreshSystemHealth()
    expect(mockPost).toHaveBeenCalledWith('/system/health/refresh')
  })

  it('resetOmdbCircuitBreaker calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { reset: true } })
    await resetOmdbCircuitBreaker()
    expect(mockPost).toHaveBeenCalledWith('/settings/omdb/circuit-breaker/reset')
  })

  it('browseFolders encodes path in URL', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ folders: [] })
    await browseFolders('/media/tv shows')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/system/browse-folders?path=%2Fmedia%2Ftv%20shows')
  })
})
