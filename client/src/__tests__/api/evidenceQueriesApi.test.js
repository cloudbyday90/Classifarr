import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
}))

import {
  getSummary,
  list,
  getById,
  diagnose,
} from '../../api/evidenceQueriesApi'

describe('evidenceQueriesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getSummary calls getDataRequest with /evidence/summary', async () => {
    const summary = { total: 42, promoted: 30 }
    mockGetDataRequest.mockResolvedValueOnce(summary)
    const result = await getSummary()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/evidence/summary')
    expect(result).toEqual(summary)
  })

  it('list calls getDataRequest with /evidence and empty default params', async () => {
    mockGetDataRequest.mockResolvedValueOnce([])
    const result = await list()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/evidence', { params: {} })
    expect(result).toEqual([])
  })

  it('list passes provided params', async () => {
    mockGetDataRequest.mockResolvedValueOnce([{ id: 1 }])
    await list({ status: 'active', page: 2 })
    expect(mockGetDataRequest).toHaveBeenCalledWith('/evidence', { params: { status: 'active', page: 2 } })
  })

  it('getById calls getDataRequest with id in URL', async () => {
    const item = { id: 5, label: 'test' }
    mockGetDataRequest.mockResolvedValueOnce(item)
    const result = await getById(5)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/evidence/5')
    expect(result).toEqual(item)
  })

  it('diagnose calls getDataRequest with id in URL', async () => {
    const diagnosis = { issues: ['low_confidence'] }
    mockGetDataRequest.mockResolvedValueOnce(diagnosis)
    const result = await diagnose(10)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/evidence/10/diagnose')
    expect(result).toEqual(diagnosis)
  })
})
