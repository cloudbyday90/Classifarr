/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { computed, ref, toValue } from 'vue'
import {
  buildPolicyIntentControlReadiness,
  resolvePolicyIntentOptionStates,
} from '@/utils/policyIntentSectionProjection'

function resolveSection(sectionSource) {
  const section = toValue(sectionSource)
  return section && typeof section === 'object' ? section : {}
}

function normalizeSelectedValues(value) {
  const values = Array.isArray(value) ? value : [value]
  const seenValues = new Set()

  return values.reduce((normalizedValues, candidate) => {
    const normalizedValue = String(candidate || '').trim()
    if (!normalizedValue) return normalizedValues

    const key = normalizedValue.toLowerCase()
    if (seenValues.has(key)) return normalizedValues

    seenValues.add(key)
    normalizedValues.push(normalizedValue)
    return normalizedValues
  }, [])
}

export function usePolicyIntentOptionAction(sectionSource, onAddValue = () => {}, options = {}) {
  const multiple = Boolean(options.multiple)
  const selectedValue = ref(multiple ? [] : '')
  const section = computed(() => resolveSection(sectionSource))
  const optionStates = computed(() => resolvePolicyIntentOptionStates(section.value))

  const controlReadiness = computed(() => {
    return buildPolicyIntentControlReadiness(section.value.key, {
      selectedValue: selectedValue.value,
      optionStates: optionStates.value,
      optionDiagnostics: section.value.optionDiagnostics,
    })
  })

  const submitSelectedValue = () => {
    if (!controlReadiness.value.canSubmit) return false
    if (!section.value.key) return false

    const submittedValues = multiple
      ? normalizeSelectedValues(selectedValue.value)
      : normalizeSelectedValues(selectedValue.value).slice(0, 1)

    if (submittedValues.length === 0) return false

    submittedValues.forEach((value) => {
      onAddValue({
        sectionKey: section.value.key,
        value,
      })
    })
    selectedValue.value = multiple ? [] : ''
    return true
  }

  return {
    selectedValue,
    optionStates,
    controlReadiness,
    submitSelectedValue,
  }
}
