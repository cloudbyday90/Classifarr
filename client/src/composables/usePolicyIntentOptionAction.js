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

export function usePolicyIntentOptionAction(sectionSource, onAddValue = () => {}) {
  const selectedValue = ref('')
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
    if (!section.value.key || !selectedValue.value) return false

    onAddValue({
      sectionKey: section.value.key,
      value: selectedValue.value,
    })
    selectedValue.value = ''
    return true
  }

  return {
    selectedValue,
    optionStates,
    controlReadiness,
    submitSelectedValue,
  }
}
