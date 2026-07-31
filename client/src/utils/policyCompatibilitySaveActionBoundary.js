/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

function hasSelectedLibrary(form = {}) {
  return Boolean(form?.library_id || form?.libraryId)
}

function countSelectedPresets(selectedPresets = []) {
  return Array.isArray(selectedPresets) ? selectedPresets.length : 0
}

function buildPolicyCompatibilitySaveActionBoundary({
  form = {},
  selectedPresets = [],
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
      ? 'This compatibility policy has a selected library and an optional starter-template seed.'
      : 'This compatibility policy has a selected library. Starter templates are optional accelerators.',
    disabledReason: '',
  }
}

export {
  buildPolicyCompatibilitySaveActionBoundary,
}
