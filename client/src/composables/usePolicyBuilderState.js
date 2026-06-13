/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { computed, ref, unref, watch } from 'vue'

export function createDefaultPolicyForm(libraryId = null) {
  return {
    library_id: libraryId || null,
    name: '',
    description: '',
    enabled: true,
    priority: 5,
    sort_order: 0,
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    require_ai_validation: true,
    trust_patterns: true,
    trust_rag: true,
    trust_history: true,
    preset_weight: 0.35,
    profile_weight: 0.25,
    pattern_weight: 0.15,
    rag_weight: 0.15,
    history_weight: 0.10,
    combination_mode: 'best_match',
  }
}

export function mapPolicyToForm(policy) {
  if (!policy) {
    return createDefaultPolicyForm()
  }

  return {
    library_id: policy.library_id,
    name: policy.name,
    description: policy.description || '',
    enabled: policy.enabled !== false,
    priority: policy.priority || 5,
    sort_order: policy.sort_order || 0,
    auto_classify_threshold: policy.auto_classify_threshold || 85,
    prompt_threshold: policy.prompt_threshold || 60,
    require_ai_validation: policy.require_ai_validation !== false,
    trust_patterns: policy.trust_patterns !== false,
    trust_rag: policy.trust_rag !== false,
    trust_history: policy.trust_history !== false,
    preset_weight: policy.preset_weight ?? 0.35,
    profile_weight: policy.profile_weight ?? 0.25,
    pattern_weight: policy.pattern_weight ?? 0.15,
    rag_weight: policy.rag_weight ?? 0.15,
    history_weight: policy.history_weight ?? 0.10,
    combination_mode: policy.combination_mode || 'best_match',
  }
}

export function mapPolicyPresets(policy) {
  return Array.isArray(policy?.presets)
    ? policy.presets.map(preset => ({
      id: preset.id,
      preset_id: preset.preset_id ?? preset.id,
      name: preset.name,
      icon: preset.icon,
      weight: preset.weight || 1.0,
      customSignals: preset.customSignals || preset.custom_signals || null,
      runtimeSemantics: preset.runtimeSemantics || preset.runtime_semantics || null,
    }))
    : []
}

export function cleanupCustomSignals(preset) {
  if (!preset?.customSignals || typeof preset.customSignals !== 'object') return

  for (const [signalType, config] of Object.entries(preset.customSignals)) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) continue

    for (const [key, value] of Object.entries(config)) {
      if (Array.isArray(value) && value.length === 0) {
        delete config[key]
      }
    }

    if (Object.keys(config).length === 0) {
      delete preset.customSignals[signalType]
    }
  }

  if (Object.keys(preset.customSignals).length === 0) {
    preset.customSignals = null
  }
}

export function buildPolicySavePayload(formValue, selectedPresets, currentLibrary) {
  let policyName = formValue.name
  if (!policyName && currentLibrary && selectedPresets.length > 0) {
    policyName = `${currentLibrary.name} Policy`
  }

  let policyDescription = formValue.description
  if (!policyDescription && selectedPresets.length > 0) {
    const presetNames = selectedPresets.map(preset => preset.name).join(', ')
    policyDescription = `Policy for ${presetNames}`
  }

  return {
    ...formValue,
    name: policyName,
    description: policyDescription,
    presets: selectedPresets.map(preset => ({
      preset_id: preset.preset_id || preset.id,
      weight: preset.weight || 1.0,
      customSignals: preset.customSignals || null,
    })),
  }
}

export function usePolicyBuilderState({ policy, libraryId, libraries }) {
  const form = ref(createDefaultPolicyForm(unref(libraryId)))
  const selectedPresets = ref([])
  const expandedPresetIds = ref(new Set())

  const totalWeight = computed(() => {
    return form.value.preset_weight + form.value.profile_weight + form.value.pattern_weight +
      form.value.rag_weight + form.value.history_weight
  })

  const currentLibrary = computed(() => {
    if (!form.value.library_id) return null
    const availableLibraries = Array.isArray(unref(libraries)) ? unref(libraries) : []
    return availableLibraries.find(library => library.id === form.value.library_id) || {
      id: form.value.library_id,
      name: 'Unknown',
    }
  })

  const hasExistingPresets = computed(() => {
    return unref(policy)?.presets?.length > 0 || selectedPresets.value.length > 0
  })

  const isValid = computed(() => {
    const hasBasicInfo = form.value.library_id && selectedPresets.value.length > 0
    const weightsValid = Math.abs(totalWeight.value - 1) <= 0.001
    return hasBasicInfo && weightsValid
  })

  const resetForm = () => {
    form.value = createDefaultPolicyForm(unref(libraryId))
    selectedPresets.value = []
    expandedPresetIds.value = new Set()
  }

  const loadPolicy = (newPolicy) => {
    if (!newPolicy) {
      resetForm()
      return
    }

    form.value = mapPolicyToForm(newPolicy)
    selectedPresets.value = mapPolicyPresets(newPolicy)
  }

  watch(policy, loadPolicy, { immediate: true })

  watch(libraryId, (newLibraryId) => {
    if (newLibraryId && !unref(policy)) {
      form.value.library_id = newLibraryId
    }
  }, { immediate: true })

  const isPresetSelected = (presetId) => {
    return selectedPresets.value.some(preset => preset.id === presetId || preset.preset_id === presetId)
  }

  const togglePresetSelection = (preset) => {
    const id = preset.id || preset.preset_id
    const index = selectedPresets.value.findIndex(item => item.id === id || item.preset_id === id)

    if (index >= 0) {
      selectedPresets.value.splice(index, 1)
      expandedPresetIds.value.delete(id)
      return
    }

    selectedPresets.value.push({
      ...preset,
      id: preset.id ?? preset.preset_id,
      preset_id: preset.preset_id ?? preset.id,
      weight: preset.weight ?? 1.0,
    })
  }

  const addAllSuggested = (suggestedPresets = []) => {
    suggestedPresets.forEach((preset) => {
      if (!isPresetSelected(preset.id)) {
        togglePresetSelection(preset)
      }
    })
  }

  const removePreset = (presetId) => {
    const index = selectedPresets.value.findIndex(preset => preset.preset_id === presetId || preset.id === presetId)
    if (index >= 0) {
      selectedPresets.value.splice(index, 1)
    }
    expandedPresetIds.value.delete(presetId)
  }

  const togglePresetCustomize = (presetId) => {
    if (expandedPresetIds.value.has(presetId)) {
      expandedPresetIds.value.delete(presetId)
    } else {
      expandedPresetIds.value.add(presetId)
    }
    expandedPresetIds.value = new Set(expandedPresetIds.value)
  }

  const getCustomSignalList = (preset, signalType, key) => {
    return preset.customSignals?.[signalType]?.[key] || []
  }

  const findSelectedPreset = (presetId) => {
    return selectedPresets.value.find(preset => preset.preset_id === presetId || preset.id === presetId) || null
  }

  const ensurePresetSignalConfig = (preset, signalType) => {
    if (!preset.customSignals) preset.customSignals = {}
    if (!preset.customSignals[signalType]) preset.customSignals[signalType] = {}
    return preset.customSignals[signalType]
  }

  const addCustomSignal = (preset, signalType, event) => {
    const value = event.target.value
    if (!value) return
    event.target.value = ''

    const [action, item] = value.split(':')
    const config = ensurePresetSignalConfig(preset, signalType)
    if (!config[action]) config[action] = []

    if (!config[action].includes(item)) {
      config[action].push(item)
    }
    cleanupCustomSignals(preset)
  }

  const removeCustomSignal = (preset, signalType, key, item) => {
    if (preset.customSignals?.[signalType]?.[key]) {
      preset.customSignals[signalType][key] = preset.customSignals[signalType][key].filter(value => value !== item)
    }
    cleanupCustomSignals(preset)
  }

  const addIntentSignal = ({ presetId, signalType, key, value, extras = {} }) => {
    const preset = findSelectedPreset(presetId)
    if (!preset || !value) return

    const config = ensurePresetSignalConfig(preset, signalType)
    if (!Array.isArray(config[key])) config[key] = []
    if (!config[key].includes(value)) {
      config[key].push(value)
    }
    Object.assign(config, extras)
    cleanupCustomSignals(preset)
  }

  const setIntentSignalConfig = ({ presetId, signalType, config, appendArrays = false }) => {
    const preset = findSelectedPreset(presetId)
    if (!preset || !config || typeof config !== 'object') return

    const existing = ensurePresetSignalConfig(preset, signalType)
    for (const [key, value] of Object.entries(config)) {
      if (appendArrays && Array.isArray(value)) {
        const current = Array.isArray(existing[key]) ? existing[key] : []
        existing[key] = Array.from(new Set([...current, ...value]))
      } else {
        existing[key] = value
      }
    }
    cleanupCustomSignals(preset)
  }

  const clearIntentSignalConfig = ({ presetId, signalType }) => {
    const preset = findSelectedPreset(presetId)
    if (!preset?.customSignals?.[signalType]) return

    delete preset.customSignals[signalType]
    cleanupCustomSignals(preset)
  }

  const buildSavePayload = () => {
    return buildPolicySavePayload(form.value, selectedPresets.value, currentLibrary.value)
  }

  return {
    form,
    selectedPresets,
    expandedPresetIds,
    totalWeight,
    currentLibrary,
    hasExistingPresets,
    isValid,
    resetForm,
    loadPolicy,
    isPresetSelected,
    togglePresetSelection,
    addAllSuggested,
    removePreset,
    togglePresetCustomize,
    getCustomSignalList,
    findSelectedPreset,
    ensurePresetSignalConfig,
    addCustomSignal,
    removeCustomSignal,
    addIntentSignal,
    setIntentSignalConfig,
    clearIntentSignalConfig,
    cleanupCustomSignals,
    buildSavePayload,
  }
}
