/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { usePolicyIntentDraft } from '@/composables/usePolicyIntentDraft'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

describe('usePolicyIntentDraft composable', () => {
  it('keeps a reactive draft synchronized with selected presets', () => {
    const selectedPresets = ref([])
    const draftState = usePolicyIntentDraft(selectedPresets)

    expect(draftState.intentDraft.value.summary.preset_count).toBe(0)

    selectedPresets.value = [{
      id: 14,
      preset_id: 14,
      name: 'Family',
      customSignals: {
        genres: {
          require_any: ['Family'],
          semantics: 'identity',
        },
      },
    }]

    expect(draftState.intentDraft.value.summary.preset_count).toBe(1)
    expect(draftState.intentDraft.value.presets[0].buckets[POLICY_INTENT_BUCKETS.IDENTITY]).toEqual([
      expect.objectContaining({
        signal_type: 'genres',
        values: { require_any: ['Family'] },
      }),
    ])
  })

  it('adds intent signals through the draft and applies them to selected presets', () => {
    const selectedPresets = ref([{
      id: 1,
      preset_id: 1,
      name: 'Starter',
      customSignals: null,
    }])
    const draftState = usePolicyIntentDraft(selectedPresets)

    expect(draftState.addSignal({
      presetId: 1,
      signalType: 'genres',
      key: 'require_any',
      value: 'Family',
      extras: { semantics: 'identity' },
    })).toBe(true)

    expect(selectedPresets.value[0].customSignals).toEqual({
      genres: {
        require_any: ['Family'],
        semantics: 'identity',
      },
    })
  })

  it('sets and appends signal configs with bounded draft commands', () => {
    const selectedPresets = ref([{
      id: 2,
      preset_id: 2,
      name: 'Movies',
      customSignals: {
        certifications: {
          source_note: 'preserved',
        },
      },
    }])
    const draftState = usePolicyIntentDraft(selectedPresets)

    expect(draftState.setSignalConfig({
      presetId: 2,
      signalType: 'certifications',
      config: {
        mode: 'max',
        max: 'PG-13',
        constraint_mode: 'strict',
      },
    })).toBe(true)

    expect(draftState.setSignalConfig({
      presetId: 2,
      signalType: 'certifications',
      config: {
        mode: 'exclude',
        exclude: ['R'],
      },
      appendArrays: true,
    })).toBe(true)

    expect(selectedPresets.value[0].customSignals).toEqual({
      certifications: {
        source_note: 'preserved',
        mode: 'exclude',
        max: 'PG-13',
        constraint_mode: 'strict',
        exclude: ['R'],
      },
    })
  })

  it('clears draft-managed signal config without dropping unsupported custom fields', () => {
    const selectedPresets = ref([{
      id: 3,
      preset_id: 3,
      name: 'Animated',
      customSignals: {
        genres: {
          require_any: ['Animation'],
          semantics: 'identity',
          source_note: 'keep',
        },
        custom_score: {
          enabled: true,
        },
      },
    }])
    const draftState = usePolicyIntentDraft(selectedPresets)

    expect(draftState.clearSignalConfig({
      presetId: 3,
      signalType: 'genres',
    })).toBe(true)

    expect(selectedPresets.value[0].customSignals).toEqual({
      genres: {
        source_note: 'keep',
      },
      custom_score: {
        enabled: true,
      },
    })
  })

  it('can serialize selected presets from draft without mutating current state', () => {
    const selectedPresets = ref([{
      id: 4,
      preset_id: 4,
      name: 'Family',
      customSignals: null,
    }])
    const draftState = usePolicyIntentDraft(selectedPresets)

    draftState.intentDraft.value.presets[0].buckets[POLICY_INTENT_BUCKETS.IDENTITY].push({
      bucket: POLICY_INTENT_BUCKETS.IDENTITY,
      signal_type: 'genres',
      values: { require_any: ['Family'] },
      metadata: { semantics: 'identity' },
      source: 'intent_draft',
    })

    const serialized = draftState.buildSelectedPresetsFromDraft()

    expect(selectedPresets.value[0].customSignals).toBeNull()
    expect(serialized[0].customSignals).toEqual({
      genres: {
        require_any: ['Family'],
        semantics: 'identity',
      },
    })
  })

  it('returns false for commands targeting missing presets', () => {
    const draftState = usePolicyIntentDraft(ref([]))

    expect(draftState.addSignal({
      presetId: 999,
      signalType: 'genres',
      key: 'require_any',
      value: 'Family',
    })).toBe(false)
    expect(draftState.setSignalConfig({
      presetId: 999,
      signalType: 'genres',
      config: { prefer: ['Comedy'] },
    })).toBe(false)
    expect(draftState.clearSignalConfig({
      presetId: 999,
      signalType: 'genres',
    })).toBe(false)
  })
})
