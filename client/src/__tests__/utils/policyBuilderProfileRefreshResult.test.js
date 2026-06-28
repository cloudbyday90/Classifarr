/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildPolicyBuilderProfileRefreshResult,
  summarizePolicyBuilderProfileRefresh,
} from '@/utils/policyBuilderProfileRefreshResult'

describe('policyBuilderProfileRefreshResult', () => {
  it('summarizes positive profile signal buckets only', () => {
    expect(summarizePolicyBuilderProfileRefresh({
      genre_distribution: {
        Animation: 45,
        Empty: 0,
      },
      rating_distribution: {
        G: 24,
      },
      keyword_distribution: {
        dragon: '3',
      },
    })).toEqual({
      totalSignalCount: 3,
      parts: ['1 genre', '1 rating', '1 keyword'],
    })
  })

  it('builds a success result with available signal counts', () => {
    expect(buildPolicyBuilderProfileRefreshResult({
      profile: {
        genre_distribution: {
          Animation: 45,
          Family: 42,
        },
        rating_distribution: {
          G: 24,
        },
      },
    })).toEqual({
      status: 'success',
      tone: 'success',
      label: 'Profile refreshed',
      message: '2 genres, 1 rating available from the current library profile.',
    })
  })

  it('warns when refresh succeeds but no useful profile signals exist', () => {
    expect(buildPolicyBuilderProfileRefreshResult({
      profile: {
        genre_distribution: {},
      },
    })).toMatchObject({
      status: 'success_empty',
      tone: 'warning',
      label: 'Profile refreshed',
    })
  })

  it('builds a bounded failure result', () => {
    expect(buildPolicyBuilderProfileRefreshResult({
      outcome: 'error',
      error: 'Profile refresh queue is unavailable.',
    })).toEqual({
      status: 'error',
      tone: 'warning',
      label: 'Refresh failed',
      message: 'Profile refresh queue is unavailable.',
    })
  })
})
