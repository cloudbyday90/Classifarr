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

  it('adds review triggers through the draft and applies them to selected presets', () => {
    const selectedPresets = ref([{
      id: 5,
      preset_id: 5,
      name: 'Review',
      customSignals: null,
    }])
    const draftState = usePolicyIntentDraft(selectedPresets)

    expect(draftState.addSignal({
      presetId: 5,
      signalType: 'review_triggers',
      key: 'when_any',
      value: 'evidence_missing',
      extras: { semantics: 'review' },
    })).toBe(true)

    expect(draftState.intentDraft.value.presets[0].buckets[POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS]).toEqual([
      expect.objectContaining({
        signal_type: 'review_triggers',
        values: { when_any: ['evidence_missing'] },
        metadata: { semantics: 'review' },
      }),
    ])
    expect(selectedPresets.value[0].customSignals).toEqual({
      review_triggers: {
        when_any: ['evidence_missing'],
        semantics: 'review',
      },
    })
  })

  it('removes custom signal values through the draft and cleans empty configs', () => {
    const selectedPresets = ref([{
      id: 12,
      preset_id: 12,
      name: 'Starter',
      customSignals: null,
    }])
    const draftState = usePolicyIntentDraft(selectedPresets)

    expect(draftState.addSignal({
      presetId: 12,
      signalType: 'certifications',
      key: 'include',
      value: 'PG',
    })).toBe(true)
    expect(draftState.addSignal({
      presetId: 12,
      signalType: 'certifications',
      key: 'include',
      value: 'PG',
    })).toBe(true)
    expect(selectedPresets.value[0].customSignals).toEqual({
      certifications: {
        include: ['PG'],
      },
    })

    expect(draftState.removeSignalValue({
      presetId: 12,
      signalType: 'certifications',
      key: 'include',
      value: 'PG',
    })).toBe(true)
    expect(selectedPresets.value[0].customSignals).toBeNull()
  })

  it('returns false when removing a missing custom signal value', () => {
    const selectedPresets = ref([{
      id: 13,
      preset_id: 13,
      name: 'Starter',
      customSignals: {
        genres: {
          prefer: ['Comedy'],
        },
      },
    }])
    const draftState = usePolicyIntentDraft(selectedPresets)

    expect(draftState.removeSignalValue({
      presetId: 13,
      signalType: 'genres',
      key: 'prefer',
      value: 'Drama',
    })).toBe(false)
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

    expect(draftState.setSignalConfig({
      presetId: 2,
      signalType: 'certifications',
      config: {
        mode: 'exclude',
        exclude: ['NC-17'],
      },
      appendArrays: true,
    })).toBe(true)

    expect(draftState.removeSignalValue({
      presetId: 2,
      signalType: 'certifications',
      key: 'exclude',
      value: 'R',
    })).toBe(true)

    expect(selectedPresets.value[0].customSignals).toEqual({
      certifications: {
        source_note: 'preserved',
        mode: 'exclude',
        max: 'PG-13',
        constraint_mode: 'strict',
        exclude: ['NC-17'],
      },
    })

    expect(draftState.removeSignalValue({
      presetId: 2,
      signalType: 'certifications',
      key: 'exclude',
      value: 'NC-17',
    })).toBe(true)

    expect(selectedPresets.value[0].customSignals).toEqual({
      certifications: {
        source_note: 'preserved',
        mode: 'max',
        max: 'PG-13',
        constraint_mode: 'strict',
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

  it('sets and clears metadata-only signal overrides through the draft', () => {
    const selectedPresets = ref([{
      id: 9,
      preset_id: 9,
      name: 'Regional',
      customSignals: null,
    }])
    const draftState = usePolicyIntentDraft(selectedPresets)

    expect(draftState.setSignalMetadata({
      presetId: 9,
      signalType: 'language',
      metadata: { strict: true },
      baseMetadata: { strict: false },
    })).toBe(true)

    expect(selectedPresets.value[0].customSignals).toEqual({
      language: {
        strict: true,
      },
    })

    expect(draftState.setSignalMetadata({
      presetId: 9,
      signalType: 'language',
      metadata: { strict: false },
      baseMetadata: { strict: false },
    })).toBe(true)

    expect(selectedPresets.value[0].customSignals).toBeNull()
  })

  it('preserves signal values while clearing matching metadata overrides', () => {
    const selectedPresets = ref([{
      id: 10,
      preset_id: 10,
      name: 'Regional',
      customSignals: {
        language: {
          require_any: ['sv'],
          strict: true,
        },
      },
    }])
    const draftState = usePolicyIntentDraft(selectedPresets)

    expect(draftState.setSignalMetadata({
      presetId: 10,
      signalType: 'language',
      metadata: { strict: false },
      baseMetadata: { strict: false },
    })).toBe(true)

    expect(selectedPresets.value[0].customSignals).toEqual({
      language: {
        require_any: ['sv'],
      },
    })
  })

  it('marks and restores removed base signal markers through the draft', () => {
    const selectedPresets = ref([{
      id: 11,
      preset_id: 11,
      name: 'Comedy',
      customSignals: null,
    }])
    const draftState = usePolicyIntentDraft(selectedPresets)

    expect(draftState.setSignalRemoval({
      presetId: 11,
      signalType: 'genres',
      key: 'prefer',
      value: 'Comedy',
      removed: true,
    })).toBe(true)
    expect(draftState.setSignalRemoval({
      presetId: 11,
      signalType: 'genres',
      key: 'prefer',
      value: 'Comedy',
      removed: true,
    })).toBe(true)

    expect(selectedPresets.value[0].customSignals).toEqual({
      removed: {
        genres: {
          prefer: ['Comedy'],
        },
      },
    })

    expect(draftState.setSignalRemoval({
      presetId: 11,
      signalType: 'genres',
      key: 'prefer',
      value: 'Comedy',
      removed: false,
    })).toBe(true)

    expect(selectedPresets.value[0].customSignals).toBeNull()
  })

  it('returns false for invalid removed base signal commands', () => {
    const draftState = usePolicyIntentDraft(ref([]))

    expect(draftState.setSignalRemoval({
      presetId: 404,
      signalType: 'genres',
      key: 'prefer',
      value: 'Comedy',
      removed: true,
    })).toBe(false)
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
    expect(draftState.setSignalMetadata({
      presetId: 999,
      signalType: 'language',
      metadata: { strict: true },
      baseMetadata: { strict: false },
    })).toBe(false)
    expect(draftState.clearSignalConfig({
      presetId: 999,
      signalType: 'genres',
    })).toBe(false)
  })
})
