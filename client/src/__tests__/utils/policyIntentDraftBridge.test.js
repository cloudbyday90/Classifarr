/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest'
import {
  POLICY_INTENT_DRAFT_SCHEMA_VERSION,
  applyPolicyIntentDraftToSelectedPresets,
  buildPolicyIntentDraft,
} from '../../utils/policyIntentDraftBridge'
import { POLICY_INTENT_BUCKETS } from '../../utils/policyIntentModel'

describe('policyIntentDraftBridge', () => {
  it('builds an empty legacy-compatible draft for empty selections', () => {
    const draft = buildPolicyIntentDraft([])

    expect(draft).toEqual({
      schema_version: POLICY_INTENT_DRAFT_SCHEMA_VERSION,
      source: 'legacy_policy_builder',
      migration_state: 'legacy_compatible',
      presets: [],
      summary: {
        preset_count: 0,
        counts: {
          [POLICY_INTENT_BUCKETS.IDENTITY]: 0,
          [POLICY_INTENT_BUCKETS.COMPATIBILITY]: 0,
          [POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]: 0,
          [POLICY_INTENT_BUCKETS.BOOSTERS]: 0,
          [POLICY_INTENT_BUCKETS.EXCLUSIONS]: 0,
        },
      },
    })
  })

  it('projects legacy custom signals into editable intent buckets', () => {
    const draft = buildPolicyIntentDraft([{
      id: 14,
      preset_id: 14,
      name: 'Family',
      weight: 0.9,
      runtimeSemantics: { intent: 'family' },
      customSignals: {
        genres: {
          require_any: ['Family'],
          prefer: ['Animation'],
          semantics: 'identity',
        },
        keywords: {
          require_any: ['coming of age'],
          semantics: 'compatibility',
        },
        certifications: {
          mode: 'max',
          max: 'PG-13',
          constraint_mode: 'strict',
        },
        ratings: {
          exclude: ['R'],
        },
      },
    }])

    expect(draft.presets[0]).toEqual(expect.objectContaining({
      preset_id: 14,
      preset_name: 'Family',
      weight: 0.9,
      source: 'legacy_preset',
      migration_state: 'legacy_compatible',
      runtimeSemantics: { intent: 'family' },
    }))
    expect(draft.presets[0].buckets[POLICY_INTENT_BUCKETS.IDENTITY]).toEqual([
      expect.objectContaining({
        signal_type: 'genres',
        values: { require_any: ['Family'] },
        metadata: { semantics: 'identity' },
      }),
    ])
    expect(draft.presets[0].buckets[POLICY_INTENT_BUCKETS.COMPATIBILITY]).toEqual([
      expect.objectContaining({
        signal_type: 'keywords',
        values: { require_any: ['coming of age'] },
        metadata: { semantics: 'compatibility' },
      }),
    ])
    expect(draft.presets[0].buckets[POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]).toEqual([
      expect.objectContaining({
        signal_type: 'certifications',
        values: { mode: 'max', max: 'PG-13' },
        metadata: { constraint_mode: 'strict' },
      }),
    ])
    expect(draft.presets[0].buckets[POLICY_INTENT_BUCKETS.BOOSTERS]).toEqual([
      expect.objectContaining({
        signal_type: 'genres',
        values: { prefer: ['Animation'] },
      }),
    ])
    expect(draft.presets[0].buckets[POLICY_INTENT_BUCKETS.EXCLUSIONS]).toEqual([
      expect.objectContaining({
        signal_type: 'ratings',
        values: { exclude: ['R'] },
      }),
    ])
    expect(draft.summary.counts[POLICY_INTENT_BUCKETS.IDENTITY]).toBe(1)
  })

  it('round-trips a no-op draft back to the legacy selected preset shape', () => {
    const selectedPresets = [{
      id: 7,
      preset_id: 7,
      name: 'Movies',
      weight: 1,
      customSignals: {
        genres: {
          require_any: ['Drama'],
          prefer: ['Comedy'],
          semantics: 'identity',
          source_note: 'keep me',
        },
        removed: {
          genres: {
            prefer: ['Horror'],
          },
        },
      },
    }]
    const draft = buildPolicyIntentDraft(selectedPresets)

    expect(applyPolicyIntentDraftToSelectedPresets(selectedPresets, draft)).toEqual(selectedPresets)
  })

  it('projects and round-trips removed base signal markers through the draft', () => {
    const selectedPresets = [{
      id: 11,
      preset_id: 11,
      name: 'Comedy',
      customSignals: {
        removed: {
          genres: {
            prefer: ['Comedy'],
          },
        },
      },
    }]

    const draft = buildPolicyIntentDraft(selectedPresets)

    expect(draft.presets[0].signalRemovalOverrides).toEqual({
      genres: {
        prefer: ['Comedy'],
      },
    })
    expect(applyPolicyIntentDraftToSelectedPresets(selectedPresets, draft)).toEqual(selectedPresets)
  })

  it('cleans empty removed base signal markers during draft serialization', () => {
    const selectedPresets = [{
      id: 12,
      preset_id: 12,
      name: 'Comedy',
      customSignals: {
        removed: {
          genres: {
            prefer: ['Comedy'],
          },
        },
      },
    }]
    const draft = buildPolicyIntentDraft(selectedPresets)

    draft.presets[0].signalRemovalOverrides.genres.prefer = []

    expect(applyPolicyIntentDraftToSelectedPresets(selectedPresets, draft)[0].customSignals).toBeNull()
  })

  it('round-trips metadata-only signal overrides through the draft', () => {
    const selectedPresets = [{
      id: 12,
      preset_id: 12,
      name: 'Regional',
      customSignals: {
        language: {
          strict: true,
        },
      },
    }]

    const draft = buildPolicyIntentDraft(selectedPresets)

    expect(draft.presets[0].signalMetadataOverrides).toEqual({
      language: {
        strict: true,
      },
    })
    expect(applyPolicyIntentDraftToSelectedPresets(selectedPresets, draft)).toEqual(selectedPresets)
  })

  it('clears metadata-only signal overrides without dropping unsupported fields', () => {
    const selectedPresets = [{
      id: 13,
      preset_id: 13,
      name: 'Regional',
      customSignals: {
        language: {
          strict: true,
          source_note: 'keep',
        },
      },
    }]
    const draft = buildPolicyIntentDraft(selectedPresets)

    delete draft.presets[0].signalMetadataOverrides.language
    draft.presets[0].cleared_signal_types = ['language']

    expect(applyPolicyIntentDraftToSelectedPresets(selectedPresets, draft)[0].customSignals).toEqual({
      language: {
        source_note: 'keep',
      },
    })
  })

  it('serializes allow-listed draft edits without dropping unsupported legacy fields', () => {
    const selectedPresets = [{
      id: 8,
      preset_id: 8,
      name: 'Animated Movies',
      customSignals: {
        genres: {
          require_any: ['Animation'],
          semantics: 'identity',
          source_note: 'preserved',
        },
        custom_score: {
          enabled: true,
        },
      },
    }]
    const draft = buildPolicyIntentDraft(selectedPresets)
    draft.presets[0].buckets[POLICY_INTENT_BUCKETS.IDENTITY][0].values.require_any.push('Family')
    draft.presets[0].buckets[POLICY_INTENT_BUCKETS.BOOSTERS].push({
      bucket: POLICY_INTENT_BUCKETS.BOOSTERS,
      signal_type: 'keywords',
      values: { prefer: ['disney'] },
      metadata: {},
      source: 'intent_draft',
    })

    const result = applyPolicyIntentDraftToSelectedPresets(selectedPresets, draft)

    expect(result[0].customSignals).toEqual({
      genres: {
        source_note: 'preserved',
        require_any: ['Animation', 'Family'],
        semantics: 'identity',
      },
      custom_score: {
        enabled: true,
      },
      keywords: {
        prefer: ['disney'],
      },
    })
  })

  it('does not mutate selected presets while applying a draft', () => {
    const selectedPresets = [{
      id: 3,
      preset_id: 3,
      name: 'Comedy',
      customSignals: {
        keywords: {
          require_any: ['stand-up'],
          semantics: 'identity',
        },
      },
    }]
    const original = JSON.parse(JSON.stringify(selectedPresets))
    const draft = buildPolicyIntentDraft(selectedPresets)
    draft.presets[0].buckets[POLICY_INTENT_BUCKETS.IDENTITY][0].values.require_any.push('special')

    applyPolicyIntentDraftToSelectedPresets(selectedPresets, draft)

    expect(selectedPresets).toEqual(original)
  })
})
