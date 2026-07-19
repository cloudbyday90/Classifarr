/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { computed, ref, unref, watch } from 'vue'
import {
  applyObservedSuggestionCommandPlan,
  buildDeclaredIntentFromObservedSuggestions,
} from '@/utils/policyObservedSuggestionDraft'

export function usePolicyObservedSuggestionDraft({ libraryId } = {}) {
  const acceptedCandidates = ref([])

  const declaredIntent = computed(() => (
    buildDeclaredIntentFromObservedSuggestions(acceptedCandidates.value)
  ))

  const nativeIntentEstablishment = computed(() => {
    if (!declaredIntent.value) return null

    return {
      declared_intent: declaredIntent.value,
    }
  })

  const applyCommandPlan = (commandPlan) => {
    const nextCandidates = applyObservedSuggestionCommandPlan(
      acceptedCandidates.value,
      commandPlan
    )
    const changed = JSON.stringify(nextCandidates) !== JSON.stringify(acceptedCandidates.value)
    acceptedCandidates.value = nextCandidates
    return changed
  }

  const reset = () => {
    acceptedCandidates.value = []
  }

  if (libraryId) {
    watch(() => unref(libraryId), reset)
  }

  return {
    acceptedCandidates,
    declaredIntent,
    nativeIntentEstablishment,
    applyCommandPlan,
    reset,
  }
}
