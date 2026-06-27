/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildPolicyIntentDraft } from '@/utils/policyIntentDraftBridge'
import { buildPolicyIntentViewFromDraft } from '@/utils/policyIntentDraftView'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

describe('policyIntentDraftView', () => {
  it('normalizes draft buckets into the editor intent view shape', () => {
    const draft = buildPolicyIntentDraft([{
      id: 14,
      preset_id: 14,
      name: 'Family',
      customSignals: {
        genres: {
          require_any: ['Family'],
          semantics: 'identity',
        },
        certifications: {
          mode: 'max',
          max: 'PG-13',
          constraint_mode: 'strict',
        },
      },
    }])

    const view = buildPolicyIntentViewFromDraft(draft)

    expect(view.summary).toEqual({
      preset_count: 1,
      counts: {
        [POLICY_INTENT_BUCKETS.IDENTITY]: 1,
        [POLICY_INTENT_BUCKETS.COMPATIBILITY]: 0,
        [POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]: 1,
        [POLICY_INTENT_BUCKETS.BOOSTERS]: 0,
        [POLICY_INTENT_BUCKETS.EXCLUSIONS]: 0,
      },
    })
    expect(view[POLICY_INTENT_BUCKETS.IDENTITY]).toEqual([
      expect.objectContaining({
        role: POLICY_INTENT_BUCKETS.IDENTITY,
        preset_id: 14,
        preset_name: 'Family',
        signal_type: 'genres',
        semantics: 'identity',
        constraint_mode: 'advisory',
        values: { require_any: ['Family'] },
      }),
    ])
    expect(view[POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]).toEqual([
      expect.objectContaining({
        role: POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
        signal_type: 'certifications',
        constraint_mode: 'strict',
        values: { mode: 'max', max: 'PG-13' },
      }),
    ])
  })

  it('returns an empty editor view for missing drafts', () => {
    const view = buildPolicyIntentViewFromDraft(null)

    expect(view.summary.preset_count).toBe(0)
    expect(view[POLICY_INTENT_BUCKETS.IDENTITY]).toEqual([])
  })
})
