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
      isLegacyEdit: false,
    })
    expect(buildPolicyBuilderExperienceMode({ id: 'invalid' })).toEqual({
      mode: POLICY_BUILDER_EXPERIENCE_MODES.NATIVE_CREATE,
      isNativeCreate: true,
      isNativeView: false,
      isLegacyEdit: false,
    })
  })

  it('retains the compatibility edit surface for a persisted policy', () => {
    expect(buildPolicyBuilderExperienceMode({ id: 12 })).toEqual({
      mode: POLICY_BUILDER_EXPERIENCE_MODES.LEGACY_EDIT,
      isNativeCreate: false,
      isNativeView: false,
      isLegacyEdit: true,
    })
  })

  it('uses the native policy view only for a server-reported native contract', () => {
    expect(buildPolicyBuilderExperienceMode({
      id: 12,
      policy_intent_contract: { source: 'native_intent' },
    })).toEqual({
      mode: POLICY_BUILDER_EXPERIENCE_MODES.NATIVE_VIEW,
      isNativeCreate: false,
      isNativeView: true,
      isLegacyEdit: false,
    })

    expect(buildPolicyBuilderExperienceMode({
      id: 12,
      policy_intent_contract: { source: 'unknown' },
    })).toEqual({
      mode: POLICY_BUILDER_EXPERIENCE_MODES.LEGACY_EDIT,
      isNativeCreate: false,
      isNativeView: false,
      isLegacyEdit: true,
    })
  })
})
