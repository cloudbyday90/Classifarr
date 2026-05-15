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

vi.mock('@/api', () => ({
  default: {
    searchTMDB: vi.fn(),
    submitManualRequest: vi.fn(),
  },
}))

vi.mock('@/utils/quickAdd', () => ({
  validateQuickAddQuery: vi.fn(() => ({ query: '', error: '' })),
  normalizeTmdbResults: vi.fn(() => []),
}))

import api from '@/api'
import { validateQuickAddQuery, normalizeTmdbResults } from '@/utils/quickAdd'
import { useQuickAdd } from '@/composables/useQuickAdd'

function createComposable(refreshData) {
  return useQuickAdd({ refreshData: refreshData || vi.fn() })
}

describe('useQuickAdd composable — error and edge-case branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('updateQuickAddQuery sets value even when unchanged', () => {
    const qa = createComposable()
    qa.updateQuickAddQuery('test')
    expect(qa.quickAddQuery.value).toBe('test')

    qa.updateQuickAddQuery('test')
    expect(qa.quickAddQuery.value).toBe('test')
  })

  it('searchQuickAdd sets error when validation fails', async () => {
    validateQuickAddQuery.mockReturnValueOnce({ query: '', error: 'Enter at least 2 characters.' })

    const qa = createComposable()
    await qa.searchQuickAdd()

    expect(qa.quickAddError.value).toBe('Enter at least 2 characters.')
    expect(api.searchTMDB).not.toHaveBeenCalled()
  })

  it('searchQuickAdd handles API errors with response data', async () => {
    validateQuickAddQuery.mockReturnValueOnce({ query: 'Inception', error: '' })
    api.searchTMDB.mockRejectedValueOnce({
      response: { data: { error: 'API limit reached' } },
    })

    const qa = createComposable()
    await qa.searchQuickAdd()

    expect(qa.quickAddError.value).toBe('API limit reached')
  })

  it('submitQuickAdd handles API errors with fallback message', async () => {
    api.submitManualRequest.mockRejectedValueOnce(new Error('Network down'))

    const qa = createComposable()
    qa.selectQuickAddResult({ id: 1, media_type: 'movie', title: 'Test' })

    await qa.submitQuickAdd()

    expect(qa.quickAddError.value).toBe('Network down')
  })

  it('submitQuickAdd calls refreshData after successful submission', async () => {
    api.submitManualRequest.mockResolvedValueOnce({})
    const refreshData = vi.fn()

    const qa = createComposable(refreshData)
    qa.selectQuickAddResult({ id: 1, media_type: 'movie', title: 'Test' })

    await qa.submitQuickAdd()

    expect(refreshData).toHaveBeenCalledOnce()
    expect(qa.quickAddSuccess.value).toContain('Test')
    expect(qa.quickAddQuery.value).toBe('')
  })

  it('searchQuickAdd sets error when results are empty', async () => {
    validateQuickAddQuery.mockReturnValueOnce({ query: 'xyz', error: '' })
    api.searchTMDB.mockResolvedValueOnce({ results: [] })
    normalizeTmdbResults.mockReturnValueOnce([])

    const qa = createComposable()
    await qa.searchQuickAdd()

    expect(qa.quickAddResults.value).toEqual([])
    expect(qa.quickAddError.value).toBe('No TMDB results found for that query.')
  })

  it('submitQuickAdd returns immediately when nothing is selected', async () => {
    const qa = createComposable()

    await qa.submitQuickAdd()

    expect(api.submitManualRequest).not.toHaveBeenCalled()
    expect(qa.quickAddSubmitting.value).toBe(false)
  })

  it('searchQuickAdd uses message fallback when error has no response data', async () => {
    validateQuickAddQuery.mockReturnValueOnce({ query: 'test', error: '' })
    api.searchTMDB.mockRejectedValueOnce(new Error('Network timeout'))

    const qa = createComposable()
    await qa.searchQuickAdd()

    expect(qa.quickAddError.value).toBe('Network timeout')
  })

  it('submitQuickAdd uses string fallback when error has no message', async () => {
    api.submitManualRequest.mockRejectedValueOnce({})

    const qa = createComposable()
    qa.selectQuickAddResult({ id: 1, media_type: 'movie', title: 'Test' })

    await qa.submitQuickAdd()

    expect(qa.quickAddError.value).toBe('Failed to add request.')
  })
})
