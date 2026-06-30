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
  normalizePolicyFormField,
  pickPolicySaveFormFields,
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
    const intentDraft = {
      schema_version: 1,
      source: 'policy_builder',
      migration_state: 'native_draft',
      presets: [],
      summary: {
        preset_count: 0,
        populated_buckets: [],
        warning_count: 0,
      },
    }

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
      { id: 9, name: 'Family Movies' },
      intentDraft
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
    expect(payload.policyIntentDraft).toEqual(intentDraft)
    expect(payload.policyIntentDraft).not.toBe(intentDraft)
  })

  it('keeps UI-only and read-only projection fields out of save payload serialization', () => {
    const pollutedForm = {
      ...createDefaultPolicyForm(9),
      name: 'Family Policy',
      expandedPresetIds: new Set([4]),
      libraryProfile: { genres: ['Family'] },
      impactPreview: { status: 'ready' },
      replayPreview: { status: 'ready' },
      readinessProjection: { ready: true },
      policyIntentView: { sections: [] },
      rawLegacyPayload: { customSignals: {} },
    }

    const formPayload = pickPolicySaveFormFields(pollutedForm)
    const payload = buildPolicySavePayload(
      pollutedForm,
      [{ id: 4, preset_id: 4, name: 'Family', weight: 1 }],
      { id: 9, name: 'Family Movies' },
      null
    )

    expect(formPayload).toEqual({
      ...createDefaultPolicyForm(9),
      name: 'Family Policy',
    })
    expect(payload).toMatchObject({
      library_id: 9,
      name: 'Family Policy',
      presets: [{
        preset_id: 4,
        weight: 1,
        customSignals: null,
      }],
    })
    expect(payload).not.toHaveProperty('expandedPresetIds')
    expect(payload).not.toHaveProperty('libraryProfile')
    expect(payload).not.toHaveProperty('impactPreview')
    expect(payload).not.toHaveProperty('replayPreview')
    expect(payload).not.toHaveProperty('readinessProjection')
    expect(payload).not.toHaveProperty('policyIntentView')
    expect(payload).not.toHaveProperty('rawLegacyPayload')
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
    expect(payload.policyIntentDraft).toMatchObject({
      schema_version: 1,
      source: 'legacy_policy_builder',
      migration_state: 'legacy_compatible',
      summary: {
        preset_count: 1,
      },
    })
    expect(payload.policyIntentDraft.presets).toHaveLength(1)
    expect(payload.policyIntentDraft.presets[0]).toMatchObject({
      preset_id: 8,
    })
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
        mode: 'max',
        max: 'PG-13',
        constraint_mode: 'strict',
      },
    })

    state.removeIntentSignalValue({
      presetId: 5,
      signalType: 'genres',
      key: 'require_any',
      value: 'Family',
    })

    expect(state.buildSavePayload().presets[0].customSignals).toEqual({
      certifications: {
        mode: 'max',
        max: 'PG-13',
        constraint_mode: 'strict',
      },
    })

    state.addIntentSignal({
      presetId: 5,
      signalType: 'genres',
      key: 'require_any',
      value: 'Family',
      extras: { semantics: 'identity' },
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

  it('applies custom signal additions and removals through the intent draft state boundary', async () => {
    const state = usePolicyBuilderState({
      policy: ref({
        library_id: 14,
        name: 'Family Policy',
        presets: [{
          id: 8,
          name: 'Starter',
          weight: 1,
        }],
      }),
      libraryId: ref(14),
      libraries: ref([{ id: 14, name: 'Family' }]),
    })

    await nextTick()

    expect(state.addCustomSignal({
      presetId: 8,
      signalType: 'keywords',
      key: 'require_any',
      value: 'space opera',
    })).toBe(true)
    expect(state.buildSavePayload().presets[0].customSignals).toEqual({
      keywords: {
        require_any: ['space opera'],
      },
    })

    expect(state.removeCustomSignal({
      presetId: 8,
      signalType: 'keywords',
      key: 'require_any',
      value: 'space opera',
    })).toBe(true)
    expect(state.buildSavePayload().presets[0].customSignals).toBeNull()
  })

  it('updates selected starter-template weights through bounded state commands', async () => {
    const state = usePolicyBuilderState({
      policy: ref({
        library_id: 14,
        name: 'Family Policy',
        presets: [{
          id: 9,
          name: 'Starter',
          weight: 1,
        }],
      }),
      libraryId: ref(14),
      libraries: ref([{ id: 14, name: 'Family' }]),
    })

    await nextTick()

    expect(state.setPresetWeight({ presetId: 9, weight: 1.5 })).toBe(true)
    expect(state.buildSavePayload().presets[0].weight).toBe(1.5)

    expect(state.setPresetWeight({ presetId: 9, weight: 99 })).toBe(true)
    expect(state.buildSavePayload().presets[0].weight).toBe(2)

    expect(state.setPresetWeight({ presetId: 404, weight: 1 })).toBe(false)
    expect(state.setPresetWeight({ presetId: 9, weight: 'bad' })).toBe(false)
  })

  it('normalizes advanced policy form field updates through bounded state commands', async () => {
    const state = usePolicyBuilderState({
      policy: ref({
        library_id: 14,
        name: 'Family Policy',
        presets: [],
      }),
      libraryId: ref(14),
      libraries: ref([{ id: 14, name: 'Family' }]),
    })

    await nextTick()

    expect(normalizePolicyFormField('preset_weight', 1.25)).toBe(1)
    expect(normalizePolicyFormField('auto_classify_threshold', 49)).toBe(50)
    expect(normalizePolicyFormField('prompt_threshold', 99)).toBe(80)
    expect(normalizePolicyFormField('combination_mode', 'require_all')).toBe('require_all')
    expect(normalizePolicyFormField('combination_mode', 'unsafe')).toBeNull()
    expect(normalizePolicyFormField('unknown_field', 1)).toBeNull()

    expect(state.setFormField({ field: 'preset_weight', value: 0.4 })).toBe(true)
    expect(state.form.value.preset_weight).toBe(0.4)

    expect(state.setFormField({ field: 'prompt_threshold', value: 99 })).toBe(true)
    expect(state.form.value.prompt_threshold).toBe(80)

    expect(state.setFormField({ field: 'combination_mode', value: 'average' })).toBe(true)
    expect(state.form.value.combination_mode).toBe('average')

    expect(state.setFormField({ field: 'combination_mode', value: 'unsafe' })).toBe(false)
    expect(state.form.value.combination_mode).toBe('average')
  })
})
