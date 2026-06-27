/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'
import {
  POLICY_INTENT_EDITOR_SECTION_DEFINITIONS,
  buildDraftClearCommandForIntentSection,
  buildDraftCommandForIntentSection,
  buildPolicyIntentEditorSections,
} from '@/utils/policyIntentEditorSections'

describe('policyIntentEditorSections', () => {
  it('defines the five operator-facing intent sections in order', () => {
    expect(POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.map(section => section.key)).toEqual([
      POLICY_INTENT_BUCKETS.IDENTITY,
      POLICY_INTENT_BUCKETS.COMPATIBILITY,
      POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
      POLICY_INTENT_BUCKETS.BOOSTERS,
      POLICY_INTENT_BUCKETS.EXCLUSIONS,
    ])
    expect(POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.map(section => section.label)).toEqual([
      'Belongs Here',
      'Helpful Matches',
      'Hard Limits',
      'Boosts',
      'Avoid',
    ])
  })

  it('projects intent view entries and available options into render sections', () => {
    const sections = buildPolicyIntentEditorSections({
      [POLICY_INTENT_BUCKETS.IDENTITY]: [{ signal_type: 'genres' }],
      [POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]: [{ signal_type: 'certifications' }],
    }, {
      availableGenres: ['Family'],
      availableRatings: ['PG-13'],
    })

    expect(sections.find(section => section.key === POLICY_INTENT_BUCKETS.IDENTITY)).toMatchObject({
      label: 'Belongs Here',
      entries: [{ signal_type: 'genres' }],
      options: ['Family'],
      hasClearAction: false,
    })
    expect(sections.find(section => section.key === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS)).toMatchObject({
      label: 'Hard Limits',
      entries: [{ signal_type: 'certifications' }],
      options: ['PG-13'],
      hasClearAction: true,
    })
  })

  it('builds allow-listed draft add commands for identity, compatibility, and boosters', () => {
    expect(buildDraftCommandForIntentSection(POLICY_INTENT_BUCKETS.IDENTITY, {
      presetId: 7,
      value: 'Family',
    })).toEqual({
      eventName: 'draft-add-signal',
      payload: {
        presetId: 7,
        signalType: 'genres',
        key: 'require_any',
        value: 'Family',
        extras: { semantics: 'identity' },
      },
    })

    expect(buildDraftCommandForIntentSection(POLICY_INTENT_BUCKETS.COMPATIBILITY, {
      presetId: 7,
      value: 'Comedy',
    }).payload.extras).toEqual({ semantics: 'compatibility' })

    expect(buildDraftCommandForIntentSection(POLICY_INTENT_BUCKETS.BOOSTERS, {
      presetId: 7,
      value: 'Adventure',
    }).payload).toMatchObject({
      signalType: 'genres',
      key: 'prefer',
      value: 'Adventure',
    })
  })

  it('builds allow-listed certification commands and rejects incomplete commands', () => {
    expect(buildDraftCommandForIntentSection(POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS, {
      presetId: 7,
      value: 'PG-13',
    })).toEqual({
      eventName: 'draft-set-signal-config',
      payload: {
        presetId: 7,
        signalType: 'certifications',
        config: {
          mode: 'max',
          max: 'PG-13',
          constraint_mode: 'strict',
        },
      },
    })

    expect(buildDraftCommandForIntentSection(POLICY_INTENT_BUCKETS.EXCLUSIONS, {
      presetId: 7,
      value: 'R',
    })).toEqual({
      eventName: 'draft-set-signal-config',
      payload: {
        presetId: 7,
        signalType: 'certifications',
        config: {
          mode: 'exclude',
          exclude: ['R'],
        },
        appendArrays: true,
      },
    })

    expect(buildDraftCommandForIntentSection(POLICY_INTENT_BUCKETS.IDENTITY, {
      presetId: null,
      value: 'Family',
    })).toBeNull()
    expect(buildDraftCommandForIntentSection('unknown', {
      presetId: 7,
      value: 'Family',
    })).toBeNull()
  })

  it('builds clear commands only for sections that support clearing', () => {
    expect(buildDraftClearCommandForIntentSection(POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS, {
      presetId: 7,
    })).toEqual({
      eventName: 'draft-clear-signal-config',
      payload: {
        presetId: 7,
        signalType: 'certifications',
      },
    })

    expect(buildDraftClearCommandForIntentSection(POLICY_INTENT_BUCKETS.IDENTITY, {
      presetId: 7,
    })).toBeNull()
  })
})
