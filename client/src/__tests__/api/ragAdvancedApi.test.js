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
  resetRagCircuitBreaker,
  warmupRagModel,
  exportRagConfig,
  exportRagLogs,
  exportRagMetrics,
  getRagAdvancedConfig,
  updateRagAdvancedConfig,
  clearRagEmbeddings,
  resetRagConfig,
} from '../../api/ragAdvancedApi'

describe('ragAdvancedApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resetRagCircuitBreaker calls POST /rag/circuit-breaker/reset', async () => {
    mockPost.mockResolvedValueOnce({ data: { ok: true } })
    const result = await resetRagCircuitBreaker()
    expect(mockPost).toHaveBeenCalledWith('/rag/circuit-breaker/reset')
    expect(result).toEqual({ data: { ok: true } })
  })

  it('warmupRagModel calls POST /rag/warmup', async () => {
    mockPost.mockResolvedValueOnce({ data: { started: true } })
    const result = await warmupRagModel()
    expect(mockPost).toHaveBeenCalledWith('/rag/warmup')
    expect(result).toEqual({ data: { started: true } })
  })

  it('exportRagConfig calls POST /rag/export/config', async () => {
    mockPost.mockResolvedValueOnce({ data: { config: {} } })
    const result = await exportRagConfig()
    expect(mockPost).toHaveBeenCalledWith('/rag/export/config')
    expect(result).toEqual({ data: { config: {} } })
  })

  it('exportRagLogs calls POST /rag/export/logs', async () => {
    mockPost.mockResolvedValueOnce({ data: { logs: [] } })
    const result = await exportRagLogs()
    expect(mockPost).toHaveBeenCalledWith('/rag/export/logs')
    expect(result).toEqual({ data: { logs: [] } })
  })

  it('exportRagMetrics calls POST /rag/export/metrics', async () => {
    mockPost.mockResolvedValueOnce({ data: { metrics: {} } })
    const result = await exportRagMetrics()
    expect(mockPost).toHaveBeenCalledWith('/rag/export/metrics')
    expect(result).toEqual({ data: { metrics: {} } })
  })

  it('getRagAdvancedConfig calls getDataRequest with /rag/advanced', async () => {
    const config = { max_retries: 3, cache_enabled: true }
    mockGetDataRequest.mockResolvedValueOnce(config)
    const result = await getRagAdvancedConfig()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/rag/advanced')
    expect(result).toEqual(config)
  })

  it('updateRagAdvancedConfig calls PUT /rag/advanced with data', async () => {
    const data = { max_retries: 5, cache_enabled: false }
    mockPut.mockResolvedValueOnce({ data: { updated: true } })
    const result = await updateRagAdvancedConfig(data)
    expect(mockPut).toHaveBeenCalledWith('/rag/advanced', data)
    expect(result).toEqual({ data: { updated: true } })
  })

  it('clearRagEmbeddings calls POST /rag/clear-embeddings', async () => {
    mockPost.mockResolvedValueOnce({ data: { cleared: true } })
    const result = await clearRagEmbeddings()
    expect(mockPost).toHaveBeenCalledWith('/rag/clear-embeddings')
    expect(result).toEqual({ data: { cleared: true } })
  })

  it('resetRagConfig calls POST /rag/reset-config', async () => {
    mockPost.mockResolvedValueOnce({ data: { reset: true } })
    const result = await resetRagConfig()
    expect(mockPost).toHaveBeenCalledWith('/rag/reset-config')
    expect(result).toEqual({ data: { reset: true } })
  })
})
