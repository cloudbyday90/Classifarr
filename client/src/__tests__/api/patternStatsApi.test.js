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
