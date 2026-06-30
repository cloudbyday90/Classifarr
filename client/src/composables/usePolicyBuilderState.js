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
import { usePolicyIntentDraft } from '@/composables/usePolicyIntentDraft'
import {
  POLICY_BUILDER_COMBINATION_MODES,
  POLICY_BUILDER_THRESHOLD_FIELDS,
  POLICY_BUILDER_WEIGHT_FIELDS,
  normalizePolicyBuilderFormField,
} from '@/utils/policyBuilderAdvancedControls'
import { clonePolicyIntentDraftForWrite } from '@/utils/policyIntentWritePreflight'

export {
  POLICY_BUILDER_COMBINATION_MODES,
  POLICY_BUILDER_THRESHOLD_FIELDS,
  POLICY_BUILDER_WEIGHT_FIELDS,
}

export function normalizePolicyFormField(field, value) {
  return normalizePolicyBuilderFormField(field, value)
}

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

const POLICY_SAVE_FORM_FIELDS = Object.freeze(Object.keys(createDefaultPolicyForm()))

export function pickPolicySaveFormFields(formValue = {}) {
  return POLICY_SAVE_FORM_FIELDS.reduce((payload, field) => {
    payload[field] = formValue[field]
    return payload
  }, {})
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

export function buildPolicySavePayload(formValue, selectedPresets, currentLibrary, intentDraft = null) {
  let policyName = formValue.name
  if (!policyName && currentLibrary && selectedPresets.length > 0) {
    policyName = `${currentLibrary.name} Policy`
  }

  let policyDescription = formValue.description
  if (!policyDescription && selectedPresets.length > 0) {
    const presetNames = selectedPresets.map(preset => preset.name).join(', ')
    policyDescription = `Policy for ${presetNames}`
  }

  const payload = {
    ...pickPolicySaveFormFields(formValue),
    name: policyName,
    description: policyDescription,
    presets: selectedPresets.map(preset => ({
      preset_id: preset.preset_id || preset.id,
      weight: preset.weight || 1.0,
      customSignals: preset.customSignals || null,
    })),
  }

  const policyIntentDraft = clonePolicyIntentDraftForWrite(intentDraft)
  if (policyIntentDraft) {
    payload.policyIntentDraft = policyIntentDraft
  }

  return payload
}

export function usePolicyBuilderState({ policy, libraryId, libraries }) {
  const form = ref(createDefaultPolicyForm(unref(libraryId)))
  const selectedPresets = ref([])
  const expandedPresetIds = ref(new Set())
  const {
    intentDraft,
    addSignal: addIntentDraftSignal,
    removeSignalValue: removeIntentDraftSignalValue,
    setSignalConfig: setIntentDraftSignalConfig,
    setSignalMetadata: setIntentDraftSignalMetadata,
    setSignalRemoval: setIntentDraftSignalRemoval,
    clearSignalConfig: clearIntentDraftSignalConfig,
    buildSelectedPresetsFromDraft,
  } = usePolicyIntentDraft(selectedPresets)

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

  const setPresetWeight = ({ presetId, weight }) => {
    const preset = findSelectedPreset(presetId)
    const numericWeight = Number(weight)
    if (!preset || !Number.isFinite(numericWeight)) return false

    preset.weight = Math.min(2, Math.max(0.1, numericWeight))
    return true
  }

  const setFormField = ({ field, value }) => {
    const normalizedValue = normalizePolicyFormField(field, value)
    if (normalizedValue === null) return false

    form.value[field] = normalizedValue
    return true
  }

  const getCustomSignalList = (preset, signalType, key) => {
    return preset.customSignals?.[signalType]?.[key] || []
  }

  const findSelectedPreset = (presetId) => {
    return selectedPresets.value.find(preset => preset.preset_id === presetId || preset.id === presetId) || null
  }

  const addIntentSignal = ({ presetId, signalType, key, value, extras = {} }) => {
    addIntentDraftSignal({ presetId, signalType, key, value, extras })
  }

  const removeIntentSignalValue = ({ presetId, signalType, key, value }) => {
    removeIntentDraftSignalValue({ presetId, signalType, key, value })
  }

  const addCustomSignal = ({ presetId, signalType, key, value, extras = {} }) => {
    return addIntentDraftSignal({ presetId, signalType, key, value, extras })
  }

  const removeCustomSignal = ({ presetId, signalType, key, value }) => {
    return removeIntentDraftSignalValue({ presetId, signalType, key, value })
  }

  const setIntentSignalConfig = ({ presetId, signalType, config, appendArrays = false }) => {
    setIntentDraftSignalConfig({ presetId, signalType, config, appendArrays })
  }

  const clearIntentSignalConfig = ({ presetId, signalType }) => {
    clearIntentDraftSignalConfig({ presetId, signalType })
  }

  const setIntentSignalMetadata = ({ presetId, signalType, metadata, baseMetadata = {} }) => {
    setIntentDraftSignalMetadata({ presetId, signalType, metadata, baseMetadata })
  }

  const setIntentSignalRemoval = ({ presetId, signalType, key, value, removed = true }) => {
    setIntentDraftSignalRemoval({ presetId, signalType, key, value, removed })
  }

  const buildSavePayload = () => {
    return buildPolicySavePayload(form.value, buildSelectedPresetsFromDraft(), currentLibrary.value, intentDraft.value)
  }

  return {
    form,
    selectedPresets,
    intentDraft,
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
    setPresetWeight,
    setFormField,
    getCustomSignalList,
    findSelectedPreset,
    addCustomSignal,
    removeCustomSignal,
    addIntentSignal,
    removeIntentSignalValue,
    setIntentSignalConfig,
    setIntentSignalMetadata,
    setIntentSignalRemoval,
    clearIntentSignalConfig,
    cleanupCustomSignals,
    buildSavePayload,
  }
}
