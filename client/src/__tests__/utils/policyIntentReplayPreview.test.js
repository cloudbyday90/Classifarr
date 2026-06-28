/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildPolicyIntentReplayPreviewNotice,
  normalizePolicyIntentReplayPreview,
  summarizePolicyIntentReplaySamples,
} from '@/utils/policyIntentReplayPreview'

describe('policyIntentReplayPreview utilities', () => {
  it('normalizes replay preview output without raw fields', () => {
    const normalized = normalizePolicyIntentReplayPreview({
      schema_version: 1,
      mode: 'read_only_replay_preview',
      persistence_enabled: false,
      execution: {
        classification_run: false,
        ai_calls_enabled: false,
        provider_calls_enabled: false,
        arr_writes_enabled: false,
      },
      validation: { valid: true, errors: [] },
      impact_summary: {
        parity: 'matching',
        impact_level: 'none',
        changed_bucket_count: 0,
      },
      sample: {
        requested_limit: 5,
        returned_count: 1,
        readiness: 'ready',
        items: [{
          sample_id: 1,
          title: 'Mulan',
          year: 1998,
          media_type: 'movie',
          library_name: 'Animated Movies',
          current_confidence: '81.00',
          current_method: 'ai_analysis',
          current_status: 'completed',
          current_outcome: 'final_success',
          created_at: '2026-06-01T10:00:00.000Z',
          tmdb_id: 10674,
          metadata: { rating: 'G' },
        }],
      },
    })

    expect(normalized.sample.items[0]).toEqual({
      sample_id: 1,
      title: 'Mulan',
      year: 1998,
      media_type: 'movie',
      library_name: 'Animated Movies',
      current_confidence: 81,
      current_method: 'ai_analysis',
      current_status: 'completed',
      current_outcome: 'final_success',
      created_at: '2026-06-01T10:00:00.000Z',
    })
    expect(normalized.sample.items[0]).not.toHaveProperty('tmdb_id')
    expect(normalized.sample.items[0]).not.toHaveProperty('metadata')
  })

  it('builds notice copy for no-sample replay readiness', () => {
    expect(buildPolicyIntentReplayPreviewNotice({
      validation: { valid: true, errors: [] },
      sample: {
        readiness: 'no_samples',
        requested_limit: 5,
        returned_count: 0,
        items: [],
      },
    })).toEqual({
      tone: 'warning',
      title: 'No representative samples found',
      message: 'This library does not have recent classification history to preview against yet.',
    })
  })

  it('summarizes normalized samples', () => {
    const samples = summarizePolicyIntentReplaySamples({
      sample: {
        readiness: 'ready',
        items: [{ sample_id: 1, title: 'Sample', current_outcome: 'final_success' }],
      },
    })

    expect(samples).toHaveLength(1)
    expect(samples[0].title).toBe('Sample')
  })
})
