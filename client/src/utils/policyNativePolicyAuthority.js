/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  NATIVE_POLICY_INTENT_CONTRACT_SOURCE,
  buildPolicyNativePolicyReadState,
} from './policyNativePolicyReadState'

/**
 * This selects a browser display surface from the server's policy read model.
 * Server routes remain the authority for every policy mutation and transition.
 */
function hasServerReportedNativePolicyIntent(policy = null) {
  return buildPolicyNativePolicyReadState(policy).isValidatedNative
}

export {
  NATIVE_POLICY_INTENT_CONTRACT_SOURCE,
  hasServerReportedNativePolicyIntent,
}
