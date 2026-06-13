/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_INTENT_BUCKETS = Object.freeze({
  IDENTITY: 'identity_signals',
  COMPATIBILITY: 'compatibility_signals',
  STRICT_CONSTRAINTS: 'strict_constraints',
  BOOSTERS: 'boosters',
  EXCLUSIONS: 'exclusions',
})

const IDENTITY_SIGNAL_TYPES = new Set(['genres', 'keywords', 'studios'])
const STRICT_MODE_ALIASES = new Set(['strict', 'hard', 'required', 'require', 'exclude', 'block'])

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

function hasValues(value) {
  return Array.isArray(value) && value.length > 0
}

function getPresetId(preset) {
  return preset?.preset_id ?? preset?.id ?? null
}

function findBasePreset(selectedPreset, allPresets = []) {
  const selectedId = getPresetId(selectedPreset)
  return allPresets.find((preset) => preset?.id === selectedId || preset?.preset_id === selectedId) || selectedPreset || {}
}

function isRemoved(customSignals, signalType, key, value) {
  return hasValues(customSignals?.removed?.[signalType]?.[key])
    && customSignals.removed[signalType][key].includes(value)
}

function mergePresetSignals(baseSignals, customSignals) {
  const base = clone(baseSignals)
  const custom = asObject(customSignals)

  for (const [signalType, config] of Object.entries(custom)) {
    if (signalType === 'removed') continue
    if (!base[signalType]) base[signalType] = {}

    for (const [key, value] of Object.entries(asObject(config))) {
      if (Array.isArray(value)) {
        const existing = Array.isArray(base[signalType][key]) ? base[signalType][key] : []
        base[signalType][key] = Array.from(new Set([...existing, ...value]))
      } else {
        base[signalType][key] = value
      }
    }
  }

  for (const [signalType, config] of Object.entries(base)) {
    for (const [key, value] of Object.entries(asObject(config))) {
      if (!Array.isArray(value)) continue
      base[signalType][key] = value.filter((item) => !isRemoved(custom, signalType, key, item))
    }
  }

  return base
}

function normalizeConstraintMode(config) {
  const explicit = config?.constraint_mode ?? config?.constraint ?? config?.runtime_mode ?? config?.runtime
  if (typeof explicit === 'string' && STRICT_MODE_ALIASES.has(explicit.trim().toLowerCase())) {
    return 'strict'
  }

  return config?.strict === true ? 'strict' : 'advisory'
}

function resolveSemantics(signalType, config) {
  if (config?.semantics === 'identity' || config?.semantics === 'compatibility') {
    return config.semantics
  }

  return IDENTITY_SIGNAL_TYPES.has(signalType)
    && (hasValues(config?.require_all) || hasValues(config?.require_any))
    ? 'identity'
    : 'compatibility'
}

function resolvePrimaryRole(signalType, config) {
  if (normalizeConstraintMode(config) === 'strict') {
    return POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS
  }

  if (hasValues(config?.exclude) || config?.mode === 'exclude') {
    return POLICY_INTENT_BUCKETS.EXCLUSIONS
  }

  if (hasValues(config?.prefer)
    && !hasValues(config?.require_all)
    && !hasValues(config?.require_any)
    && !hasValues(config?.include)
    && config?.mode !== 'max') {
    return POLICY_INTENT_BUCKETS.BOOSTERS
  }

  if (hasValues(config?.require_all) || hasValues(config?.require_any) || hasValues(config?.include) || config?.mode === 'max') {
    return resolveSemantics(signalType, config) === 'identity'
      ? POLICY_INTENT_BUCKETS.IDENTITY
      : POLICY_INTENT_BUCKETS.COMPATIBILITY
  }

  return null
}

function pickValues(config, allowedKeys = null) {
  const keys = allowedKeys || ['require_all', 'require_any', 'prefer', 'include', 'exclude', 'mode', 'max', 'min', 'min_minutes', 'max_minutes']
  return keys
    .reduce((values, key) => {
      const value = config?.[key]
      if (Array.isArray(value) && value.length > 0) {
        values[key] = value
      } else if (value !== undefined && value !== null && String(value).trim()) {
        values[key] = value
      }
      return values
    }, {})
}

function buildEntry(selectedPreset, signalType, config, role, allowedValueKeys = null) {
  if (!role) return null

  return {
    role,
    preset_id: getPresetId(selectedPreset),
    preset_name: selectedPreset?.name || 'Selected preset',
    signal_type: signalType,
    semantics: resolveSemantics(signalType, config),
    constraint_mode: normalizeConstraintMode(config),
    values: pickValues(config, allowedValueKeys),
  }
}

function buildEntries(selectedPreset, signalType, config) {
  const primaryRole = resolvePrimaryRole(signalType, config)
  if (primaryRole === POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS) {
    return [buildEntry(selectedPreset, signalType, config, primaryRole)]
  }

  const entries = []
  if (hasValues(config?.exclude) || config?.mode === 'exclude') {
    entries.push(buildEntry(selectedPreset, signalType, config, POLICY_INTENT_BUCKETS.EXCLUSIONS, ['mode', 'exclude']))
  }

  if (hasValues(config?.prefer)) {
    entries.push(buildEntry(selectedPreset, signalType, config, POLICY_INTENT_BUCKETS.BOOSTERS, ['prefer']))
  }

  if (hasValues(config?.require_all) || hasValues(config?.require_any) || hasValues(config?.include) || config?.mode === 'max') {
    const affirmativeRole = resolveSemantics(signalType, config) === 'identity'
      ? POLICY_INTENT_BUCKETS.IDENTITY
      : POLICY_INTENT_BUCKETS.COMPATIBILITY
    entries.push(buildEntry(selectedPreset, signalType, config, affirmativeRole, ['require_all', 'require_any', 'include', 'mode', 'max', 'min', 'min_minutes', 'max_minutes']))
  }

  return entries
}

export function buildPolicyIntentView(selectedPresets = [], allPresets = []) {
  const view = {
    [POLICY_INTENT_BUCKETS.IDENTITY]: [],
    [POLICY_INTENT_BUCKETS.COMPATIBILITY]: [],
    [POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]: [],
    [POLICY_INTENT_BUCKETS.BOOSTERS]: [],
    [POLICY_INTENT_BUCKETS.EXCLUSIONS]: [],
    summary: {
      preset_count: selectedPresets.length,
      counts: {},
    },
  }

  for (const selectedPreset of selectedPresets) {
    const basePreset = findBasePreset(selectedPreset, allPresets)
    const mergedSignals = mergePresetSignals(basePreset?.signals, selectedPreset?.customSignals)

    for (const [signalType, config] of Object.entries(mergedSignals)) {
      const entries = buildEntries(selectedPreset, signalType, asObject(config))
      for (const entry of entries) {
        view[entry.role].push(entry)
      }
    }
  }

  for (const bucket of Object.values(POLICY_INTENT_BUCKETS)) {
    view.summary.counts[bucket] = view[bucket].length
  }

  return view
}
