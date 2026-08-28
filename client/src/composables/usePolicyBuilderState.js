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
import { clonePolicyIntentDraftForWrite } from '@/utils/policyIntentWritePreflight'

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
    priority: policy.priority ?? 5,
    sort_order: policy.sort_order ?? 0,
    auto_classify_threshold: policy.auto_classify_threshold ?? 85,
    prompt_threshold: policy.prompt_threshold ?? 60,
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
  if (!policyName && currentLibrary) {
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
  const {
    intentDraft,
    addSignal: addIntentDraftSignal,
    removeSignalValue: removeIntentDraftSignalValue,
    setSignalConfig: setIntentDraftSignalConfig,
    clearSignalConfig: clearIntentDraftSignalConfig,
    buildSelectedPresetsFromDraft,
  } = usePolicyIntentDraft(selectedPresets)

  const currentLibrary = computed(() => {
    if (!form.value.library_id) return null
    const availableLibraries = Array.isArray(unref(libraries)) ? unref(libraries) : []
    return availableLibraries.find(library => library.id === form.value.library_id) || {
      id: form.value.library_id,
      name: 'Unknown',
    }
  })

  const isValid = computed(() => {
    return Boolean(form.value.library_id)
  })

  const resetForm = () => {
    form.value = createDefaultPolicyForm(unref(libraryId))
    selectedPresets.value = []
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

  const addIntentSignal = ({ presetId, signalType, key, value, extras = {} }) => {
    addIntentDraftSignal({ presetId, signalType, key, value, extras })
  }

  const removeIntentSignalValue = ({ presetId, signalType, key, value }) => {
    removeIntentDraftSignalValue({ presetId, signalType, key, value })
  }

  const setIntentSignalConfig = ({ presetId, signalType, config, appendArrays = false }) => {
    setIntentDraftSignalConfig({ presetId, signalType, config, appendArrays })
  }

  const clearIntentSignalConfig = ({ presetId, signalType }) => {
    clearIntentDraftSignalConfig({ presetId, signalType })
  }

  const applyProfilePurposeSuggestion = async (rules) => {
    const { buildPolicyCompatibilityProfileSuggestionDraftPlan } = await import(
      '@/utils/policyCompatibilityProfileSuggestionDraft'
    )
    const plan = buildPolicyCompatibilityProfileSuggestionDraftPlan({
      selectedPresets: selectedPresets.value,
      rules,
    })
    if (!plan.ok) return false

    plan.commands.forEach(command => {
      setIntentDraftSignalConfig(command)
    })
    return true
  }

  const buildSavePayload = () => {
    return buildPolicySavePayload(form.value, buildSelectedPresetsFromDraft(), currentLibrary.value, intentDraft.value)
  }

  return {
    form,
    selectedPresets,
    intentDraft,
    currentLibrary,
    isValid,
    resetForm,
    loadPolicy,
    addIntentSignal,
    removeIntentSignalValue,
    setIntentSignalConfig,
    clearIntentSignalConfig,
    applyProfilePurposeSuggestion,
    cleanupCustomSignals,
    buildSavePayload,
  }
}
