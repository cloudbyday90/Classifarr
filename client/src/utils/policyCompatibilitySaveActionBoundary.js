/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

function hasSelectedLibrary(form = {}) {
  return Boolean(form?.library_id || form?.libraryId)
}

function buildPolicyCompatibilitySaveActionBoundary({
  form = {},
} = {}) {
  if (!hasSelectedLibrary(form)) {
    return {
      canSave: false,
      saveLabel: 'Save Policy',
      deferLabel: 'Defer for now',
      disabledReason: 'Choose a destination library before saving.',
    }
  }

  return {
    canSave: true,
    saveLabel: 'Save Policy',
    deferLabel: 'Defer for now',
    disabledReason: '',
  }
}

export {
  buildPolicyCompatibilitySaveActionBoundary,
}
