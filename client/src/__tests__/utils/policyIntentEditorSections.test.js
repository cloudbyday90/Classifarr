/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'
import {
  POLICY_INTENT_EDITOR_SECTION_DEFINITIONS,
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
    expect(POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.map(section => section.actionLabel)).toEqual([
      'Add a belongs-here genre',
      'Add a helpful genre',
      'Set maximum allowed rating',
      'Add a confidence boost',
      'Add an avoid rating',
    ])
    expect(POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.map(section => section.controlKind)).toEqual([
      'genre_intent',
      'genre_intent',
      'certification',
      'genre_intent',
      'certification',
    ])
  })

  it('projects intent view entries and available options into render sections', () => {
    const sections = buildPolicyIntentEditorSections({
      [POLICY_INTENT_BUCKETS.IDENTITY]: [{ preset_id: 7, signal_type: 'genres', values: { require_any: ['Family'] } }],
      [POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]: [{ preset_id: 7, signal_type: 'certifications', values: { mode: 'max', max: 'PG-13' } }],
      [POLICY_INTENT_BUCKETS.EXCLUSIONS]: [{ preset_id: 7, signal_type: 'certifications', values: { mode: 'exclude', exclude: ['R', 'NC-17'] } }],
    }, {
      availableGenres: ['Family'],
      availableRatings: ['PG-13'],
    })

    expect(sections.find(section => section.key === POLICY_INTENT_BUCKETS.IDENTITY)).toMatchObject({
      label: 'Belongs Here',
      actionLabel: 'Add a belongs-here genre',
      actionHelp: 'Use this for identity evidence that should define the destination.',
      addLabel: 'Choose identity genre...',
      controlKind: 'genre_intent',
      entries: [{ preset_id: 7, signal_type: 'genres', values: { require_any: ['Family'] }, displayText: 'Belongs here: Family' }],
      behaviorSummary: 'This destination is defined by Family.',
      completion: {
        status: 'configured',
        tone: 'success',
        label: 'Configured',
        description: 'This section has configured intent signals.',
      },
      nextAction: 'Next: add helpful matches only if they support this identity without replacing it.',
      options: ['Family'],
      optionStates: [{
        value: 'Family',
        label: 'Family',
        disabled: true,
        reason: 'Family is already configured as a belongs-here genre.',
      }],
      optionDiagnostics: {
        status: 'all_configured',
        tone: 'neutral',
        optionKind: 'genre',
        optionCount: 1,
        enabledCount: 0,
        disabledCount: 1,
        message: 'All available genre options are already configured in this section.',
      },
      hasClearAction: false,
    })
    expect(sections.find(section => section.key === POLICY_INTENT_BUCKETS.IDENTITY).entries[0]).toMatchObject({
      canRemove: true,
      removeLabel: 'Remove Belongs here: Family',
    })
    expect(sections.find(section => section.key === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS)).toMatchObject({
      label: 'Hard Limits',
      controlKind: 'certification',
      entries: [{ preset_id: 7, signal_type: 'certifications', values: { mode: 'max', max: 'PG-13' }, displayText: 'Maximum rating: PG-13' }],
      behaviorSummary: 'Items must stay within PG-13.',
      options: ['PG-13'],
      hasClearAction: true,
    })
    expect(sections.find(section => section.key === POLICY_INTENT_BUCKETS.EXCLUSIONS).entries).toMatchObject([
      { displayText: 'Avoid rating: R', canRemove: true, removeLabel: 'Remove Avoid rating: R' },
      { displayText: 'Avoid rating: NC-17', canRemove: true, removeLabel: 'Remove Avoid rating: NC-17' },
    ])
  })

  it('preserves library-profile option metadata when building genre sections', () => {
    const sections = buildPolicyIntentEditorSections({}, {
      availableGenres: ['Fallback'],
      availableGenreOptions: [
        {
          value: 'Animation',
          label: 'Animation',
          source: 'library_profile',
          sourceLabel: 'Already in library',
          count: 45,
          detail: '45 items in this library',
        },
      ],
      availableRatings: [],
    })

    expect(sections.find(section => section.key === POLICY_INTENT_BUCKETS.IDENTITY).optionStates).toEqual([
      {
        value: 'Animation',
        label: 'Animation',
        source: 'library_profile',
        sourceLabel: 'Already in library',
        count: 45,
        detail: '45 items in this library',
        disabled: false,
        reason: '',
      },
    ])
  })

  it('preserves the public draft command wrapper for existing callers', () => {
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
    expect(buildDraftCommandForIntentSection(POLICY_INTENT_BUCKETS.IDENTITY, {
      presetId: null,
      value: 'Family',
    })).toBeNull()
    expect(buildDraftCommandForIntentSection('unknown', {
      presetId: 7,
      value: 'Family',
    })).toBeNull()
  })
})
