/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  buildCombinedSignals,
  createEmptyCombinedSignals,
  usePolicyBuilderCombinedSignals,
} from '@/composables/usePolicyBuilderCombinedSignals'

describe('usePolicyBuilderCombinedSignals composable', () => {
  it('returns the empty presentation shape when no presets are selected', () => {
    expect(buildCombinedSignals([], [])).toEqual(createEmptyCombinedSignals())
    expect(buildCombinedSignals(null, null)).toEqual(createEmptyCombinedSignals())
  })

  it('combines base and custom signals with sorted source attribution', () => {
    const result = buildCombinedSignals([
      {
        id: 1,
        name: 'Family Starter',
        customSignals: {
          genres: {
            prefer: ['Adventure'],
          },
          keywords: {
            require_any: ['dragon'],
          },
        },
      },
      {
        id: 2,
        name: 'Animation Starter',
        customSignals: {
          certifications: {
            exclude: ['R'],
          },
        },
      },
    ], [
      {
        id: 1,
        signals: {
          certifications: {
            include: ['G', 'PG'],
          },
          genres: {
            prefer: ['Animation'],
            require_any: ['Family'],
          },
          keywords: {
            exclude: ['horror'],
          },
        },
      },
      {
        id: 2,
        signals: {
          certifications: {
            include: ['PG'],
          },
          genres: {
            prefer: ['Animation'],
          },
          keywords: {
            prefer: ['cartoon'],
          },
        },
      },
    ])

    expect(result.certifications.include).toEqual([
      { value: 'G', sources: ['Family Starter'] },
      { value: 'PG', sources: ['Animation Starter', 'Family Starter'] },
    ])
    expect(result.certifications.exclude).toEqual([
      { value: 'R', sources: ['Animation Starter'] },
    ])
    expect(result.genres.prefer).toEqual([
      { value: 'Adventure', sources: ['Family Starter'] },
      { value: 'Animation', sources: ['Animation Starter', 'Family Starter'] },
    ])
    expect(result.genres.require_any).toEqual([
      { value: 'Family', sources: ['Family Starter'] },
    ])
    expect(result.keywords.prefer).toEqual([
      { value: 'cartoon', sources: ['Animation Starter'] },
    ])
    expect(result.keywords.require_any).toEqual([
      { value: 'dragon', sources: ['Family Starter'] },
    ])
    expect(result.keywords.exclude).toEqual([
      { value: 'horror', sources: ['Family Starter'] },
    ])
  })

  it('omits removed base signals while keeping custom signals for the same key', () => {
    const result = buildCombinedSignals([
      {
        preset_id: 1,
        name: 'Movies Starter',
        customSignals: {
          removed: {
            genres: {
              prefer: ['Drama'],
            },
          },
          genres: {
            prefer: ['Comedy'],
          },
        },
      },
    ], [
      {
        id: 1,
        signals: {
          genres: {
            prefer: ['Drama', 'Action'],
          },
        },
      },
    ])

    expect(result.genres.prefer).toEqual([
      { value: 'Action', sources: ['Movies Starter'] },
      { value: 'Comedy', sources: ['Movies Starter'] },
    ])
  })

  it('ignores selected presets that no longer have a matching full preset definition', () => {
    const result = buildCombinedSignals([
      { id: 99, name: 'Missing' },
    ], [
      {
        id: 1,
        signals: {
          genres: {
            prefer: ['Drama'],
          },
        },
      },
    ])

    expect(result).toEqual(createEmptyCombinedSignals())
  })

  it('updates reactively when selected presets change', () => {
    const selectedPresets = ref([])
    const allPresets = ref([{
      id: 1,
      signals: {
        genres: {
          prefer: ['Comedy'],
        },
      },
    }])
    const { combinedSignals } = usePolicyBuilderCombinedSignals({
      selectedPresets,
      allPresets,
    })

    expect(combinedSignals.value.genres.prefer).toEqual([])

    selectedPresets.value = [{ id: 1, name: 'Comedy Starter' }]

    expect(combinedSignals.value.genres.prefer).toEqual([
      { value: 'Comedy', sources: ['Comedy Starter'] },
    ])
  })
})
