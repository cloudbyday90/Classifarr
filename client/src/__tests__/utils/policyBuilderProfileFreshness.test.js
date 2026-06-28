/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildPolicyBuilderProfileFreshness } from '@/utils/policyBuilderProfileFreshness'

const NOW = Date.parse('2026-06-28T12:00:00.000Z')

describe('policyBuilderProfileFreshness', () => {
  it('reports loading and refreshing as non-refreshable transient states', () => {
    expect(buildPolicyBuilderProfileFreshness({ loading: true })).toMatchObject({
      status: 'loading',
      canRefresh: false,
    })
    expect(buildPolicyBuilderProfileFreshness({ refreshing: true })).toMatchObject({
      status: 'refreshing',
      canRefresh: false,
    })
  })

  it('reports missing and error states as refreshable', () => {
    expect(buildPolicyBuilderProfileFreshness({ now: NOW })).toMatchObject({
      status: 'missing',
      tone: 'warning',
      canRefresh: true,
    })
    expect(buildPolicyBuilderProfileFreshness({ error: 'Could not load profile.', now: NOW })).toMatchObject({
      status: 'error',
      message: 'Could not load profile.',
      canRefresh: true,
    })
  })

  it('reports current profiles with bounded age text', () => {
    expect(buildPolicyBuilderProfileFreshness({
      profile: { last_generated_at: '2026-06-28T10:00:00.000Z' },
      now: NOW,
    })).toMatchObject({
      status: 'current',
      tone: 'success',
      message: 'Last generated 2 hours ago.',
    })
  })

  it('reports stale profiles after the configured threshold', () => {
    expect(buildPolicyBuilderProfileFreshness({
      profile: { last_generated_at: '2026-06-18T10:00:00.000Z' },
      now: NOW,
      staleDays: 7,
    })).toMatchObject({
      status: 'stale',
      tone: 'warning',
      message: 'Last generated 10 days ago. Refresh before using it as policy evidence.',
    })
  })
})
