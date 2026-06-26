/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ref, unref } from 'vue'

const languageLabels = {
  da: 'Danish',
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fi: 'Finnish',
  fr: 'French',
  it: 'Italian',
  ja: 'Japanese',
  ka: 'Georgian',
  ko: 'Korean',
  no: 'Norwegian',
  pt: 'Portuguese',
  sv: 'Swedish',
  zh: 'Chinese',
}

export function formatLanguageCode(value) {
  const code = String(value || '').toLowerCase()
  return languageLabels[code] || String(value || '').toUpperCase()
}

export function usePolicyBuilderTemplateSignals({
  allPresets,
  cleanupCustomSignals,
}) {
  const newKeyword = ref('')

  const getAllPresets = () => {
    return Array.isArray(unref(allPresets)) ? unref(allPresets) : []
  }

  const findFullPreset = (selectedPreset) => {
    return getAllPresets().find(preset =>
      preset.id === selectedPreset?.id ||
      preset.id === selectedPreset?.preset_id
    ) || null
  }

  const getPresetBaseSignals = (selectedPreset, signalType, key) => {
    return findFullPreset(selectedPreset)?.signals?.[signalType]?.[key] || []
  }

  const getPresetBaseSignalConfig = (selectedPreset, signalType) => {
    return findFullPreset(selectedPreset)?.signals?.[signalType] || null
  }

  const hasPresetLanguageSignals = (preset) => {
    const baseConfig = getPresetBaseSignalConfig(preset, 'language')
    const customConfig = preset?.customSignals?.language
    return Boolean(
      baseConfig?.require_any?.length ||
      baseConfig?.exclude?.length ||
      customConfig?.require_any?.length ||
      customConfig?.exclude?.length
    )
  }

  const hasRuntimeSemanticsWarning = (preset) => {
    return Array.isArray(preset?.suggestion_warnings) &&
      preset.suggestion_warnings.includes('runtime_semantics_review_recommended')
  }

  const getPresetRuntimeSemantics = (preset) => {
    return preset?.runtimeSemantics || preset?.runtime_semantics || null
  }

  const getPresetRuntimeBadge = (preset) => {
    const semantics = getPresetRuntimeSemantics(preset)
    if (semantics?.badge_label) {
      const toneClasses = {
        info: 'bg-primary/10 text-primary',
        warning: 'bg-amber-500/10 text-amber-300',
        review: 'bg-amber-500/10 text-amber-300',
      }

      return {
        label: semantics.badge_label,
        className: toneClasses[semantics.badge_tone] || 'bg-gray-700 text-gray-300',
      }
    }

    if (hasPresetLanguageSignals(preset)) {
      return {
        label: 'Advisory by default',
        className: 'bg-amber-500/10 text-amber-300',
      }
    }

    return null
  }

  const getPresetRuntimeSummary = (preset) => {
    const semantics = getPresetRuntimeSemantics(preset)
    if (semantics?.summary) {
      return semantics.summary
    }

    return 'Advisory presets only influence score. Strict presets can block mismatched languages from ranking.'
  }

  const getPresetSignalStrict = (preset, signalType) => {
    if (typeof preset?.customSignals?.[signalType]?.strict === 'boolean') {
      return preset.customSignals[signalType].strict
    }

    return getPresetBaseSignalConfig(preset, signalType)?.strict === true
  }

  const setPresetSignalStrict = (preset, signalType, strict) => {
    if (!preset.customSignals) preset.customSignals = {}
    if (!preset.customSignals[signalType]) preset.customSignals[signalType] = {}

    const baseStrict = getPresetBaseSignalConfig(preset, signalType)?.strict === true
    if (strict === baseStrict) {
      delete preset.customSignals[signalType].strict
    } else {
      preset.customSignals[signalType].strict = strict
    }

    cleanupCustomSignals(preset)
  }

  const isSignalRemoved = (preset, signalType, key, item) => {
    return preset?.customSignals?.removed?.[signalType]?.[key]?.includes(item) || false
  }

  const markSignalRemoved = (preset, signalType, key, item) => {
    if (!preset.customSignals) preset.customSignals = {}
    if (!preset.customSignals.removed) preset.customSignals.removed = {}
    if (!preset.customSignals.removed[signalType]) preset.customSignals.removed[signalType] = {}
    if (!preset.customSignals.removed[signalType][key]) preset.customSignals.removed[signalType][key] = []

    if (!preset.customSignals.removed[signalType][key].includes(item)) {
      preset.customSignals.removed[signalType][key].push(item)
    }
    cleanupCustomSignals(preset)
  }

  const unmarkSignalRemoved = (preset, signalType, key, item) => {
    if (preset?.customSignals?.removed?.[signalType]?.[key]) {
      preset.customSignals.removed[signalType][key] =
        preset.customSignals.removed[signalType][key].filter(value => value !== item)
    }
    cleanupCustomSignals(preset)
  }

  const addKeywordToPreset = (preset) => {
    const keyword = newKeyword.value.trim().toLowerCase()
    if (!keyword) return
    newKeyword.value = ''

    if (!preset.customSignals) preset.customSignals = {}
    if (!preset.customSignals.keywords) preset.customSignals.keywords = {}
    if (!preset.customSignals.keywords.require_any) preset.customSignals.keywords.require_any = []

    if (!preset.customSignals.keywords.require_any.includes(keyword)) {
      preset.customSignals.keywords.require_any.push(keyword)
    }
    cleanupCustomSignals(preset)
  }

  return {
    newKeyword,
    findFullPreset,
    getPresetBaseSignals,
    getPresetBaseSignalConfig,
    hasPresetLanguageSignals,
    hasRuntimeSemanticsWarning,
    getPresetRuntimeSemantics,
    getPresetRuntimeBadge,
    getPresetRuntimeSummary,
    getPresetSignalStrict,
    setPresetSignalStrict,
    isSignalRemoved,
    markSignalRemoved,
    unmarkSignalRemoved,
    addKeywordToPreset,
    formatLanguageCode,
  }
}
