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

export {
  buildPolicyIntentReadinessSummary,
  buildPolicyIntentSectionCompletion,
  buildPolicyIntentSectionNextAction,
  buildPolicyIntentSectionWarnings,
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function firstArrayValue(values, keys) {
  for (const key of keys) {
    const list = asArray(values[key])
    if (list.length > 0) return list.join(', ')
  }
  return ''
}

function firstRemovableArrayValue(values, keys) {
  for (const key of keys) {
    const list = asArray(values[key])
    if (list.length > 0) {
      return {
        key,
        value: list[0],
      }
    }
  }
  return null
}

function createSingleValueEntry(entry, key, value) {
  return {
    ...entry,
    values: {
      ...asObject(entry.values),
      [key]: [value],
    },
  }
}

function expandArrayBackedEntries(sectionKey, entry = {}) {
  const values = asObject(entry.values)
  let keys = []

  if (sectionKey === POLICY_INTENT_BUCKETS.IDENTITY || sectionKey === POLICY_INTENT_BUCKETS.COMPATIBILITY) {
    keys = ['require_any', 'require_all', 'include']
  } else if (sectionKey === POLICY_INTENT_BUCKETS.BOOSTERS) {
    keys = ['prefer', 'require_any', 'include']
  } else if (sectionKey === POLICY_INTENT_BUCKETS.EXCLUSIONS) {
    keys = ['exclude', 'require_any', 'include']
  }

  for (const key of keys) {
    const list = asArray(values[key])
    if (list.length > 1) {
      return list.map(value => createSingleValueEntry(entry, key, value))
    }
  }

  return [entry]
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

export function formatPolicyIntentEntryForSection(sectionKey, entry = {}) {
  const values = asObject(entry.values)

  if (sectionKey === POLICY_INTENT_BUCKETS.IDENTITY) {
    const value = firstArrayValue(values, ['require_any', 'require_all', 'include'])
    return value ? `Belongs here: ${value}` : 'Belongs-here signal'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.COMPATIBILITY) {
    const value = firstArrayValue(values, ['require_any', 'require_all', 'include'])
    return value ? `Helpful match: ${value}` : 'Helpful match'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS) {
    if (values.mode === 'max' && values.max) return `Maximum rating: ${values.max}`
    const value = firstArrayValue(values, ['include', 'require_any', 'require_all'])
    return value ? `Required limit: ${value}` : 'Hard limit'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.BOOSTERS) {
    const value = firstArrayValue(values, ['prefer', 'require_any', 'include'])
    return value ? `Confidence boost: ${value}` : 'Confidence boost'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.EXCLUSIONS) {
    const value = firstArrayValue(values, ['exclude', 'require_any', 'include'])
    return value ? `Avoid rating: ${value}` : 'Avoid rule'
  }

  return entry.signal_type || 'Signal'
}

function buildIntentEntryRemoveCommand(sectionKey, { presetId, entry } = {}) {
  const entryPresetId = entry?.preset_id ?? presetId
  const values = asObject(entry?.values)
  if (entryPresetId === null || entryPresetId === undefined) return null

  if (sectionKey === POLICY_INTENT_BUCKETS.IDENTITY || sectionKey === POLICY_INTENT_BUCKETS.COMPATIBILITY) {
    const removable = firstRemovableArrayValue(values, ['require_any', 'require_all', 'include'])
    if (!removable) return null

    return {
      eventName: 'draft-remove-signal-value',
      payload: {
        presetId: entryPresetId,
        signalType: entry.signal_type || 'genres',
        key: removable.key,
        value: removable.value,
      },
    }
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.BOOSTERS) {
    const removable = firstRemovableArrayValue(values, ['prefer', 'require_any', 'include'])
    if (!removable) return null

    return {
      eventName: 'draft-remove-signal-value',
      payload: {
        presetId: entryPresetId,
        signalType: entry.signal_type || 'genres',
        key: removable.key,
        value: removable.value,
      },
    }
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS && values.mode === 'max' && values.max) {
    return {
      eventName: 'draft-clear-signal-config',
      payload: {
        presetId: entryPresetId,
        signalType: entry.signal_type || 'certifications',
      },
    }
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.EXCLUSIONS) {
    const removable = firstRemovableArrayValue(values, ['exclude', 'require_any', 'include'])
    if (!removable) return null

    return {
      eventName: 'draft-remove-signal-value',
      payload: {
        presetId: entryPresetId,
        signalType: entry.signal_type || 'certifications',
        key: removable.key,
        value: removable.value,
      },
    }
  }

  return null
}

function projectIntentEntry(definition, entry) {
  return expandArrayBackedEntries(definition.key, entry).map((displayEntry) => {
    const displayText = formatPolicyIntentEntryForSection(definition.key, displayEntry)
    const removeCommand = buildIntentEntryRemoveCommand(definition.key, { entry: displayEntry })
    return {
      ...displayEntry,
      displayText,
      canRemove: Boolean(removeCommand),
      removeLabel: removeCommand ? `Remove ${displayText}` : null,
    }
  })
}

function joinDisplayValues(entries) {
  return entries
    .map(entry => String(entry.displayText || '').replace(/^[^:]+:\s*/, '').trim())
    .filter(Boolean)
    .join(', ')
}

export function summarizePolicyIntentSection(sectionKey, entries = []) {
  const projectedEntries = asArray(entries)
  if (projectedEntries.length === 0) return ''

  const values = joinDisplayValues(projectedEntries)
  if (!values) return ''

  if (sectionKey === POLICY_INTENT_BUCKETS.IDENTITY) {
    return `This destination is defined by ${values}.`
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.COMPATIBILITY) {
    return `${values} can support a match, but should not decide alone.`
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS) {
    return `Items must stay within ${values}.`
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.BOOSTERS) {
    return `${values} can raise confidence after the item already fits.`
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.EXCLUSIONS) {
    return `${values} should count against this destination.`
  }

  return ''
}

export function buildPolicyIntentEditorSections(intentView = {}, options = {}) {
  const projectedEntriesBySection = POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.reduce((sectionMap, definition) => {
    sectionMap[definition.key] = asArray(intentView[definition.key]).flatMap(entry => projectIntentEntry(definition, entry))
    return sectionMap
  }, {})

  return POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.map((definition) => {
    const entries = projectedEntriesBySection[definition.key]
    const warnings = buildPolicyIntentSectionWarnings(definition.key, entries, projectedEntriesBySection)
    const completion = buildPolicyIntentSectionCompletion(definition.key, entries, warnings)
    return {
      ...definition,
      entries,
      behaviorSummary: summarizePolicyIntentSection(definition.key, entries),
      warnings,
      completion,
      nextAction: buildPolicyIntentSectionNextAction(definition.key, completion),
      options: definition.optionSource === 'ratings'
        ? asArray(options.availableRatings)
        : asArray(options.availableGenres),
      hasClearAction: Boolean(definition.clearCommand),
    }
  })
}

export function buildDraftRemoveCommandForIntentEntry(sectionKey, { presetId, entry } = {}) {
  return buildIntentEntryRemoveCommand(sectionKey, { presetId, entry })
}

export function buildDraftCommandForIntentSection(sectionKey, { presetId, value } = {}) {
  const definition = POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.find(section => section.key === sectionKey)
  if (!definition || presetId === null || presetId === undefined || !value) return null

  if (definition.command.type === 'add_signal') {
    return {
      eventName: 'draft-add-signal',
      payload: {
        presetId,
        signalType: definition.command.signalType,
        key: definition.command.key,
        value,
        extras: definition.command.extras || {},
      },
    }
  }

  if (definition.command.type === 'set_certification_max') {
    return {
      eventName: 'draft-set-signal-config',
      payload: {
        presetId,
        signalType: 'certifications',
        config: {
          mode: 'max',
          max: value,
          constraint_mode: 'strict',
        },
      },
    }
  }

  if (definition.command.type === 'add_certification_exclusion') {
    return {
      eventName: 'draft-set-signal-config',
      payload: {
        presetId,
        signalType: 'certifications',
        config: {
          mode: 'exclude',
          exclude: [value],
        },
        appendArrays: true,
      },
    }
  }

  return null
}

export function buildDraftClearCommandForIntentSection(sectionKey, { presetId } = {}) {
  const definition = POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.find(section => section.key === sectionKey)
  if (!definition?.clearCommand || presetId === null || presetId === undefined) return null

  return {
    eventName: 'draft-clear-signal-config',
    payload: {
      presetId,
      signalType: definition.clearCommand.signalType,
    },
  }
}
