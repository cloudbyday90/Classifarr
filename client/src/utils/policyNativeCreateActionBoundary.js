/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

function hasSelectedLibrary(form = {}) {
  return Boolean(form?.library_id || form?.libraryId)
}

function hasDeclaredNativePurpose(nativeIntentEstablishment = null) {
  const purpose = nativeIntentEstablishment?.declared_intent?.purpose
  return Array.isArray(purpose) && purpose.length > 0
}

function buildPolicyNativeCreateActionBoundary({
  form = {},
  nativeIntentEstablishment = null,
} = {}) {
  if (!hasSelectedLibrary(form)) {
    return {
      canSave: false,
      saveLabel: 'Create Policy',
      deferLabel: 'Defer for now',
      disabledReason: 'Choose a destination library before creating a policy.',
    }
  }

  if (!hasDeclaredNativePurpose(nativeIntentEstablishment)) {
    return {
      canSave: false,
      saveLabel: 'Create Policy',
      deferLabel: 'Defer for now',
      disabledReason: 'Accept one or more observed values that should define this destination.',
    }
  }

  return {
    canSave: true,
    saveLabel: 'Create Policy',
    deferLabel: 'Defer for now',
    disabledReason: '',
  }
}

export {
  buildPolicyNativeCreateActionBoundary,
  hasDeclaredNativePurpose,
  hasSelectedLibrary,
}
