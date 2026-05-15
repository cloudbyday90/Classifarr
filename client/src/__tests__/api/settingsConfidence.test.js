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
