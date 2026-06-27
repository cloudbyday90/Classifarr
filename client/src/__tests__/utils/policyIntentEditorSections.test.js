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
  buildDraftRemoveCommandForIntentEntry,
  buildPolicyIntentEditorSections,
  formatPolicyIntentEntryForSection,
  summarizePolicyIntentSection,
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
      options: ['Family'],
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

  it('summarizes projected section behavior with operator-facing language', () => {
    expect(summarizePolicyIntentSection(POLICY_INTENT_BUCKETS.COMPATIBILITY, [
      { displayText: 'Helpful match: Comedy' },
      { displayText: 'Helpful match: Romance' },
    ])).toBe('Comedy, Romance can support a match, but should not decide alone.')

    expect(summarizePolicyIntentSection(POLICY_INTENT_BUCKETS.BOOSTERS, [
      { displayText: 'Confidence boost: Adventure' },
    ])).toBe('Adventure can raise confidence after the item already fits.')

    expect(summarizePolicyIntentSection(POLICY_INTENT_BUCKETS.EXCLUSIONS, [
      { displayText: 'Avoid rating: R' },
    ])).toBe('R should count against this destination.')

    expect(summarizePolicyIntentSection(POLICY_INTENT_BUCKETS.IDENTITY, [])).toBe('')
  })

  it('formats intent entries with operator-facing labels', () => {
    expect(formatPolicyIntentEntryForSection(POLICY_INTENT_BUCKETS.IDENTITY, {
      signal_type: 'genres',
      values: { require_any: ['Family'] },
    })).toBe('Belongs here: Family')

    expect(formatPolicyIntentEntryForSection(POLICY_INTENT_BUCKETS.COMPATIBILITY, {
      signal_type: 'genres',
      values: { require_any: ['Comedy'] },
    })).toBe('Helpful match: Comedy')

    expect(formatPolicyIntentEntryForSection(POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS, {
      signal_type: 'certifications',
      values: { mode: 'max', max: 'PG-13' },
    })).toBe('Maximum rating: PG-13')

    expect(formatPolicyIntentEntryForSection(POLICY_INTENT_BUCKETS.BOOSTERS, {
      signal_type: 'genres',
      values: { prefer: ['Adventure'] },
    })).toBe('Confidence boost: Adventure')

    expect(formatPolicyIntentEntryForSection(POLICY_INTENT_BUCKETS.EXCLUSIONS, {
      signal_type: 'certifications',
      values: { exclude: ['R'] },
    })).toBe('Avoid rating: R')
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

  it('builds allow-listed remove commands for draft-managed intent chips', () => {
    expect(buildDraftRemoveCommandForIntentEntry(POLICY_INTENT_BUCKETS.IDENTITY, {
      presetId: 99,
      entry: {
        preset_id: 7,
        signal_type: 'genres',
        values: { require_any: ['Family'] },
      },
    })).toEqual({
      eventName: 'draft-remove-signal-value',
      payload: {
        presetId: 7,
        signalType: 'genres',
        key: 'require_any',
        value: 'Family',
      },
    })

    expect(buildDraftRemoveCommandForIntentEntry(POLICY_INTENT_BUCKETS.BOOSTERS, {
      presetId: 7,
      entry: {
        signal_type: 'genres',
        values: { prefer: ['Adventure'] },
      },
    })).toEqual({
      eventName: 'draft-remove-signal-value',
      payload: {
        presetId: 7,
        signalType: 'genres',
        key: 'prefer',
        value: 'Adventure',
      },
    })

    expect(buildDraftRemoveCommandForIntentEntry(POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS, {
      presetId: 7,
      entry: {
        signal_type: 'certifications',
        values: { mode: 'max', max: 'PG-13' },
      },
    })).toEqual({
      eventName: 'draft-clear-signal-config',
      payload: {
        presetId: 7,
        signalType: 'certifications',
      },
    })

    expect(buildDraftRemoveCommandForIntentEntry(POLICY_INTENT_BUCKETS.EXCLUSIONS, {
      presetId: 7,
      entry: {
        signal_type: 'certifications',
        values: { mode: 'exclude', exclude: ['R'] },
      },
    })).toEqual({
      eventName: 'draft-remove-signal-value',
      payload: {
        presetId: 7,
        signalType: 'certifications',
        key: 'exclude',
        value: 'R',
      },
    })
  })
})
