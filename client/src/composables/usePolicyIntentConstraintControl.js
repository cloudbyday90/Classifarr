/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { computed, ref } from 'vue'
import { buildPolicyIntentConstraintCommandPlan } from '@/utils/policyIntentConstraintDraft'
import { buildPolicyIntentConstraintControlSurface } from '@/utils/policyIntentConstraintControlSurface'

function normalizedControlId(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function constraintProjectionInput(constraintProps = {}) {
  const source = constraintProps && typeof constraintProps === 'object'
    ? constraintProps
    : {}

  return {
    constraintDecisionModel: source.constraintDecisionModel,
    constraintValueEligibility: source.constraintValueEligibility,
    constraintDraftCommands: source.constraintDraftCommands,
  }
}

export function usePolicyIntentConstraintControl({
  controlId,
  constraintProps,
} = {}) {
  const resolvedControlId = normalizedControlId(controlId)
  const draftValue = ref('')
  const confirmed = ref(false)

  const control = computed(() => {
    if (!resolvedControlId) return null

    const surface = buildPolicyIntentConstraintControlSurface(
      constraintProjectionInput(constraintProps)
    )

    return surface.available
      ? surface.controls.find(candidate => candidate.controlId === resolvedControlId) || null
      : null
  })
  const selectedValue = computed(() => (
    typeof draftValue.value === 'string' ? draftValue.value.trim() : ''
  ))
  const canStage = computed(() => Boolean(control.value) && Boolean(selectedValue.value) && (
    !control.value.requiresExplicitOperatorAction || confirmed.value === true
  ))
  const stageActionLabel = computed(() => {
    const actionLabel = control.value?.actionLabel || 'Stage constraint'

    if (!selectedValue.value) {
      return `${actionLabel}: choose an approved value first.`
    }

    if (control.value?.requiresExplicitOperatorAction && confirmed.value !== true) {
      return `${actionLabel}: confirm this explicit operator choice first.`
    }

    return actionLabel
  })

  function setDraftValue(value) {
    const nextValue = typeof value === 'string' ? value : ''
    if (draftValue.value === nextValue) return

    draftValue.value = nextValue
    confirmed.value = false
  }

  function reset() {
    draftValue.value = ''
    confirmed.value = false
  }

  function buildCommandPlan() {
    if (!control.value || !canStage.value) return null

    const plan = buildPolicyIntentConstraintCommandPlan({
      ...constraintProjectionInput(constraintProps),
      selection: {
        controlId: control.value.controlId,
        value: draftValue.value,
        explicitOperatorAction: true,
      },
    })

    return plan?.commands?.length ? plan : null
  }

  return {
    control,
    draftValue,
    confirmed,
    canStage,
    stageActionLabel,
    setDraftValue,
    reset,
    buildCommandPlan,
  }
}
