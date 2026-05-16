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

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
}))

import {
  getBackfillStatus,
  getBackfillConfig,
  updateBackfillConfig,
  startManualBackfill,
  pauseManualBackfill,
  resumeManualBackfill,
  clearManualBackfill,
} from '../../api/ragBackfillApi'

describe('ragBackfillApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getBackfillStatus calls getDataRequest with /rag/backfill/status', async () => {
    const status = { running: true, progress: 0.5 }
    mockGetDataRequest.mockResolvedValueOnce(status)
    const result = await getBackfillStatus()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/rag/backfill/status')
    expect(result).toEqual(status)
  })

  it('getBackfillConfig calls getDataRequest with /rag/backfill/config', async () => {
    const config = { batchSize: 100, concurrency: 4 }
    mockGetDataRequest.mockResolvedValueOnce(config)
    const result = await getBackfillConfig()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/rag/backfill/config')
    expect(result).toEqual(config)
  })

  it('updateBackfillConfig calls PUT with data', async () => {
    const data = { batchSize: 200 }
    mockPut.mockResolvedValueOnce({ data: { updated: true } })
    const result = await updateBackfillConfig(data)
    expect(mockPut).toHaveBeenCalledWith('/rag/backfill/config', data)
    expect(result).toEqual({ data: { updated: true } })
  })

  it('startManualBackfill calls POST with empty default data', async () => {
    mockPost.mockResolvedValueOnce({ data: { started: true } })
    const result = await startManualBackfill()
    expect(mockPost).toHaveBeenCalledWith('/rag/backfill/manual/start', {})
    expect(result).toEqual({ data: { started: true } })
  })

  it('startManualBackfill passes provided data', async () => {
    const data = { force: true }
    mockPost.mockResolvedValueOnce({ data: { started: true } })
    await startManualBackfill(data)
    expect(mockPost).toHaveBeenCalledWith('/rag/backfill/manual/start', data)
  })

  it('pauseManualBackfill calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { paused: true } })
    const result = await pauseManualBackfill()
    expect(mockPost).toHaveBeenCalledWith('/rag/backfill/manual/pause')
    expect(result).toEqual({ data: { paused: true } })
  })

  it('resumeManualBackfill calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { resumed: true } })
    const result = await resumeManualBackfill()
    expect(mockPost).toHaveBeenCalledWith('/rag/backfill/manual/resume')
    expect(result).toEqual({ data: { resumed: true } })
  })

  it('clearManualBackfill calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { cleared: true } })
    const result = await clearManualBackfill()
    expect(mockPost).toHaveBeenCalledWith('/rag/backfill/manual/clear')
    expect(result).toEqual({ data: { cleared: true } })
  })
})
