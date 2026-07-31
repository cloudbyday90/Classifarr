/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const NATIVE_POLICY_INTENT_CONTRACT_SOURCE = 'native_intent'
const NATIVE_POLICY_READ_SOURCE = 'native_intent'
const NATIVE_POLICY_READ_STATUS_ACTIVE = 'native_intent_active'

const POLICY_NATIVE_POLICY_READ_STATE_IDS = Object.freeze({
  VALIDATED_NATIVE: 'validated_native',
  NATIVE_RECOVERY_REQUIRED: 'native_recovery_required',
  COMPATIBILITY: 'compatibility',
})

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function hasNativeIntentIndication(policy = {}) {
  const contract = asObject(policy?.policy_intent_contract)
  const trace = asObject(policy?.policy_intent_read_trace)

  return contract.source === NATIVE_POLICY_INTENT_CONTRACT_SOURCE ||
    trace.source === NATIVE_POLICY_READ_SOURCE
}

/**
 * A native source alone can describe an invalid or conflicting policy record.
 * Only the validated active server projection selects native policy inspection.
 */
function buildPolicyNativePolicyReadState(policy = {}) {
  const contract = asObject(policy?.policy_intent_contract)
  const trace = asObject(policy?.policy_intent_read_trace)
  const isValidatedNative = contract.source === NATIVE_POLICY_INTENT_CONTRACT_SOURCE &&
    contract.validation?.valid === true &&
    trace.source === NATIVE_POLICY_READ_SOURCE &&
    trace.status === NATIVE_POLICY_READ_STATUS_ACTIVE

  if (isValidatedNative) {
    return {
      stateId: POLICY_NATIVE_POLICY_READ_STATE_IDS.VALIDATED_NATIVE,
      isValidatedNative: true,
      requiresNativeRecovery: false,
      isCompatibility: false,
    }
  }

  if (hasNativeIntentIndication(policy)) {
    return {
      stateId: POLICY_NATIVE_POLICY_READ_STATE_IDS.NATIVE_RECOVERY_REQUIRED,
      isValidatedNative: false,
      requiresNativeRecovery: true,
      isCompatibility: false,
    }
  }

  return {
    stateId: POLICY_NATIVE_POLICY_READ_STATE_IDS.COMPATIBILITY,
    isValidatedNative: false,
    requiresNativeRecovery: false,
    isCompatibility: true,
  }
}

export {
  NATIVE_POLICY_INTENT_CONTRACT_SOURCE,
  NATIVE_POLICY_READ_SOURCE,
  NATIVE_POLICY_READ_STATUS_ACTIVE,
  POLICY_NATIVE_POLICY_READ_STATE_IDS,
  buildPolicyNativePolicyReadState,
}
