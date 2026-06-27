/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildPolicyIntentControlView } from '@/utils/policyIntentControlView'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

describe('policyIntentControlView', () => {
  it('routes genre controls through the genre projection', () => {
    expect(buildPolicyIntentControlView({
      controlKind: 'genre_intent',
      key: POLICY_INTENT_BUCKETS.COMPATIBILITY,
    })).toEqual({
      inputLabel: 'Genre that can support a match',
      buttonLabel: 'Add helpful genre',
    })
  })

  it('routes certification controls through the certification projection', () => {
    expect(buildPolicyIntentControlView({
      controlKind: 'certification',
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

  it('routes by known section key when control kind is omitted', () => {
    expect(buildPolicyIntentControlView({
      key: POLICY_INTENT_BUCKETS.IDENTITY,
    })).toEqual({
      inputLabel: 'Genre that defines this library',
      buttonLabel: 'Add belongs-here genre',
    })

    expect(buildPolicyIntentControlView({
      key: POLICY_INTENT_BUCKETS.EXCLUSIONS,
    })).toMatchObject({
      inputLabel: 'Rating to avoid',
      buttonLabel: 'Add avoid rating',
    })
  })

  it('returns a safe fallback for unknown control kinds', () => {
    expect(buildPolicyIntentControlView({
      controlKind: 'unknown',
    })).toEqual({
      inputLabel: 'Intent option',
      buttonLabel: 'Add option',
      clearLabel: '',
      canClear: false,
    })
  })
})
