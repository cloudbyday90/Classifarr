/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { POLICY_INTENT_BUCKETS } from './policyIntentModel'

export const POLICY_INTENT_DRAFT_SCHEMA_VERSION = 1

const DRAFT_SIGNAL_KEYS = Object.freeze([
  'require_all',
  'require_any',
  'include',
  'prefer',
  'exclude',
  'mode',
  'max',
  'min',
  'min_minutes',
  'max_minutes',
])

const SIGNAL_METADATA_KEYS = Object.freeze([
  'semantics',
  'constraint_mode',
  'constraint',
  'runtime_mode',
  'runtime',
  'strict',
])

const BUCKET_ORDER = Object.freeze([
  POLICY_INTENT_BUCKETS.IDENTITY,
  POLICY_INTENT_BUCKETS.COMPATIBILITY,
  POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
  POLICY_INTENT_BUCKETS.BOOSTERS,
  POLICY_INTENT_BUCKETS.EXCLUSIONS,
])

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function clone(value) {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value))
}

function cloneObject(value) {
  return clone(asObject(value))
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(item => item !== undefined && item !== null && String(item).trim()) : []
}

function unique(values) {
  return Array.from(new Set(asArray(values)))
}

function getPresetId(preset) {
  return preset?.preset_id ?? preset?.id ?? null
}

function createEmptyBuckets() {
  return BUCKET_ORDER.reduce((buckets, bucket) => {
    buckets[bucket] = []
    return buckets
  }, {})
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && String(value).trim()
}

function pickSignalValues(config, allowedKeys = DRAFT_SIGNAL_KEYS) {
  return allowedKeys.reduce((values, key) => {
    const value = config?.[key]
    if (Array.isArray(value)) {
      const normalized = unique(value)
      if (normalized.length > 0) values[key] = normalized
    } else if (hasValue(value)) {
      values[key] = value
    }
    return values
  }, {})
}

function pickSignalMetadata(config) {
  return SIGNAL_METADATA_KEYS.reduce((metadata, key) => {
    if (config?.[key] !== undefined && config?.[key] !== null && config?.[key] !== '') {
      metadata[key] = config[key]
    }
    return metadata
  }, {})
}

function addEntry(draftPreset, bucket, signalType, config, allowedKeys = DRAFT_SIGNAL_KEYS) {
  const values = pickSignalValues(config, allowedKeys)
  if (Object.keys(values).length === 0) return

  draftPreset.buckets[bucket].push({
    bucket,
    signal_type: signalType,
    values,
    metadata: pickSignalMetadata(config),
    source: 'legacy_custom_signals',
  })
}

function inferAffirmativeBucket(signalType, config) {
  if (config?.semantics === 'identity') return POLICY_INTENT_BUCKETS.IDENTITY
  if (config?.semantics === 'compatibility') return POLICY_INTENT_BUCKETS.COMPATIBILITY

  return ['genres', 'keywords', 'studios'].includes(signalType)
    ? POLICY_INTENT_BUCKETS.IDENTITY
    : POLICY_INTENT_BUCKETS.COMPATIBILITY
}

function buildDraftPreset(preset) {
  const draftPreset = {
    preset_id: getPresetId(preset),
    preset_name: preset?.name || 'Selected preset',
    weight: preset?.weight ?? 1.0,
    source: 'legacy_preset',
    migration_state: 'legacy_compatible',
    legacyCustomSignals: cloneObject(preset?.customSignals || preset?.custom_signals),
    runtimeSemantics: clone(preset?.runtimeSemantics || preset?.runtime_semantics || null),
    signalMetadataOverrides: {},
    buckets: createEmptyBuckets(),
    warnings: [],
  }

  const customSignals = asObject(draftPreset.legacyCustomSignals)
  for (const [signalType, configValue] of Object.entries(customSignals)) {
    if (signalType === 'removed') continue
    const config = asObject(configValue)
    const metadata = pickSignalMetadata(config)
    if (Object.keys(metadata).length > 0) {
      draftPreset.signalMetadataOverrides[signalType] = metadata
    }

    if (hasValue(config?.exclude) || config?.mode === 'exclude') {
      addEntry(draftPreset, POLICY_INTENT_BUCKETS.EXCLUSIONS, signalType, config, ['mode', 'exclude'])
    }

    if (hasValue(config?.prefer)) {
      addEntry(draftPreset, POLICY_INTENT_BUCKETS.BOOSTERS, signalType, config, ['prefer'])
    }

    if (
      hasValue(config?.require_all)
      || hasValue(config?.require_any)
      || hasValue(config?.include)
      || config?.mode === 'max'
      || hasValue(config?.max)
      || hasValue(config?.min)
      || hasValue(config?.min_minutes)
      || hasValue(config?.max_minutes)
    ) {
      const bucket = config?.constraint_mode === 'strict' || config?.strict === true
        ? POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS
        : inferAffirmativeBucket(signalType, config)

      addEntry(draftPreset, bucket, signalType, config, [
        'require_all',
        'require_any',
        'include',
        'mode',
        'max',
        'min',
        'min_minutes',
        'max_minutes',
      ])
    }
  }

  return draftPreset
}

export function buildPolicyIntentDraft(selectedPresets = []) {
  const presets = Array.isArray(selectedPresets)
    ? selectedPresets.map(buildDraftPreset)
    : []

  return {
    schema_version: POLICY_INTENT_DRAFT_SCHEMA_VERSION,
    source: 'legacy_policy_builder',
    migration_state: 'legacy_compatible',
    presets,
    summary: {
      preset_count: presets.length,
      counts: BUCKET_ORDER.reduce((counts, bucket) => {
        counts[bucket] = presets.reduce((total, preset) => total + preset.buckets[bucket].length, 0)
        return counts
      }, {}),
    },
  }
}

function ensureConfig(customSignals, signalType) {
  if (!customSignals[signalType] || typeof customSignals[signalType] !== 'object' || Array.isArray(customSignals[signalType])) {
    customSignals[signalType] = {}
  }
  return customSignals[signalType]
}

function removeKnownDraftFields(customSignals, signalTypes) {
  for (const [signalType, config] of Object.entries(asObject(customSignals))) {
    if (!signalTypes.has(signalType)) continue
    if (signalType === 'removed' || !config || typeof config !== 'object' || Array.isArray(config)) continue

    for (const key of DRAFT_SIGNAL_KEYS) {
      delete config[key]
    }
    for (const key of SIGNAL_METADATA_KEYS) {
      delete config[key]
    }
  }
}

function mergeEntryValues(customSignals, entry, defaults = {}) {
  const signalType = entry?.signal_type
  if (!signalType) return

  const config = ensureConfig(customSignals, signalType)
  const values = asObject(entry.values)
  const metadata = {
    ...defaults,
    ...asObject(entry.metadata),
  }

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      const existing = Array.isArray(config[key]) ? config[key] : []
      config[key] = unique([...existing, ...value])
    } else if (hasValue(value)) {
      config[key] = value
    }
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (hasValue(value) || typeof value === 'boolean') {
      config[key] = value
    }
  }
}

function mergeSignalMetadata(customSignals, signalType, metadata) {
  if (!signalType) return
  const config = ensureConfig(customSignals, signalType)

  for (const [key, value] of Object.entries(asObject(metadata))) {
    if (hasValue(value) || typeof value === 'boolean') {
      config[key] = value
    }
  }
}

function cleanupCustomSignals(customSignals) {
  for (const [signalType, config] of Object.entries(asObject(customSignals))) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) continue

    for (const [key, value] of Object.entries(config)) {
      if (Array.isArray(value) && value.length === 0) {
        delete config[key]
      }
    }

    if (Object.keys(config).length === 0) {
      delete customSignals[signalType]
    }
  }

  return Object.keys(customSignals).length > 0 ? customSignals : null
}

function findDraftPreset(draft, preset) {
  const presetId = getPresetId(preset)
  return asObject(draft).presets?.find(item => item?.preset_id === presetId) || null
}

function serializeDraftPresetCustomSignals(draftPreset, fallbackCustomSignals) {
  const customSignals = cloneObject(draftPreset?.legacyCustomSignals ?? fallbackCustomSignals)
  const managedSignalTypes = new Set(asArray(draftPreset?.cleared_signal_types))
  for (const signalType of Object.keys(asObject(draftPreset?.signalMetadataOverrides))) {
    managedSignalTypes.add(signalType)
  }
  for (const bucket of Object.values(POLICY_INTENT_BUCKETS)) {
    for (const entry of draftPreset?.buckets?.[bucket] || []) {
      if (entry?.signal_type) managedSignalTypes.add(entry.signal_type)
    }
  }
  removeKnownDraftFields(customSignals, managedSignalTypes)

  for (const entry of draftPreset?.buckets?.[POLICY_INTENT_BUCKETS.IDENTITY] || []) {
    mergeEntryValues(customSignals, entry)
  }

  for (const entry of draftPreset?.buckets?.[POLICY_INTENT_BUCKETS.COMPATIBILITY] || []) {
    mergeEntryValues(customSignals, entry)
  }

  for (const entry of draftPreset?.buckets?.[POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS] || []) {
    mergeEntryValues(customSignals, entry, { constraint_mode: 'strict' })
  }

  for (const entry of draftPreset?.buckets?.[POLICY_INTENT_BUCKETS.BOOSTERS] || []) {
    mergeEntryValues(customSignals, entry)
  }

  for (const entry of draftPreset?.buckets?.[POLICY_INTENT_BUCKETS.EXCLUSIONS] || []) {
    mergeEntryValues(customSignals, entry)
  }

  for (const [signalType, metadata] of Object.entries(asObject(draftPreset?.signalMetadataOverrides))) {
    mergeSignalMetadata(customSignals, signalType, metadata)
  }

  return cleanupCustomSignals(customSignals)
}

export function applyPolicyIntentDraftToSelectedPresets(selectedPresets = [], draft = null) {
  if (!draft || !Array.isArray(selectedPresets)) {
    return Array.isArray(selectedPresets) ? clone(selectedPresets) : []
  }

  return selectedPresets.map((preset) => {
    const draftPreset = findDraftPreset(draft, preset)
    if (!draftPreset) return clone(preset)

    return {
      ...clone(preset),
      customSignals: serializeDraftPresetCustomSignals(draftPreset, preset?.customSignals),
    }
  })
}
