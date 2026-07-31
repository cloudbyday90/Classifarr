/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildPolicyNativePolicyReadState } from './policyNativePolicyReadState'

const POLICY_BUILDER_EXPERIENCE_MODES = Object.freeze({
  NATIVE_CREATE: 'native_create',
  NATIVE_VIEW: 'native_view',
  NATIVE_RECOVERY: 'native_recovery',
  LEGACY_EDIT: 'legacy_edit',
})

function hasPersistedPolicyId(policy = null) {
  const policyId = Number(policy?.id)
  return Number.isInteger(policyId) && policyId > 0
}

function buildPolicyBuilderExperienceMode(policy = null) {
  let mode = POLICY_BUILDER_EXPERIENCE_MODES.NATIVE_CREATE

  if (hasPersistedPolicyId(policy)) {
    const nativeReadState = buildPolicyNativePolicyReadState(policy)
    mode = nativeReadState.isValidatedNative
      ? POLICY_BUILDER_EXPERIENCE_MODES.NATIVE_VIEW
      : nativeReadState.requiresNativeRecovery
        ? POLICY_BUILDER_EXPERIENCE_MODES.NATIVE_RECOVERY
        : POLICY_BUILDER_EXPERIENCE_MODES.LEGACY_EDIT
  }

  return {
    mode,
    isNativeCreate: mode === POLICY_BUILDER_EXPERIENCE_MODES.NATIVE_CREATE,
    isNativeView: mode === POLICY_BUILDER_EXPERIENCE_MODES.NATIVE_VIEW,
    isNativeRecovery: mode === POLICY_BUILDER_EXPERIENCE_MODES.NATIVE_RECOVERY,
    isLegacyEdit: mode === POLICY_BUILDER_EXPERIENCE_MODES.LEGACY_EDIT,
  }
}

export {
  POLICY_BUILDER_EXPERIENCE_MODES,
  buildPolicyBuilderExperienceMode,
  hasPersistedPolicyId,
}
