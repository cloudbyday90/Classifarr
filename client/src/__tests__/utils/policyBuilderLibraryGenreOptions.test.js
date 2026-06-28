/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildLibraryGenreOptions,
  mergePolicyBuilderGenreOptions,
  summarizeLibraryProfileGenres,
} from '@/utils/policyBuilderLibraryGenreOptions'

describe('policyBuilderLibraryGenreOptions', () => {
  it('derives sorted genre options from the current library profile', () => {
    expect(buildLibraryGenreOptions({
      genre_distribution: {
        Comedy: 12,
        Animation: 45,
        Empty: 0,
      },
    })).toEqual([
      {
        value: 'Animation',
        label: 'Animation',
        source: 'library_profile',
        sourceLabel: 'Already in library',
        count: 45,
        detail: '45 items in this library',
      },
      {
        value: 'Comedy',
        label: 'Comedy',
        source: 'library_profile',
        sourceLabel: 'Already in library',
        count: 12,
        detail: '12 items in this library',
      },
    ])
  })

  it('merges profile-backed and preset-backed genres without duplicates', () => {
    expect(mergePolicyBuilderGenreOptions({
      libraryProfile: {
        genre_distribution: {
          Family: 42,
          Animation: 45,
        },
      },
      presetGenres: ['Comedy', 'Family'],
    })).toEqual([
      expect.objectContaining({
        value: 'Animation',
        source: 'library_profile',
        count: 45,
      }),
      expect.objectContaining({
        value: 'Family',
        source: 'library_profile',
        count: 42,
      }),
      expect.objectContaining({
        value: 'Comedy',
        source: 'preset_reference',
        count: 0,
      }),
    ])
  })

  it('summarizes top profile genres for the library context card', () => {
    expect(summarizeLibraryProfileGenres({
      genre_distribution: {
        Family: 42,
        Animation: 45,
        Comedy: 12,
      },
    }, 2)).toEqual(['Animation (45)', 'Family (42)'])
  })
})
