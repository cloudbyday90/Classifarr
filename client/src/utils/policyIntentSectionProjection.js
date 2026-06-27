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

function valueKeysForSection(sectionKey) {
  if (sectionKey === POLICY_INTENT_BUCKETS.IDENTITY || sectionKey === POLICY_INTENT_BUCKETS.COMPATIBILITY) {
    return ['require_any', 'require_all', 'include']
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.BOOSTERS) {
    return ['prefer', 'require_any', 'include']
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.EXCLUSIONS) {
    return ['exclude', 'require_any', 'include']
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS) {
    return ['max', 'include', 'require_any', 'require_all']
  }

  return []
}

function normalizeOptionValue(value) {
  return String(value || '').trim()
}

function collectConfiguredValues(sectionKey, entries = []) {
  const configuredValues = new Set()
  const keys = valueKeysForSection(sectionKey)

  for (const entry of asArray(entries)) {
    const values = asObject(entry?.values)

    for (const key of keys) {
      const rawValue = values[key]
      const candidates = Array.isArray(rawValue) ? rawValue : [rawValue]

      for (const candidate of candidates) {
        const normalizedValue = normalizeOptionValue(candidate)
        if (normalizedValue) {
          configuredValues.add(normalizedValue.toLowerCase())
        }
      }
    }
  }

  return configuredValues
}

function unavailableOptionReason(sectionKey, value) {
  if (sectionKey === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS) {
    return `${value} is already set as the maximum rating.`
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.EXCLUSIONS) {
    return `${value} is already configured as an avoid rating.`
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.IDENTITY) {
    return `${value} is already configured as a belongs-here genre.`
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.COMPATIBILITY) {
    return `${value} is already configured as a helpful genre.`
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.BOOSTERS) {
    return `${value} is already configured as a confidence boost.`
  }

  return `${value} is already configured.`
}

function optionKindForSection(sectionKey) {
  if (
    sectionKey === POLICY_INTENT_BUCKETS.IDENTITY ||
    sectionKey === POLICY_INTENT_BUCKETS.COMPATIBILITY ||
    sectionKey === POLICY_INTENT_BUCKETS.BOOSTERS
  ) {
    return 'genre'
  }

  if (
    sectionKey === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS ||
    sectionKey === POLICY_INTENT_BUCKETS.EXCLUSIONS
  ) {
    return 'rating'
  }

  return 'option'
}

function noOptionsMessage(optionKind) {
  if (optionKind === 'genre') {
    return 'No genre options are available yet. Sync or attach presets with genre signals before adding this intent value.'
  }

  if (optionKind === 'rating') {
    return 'No rating options are available yet. Sync or attach presets with certification signals before configuring this rating control.'
  }

  return 'No options are available yet.'
}

function allConfiguredMessage(sectionKey, optionKind) {
  if (sectionKey === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS) {
    return 'The available max rating is already configured.'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.EXCLUSIONS) {
    return 'All available avoid ratings are already configured in this section.'
  }

  if (optionKind === 'genre') {
    return 'All available genre options are already configured in this section.'
  }

  return 'All available options are already configured in this section.'
}

function limitedOptionsMessage(disabledCount, enabledCount) {
  return `${disabledCount} already configured ${disabledCount === 1 ? 'value is' : 'values are'} disabled; ${enabledCount} ${enabledCount === 1 ? 'choice remains' : 'choices remain'} available.`
}

function missingSelectionMessage(sectionKey, optionKind) {
  if (sectionKey === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS) {
    return 'Choose a maximum rating before applying this edit.'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.EXCLUSIONS) {
    return 'Choose a rating to avoid before applying this edit.'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.IDENTITY) {
    return 'Choose a belongs-here genre before applying this edit.'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.COMPATIBILITY) {
    return 'Choose a helpful genre before applying this edit.'
  }

  if (sectionKey === POLICY_INTENT_BUCKETS.BOOSTERS) {
    return 'Choose a confidence boost genre before applying this edit.'
  }

  return `Choose a ${optionKind} before applying this edit.`
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

function joinDisplayValues(entries) {
  return asArray(entries)
    .map(entry => String(entry.displayText || '').replace(/^[^:]+:\s*/, '').trim())
    .filter(Boolean)
    .join(', ')
}

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

export function buildDraftRemoveCommandForIntentEntry(sectionKey, { presetId, entry } = {}) {
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

export function projectPolicyIntentEntriesForSection(definition = {}, entries = []) {
  return asArray(entries).flatMap((entry) => {
    return expandArrayBackedEntries(definition.key, entry).map((displayEntry) => {
      const displayText = formatPolicyIntentEntryForSection(definition.key, displayEntry)
      const removeCommand = buildDraftRemoveCommandForIntentEntry(definition.key, { entry: displayEntry })
      return {
        ...displayEntry,
        displayText,
        canRemove: Boolean(removeCommand),
        removeLabel: removeCommand ? `Remove ${displayText}` : null,
      }
    })
  })
}

export function buildPolicyIntentOptionStates(sectionKey, options = [], entries = []) {
  const configuredValues = collectConfiguredValues(sectionKey, entries)
  const seenOptions = new Set()

  return asArray(options).reduce((optionStates, option) => {
    const value = normalizeOptionValue(option)
    if (!value) return optionStates

    const optionKey = value.toLowerCase()
    if (seenOptions.has(optionKey)) return optionStates
    seenOptions.add(optionKey)

    const disabled = configuredValues.has(optionKey)
    optionStates.push({
      value,
      label: value,
      disabled,
      reason: disabled ? unavailableOptionReason(sectionKey, value) : '',
    })
    return optionStates
  }, [])
}

export function resolvePolicyIntentOptionStates(section = {}) {
  if (Array.isArray(section.optionStates)) return section.optionStates

  return asArray(section.options).reduce((optionStates, option) => {
    const value = normalizeOptionValue(option)
    if (!value) return optionStates

    optionStates.push({
      value,
      label: value,
      disabled: false,
      reason: '',
    })
    return optionStates
  }, [])
}

export function buildPolicyIntentOptionDiagnostics(sectionKey, optionStates = []) {
  const states = asArray(optionStates)
  const optionKind = optionKindForSection(sectionKey)
  const enabledCount = states.filter(option => !option.disabled).length
  const disabledCount = states.length - enabledCount

  if (states.length === 0) {
    return {
      status: 'missing_reference_options',
      tone: 'info',
      optionKind,
      optionCount: 0,
      enabledCount: 0,
      disabledCount: 0,
      message: noOptionsMessage(optionKind),
    }
  }

  if (enabledCount === 0) {
    return {
      status: 'all_configured',
      tone: 'neutral',
      optionKind,
      optionCount: states.length,
      enabledCount,
      disabledCount,
      message: allConfiguredMessage(sectionKey, optionKind),
    }
  }

  if (disabledCount > 0) {
    return {
      status: 'limited',
      tone: 'neutral',
      optionKind,
      optionCount: states.length,
      enabledCount,
      disabledCount,
      message: limitedOptionsMessage(disabledCount, enabledCount),
    }
  }

  return {
    status: 'available',
    tone: 'success',
    optionKind,
    optionCount: states.length,
    enabledCount,
    disabledCount,
    message: '',
  }
}

export function buildPolicyIntentControlReadiness(sectionKey, {
  selectedValue,
  optionStates = [],
  optionDiagnostics = {},
} = {}) {
  const normalizedValue = normalizeOptionValue(selectedValue)
  const states = asArray(optionStates)
  const diagnostics = optionDiagnostics || {}
  const optionKind = diagnostics.optionKind || optionKindForSection(sectionKey)

  if (diagnostics.status === 'missing_reference_options') {
    return {
      canSubmit: false,
      status: 'missing_reference_options',
      reason: diagnostics.message || noOptionsMessage(optionKind),
    }
  }

  if (diagnostics.status === 'all_configured') {
    return {
      canSubmit: false,
      status: 'all_configured',
      reason: diagnostics.message || allConfiguredMessage(sectionKey, optionKind),
    }
  }

  if (!normalizedValue) {
    return {
      canSubmit: false,
      status: 'missing_selection',
      reason: missingSelectionMessage(sectionKey, optionKind),
    }
  }

  const selectedOption = states.find(option => option.value === normalizedValue)
  if (selectedOption?.disabled) {
    return {
      canSubmit: false,
      status: 'disabled_selection',
      reason: selectedOption.reason || unavailableOptionReason(sectionKey, normalizedValue),
    }
  }

  return {
    canSubmit: true,
    status: 'ready',
    reason: '',
  }
}

export function validatePolicyIntentOptionSelection(sectionKey, { value, entries = [] } = {}) {
  const normalizedValue = normalizeOptionValue(value)
  if (!normalizedValue) {
    return {
      allowed: false,
      code: 'missing_value',
      reason: 'Choose a value before applying this edit.',
    }
  }

  const configuredValues = collectConfiguredValues(sectionKey, entries)
  if (configuredValues.has(normalizedValue.toLowerCase())) {
    return {
      allowed: false,
      code: 'duplicate_value',
      reason: unavailableOptionReason(sectionKey, normalizedValue),
    }
  }

  return {
    allowed: true,
    code: 'allowed',
    reason: '',
  }
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

export function buildDraftCommandForIntentSectionDefinition(definition = {}, { presetId, value, currentEntries } = {}) {
  if (!definition.command || presetId === null || presetId === undefined || !value) return null
  if (currentEntries !== undefined) {
    const validation = validatePolicyIntentOptionSelection(definition.key, {
      value,
      entries: currentEntries,
    })
    if (!validation.allowed) return null
  }

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

export function buildDraftClearCommandForIntentSectionDefinition(definition = {}, { presetId } = {}) {
  if (!definition.clearCommand || presetId === null || presetId === undefined) return null

  return {
    eventName: 'draft-clear-signal-config',
    payload: {
      presetId,
      signalType: definition.clearCommand.signalType,
    },
  }
}
