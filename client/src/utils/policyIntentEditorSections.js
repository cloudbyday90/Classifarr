/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { POLICY_INTENT_BUCKETS } from './policyIntentModel'
import {
  buildPolicyIntentReadinessSummary,
  buildPolicyIntentSectionCompletion,
  buildPolicyIntentSectionNextAction,
  buildPolicyIntentSectionWarnings,
} from './policyIntentSectionVisualState'
import {
  buildPolicyIntentControlReadiness,
  buildPolicyIntentOptionDiagnostics,
  buildPolicyIntentOptionStates,
  buildDraftClearCommandForIntentSectionDefinition,
  buildDraftCommandForIntentSectionDefinition,
  buildDraftRemoveCommandForIntentEntry,
  formatPolicyIntentEntryForSection,
  projectPolicyIntentEntriesForSection,
  summarizePolicyIntentSection,
} from './policyIntentSectionProjection'

export {
  buildPolicyIntentControlReadiness,
  buildPolicyIntentOptionDiagnostics,
  buildDraftRemoveCommandForIntentEntry,
  buildPolicyIntentOptionStates,
  buildPolicyIntentReadinessSummary,
  buildPolicyIntentSectionCompletion,
  buildPolicyIntentSectionNextAction,
  buildPolicyIntentSectionWarnings,
  formatPolicyIntentEntryForSection,
  summarizePolicyIntentSection,
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export const POLICY_INTENT_EDITOR_SECTION_DEFINITIONS = Object.freeze([
  {
    key: POLICY_INTENT_BUCKETS.IDENTITY,
    label: 'Belongs Here',
    help: 'Signals that define what this library is for.',
    optionSource: 'genres',
    controlKind: 'genre_intent',
    actionLabel: 'Add a belongs-here genre',
    actionHelp: 'Use this for identity evidence that should define the destination.',
    addLabel: 'Choose identity genre...',
    badgeClass: 'bg-green-900/30 text-green-300',
    command: {
      type: 'add_signal',
      signalType: 'genres',
      key: 'require_any',
      extras: { semantics: 'identity' },
    },
  },
  {
    key: POLICY_INTENT_BUCKETS.COMPATIBILITY,
    label: 'Helpful Matches',
    help: 'Signals that can help, but should not decide alone.',
    optionSource: 'genres',
    controlKind: 'genre_intent',
    actionLabel: 'Add a helpful genre',
    actionHelp: 'Use this for supporting evidence that should never decide by itself.',
    addLabel: 'Choose helpful genre...',
    badgeClass: 'bg-blue-900/30 text-blue-300',
    command: {
      type: 'add_signal',
      signalType: 'genres',
      key: 'require_any',
      extras: { semantics: 'compatibility' },
    },
  },
  {
    key: POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
    label: 'Hard Limits',
    help: 'Rules that can block a match, like rating limits.',
    optionSource: 'ratings',
    controlKind: 'certification',
    actionLabel: 'Set maximum allowed rating',
    actionHelp: 'Items above this rating should require review or be blocked by policy logic.',
    addLabel: 'Choose max rating...',
    badgeClass: 'bg-amber-900/30 text-amber-300',
    command: {
      type: 'set_certification_max',
      signalType: 'certifications',
    },
    clearCommand: {
      signalType: 'certifications',
    },
  },
  {
    key: POLICY_INTENT_BUCKETS.BOOSTERS,
    label: 'Boosts',
    help: 'Signals that raise confidence when other evidence already fits.',
    optionSource: 'genres',
    controlKind: 'genre_intent',
    actionLabel: 'Add a confidence boost',
    actionHelp: 'Use this only to increase confidence after the item already fits.',
    addLabel: 'Choose boost genre...',
    badgeClass: 'bg-purple-900/30 text-purple-300',
    command: {
      type: 'add_signal',
      signalType: 'genres',
      key: 'prefer',
      extras: {},
    },
  },
  {
    key: POLICY_INTENT_BUCKETS.EXCLUSIONS,
    label: 'Avoid',
    help: 'Signals that lower confidence or keep this library from matching.',
    optionSource: 'ratings',
    controlKind: 'certification',
    actionLabel: 'Add an avoid rating',
    actionHelp: 'Use this for ratings that should count against this destination.',
    addLabel: 'Choose rating to avoid...',
    badgeClass: 'bg-red-900/30 text-red-300',
    command: {
      type: 'add_certification_exclusion',
      signalType: 'certifications',
    },
  },
])

export function buildPolicyIntentEditorSections(intentView = {}, options = {}) {
  const projectedEntriesBySection = POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.reduce((sectionMap, definition) => {
    sectionMap[definition.key] = projectPolicyIntentEntriesForSection(definition, intentView[definition.key])
    return sectionMap
  }, {})

  return POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.map((definition) => {
    const entries = projectedEntriesBySection[definition.key]
    const warnings = buildPolicyIntentSectionWarnings(definition.key, entries, projectedEntriesBySection)
    const completion = buildPolicyIntentSectionCompletion(definition.key, entries, warnings)
    const sectionOptions = definition.optionSource === 'ratings'
      ? asArray(options.availableRatings)
      : asArray(options.availableGenres)
    const optionStates = buildPolicyIntentOptionStates(definition.key, sectionOptions, entries)
    return {
      ...definition,
      entries,
      behaviorSummary: summarizePolicyIntentSection(definition.key, entries),
      warnings,
      completion,
      nextAction: buildPolicyIntentSectionNextAction(definition.key, completion),
      options: sectionOptions,
      optionStates,
      optionDiagnostics: buildPolicyIntentOptionDiagnostics(definition.key, optionStates),
      hasClearAction: Boolean(definition.clearCommand),
    }
  })
}

export function buildDraftCommandForIntentSection(sectionKey, { presetId, value, currentEntries } = {}) {
  const definition = POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.find(section => section.key === sectionKey)
  return buildDraftCommandForIntentSectionDefinition(definition, { presetId, value, currentEntries })
}

export function buildDraftClearCommandForIntentSection(sectionKey, { presetId } = {}) {
  const definition = POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.find(section => section.key === sectionKey)
  return buildDraftClearCommandForIntentSectionDefinition(definition, { presetId })
}
