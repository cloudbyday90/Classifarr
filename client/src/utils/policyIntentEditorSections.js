/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { POLICY_INTENT_BUCKETS } from './policyIntentModel'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export const POLICY_INTENT_EDITOR_SECTION_DEFINITIONS = Object.freeze([
  {
    key: POLICY_INTENT_BUCKETS.IDENTITY,
    label: 'Belongs Here',
    help: 'Signals that define what this library is for.',
    optionSource: 'genres',
    addLabel: '+ belongs-here genre',
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
    addLabel: '+ helpful genre',
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
    addLabel: '+ max rating',
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
    addLabel: '+ boost genre',
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
    addLabel: '+ avoid rating',
    badgeClass: 'bg-red-900/30 text-red-300',
    command: {
      type: 'add_certification_exclusion',
      signalType: 'certifications',
    },
  },
])

export function buildPolicyIntentEditorSections(intentView = {}, options = {}) {
  return POLICY_INTENT_EDITOR_SECTION_DEFINITIONS.map(definition => ({
    ...definition,
    entries: asArray(intentView[definition.key]),
    options: definition.optionSource === 'ratings'
      ? asArray(options.availableRatings)
      : asArray(options.availableGenres),
    hasClearAction: Boolean(definition.clearCommand),
  }))
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
