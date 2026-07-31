/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  POLICY_BUILDER_EXPERIENCE_MODES,
  buildPolicyBuilderExperienceMode,
} from '@/utils/policyBuilderExperienceMode'

describe('policyBuilderExperienceMode', () => {
  it('uses the native create surface until a persisted policy exists', () => {
    expect(buildPolicyBuilderExperienceMode()).toEqual({
      mode: POLICY_BUILDER_EXPERIENCE_MODES.NATIVE_CREATE,
      isNativeCreate: true,
      isNativeView: false,
      isNativeRecovery: false,
      isLegacyEdit: false,
    })
    expect(buildPolicyBuilderExperienceMode({ id: 'invalid' })).toEqual({
      mode: POLICY_BUILDER_EXPERIENCE_MODES.NATIVE_CREATE,
      isNativeCreate: true,
      isNativeView: false,
      isNativeRecovery: false,
      isLegacyEdit: false,
    })
  })

  it('retains the compatibility edit surface for a persisted policy', () => {
    expect(buildPolicyBuilderExperienceMode({ id: 12 })).toEqual({
      mode: POLICY_BUILDER_EXPERIENCE_MODES.LEGACY_EDIT,
      isNativeCreate: false,
      isNativeView: false,
      isNativeRecovery: false,
      isLegacyEdit: true,
    })
  })

  it('uses the native policy view only for a validated active server read', () => {
    expect(buildPolicyBuilderExperienceMode({
      id: 12,
      policy_intent_contract: { source: 'native_intent', validation: { valid: true } },
      policy_intent_read_trace: { source: 'native_intent', status: 'native_intent_active' },
    })).toEqual({
      mode: POLICY_BUILDER_EXPERIENCE_MODES.NATIVE_VIEW,
      isNativeCreate: false,
      isNativeView: true,
      isNativeRecovery: false,
      isLegacyEdit: false,
    })

    expect(buildPolicyBuilderExperienceMode({
      id: 12,
      policy_intent_contract: { source: 'unknown' },
    })).toEqual({
      mode: POLICY_BUILDER_EXPERIENCE_MODES.LEGACY_EDIT,
      isNativeCreate: false,
      isNativeView: false,
      isNativeRecovery: false,
      isLegacyEdit: true,
    })
  })

  it('uses read-only recovery when native evidence is invalid or incomplete', () => {
    expect(buildPolicyBuilderExperienceMode({
      id: 12,
      policy_intent_contract: { source: 'native_intent', validation: { valid: false } },
      policy_intent_read_trace: { source: 'native_intent', status: 'native_intent_invalid' },
    })).toEqual({
      mode: POLICY_BUILDER_EXPERIENCE_MODES.NATIVE_RECOVERY,
      isNativeCreate: false,
      isNativeView: false,
      isNativeRecovery: true,
      isLegacyEdit: false,
    })
  })
})
