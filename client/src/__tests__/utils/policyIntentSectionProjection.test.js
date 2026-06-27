/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  POLICY_INTENT_EDITOR_SECTION_DEFINITIONS,
} from '@/utils/policyIntentEditorSections'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'
import {
  buildPolicyIntentControlReadiness,
  buildPolicyIntentOptionDiagnostics,
  buildPolicyIntentOptionStates,
  buildDraftClearCommandForIntentSectionDefinition,
  buildDraftCommandForIntentSectionDefinition,
  buildDraftRemoveCommandForIntentEntry,
  formatPolicyIntentEntryForSection,
  projectPolicyIntentEntriesForSection,
  resolvePolicyIntentOptionStates,
  summarizePolicyIntentSection,
  validatePolicyIntentOptionSelection,
} from '@/utils/policyIntentSectionProjection'

function sectionDefinition(sectionKey) {
  return POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.find(section => section.key === sectionKey)
}

describe('policyIntentSectionProjection', () => {
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

  it('projects array-backed section entries into removable display entries', () => {
    expect(projectPolicyIntentEntriesForSection(
      sectionDefinition(POLICY_INTENT_BUCKETS.EXCLUSIONS),
      [{
        preset_id: 7,
        signal_type: 'certifications',
        values: { mode: 'exclude', exclude: ['R', 'NC-17'] },
      }],
    )).toMatchObject([
      {
        preset_id: 7,
        displayText: 'Avoid rating: R',
        canRemove: true,
        removeLabel: 'Remove Avoid rating: R',
      },
      {
        preset_id: 7,
        displayText: 'Avoid rating: NC-17',
        canRemove: true,
        removeLabel: 'Remove Avoid rating: NC-17',
      },
    ])
  })

  it('marks already configured options unavailable with deterministic reasons', () => {
    const entries = projectPolicyIntentEntriesForSection(
      sectionDefinition(POLICY_INTENT_BUCKETS.EXCLUSIONS),
      [{
        preset_id: 7,
        signal_type: 'certifications',
        values: { mode: 'exclude', exclude: ['R'] },
      }],
    )

    expect(buildPolicyIntentOptionStates(POLICY_INTENT_BUCKETS.EXCLUSIONS, ['PG-13', 'R', 'R'], entries)).toEqual([
      {
        value: 'PG-13',
        label: 'PG-13',
        disabled: false,
        reason: '',
      },
      {
        value: 'R',
        label: 'R',
        disabled: true,
        reason: 'R is already configured as an avoid rating.',
      },
    ])
  })

  it('builds section option diagnostics for missing, limited, and exhausted choices', () => {
    expect(buildPolicyIntentOptionDiagnostics(POLICY_INTENT_BUCKETS.IDENTITY, [])).toEqual({
      status: 'missing_reference_options',
      tone: 'info',
      optionKind: 'genre',
      optionCount: 0,
      enabledCount: 0,
      disabledCount: 0,
      message: 'No genre options are available yet. Sync or attach presets with genre signals before adding this intent value.',
    })

    expect(buildPolicyIntentOptionDiagnostics(POLICY_INTENT_BUCKETS.EXCLUSIONS, [
      {
        value: 'PG-13',
        label: 'PG-13',
        disabled: false,
        reason: '',
      },
      {
        value: 'R',
        label: 'R',
        disabled: true,
        reason: 'R is already configured as an avoid rating.',
      },
    ])).toEqual({
      status: 'limited',
      tone: 'neutral',
      optionKind: 'rating',
      optionCount: 2,
      enabledCount: 1,
      disabledCount: 1,
      message: '1 already configured value is disabled; 1 choice remains available.',
    })

    expect(buildPolicyIntentOptionDiagnostics(POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS, [
      {
        value: 'PG-13',
        label: 'PG-13',
        disabled: true,
        reason: 'PG-13 is already set as the maximum rating.',
      },
    ])).toMatchObject({
      status: 'all_configured',
      optionKind: 'rating',
      enabledCount: 0,
      disabledCount: 1,
      message: 'The available max rating is already configured.',
    })
  })

  it('resolves structured option states with fallback raw option support', () => {
    const structuredStates = [{
      value: 'Family',
      label: 'Family',
      disabled: true,
      reason: 'Family is already configured as a belongs-here genre.',
    }]

    expect(resolvePolicyIntentOptionStates({
      optionStates: structuredStates,
      options: ['Comedy'],
    })).toBe(structuredStates)

    expect(resolvePolicyIntentOptionStates({
      options: ['Family', '', null, 'Comedy'],
    })).toEqual([
      {
        value: 'Family',
        label: 'Family',
        disabled: false,
        reason: '',
      },
      {
        value: 'Comedy',
        label: 'Comedy',
        disabled: false,
        reason: '',
      },
    ])
  })

  it('builds deterministic control readiness for missing, disabled, and valid selections', () => {
    expect(buildPolicyIntentControlReadiness(POLICY_INTENT_BUCKETS.IDENTITY, {
      selectedValue: '',
      optionStates: [{
        value: 'Family',
        label: 'Family',
        disabled: false,
        reason: '',
      }],
      optionDiagnostics: {
        status: 'available',
        optionKind: 'genre',
      },
    })).toEqual({
      canSubmit: false,
      status: 'missing_selection',
      reason: 'Choose a belongs-here genre before applying this edit.',
    })

    expect(buildPolicyIntentControlReadiness(POLICY_INTENT_BUCKETS.EXCLUSIONS, {
      selectedValue: 'R',
      optionStates: [{
        value: 'R',
        label: 'R',
        disabled: true,
        reason: 'R is already configured as an avoid rating.',
      }],
      optionDiagnostics: {
        status: 'all_configured',
        optionKind: 'rating',
        message: 'All available avoid ratings are already configured in this section.',
      },
    })).toEqual({
      canSubmit: false,
      status: 'all_configured',
      reason: 'All available avoid ratings are already configured in this section.',
    })

    expect(buildPolicyIntentControlReadiness(POLICY_INTENT_BUCKETS.BOOSTERS, {
      selectedValue: 'Adventure',
      optionStates: [{
        value: 'Adventure',
        label: 'Adventure',
        disabled: false,
        reason: '',
      }],
      optionDiagnostics: {
        status: 'available',
        optionKind: 'genre',
      },
    })).toEqual({
      canSubmit: true,
      status: 'ready',
      reason: '',
    })
  })

  it('validates duplicate section option selections before command emission', () => {
    const currentEntries = [{
      signal_type: 'genres',
      values: { require_any: ['Family'] },
    }]

    expect(validatePolicyIntentOptionSelection(POLICY_INTENT_BUCKETS.IDENTITY, {
      value: 'Family',
      entries: currentEntries,
    })).toEqual({
      allowed: false,
      code: 'duplicate_value',
      reason: 'Family is already configured as a belongs-here genre.',
    })

    expect(validatePolicyIntentOptionSelection(POLICY_INTENT_BUCKETS.IDENTITY, {
      value: 'Animation',
      entries: currentEntries,
    })).toEqual({
      allowed: true,
      code: 'allowed',
      reason: '',
    })
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

  it('builds allow-listed draft add commands from section definitions', () => {
    expect(buildDraftCommandForIntentSectionDefinition(sectionDefinition(POLICY_INTENT_BUCKETS.IDENTITY), {
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

    expect(buildDraftCommandForIntentSectionDefinition(sectionDefinition(POLICY_INTENT_BUCKETS.COMPATIBILITY), {
      presetId: 7,
      value: 'Comedy',
    }).payload.extras).toEqual({ semantics: 'compatibility' })

    expect(buildDraftCommandForIntentSectionDefinition(sectionDefinition(POLICY_INTENT_BUCKETS.BOOSTERS), {
      presetId: 7,
      value: 'Adventure',
    }).payload).toMatchObject({
      signalType: 'genres',
      key: 'prefer',
      value: 'Adventure',
    })
  })

  it('builds allow-listed certification commands and rejects incomplete commands', () => {
    expect(buildDraftCommandForIntentSectionDefinition(sectionDefinition(POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS), {
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

    expect(buildDraftCommandForIntentSectionDefinition(sectionDefinition(POLICY_INTENT_BUCKETS.EXCLUSIONS), {
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

    expect(buildDraftCommandForIntentSectionDefinition(sectionDefinition(POLICY_INTENT_BUCKETS.IDENTITY), {
      presetId: null,
      value: 'Family',
    })).toBeNull()
    expect(buildDraftCommandForIntentSectionDefinition(sectionDefinition(POLICY_INTENT_BUCKETS.IDENTITY), {
      presetId: 7,
      value: 'Family',
      currentEntries: [{
        signal_type: 'genres',
        values: { require_any: ['Family'] },
      }],
    })).toBeNull()
    expect(buildDraftCommandForIntentSectionDefinition({}, {
      presetId: 7,
      value: 'Family',
    })).toBeNull()
  })

  it('builds clear commands only for definitions that support clearing', () => {
    expect(buildDraftClearCommandForIntentSectionDefinition(sectionDefinition(POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS), {
      presetId: 7,
    })).toEqual({
      eventName: 'draft-clear-signal-config',
      payload: {
        presetId: 7,
        signalType: 'certifications',
      },
    })

    expect(buildDraftClearCommandForIntentSectionDefinition(sectionDefinition(POLICY_INTENT_BUCKETS.IDENTITY), {
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
