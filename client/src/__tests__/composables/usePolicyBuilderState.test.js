/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  buildPolicySavePayload,
  createDefaultPolicyForm,
  mapPolicyPresets,
  mapPolicyToForm,
  usePolicyBuilderState,
} from '@/composables/usePolicyBuilderState'

describe('usePolicyBuilderState composable', () => {
  it('creates default form state for a target library', () => {
    const form = createDefaultPolicyForm(42)

    expect(form).toMatchObject({
      library_id: 42,
      enabled: true,
      priority: 5,
      auto_classify_threshold: 85,
      prompt_threshold: 60,
      require_ai_validation: true,
      combination_mode: 'best_match',
    })
    expect(
      form.preset_weight + form.profile_weight + form.pattern_weight +
      form.rag_weight + form.history_weight
    ).toBeCloseTo(1)
  })

  it('maps policy form and attached presets without dropping legacy custom signals', () => {
    const policy = {
      library_id: 7,
      name: 'Regional Policy',
      description: null,
      enabled: false,
      priority: 9,
      preset_weight: 0.4,
      profile_weight: 0.2,
      pattern_weight: 0.1,
      rag_weight: 0.2,
      history_weight: 0.1,
      presets: [{
        id: 3,
        preset_id: 3,
        name: 'Scandinavian',
        icon: 'SE',
        weight: 1.2,
        custom_signals: {
          language: {
            require_any: ['sv'],
            strict: true,
          },
        },
        runtime_semantics: {
          language: 'strict',
        },
      }],
    }

    expect(mapPolicyToForm(policy)).toMatchObject({
      library_id: 7,
      name: 'Regional Policy',
      description: '',
      enabled: false,
      priority: 9,
      preset_weight: 0.4,
      profile_weight: 0.2,
    })

    expect(mapPolicyPresets(policy)).toEqual([{
      id: 3,
      preset_id: 3,
      name: 'Scandinavian',
      icon: 'SE',
      weight: 1.2,
      customSignals: {
        language: {
          require_any: ['sv'],
          strict: true,
        },
      },
      runtimeSemantics: {
        language: 'strict',
      },
    }])
  })

  it('builds the legacy-compatible save payload with generated name and description', () => {
    const payload = buildPolicySavePayload(
      createDefaultPolicyForm(9),
      [{
        id: 4,
        preset_id: 4,
        name: 'Family',
        weight: 0.75,
        customSignals: {
          certifications: {
            max: 'PG-13',
            constraint_mode: 'strict',
          },
        },
      }],
      { id: 9, name: 'Family Movies' }
    )

    expect(payload).toMatchObject({
      library_id: 9,
      name: 'Family Movies Policy',
      description: 'Policy for Family',
    })
    expect(payload.presets).toEqual([{
      preset_id: 4,
      weight: 0.75,
      customSignals: {
        certifications: {
          max: 'PG-13',
          constraint_mode: 'strict',
        },
      },
    }])
  })

  it('round-trips a legacy preset-backed policy through state and save payloads', async () => {
    const policy = ref({
      library_id: 20,
      name: 'TV Shows Policy',
      description: 'Keep existing policy shape',
      presets: [{
        id: 8,
        preset_id: 8,
        name: 'Comedy',
        weight: 1,
        custom_signals: {
          genres: {
            prefer: ['Comedy'],
          },
          ratings: {
            exclude: ['TV-MA'],
          },
        },
      }],
    })

    const state = usePolicyBuilderState({
      policy,
      libraryId: ref(20),
      libraries: ref([{ id: 20, name: 'TV Shows' }]),
    })

    await nextTick()

    expect(state.selectedPresets.value).toHaveLength(1)
    expect(state.selectedPresets.value[0].customSignals).toEqual({
      genres: {
        prefer: ['Comedy'],
      },
      ratings: {
        exclude: ['TV-MA'],
      },
    })

    state.form.value.prompt_threshold = 70
    const payload = state.buildSavePayload()

    expect(payload).toMatchObject({
      library_id: 20,
      name: 'TV Shows Policy',
      description: 'Keep existing policy shape',
      prompt_threshold: 70,
    })
    expect(payload.presets).toEqual([{
      preset_id: 8,
      weight: 1,
      customSignals: {
        genres: {
          prefer: ['Comedy'],
        },
        ratings: {
          exclude: ['TV-MA'],
        },
      },
    }])
  })

  it('applies intent helper changes as structured custom signals', async () => {
    const state = usePolicyBuilderState({
      policy: ref({
        library_id: 14,
        name: 'Family Policy',
        presets: [{
          id: 5,
          name: 'Family',
          weight: 1,
        }],
      }),
      libraryId: ref(14),
      libraries: ref([{ id: 14, name: 'Family' }]),
    })

    await nextTick()

    state.addIntentSignal({
      presetId: 5,
      signalType: 'genres',
      key: 'require_any',
      value: 'Family',
      extras: { semantics: 'identity' },
    })
    state.setIntentSignalConfig({
      presetId: 5,
      signalType: 'certifications',
      config: {
        max: 'PG-13',
        constraint_mode: 'strict',
      },
    })

    expect(state.buildSavePayload().presets[0].customSignals).toEqual({
      genres: {
        require_any: ['Family'],
        semantics: 'identity',
      },
      certifications: {
        max: 'PG-13',
        constraint_mode: 'strict',
      },
    })

    state.clearIntentSignalConfig({
      presetId: 5,
      signalType: 'certifications',
    })

    expect(state.buildSavePayload().presets[0].customSignals).toEqual({
      genres: {
        require_any: ['Family'],
        semantics: 'identity',
      },
    })
  })

  it('applies signal metadata overrides through the intent draft state boundary', async () => {
    const state = usePolicyBuilderState({
      policy: ref({
        library_id: 14,
        name: 'Family Policy',
        presets: [{
          id: 6,
          name: 'Regional',
          weight: 1,
          custom_signals: {
            language: {
              strict: true,
            },
          },
        }],
      }),
      libraryId: ref(14),
      libraries: ref([{ id: 14, name: 'Family' }]),
    })

    await nextTick()

    state.setIntentSignalMetadata({
      presetId: 6,
      signalType: 'language',
      metadata: { strict: false },
      baseMetadata: { strict: false },
    })

    expect(state.buildSavePayload().presets[0].customSignals).toBeNull()
  })

  it('applies removed base signal markers through the intent draft state boundary', async () => {
    const state = usePolicyBuilderState({
      policy: ref({
        library_id: 14,
        name: 'Family Policy',
        presets: [{
          id: 7,
          name: 'Comedy',
          weight: 1,
        }],
      }),
      libraryId: ref(14),
      libraries: ref([{ id: 14, name: 'Family' }]),
    })

    await nextTick()

    state.setIntentSignalRemoval({
      presetId: 7,
      signalType: 'genres',
      key: 'prefer',
      value: 'Comedy',
      removed: true,
    })

    expect(state.buildSavePayload().presets[0].customSignals).toEqual({
      removed: {
        genres: {
          prefer: ['Comedy'],
        },
      },
    })

    state.setIntentSignalRemoval({
      presetId: 7,
      signalType: 'genres',
      key: 'prefer',
      value: 'Comedy',
      removed: false,
    })

    expect(state.buildSavePayload().presets[0].customSignals).toBeNull()
  })
})
