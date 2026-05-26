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

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
}))

import {
  getSummary,
  list,
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

  it('diagnose calls getDataRequest with id in URL', async () => {
    const diagnosis = { issues: ['low_confidence'] }
    mockGetDataRequest.mockResolvedValueOnce(diagnosis)
    const result = await diagnose(10)
    expect(mockGetDataRequest).toHaveBeenCalledWith('/evidence/10/diagnose')
    expect(result).toEqual(diagnosis)
  })
})
