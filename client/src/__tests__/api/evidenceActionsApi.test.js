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

const mockPost = vi.fn()

vi.mock('../../api/core', () => ({
  apiClient: {
    post: (...args) => mockPost(...args),
  },
}))

import {
  decay,
  promote,
  purge,
} from '../../api/evidenceActionsApi'

describe('evidenceActionsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('decay calls POST with id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { decayed: true } })
    const result = await decay(7)
    expect(mockPost).toHaveBeenCalledWith('/evidence/7/decay')
    expect(result).toEqual({ data: { decayed: true } })
  })

  it('promote calls POST with id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { promoted: true } })
    const result = await promote(12)
    expect(mockPost).toHaveBeenCalledWith('/evidence/12/promote')
    expect(result).toEqual({ data: { promoted: true } })
  })

  it('purge calls POST with filter body', async () => {
    const filter = { olderThan: '30d', status: 'decayed' }
    mockPost.mockResolvedValueOnce({ data: { purged: 15 } })
    const result = await purge(filter)
    expect(mockPost).toHaveBeenCalledWith('/evidence/purge', filter)
    expect(result).toEqual({ data: { purged: 15 } })
  })
})
