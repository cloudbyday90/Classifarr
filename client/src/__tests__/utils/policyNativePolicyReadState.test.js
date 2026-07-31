/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  POLICY_NATIVE_POLICY_READ_STATE_IDS,
  buildPolicyNativePolicyReadState,
} from '@/utils/policyNativePolicyReadState'

function validatedNativePolicy(overrides = {}) {
  return {
    policy_intent_contract: {
      source: 'native_intent',
      validation: { valid: true },
    },
    policy_intent_read_trace: {
      source: 'native_intent',
      status: 'native_intent_active',
    },
    ...overrides,
  }
}

describe('policyNativePolicyReadState', () => {
  it('accepts only a server-validated active native read', () => {
    expect(buildPolicyNativePolicyReadState(validatedNativePolicy())).toEqual({
      stateId: POLICY_NATIVE_POLICY_READ_STATE_IDS.VALIDATED_NATIVE,
      isValidatedNative: true,
      requiresNativeRecovery: false,
      isCompatibility: false,
    })
  })

  it.each([
    ['invalid contract', validatedNativePolicy({
      policy_intent_contract: { source: 'native_intent', validation: { valid: false } },
      policy_intent_read_trace: { source: 'native_intent', status: 'native_intent_invalid' },
    })],
    ['authority conflict', validatedNativePolicy({
      policy_intent_contract: { source: 'native_intent', validation: { valid: false } },
      policy_intent_read_trace: { source: 'native_intent', status: 'native_intent_authority_conflict' },
    })],
    ['missing native trace', {
      policy_intent_contract: { source: 'native_intent', validation: { valid: true } },
    }],
    ['trace and contract mismatch', {
      policy_intent_contract: { source: 'legacy_presets', validation: { valid: true } },
      policy_intent_read_trace: { source: 'native_intent', status: 'native_intent_active' },
    }],
  ])('requires read-only native recovery for %s', (_label, policy) => {
    expect(buildPolicyNativePolicyReadState(policy)).toEqual({
      stateId: POLICY_NATIVE_POLICY_READ_STATE_IDS.NATIVE_RECOVERY_REQUIRED,
      isValidatedNative: false,
      requiresNativeRecovery: true,
      isCompatibility: false,
    })
  })

  it('keeps a policy without native read evidence in compatibility maintenance', () => {
    expect(buildPolicyNativePolicyReadState({
      policy_intent_contract: { source: 'legacy_presets', validation: { valid: true } },
      policy_intent_read_trace: {
        source: 'compatibility_bridge',
        status: 'compatibility_bridge_fallback',
      },
    })).toEqual({
      stateId: POLICY_NATIVE_POLICY_READ_STATE_IDS.COMPATIBILITY,
      isValidatedNative: false,
      requiresNativeRecovery: false,
      isCompatibility: true,
    })
  })
})
