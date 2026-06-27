/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  formatLanguageCode,
  usePolicyBuilderTemplateSignals,
} from '@/composables/usePolicyBuilderTemplateSignals'

function createTemplateSignals(allPresets) {
  return usePolicyBuilderTemplateSignals({
    allPresets: ref(allPresets),
  })
}

describe('usePolicyBuilderTemplateSignals composable', () => {
  it('finds base signals and formats language codes for advanced template details', () => {
    const helpers = createTemplateSignals([{
      id: 10,
      name: 'Language',
      signals: {
        language: {
          require_any: ['sv'],
          exclude: ['ja'],
          strict: false,
        },
        genres: {
          prefer: ['Drama'],
        },
      },
    }])

    expect(helpers.getPresetBaseSignals({ preset_id: 10 }, 'genres', 'prefer')).toEqual(['Drama'])
    expect(helpers.getPresetBaseSignals({ id: 10 }, 'language', 'exclude')).toEqual(['ja'])
    expect(helpers.hasPresetLanguageSignals({ id: 10 })).toBe(true)
    expect(formatLanguageCode('sv')).toBe('Swedish')
    expect(formatLanguageCode('zz')).toBe('ZZ')
  })

  it('builds runtime badges from explicit semantics or language signals', () => {
    const helpers = createTemplateSignals([{
      id: 10,
      signals: {
        language: {
          require_any: ['sv'],
        },
      },
    }])

    expect(helpers.hasRuntimeSemanticsWarning({
      suggestion_warnings: ['runtime_semantics_review_recommended'],
    })).toBe(true)

    expect(helpers.getPresetRuntimeBadge({
      id: 10,
      runtime_semantics: {
        badge_label: 'Strict',
        badge_tone: 'warning',
        summary: 'Strict language behavior',
      },
    })).toEqual({
      label: 'Strict',
      className: 'bg-amber-500/10 text-amber-300',
    })
    expect(helpers.getPresetRuntimeSummary({
      runtimeSemantics: {
        summary: 'Advisory only',
      },
    })).toBe('Advisory only')
    expect(helpers.getPresetRuntimeBadge({ id: 10 })).toEqual({
      label: 'Advisory by default',
      className: 'bg-amber-500/10 text-amber-300',
    })
  })

  it('reads strict signal overrides relative to base config', () => {
    const helpers = createTemplateSignals([{
      id: 10,
      signals: {
        language: {
          strict: false,
        },
      },
    }])

    expect(helpers.getPresetSignalStrict({ id: 10 }, 'language')).toBe(false)

    expect(helpers.getPresetSignalStrict({
      id: 10,
      customSignals: {
        language: {
          strict: true,
        },
      },
    }, 'language')).toBe(true)
  })

  it('reads removed base signals for advanced template details', () => {
    const helpers = createTemplateSignals([])
    const preset = {
      customSignals: {
        removed: {
          genres: {
            prefer: ['Comedy'],
          },
        },
      },
    }

    expect(helpers.isSignalRemoved(preset, 'genres', 'prefer', 'Comedy')).toBe(true)
    expect(helpers.isSignalRemoved(preset, 'genres', 'prefer', 'Drama')).toBe(false)
  })

  it('keeps advanced template helpers read-only', () => {
    const helpers = createTemplateSignals([])

    expect(helpers.addKeywordToPreset).toBeUndefined()
    expect(helpers.setPresetSignalStrict).toBeUndefined()
    expect(helpers.newKeyword).toBeUndefined()
  })
})
