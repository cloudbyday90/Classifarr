/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  getPolicyReviewTriggerOption,
  listPolicyReviewTriggerOptions,
} from '@/utils/policyReviewTriggers'

describe('policyReviewTriggers', () => {
  it('defines stable review trigger options for the policy builder', () => {
    expect(listPolicyReviewTriggerOptions()).toEqual([
      expect.objectContaining({ value: 'evidence_missing', label: 'Evidence is missing' }),
      expect.objectContaining({ value: 'evidence_conflicting', label: 'Evidence conflicts' }),
      expect.objectContaining({ value: 'profile_stale', label: 'Library profile is stale' }),
      expect.objectContaining({ value: 'routing_not_ready', label: 'Routing is not ready' }),
    ])
    expect(Object.isFrozen(listPolicyReviewTriggerOptions())).toBe(true)
    expect(Object.isFrozen(listPolicyReviewTriggerOptions()[0])).toBe(true)
  })

  it('returns trigger metadata by value', () => {
    expect(getPolicyReviewTriggerOption('evidence_missing')).toMatchObject({
      label: 'Evidence is missing',
    })
    expect(getPolicyReviewTriggerOption('unknown')).toBeNull()
  })
})
