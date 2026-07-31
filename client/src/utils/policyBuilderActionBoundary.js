/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyCompatibilitySaveActionBoundary,
} from './policyCompatibilitySaveActionBoundary'
import {
  buildPolicyNativeCreateActionBoundary,
} from './policyNativeCreateActionBoundary'

function buildPolicyBuilderSaveBoundary({
  form = {},
  selectedPresets = [],
  hasExistingPolicy = false,
  nativeIntentEstablishment = null,
  compatibilityRoutingReadiness = null,
} = {}) {
  if (!hasExistingPolicy) {
    return buildPolicyNativeCreateActionBoundary({ form, nativeIntentEstablishment })
  }

  return buildPolicyCompatibilitySaveActionBoundary({
    form,
    selectedPresets,
    compatibilityRoutingReadiness,
  })
}

export {
  buildPolicyBuilderSaveBoundary,
}
