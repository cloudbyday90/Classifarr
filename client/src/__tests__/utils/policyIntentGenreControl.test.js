/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildPolicyIntentGenreControlView } from '@/utils/policyIntentGenreControl'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

describe('policyIntentGenreControl', () => {
  it('projects belongs-here genre control labels', () => {
    expect(buildPolicyIntentGenreControlView({
      key: POLICY_INTENT_BUCKETS.IDENTITY,
    })).toEqual({
      inputLabel: 'Genre that defines this library',
      buttonLabel: 'Add belongs-here genre',
    })
  })

  it('projects helpful-match genre control labels', () => {
    expect(buildPolicyIntentGenreControlView({
      key: POLICY_INTENT_BUCKETS.COMPATIBILITY,
    })).toEqual({
      inputLabel: 'Genre that can support a match',
      buttonLabel: 'Add helpful genre',
    })
  })

  it('projects confidence-boost genre control labels', () => {
    expect(buildPolicyIntentGenreControlView({
      key: POLICY_INTENT_BUCKETS.BOOSTERS,
    })).toEqual({
      inputLabel: 'Genre that boosts confidence',
      buttonLabel: 'Add confidence boost',
    })
  })

  it('falls back to generic genre labels for unknown sections', () => {
    expect(buildPolicyIntentGenreControlView({
      key: 'unknown',
    })).toEqual({
      inputLabel: 'Genre signal',
      buttonLabel: 'Add genre',
    })
  })
})
