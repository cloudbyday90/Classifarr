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
import {
  applyPolicyIntentConstraintCommandPlan,
} from '@/utils/policyIntentConstraintDraft'

export function usePolicyIntentConstraintDraft({
  libraryId,
  constraintValueEligibility,
} = {}) {
  const constraintDraftCommands = ref([])

  const hasConstraintDraftCommands = computed(() => constraintDraftCommands.value.length > 0)

  const applyCommandPlan = (commandPlan) => {
    const nextCommands = applyPolicyIntentConstraintCommandPlan(
      constraintDraftCommands.value,
      commandPlan,
      { constraintValueEligibility: unref(constraintValueEligibility) }
    )
    const changed = JSON.stringify(nextCommands) !== JSON.stringify(constraintDraftCommands.value)
    constraintDraftCommands.value = nextCommands
    return changed
  }

  const reset = () => {
    constraintDraftCommands.value = []
  }

  if (libraryId) {
    watch(() => unref(libraryId), reset)
  }

  return {
    constraintDraftCommands,
    hasConstraintDraftCommands,
    applyCommandPlan,
    reset,
  }
}
