/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { computed, ref, unref, watch } from 'vue'
import {
  applyIntentSignalCommandPlan,
  buildDeclaredIntentFromIntentSignals,
} from '@/utils/policyIntentSignalDraft'

export function usePolicyIntentSignalDraft({ libraryId } = {}) {
  const acceptedSignals = ref([])

  const declaredIntent = computed(() => (
    buildDeclaredIntentFromIntentSignals(acceptedSignals.value)
  ))

  const nativeIntentEstablishment = computed(() => {
    if (!declaredIntent.value) return null

    return {
      declared_intent: declaredIntent.value,
    }
  })

  const applyCommandPlan = (commandPlan) => {
    const nextSignals = applyIntentSignalCommandPlan(
      acceptedSignals.value,
      commandPlan
    )
    const changed = JSON.stringify(nextSignals) !== JSON.stringify(acceptedSignals.value)
    acceptedSignals.value = nextSignals
    return changed
  }

  const reset = () => {
    acceptedSignals.value = []
  }

  if (libraryId) {
    watch(() => unref(libraryId), reset)
  }

  return {
    acceptedSignals,
    declaredIntent,
    nativeIntentEstablishment,
    applyCommandPlan,
    reset,
  }
}
