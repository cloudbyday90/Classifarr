/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

function asNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function hasSelectedLibrary(form = {}) {
  return Boolean(form?.library_id || form?.libraryId)
}

function countSelectedPresets(selectedPresets = []) {
  return Array.isArray(selectedPresets) ? selectedPresets.length : 0
}

function weightsAreValid(totalWeight) {
  return Math.abs(asNumber(totalWeight) - 1) <= 0.001
}

function formatPercent(value) {
  return `${Math.round(asNumber(value) * 100)}%`
}

function buildPolicyBuilderSaveBoundary({
  form = {},
  selectedPresets = [],
  totalWeight = 0,
  hasExistingPolicy = false,
  routingReadiness = null,
} = {}) {
  const selectedPresetCount = countSelectedPresets(selectedPresets)
  const hasStarterTemplate = selectedPresetCount > 0
  const librarySelected = hasSelectedLibrary(form)
  const weightsValid = weightsAreValid(totalWeight)
  const saveLabel = hasExistingPolicy ? 'Save Policy' : 'Create Policy'

  if (!librarySelected) {
    return {
      canSave: false,
      saveLabel,
      deferLabel: 'Defer for now',
      status: 'blocked',
      tone: 'warning',
      statusLabel: 'Choose a library before saving',
      statusMessage: 'Select the media-server library this policy should describe.',
      disabledReason: 'Choose a destination library before saving.',
    }
  }

  if (!weightsValid) {
    return {
      canSave: false,
      saveLabel,
      deferLabel: 'Defer for now',
      status: 'blocked',
      tone: 'warning',
      statusLabel: 'Adjust weights before saving',
      statusMessage: `Scoring weights currently total ${formatPercent(totalWeight)}. They must total 100%.`,
      disabledReason: 'Adjust scoring weights to total 100% before saving.',
    }
  }

  if (routingReadiness && !routingReadiness.canRoute) {
    return {
      canSave: true,
      saveLabel,
      deferLabel: 'Defer for now',
      status: 'ready_with_warning',
      tone: 'info',
      statusLabel: 'Ready to save; routing still needs setup',
      statusMessage: 'Policy intent can be saved now. Approved matches will still need routing setup before automation can apply them.',
      disabledReason: '',
    }
  }

  return {
    canSave: true,
    saveLabel,
    deferLabel: 'Defer for now',
    status: 'ready',
    tone: 'success',
    statusLabel: 'Ready to save',
    statusMessage: hasStarterTemplate
      ? 'This policy has a selected library, optional starter-template seed, and valid weight total.'
      : 'This policy has a selected library and valid weight total. Starter templates are optional accelerators.',
    disabledReason: '',
  }
}

export {
  buildPolicyBuilderSaveBoundary,
}
