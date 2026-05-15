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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLibrariesStore } from '@/stores/libraries'
import api from '@/api'

vi.mock('@/api', () => ({
  default: {
    getLibraries: vi.fn(),
  },
}))

describe('useLibrariesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with empty libraries, loading false, and no error', () => {
    const store = useLibrariesStore()

    expect(store.libraries).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchLibraries populates libraries on success', async () => {
    const mockLibraries = [
      { id: 1, name: 'Movies', type: 'movie' },
      { id: 2, name: 'TV Shows', type: 'series' },
    ]
    api.getLibraries.mockResolvedValueOnce(mockLibraries)

    const store = useLibrariesStore()
    await store.fetchLibraries()

    expect(store.libraries).toEqual(mockLibraries)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(api.getLibraries).toHaveBeenCalledOnce()
  })

  it('fetchLibraries sets error and logs on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.getLibraries.mockRejectedValueOnce(new Error('Server unreachable'))

    const store = useLibrariesStore()
    await store.fetchLibraries()

    expect(store.error).toBe('Server unreachable')
    expect(store.loading).toBe(false)
    expect(store.libraries).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch libraries:', expect.any(Error))
  })

  it('fetchLibraries sets loading to true during fetch and false after', async () => {
    let resolvePromise
    api.getLibraries.mockImplementation(() => new Promise((resolve) => {
      resolvePromise = resolve
    }))

    const store = useLibrariesStore()
    const promise = store.fetchLibraries()

    expect(store.loading).toBe(true)

    resolvePromise([])
    await promise

    expect(store.loading).toBe(false)
  })
})
