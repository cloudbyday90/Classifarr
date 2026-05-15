import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()
const mockDelete = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    delete: (...args) => mockDelete(...args),
  },
}))

import {
  getLogStats,
  getLogs,
  getLogError,
  getBugReport,
  resolveLogError,
  exportLogs,
  clearAllLogs,
  cleanupLogs,
} from '../../api/logsApi'

describe('logsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getLogStats calls getDataRequest with /logs/stats', async () => {
    const stats = { totals: { total_logs: 10 } }
    mockGetDataRequest.mockResolvedValueOnce(stats)
    const result = await getLogStats()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/logs/stats')
    expect(result).toEqual(stats)
  })

  it('getLogs appends params to URL', async () => {
    const params = new URLSearchParams({ page: '1', limit: '50' })
    mockGetDataRequest.mockResolvedValueOnce({ logs: [], pagination: {} })
    await getLogs(params)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/logs?page=1&limit=50')
  })

  it('getLogError calls getDataRequest with error id', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ error_id: 'e1' })
    await getLogError('e1')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/logs/error/e1')
  })

  it('getBugReport calls getDataRequest with error id', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ report: 'bug text' })
    await getBugReport('e1')
    expect(mockGetDataRequest).toHaveBeenCalledWith('/logs/error/e1/report')
  })

  it('resolveLogError calls POST with error id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    await resolveLogError('e1')
    expect(mockPost).toHaveBeenCalledWith('/logs/error/e1/resolve', {})
  })

  it('exportLogs appends params to URL', async () => {
    const params = new URLSearchParams({ level: 'error' })
    mockGetDataRequest.mockResolvedValueOnce([])
    await exportLogs(params)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/logs/export?level=error')
  })

  it('clearAllLogs calls DELETE with /logs', async () => {
    mockDelete.mockResolvedValueOnce({ data: { deleted: { errorLogs: 5, appLogs: 10 } } })
    await clearAllLogs()
    expect(mockDelete).toHaveBeenCalledWith('/logs')
  })

  it('cleanupLogs calls POST with /logs/cleanup', async () => {
    mockPost.mockResolvedValueOnce({ data: { deleted: { errorLogs: 3, appLogs: 7 } } })
    await cleanupLogs()
    expect(mockPost).toHaveBeenCalledWith('/logs/cleanup', {})
  })
})
