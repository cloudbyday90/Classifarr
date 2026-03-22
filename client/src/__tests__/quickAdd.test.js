/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  normalizeTmdbResult,
  normalizeTmdbResults,
  validateQuickAddQuery,
} from '@/utils/quickAdd'

describe('quickAdd utility helpers', () => {
  it('normalizes movie and tv TMDB rows', () => {
    expect(normalizeTmdbResult({
      id: 27205,
      media_type: 'movie',
      title: 'Inception',
      release_date: '2010-07-16',
    })).toEqual({
      id: 27205,
      media_type: 'movie',
      title: 'Inception',
      year: '2010',
    })

    expect(normalizeTmdbResult({
      id: 1399,
      mediaType: 'tv',
      name: 'Game of Thrones',
      first_air_date: '2011-04-17',
    })).toEqual({
      id: 1399,
      media_type: 'tv',
      title: 'Game of Thrones',
      year: '2011',
    })
  })

  it('drops unsupported or malformed TMDB rows', () => {
    expect(normalizeTmdbResult(null)).toBeNull()
    expect(normalizeTmdbResult({ id: 1, media_type: 'person', name: 'Actor' })).toBeNull()
    expect(normalizeTmdbResult({ media_type: 'movie', title: 'Missing Id' })).toBeNull()
  })

  it('normalizes result lists and enforces the default cap', () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      media_type: 'movie',
      title: `Movie ${index + 1}`,
      release_date: '2025-01-01',
    }))

    expect(normalizeTmdbResults(rows)).toHaveLength(8)
    expect(normalizeTmdbResults(rows, 3).map((row) => row.id)).toEqual([1, 2, 3])
  })

  it('trims and validates quick add queries', () => {
    expect(validateQuickAddQuery('  Inception  ')).toEqual({
      query: 'Inception',
      error: '',
    })

    expect(validateQuickAddQuery(' a ')).toEqual({
      query: 'a',
      error: 'Enter at least 2 characters to search TMDB.',
    })
  })
})
