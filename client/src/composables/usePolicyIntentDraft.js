/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { isRef, ref, unref, watch } from 'vue'
import {
  applyPolicyIntentDraftToSelectedPresets,
  buildPolicyIntentDraft,
} from '@/utils/policyIntentDraftBridge'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
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

function resolveBucket({ key, config = {}, extras = {} }) {
  const merged = {
    ...asObject(config),
    ...asObject(extras),
  }

  if (merged.constraint_mode === 'strict' || merged.strict === true || key === 'max' || merged.mode === 'max') {
    return POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS
  }

  if (key === 'exclude' || merged.mode === 'exclude') {
    return POLICY_INTENT_BUCKETS.EXCLUSIONS
  }

  if (key === 'prefer') {
    return POLICY_INTENT_BUCKETS.BOOSTERS
  }

  return merged.semantics === 'compatibility'
    ? POLICY_INTENT_BUCKETS.COMPATIBILITY
    : POLICY_INTENT_BUCKETS.IDENTITY
}

function findDraftPreset(draft, presetId) {
  return draft?.presets?.find(preset => preset?.preset_id === presetId) || null
}

function removeSignalEntries(draftPreset, signalType) {
  if (!draftPreset?.buckets) return

  for (const bucket of Object.values(POLICY_INTENT_BUCKETS)) {
    draftPreset.buckets[bucket] = (draftPreset.buckets[bucket] || [])
      .filter(entry => entry?.signal_type !== signalType)
  }
}

function markSignalCleared(draftPreset, signalType) {
  if (!draftPreset || !signalType) return
  if (!Array.isArray(draftPreset.cleared_signal_types)) {
    draftPreset.cleared_signal_types = []
  }
  if (!draftPreset.cleared_signal_types.includes(signalType)) {
    draftPreset.cleared_signal_types.push(signalType)
  }
}

function unmarkSignalCleared(draftPreset, signalType) {
  if (!Array.isArray(draftPreset?.cleared_signal_types)) return
  draftPreset.cleared_signal_types = draftPreset.cleared_signal_types.filter(item => item !== signalType)
}

function findOrCreateEntry(draftPreset, bucket, signalType, metadata = {}) {
  if (!draftPreset?.buckets?.[bucket]) return null

  const normalizedMetadata = asObject(metadata)
  const existing = draftPreset.buckets[bucket].find((entry) => {
    if (entry?.signal_type !== signalType) return false
    return JSON.stringify(asObject(entry.metadata)) === JSON.stringify(normalizedMetadata)
  })

  if (existing) return existing

  const entry = {
    bucket,
    signal_type: signalType,
    values: {},
    metadata: normalizedMetadata,
    source: 'intent_draft',
  }
  draftPreset.buckets[bucket].push(entry)
  return entry
}

function setEntryValue(entry, key, value, appendArrays = false) {
  if (!entry || !key) return

  if (Array.isArray(value)) {
    const existing = appendArrays ? asArray(entry.values[key]) : []
    entry.values[key] = unique([...existing, ...value])
    return
  }

  if (value !== undefined && value !== null && String(value).trim()) {
    entry.values[key] = value
  }
}

function removeEntryValue(entry, key, value) {
  const values = asObject(entry?.values)
  const currentValue = values[key]

  if (Array.isArray(currentValue)) {
    const nextValues = currentValue.filter(item => item !== value)
    if (nextValues.length === currentValue.length) return false

    if (nextValues.length > 0) {
      values[key] = nextValues
    } else {
      delete values[key]
    }
    return true
  }

  if (currentValue === value) {
    delete values[key]
    return true
  }

  return false
}

function removeEmptyDraftEntries(draftPreset) {
  if (!draftPreset?.buckets) return

  for (const bucket of Object.values(POLICY_INTENT_BUCKETS)) {
    draftPreset.buckets[bucket] = (draftPreset.buckets[bucket] || [])
      .filter(entry => Object.keys(asObject(entry?.values)).length > 0)
  }
}

function splitConfig(config = {}) {
  const values = {}
  const metadata = {}

  for (const [key, value] of Object.entries(asObject(config))) {
    if (['semantics', 'constraint_mode', 'constraint', 'runtime_mode', 'runtime', 'strict'].includes(key)) {
      metadata[key] = value
    } else {
      values[key] = value
    }
  }

  return { values, metadata }
}

function ensureMetadataOverrides(draftPreset) {
  if (!draftPreset.signalMetadataOverrides || typeof draftPreset.signalMetadataOverrides !== 'object') {
    draftPreset.signalMetadataOverrides = {}
  }
  return draftPreset.signalMetadataOverrides
}

function ensureRemovalOverrides(draftPreset) {
  if (!draftPreset.signalRemovalOverrides || typeof draftPreset.signalRemovalOverrides !== 'object') {
    draftPreset.signalRemovalOverrides = {}
  }
  return draftPreset.signalRemovalOverrides
}

function cleanupRemovalOverrides(removalOverrides, signalType, key) {
  const keyConfig = removalOverrides?.[signalType]
  if (!keyConfig) return

  if (Array.isArray(keyConfig[key]) && keyConfig[key].length === 0) {
    delete keyConfig[key]
  }

  if (Object.keys(keyConfig).length === 0) {
    delete removalOverrides[signalType]
  }
}

function hasSignalEntries(draftPreset, signalType) {
  return Object.values(POLICY_INTENT_BUCKETS).some((bucket) => {
    return (draftPreset?.buckets?.[bucket] || []).some(entry => entry?.signal_type === signalType)
  })
}

function getFirstValueKey(entry) {
  return Object.keys(asObject(entry?.values))[0] || null
}

function moveEntryToResolvedBucket(draftPreset, entry) {
  const key = getFirstValueKey(entry)
  if (!draftPreset?.buckets || !key) return

  const nextBucket = resolveBucket({
    key,
    config: {
      ...asObject(entry.values),
      ...asObject(entry.metadata),
    },
  })
  if (entry.bucket === nextBucket) return

  for (const bucket of Object.values(POLICY_INTENT_BUCKETS)) {
    draftPreset.buckets[bucket] = (draftPreset.buckets[bucket] || []).filter(item => item !== entry)
  }
  entry.bucket = nextBucket
  draftPreset.buckets[nextBucket].push(entry)
}

function applySignalMetadataToEntries(draftPreset, signalType, metadata, baseMetadata) {
  const matchingEntries = []
  for (const bucket of Object.values(POLICY_INTENT_BUCKETS)) {
    for (const entry of draftPreset?.buckets?.[bucket] || []) {
      if (entry?.signal_type === signalType) {
        matchingEntries.push(entry)
      }
    }
  }

  for (const entry of matchingEntries) {
    const nextMetadata = {
      ...asObject(entry.metadata),
    }
    for (const [key, value] of Object.entries(asObject(metadata))) {
      if (value === asObject(baseMetadata)[key]) {
        delete nextMetadata[key]
      } else {
        nextMetadata[key] = value
      }
    }
    entry.metadata = nextMetadata
    moveEntryToResolvedBucket(draftPreset, entry)
  }
}

export function usePolicyIntentDraft(selectedPresets) {
  const intentDraft = ref(buildPolicyIntentDraft(unref(selectedPresets)))

  const syncFromSelectedPresets = () => {
    intentDraft.value = buildPolicyIntentDraft(unref(selectedPresets))
  }

  const buildSelectedPresetsFromDraft = () => {
    return applyPolicyIntentDraftToSelectedPresets(unref(selectedPresets), intentDraft.value)
  }

  const applyDraftToSelectedPresets = () => {
    const nextPresets = buildSelectedPresetsFromDraft()
    if (isRef(selectedPresets)) {
      selectedPresets.value = nextPresets
    }
    return nextPresets
  }

  if (isRef(selectedPresets)) {
    watch(
      selectedPresets,
      syncFromSelectedPresets,
      { deep: true, immediate: true, flush: 'sync' },
    )
  }

  const addSignal = ({ presetId, signalType, key, value, extras = {} }) => {
    const draftPreset = findDraftPreset(intentDraft.value, presetId)
    if (!draftPreset || !signalType || !key || !value) return false

    const bucket = resolveBucket({ key, extras })
    const entry = findOrCreateEntry(draftPreset, bucket, signalType, asObject(extras))
    setEntryValue(entry, key, [value], true)
    unmarkSignalCleared(draftPreset, signalType)
    applyDraftToSelectedPresets()
    return true
  }

  const removeSignalValue = ({ presetId, signalType, key, value }) => {
    const draftPreset = findDraftPreset(intentDraft.value, presetId)
    if (!draftPreset || !signalType || !key || !value) return false

    let changed = false
    for (const bucket of Object.values(POLICY_INTENT_BUCKETS)) {
      for (const entry of draftPreset.buckets?.[bucket] || []) {
        if (entry?.signal_type === signalType) {
          changed = removeEntryValue(entry, key, value) || changed
        }
      }
    }

    if (!changed) return false

    removeEmptyDraftEntries(draftPreset)
    if (!hasSignalEntries(draftPreset, signalType)) {
      markSignalCleared(draftPreset, signalType)
    }
    applyDraftToSelectedPresets()
    return true
  }

  const setSignalConfig = ({ presetId, signalType, config, appendArrays = false }) => {
    const draftPreset = findDraftPreset(intentDraft.value, presetId)
    if (!draftPreset || !signalType || !config || typeof config !== 'object') return false

    if (!appendArrays) {
      removeSignalEntries(draftPreset, signalType)
      delete ensureMetadataOverrides(draftPreset)[signalType]
    }
    unmarkSignalCleared(draftPreset, signalType)

    const { values, metadata } = splitConfig(config)
    const bucket = resolveBucket({ config })
    const entry = findOrCreateEntry(draftPreset, bucket, signalType, metadata)

    for (const [key, value] of Object.entries(values)) {
      setEntryValue(entry, key, value, appendArrays)
    }

    applyDraftToSelectedPresets()
    return true
  }

  const clearSignalConfig = ({ presetId, signalType }) => {
    const draftPreset = findDraftPreset(intentDraft.value, presetId)
    if (!draftPreset || !signalType) return false

    removeSignalEntries(draftPreset, signalType)
    delete ensureMetadataOverrides(draftPreset)[signalType]
    markSignalCleared(draftPreset, signalType)
    applyDraftToSelectedPresets()
    return true
  }

  const setSignalMetadata = ({ presetId, signalType, metadata, baseMetadata = {} }) => {
    const draftPreset = findDraftPreset(intentDraft.value, presetId)
    if (!draftPreset || !signalType || !metadata || typeof metadata !== 'object') return false

    const overrides = ensureMetadataOverrides(draftPreset)
    const nextMetadata = {
      ...asObject(overrides[signalType]),
    }

    for (const [key, value] of Object.entries(asObject(metadata))) {
      if (value === asObject(baseMetadata)[key]) {
        delete nextMetadata[key]
      } else {
        nextMetadata[key] = value
      }
    }

    if (Object.keys(nextMetadata).length > 0) {
      overrides[signalType] = nextMetadata
      unmarkSignalCleared(draftPreset, signalType)
    } else {
      delete overrides[signalType]
      if (!hasSignalEntries(draftPreset, signalType)) {
        markSignalCleared(draftPreset, signalType)
      }
    }
    applySignalMetadataToEntries(draftPreset, signalType, metadata, baseMetadata)

    applyDraftToSelectedPresets()
    return true
  }

  const setSignalRemoval = ({ presetId, signalType, key, value, removed = true }) => {
    const draftPreset = findDraftPreset(intentDraft.value, presetId)
    if (!draftPreset || !signalType || !key || !value) return false

    const removalOverrides = ensureRemovalOverrides(draftPreset)
    if (!removalOverrides[signalType]) removalOverrides[signalType] = {}
    if (!Array.isArray(removalOverrides[signalType][key])) {
      removalOverrides[signalType][key] = []
    }

    if (removed) {
      removalOverrides[signalType][key] = unique([...removalOverrides[signalType][key], value])
    } else {
      removalOverrides[signalType][key] = removalOverrides[signalType][key].filter(item => item !== value)
      cleanupRemovalOverrides(removalOverrides, signalType, key)
    }

    applyDraftToSelectedPresets()
    return true
  }

  return {
    intentDraft,
    syncFromSelectedPresets,
    buildSelectedPresetsFromDraft,
    applyDraftToSelectedPresets,
    addSignal,
    removeSignalValue,
    setSignalConfig,
    setSignalMetadata,
    setSignalRemoval,
    clearSignalConfig,
    getPresetId,
  }
}
