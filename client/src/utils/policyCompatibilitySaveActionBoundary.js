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

function buildPolicyCompatibilitySaveActionBoundary({
  form = {},
  selectedPresets = [],
  totalWeight = 0,
  compatibilityRoutingReadiness = null,
} = {}) {
  const hasStarterTemplate = countSelectedPresets(selectedPresets) > 0

  if (!hasSelectedLibrary(form)) {
    return {
      canSave: false,
      saveLabel: 'Save Policy',
      deferLabel: 'Defer for now',
      status: 'blocked',
      tone: 'warning',
      statusLabel: 'Choose a library before saving',
      statusMessage: 'Select the media-server library this policy should describe.',
      disabledReason: 'Choose a destination library before saving.',
    }
  }

  if (!weightsAreValid(totalWeight)) {
    return {
      canSave: false,
      saveLabel: 'Save Policy',
      deferLabel: 'Defer for now',
      status: 'blocked',
      tone: 'warning',
      statusLabel: 'Adjust weights before saving',
      statusMessage: `Scoring weights currently total ${formatPercent(totalWeight)}. They must total 100%.`,
      disabledReason: 'Adjust scoring weights to total 100% before saving.',
    }
  }

  if (compatibilityRoutingReadiness && !compatibilityRoutingReadiness.canRoute) {
    return {
      canSave: true,
      saveLabel: 'Save Policy',
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
    saveLabel: 'Save Policy',
    deferLabel: 'Defer for now',
    status: 'ready',
    tone: 'success',
    statusLabel: 'Ready to save',
    statusMessage: hasStarterTemplate
      ? 'This compatibility policy has a selected library, optional starter-template seed, and valid weight total.'
      : 'This compatibility policy has a selected library and valid weight total. Starter templates are optional accelerators.',
    disabledReason: '',
  }
}

export {
  buildPolicyCompatibilitySaveActionBoundary,
}
