/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildPolicyIntentCertificationControlView } from '@/utils/policyIntentCertificationControl'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

describe('policyIntentCertificationControl', () => {
  it('projects hard-limit control labels and clear capability', () => {
    expect(buildPolicyIntentCertificationControlView({
      key: POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
      hasClearAction: true,
    })).toEqual({
      isHardLimit: true,
      inputLabel: 'Maximum allowed rating',
      buttonLabel: 'Set max rating',
      clearLabel: 'Clear max rating',
      canClear: true,
    })
  })

  it('projects avoid-rating control labels without clear capability', () => {
    expect(buildPolicyIntentCertificationControlView({
      key: POLICY_INTENT_BUCKETS.EXCLUSIONS,
      hasClearAction: false,
    })).toEqual({
      isHardLimit: false,
      inputLabel: 'Rating to avoid',
      buttonLabel: 'Add avoid rating',
      clearLabel: 'Clear max rating',
      canClear: false,
    })
  })
})
