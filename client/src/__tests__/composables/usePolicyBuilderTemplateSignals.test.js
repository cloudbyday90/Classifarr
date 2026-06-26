/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  formatLanguageCode,
  usePolicyBuilderTemplateSignals,
} from '@/composables/usePolicyBuilderTemplateSignals'
import { cleanupCustomSignals } from '@/composables/usePolicyBuilderState'

function createTemplateSignals(allPresets) {
  return usePolicyBuilderTemplateSignals({
    allPresets: ref(allPresets),
    cleanupCustomSignals,
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

  it('toggles strict signal overrides relative to base config', () => {
    const helpers = createTemplateSignals([{
      id: 10,
      signals: {
        language: {
          strict: false,
        },
      },
    }])
    const preset = {
      id: 10,
      customSignals: null,
    }

    expect(helpers.getPresetSignalStrict(preset, 'language')).toBe(false)

    helpers.setPresetSignalStrict(preset, 'language', true)
    expect(preset.customSignals).toEqual({
      language: {
        strict: true,
      },
    })
    expect(helpers.getPresetSignalStrict(preset, 'language')).toBe(true)

    helpers.setPresetSignalStrict(preset, 'language', false)
    expect(preset.customSignals).toBeNull()
    expect(helpers.getPresetSignalStrict(preset, 'language')).toBe(false)
  })

  it('marks and restores removed base signals without duplicating entries', () => {
    const helpers = createTemplateSignals([])
    const preset = {}

    helpers.markSignalRemoved(preset, 'genres', 'prefer', 'Comedy')
    helpers.markSignalRemoved(preset, 'genres', 'prefer', 'Comedy')

    expect(helpers.isSignalRemoved(preset, 'genres', 'prefer', 'Comedy')).toBe(true)
    expect(preset.customSignals.removed.genres.prefer).toEqual(['Comedy'])

    helpers.unmarkSignalRemoved(preset, 'genres', 'prefer', 'Comedy')
    expect(helpers.isSignalRemoved(preset, 'genres', 'prefer', 'Comedy')).toBe(false)
    expect(preset.customSignals.removed.genres.prefer).toEqual([])
  })

  it('adds normalized custom keywords once and clears the input', () => {
    const cleanupSpy = vi.fn(cleanupCustomSignals)
    const helpers = usePolicyBuilderTemplateSignals({
      allPresets: ref([]),
      cleanupCustomSignals: cleanupSpy,
    })
    const preset = {}

    helpers.newKeyword.value = '  Space Opera  '
    helpers.addKeywordToPreset(preset)
    helpers.newKeyword.value = 'space opera'
    helpers.addKeywordToPreset(preset)

    expect(preset.customSignals).toEqual({
      keywords: {
        require_any: ['space opera'],
      },
    })
    expect(helpers.newKeyword.value).toBe('')
    expect(cleanupSpy).toHaveBeenCalledTimes(2)
  })
})
