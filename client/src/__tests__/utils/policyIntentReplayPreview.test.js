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
      dry_run_scoring: {
        schema_version: 1,
        mode: 'deterministic_signal_fit',
        enabled: true,
        full_classification_run: false,
        ai_calls_enabled: false,
        provider_calls_enabled: false,
        arr_writes_enabled: false,
        persistence_enabled: false,
        sample_count: 1,
        scored_count: 1,
        strong_fit_count: 1,
        review_count: 0,
        blocked_count: 0,
        insufficient_count: 0,
        policy_engine_comparison: {
          schema_version: 1,
          mode: 'deterministic_policy_engine_preview',
          enabled: true,
          compared_count: 1,
          strong_count: 1,
          review_count: 0,
          blocked_count: 0,
          insufficient_count: 0,
          raw_query: 'nope',
        },
        items: [{
          sample_id: 1,
          draft_signal_fit: 'strong',
          recommendation: 'would_remain_candidate',
          evidence_available: true,
          matched: { identity: ['genres:Family'], compatibility: [], boosters: [] },
          missing_required: [],
          exclusion_hits: [],
          policy_engine: {
            schema_version: 1,
            mode: 'deterministic_policy_engine_preview',
            enabled: true,
            policy_engine_score: 80,
            policy_engine_fit: 'strong',
            evidence_available: true,
            preset_count: 1,
            scored_preset_count: 1,
            positive_signal_count: 2,
            blocking_signal_count: 1,
            blocker_count: 0,
            blockers: [],
            metadata: { leaked: true },
          },
          metadata: { leaked: true },
        }],
      },
      parity_delta: {
        schema_version: 1,
        mode: 'representative_replay_parity_delta',
        enabled: true,
        compared_count: 1,
        would_remain_count: 1,
        would_now_candidate_count: 0,
        would_now_review_count: 0,
        would_now_block_count: 0,
        insufficient_count: 0,
        items: [{
          sample_id: 1,
          current_outcome: 'final_success',
          draft_signal_fit: 'strong',
          policy_engine_fit: 'strong',
          delta_action: 'would_remain',
          delta_level: 'low',
          reason_codes: ['current:final_success', 'draft:strong', 'policy_engine:strong'],
          metadata: { leaked: true },
        }],
        raw_rows: [{ leaked: true }],
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
    expect(normalized.dry_run_scoring).toEqual(expect.objectContaining({
      enabled: true,
      full_classification_run: false,
      strong_fit_count: 1,
      blocked_count: 0,
      policy_engine_comparison: expect.objectContaining({
        enabled: true,
        compared_count: 1,
        strong_count: 1,
      }),
    }))
    expect(normalized.dry_run_scoring.items[0]).toEqual(expect.objectContaining({
      sample_id: 1,
      draft_signal_fit: 'strong',
      recommendation: 'would_remain_candidate',
      matched: {
        identity: ['genres:Family'],
        compatibility: [],
        boosters: [],
      },
      policy_engine: expect.objectContaining({
        enabled: true,
        policy_engine_score: 80,
        policy_engine_fit: 'strong',
        blocker_count: 0,
      }),
    }))
    expect(normalized.dry_run_scoring.items[0]).not.toHaveProperty('metadata')
    expect(normalized.dry_run_scoring.items[0].policy_engine).not.toHaveProperty('metadata')
    expect(normalized.dry_run_scoring.policy_engine_comparison).not.toHaveProperty('raw_query')
    expect(normalized.parity_delta).toEqual(expect.objectContaining({
      enabled: true,
      compared_count: 1,
      would_remain_count: 1,
      would_now_block_count: 0,
    }))
    expect(normalized.parity_delta.items[0]).toEqual(expect.objectContaining({
      sample_id: 1,
      delta_action: 'would_remain',
      delta_level: 'low',
      reason_codes: ['current:final_success', 'draft:strong', 'policy_engine:strong'],
    }))
    expect(normalized.parity_delta).not.toHaveProperty('raw_rows')
    expect(normalized.parity_delta.items[0]).not.toHaveProperty('metadata')
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
