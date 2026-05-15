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
  clearCompletedTasks,
  clearFailedTasks,
  retryAllFailedTasks,
  cancelAllPendingTasks,
  reprocessCompleted,
  clearAndResync,
  getLiveStats,
  getAiGenerationStatus,
  processEnrichmentRetries,
} from '../../api/queueOperationsApi'

describe('queueOperationsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clearCompletedTasks calls POST /queue/clear-completed', async () => {
    mockPost.mockResolvedValueOnce({ data: { count: 50 } })
    const result = await clearCompletedTasks()
    expect(mockPost).toHaveBeenCalledWith('/queue/clear-completed')
    expect(result).toEqual({ data: { count: 50 } })
  })

  it('clearFailedTasks calls POST /queue/clear-failed', async () => {
    mockPost.mockResolvedValueOnce({ data: { count: 3 } })
    const result = await clearFailedTasks()
    expect(mockPost).toHaveBeenCalledWith('/queue/clear-failed')
    expect(result).toEqual({ data: { count: 3 } })
  })

  it('retryAllFailedTasks calls POST /queue/retry-all-failed', async () => {
    mockPost.mockResolvedValueOnce({ data: { count: 3 } })
    const result = await retryAllFailedTasks()
    expect(mockPost).toHaveBeenCalledWith('/queue/retry-all-failed')
    expect(result).toEqual({ data: { count: 3 } })
  })

  it('cancelAllPendingTasks calls POST /queue/cancel-all-pending', async () => {
    mockPost.mockResolvedValueOnce({ data: { count: 5 } })
    const result = await cancelAllPendingTasks()
    expect(mockPost).toHaveBeenCalledWith('/queue/cancel-all-pending')
    expect(result).toEqual({ data: { count: 5 } })
  })

  it('reprocessCompleted calls POST /queue/reprocess-completed', async () => {
    mockPost.mockResolvedValueOnce({ data: { count: 12 } })
    const result = await reprocessCompleted()
    expect(mockPost).toHaveBeenCalledWith('/queue/reprocess-completed')
    expect(result).toEqual({ data: { count: 12 } })
  })

  it('clearAndResync calls POST /queue/clear-and-resync', async () => {
    mockPost.mockResolvedValueOnce({ data: { itemsReset: 100 } })
    const result = await clearAndResync()
    expect(mockPost).toHaveBeenCalledWith('/queue/clear-and-resync')
    expect(result).toEqual({ data: { itemsReset: 100 } })
  })

  it('getLiveStats calls getDataRequest with /queue/live-stats', async () => {
    const stats = { queue: { pending: 5 }, enrichment: { total: 50 } }
    mockGetDataRequest.mockResolvedValueOnce(stats)
    const result = await getLiveStats()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/queue/live-stats')
    expect(result).toEqual(stats)
  })

  it('getAiGenerationStatus calls getDataRequest with /queue/ollama-status', async () => {
    const status = { available: true, model: 'llama3' }
    mockGetDataRequest.mockResolvedValueOnce(status)
    const result = await getAiGenerationStatus()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/queue/ollama-status')
    expect(result).toEqual(status)
  })

  it('processEnrichmentRetries calls POST with empty default options', async () => {
    mockPost.mockResolvedValueOnce({ data: { processed: 10 } })
    const result = await processEnrichmentRetries()
    expect(mockPost).toHaveBeenCalledWith('/queue/retry-process', {})
    expect(result).toEqual({ data: { processed: 10 } })
  })

  it('processEnrichmentRetries passes provided options', async () => {
    const options = { batchSize: 50, dryRun: true }
    mockPost.mockResolvedValueOnce({ data: { processed: 0 } })
    await processEnrichmentRetries(options)
    expect(mockPost).toHaveBeenCalledWith('/queue/retry-process', options)
  })
})
