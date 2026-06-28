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
        diagnostics: {
          schema_version: 1,
          mode: 'representative_sample_selection_diagnostics',
          enabled: true,
          requested_limit: 5,
          returned_count: 1,
          media_type_filter: 'movie',
          total_history_count: 3,
          eligible_history_count: 2,
          final_success_count: 1,
          review_or_pending_count: 1,
          media_type_filtered_out_count: 1,
          sparse_evidence_count: 1,
          selection_status: 'selected',
          reason_codes: ['status:selected', 'media_type:filtered'],
          raw_query: 'nope',
        },
        evidence_completeness: {
          schema_version: 1,
          mode: 'representative_replay_evidence_completeness',
          enabled: true,
          sample_count: 1,
          strong_count: 1,
          partial_count: 0,
          sparse_count: 0,
          items: [{
            sample_id: 1,
            completeness: 'strong',
            available_fields: ['rating', 'genres', 'keywords', 'language', 'overview', 'raw_metadata'],
            missing_fields: ['studio'],
            field_counts: {
              genres: 2,
              keywords: 1,
              studios: 0,
              raw: 99,
            },
            reason_codes: ['status:strong', 'evidence:rating_available'],
            raw_values: { rating: 'G' },
          }],
          raw_rows: [{ leaked: true }],
        },
        enrichment_eligibility: {
          schema_version: 1,
          mode: 'representative_replay_enrichment_eligibility',
          enabled: true,
          provider_calls_enabled: false,
          ai_calls_enabled: false,
          persistence_enabled: false,
          arr_writes_enabled: false,
          sample_count: 1,
          eligible_count: 1,
          not_needed_count: 0,
          insufficient_identity_count: 0,
          no_safe_source_count: 0,
          items: [{
            sample_id: 1,
            status: 'eligible',
            missing_fields: ['studio', 'runtime', 'raw_metadata'],
            eligible_sources: ['tmdb_metadata', 'web_search_metadata', 'raw_provider'],
            provider_calls_enabled: false,
            ai_calls_enabled: false,
            persistence_enabled: false,
            arr_writes_enabled: false,
            reason_codes: ['status:eligible', 'identity:tmdb_available'],
            tmdb_id: 10674,
          }],
          raw_rows: [{ leaked: true }],
        },
        provider_readiness: {
          schema_version: 1,
          mode: 'representative_replay_provider_readiness',
          enabled: true,
          live_provider_calls_enabled: false,
          ai_calls_enabled: false,
          persistence_enabled: false,
          arr_writes_enabled: false,
          source_count: 3,
          ready_source_count: 2,
          unavailable_source_count: 1,
          demanded_source_count: 3,
          readiness: 'partial',
          sources: [
            {
              source: 'tmdb_metadata',
              status: 'ready',
              configured: true,
              quota_safe: true,
              cooldown_active: false,
              eligible_sample_count: 1,
              selected_provider_key: 'tmdb',
              available_provider_count: 1,
              reason_codes: ['provider:tmdb_configured'],
              api_key: 'nope',
            },
            {
              source: 'web_search_metadata',
              status: 'ready',
              configured: true,
              quota_safe: true,
              cooldown_active: false,
              eligible_sample_count: 1,
              selected_provider_key: 'tavily',
              available_provider_count: 1,
              reason_codes: ['route:web_search_available'],
              raw_config: { leaked: true },
            },
          ],
          provider_config: { leaked: true },
        },
        enrichment_adapter_contract: {
          schema_version: 1,
          mode: 'replay_enrichment_adapter_contract',
          enabled: true,
          live_provider_calls_enabled: false,
          ai_calls_enabled: false,
          persistence_enabled: false,
          arr_writes_enabled: false,
          adapter_count: 3,
          enabled_adapter_count: 0,
          ready_adapter_count: 0,
          blocked_adapter_count: 3,
          unavailable_adapter_count: 0,
          demanded_adapter_count: 2,
          readiness: 'blocked',
          sources: [
            {
              source: 'tmdb_metadata',
              status: 'blocked',
              enabled: false,
              provider_ready: true,
              configured: true,
              quota_safe: true,
              cooldown_active: false,
              eligible_sample_count: 1,
              selected_provider_key: 'tmdb',
              available_provider_count: 1,
              reason_codes: ['adapter:source_not_enabled'],
              raw_provider_payload: { leaked: true },
            },
            {
              source: 'web_search_metadata',
              status: 'blocked',
              enabled: false,
              provider_ready: true,
              configured: true,
              quota_safe: true,
              cooldown_active: false,
              eligible_sample_count: 1,
              selected_provider_key: 'tavily',
              available_provider_count: 1,
              reason_codes: ['adapter:source_not_enabled'],
              api_key: 'nope',
            },
          ],
          raw_adapter_context: { leaked: true },
        },
        tmdb_metadata_adapter_preview: {
          schema_version: 1,
          mode: 'replay_tmdb_metadata_adapter_preview',
          source: 'tmdb_metadata',
          enabled: true,
          status: 'blocked',
          provider_payload_exposed: false,
          live_provider_calls_enabled: false,
          ai_calls_enabled: false,
          persistence_enabled: false,
          arr_writes_enabled: false,
          cache_mutation_enabled: false,
          execution_switch: {
            schema_version: 1,
            mode: 'replay_tmdb_metadata_execution_switch',
            source: 'tmdb_metadata',
            enabled: false,
            status: 'blocked',
            requested: true,
            server_enabled: false,
            provider_ready: true,
            quota_safe: true,
            cooldown_active: false,
            selected_provider_key: 'tmdb',
            reason_codes: ['server:tmdb_live_preview_disabled'],
            api_key: 'nope',
            raw_payload: { leaked: true },
          },
          requested_field_count: 8,
          eligible_sample_count: 1,
          preview_limit: 1,
          previewed_count: 0,
          improved_sample_count: 0,
          improved_field_count: 0,
          items: [{
            sample_id: 1,
            status: 'ready',
            available_fields: ['rating', 'genres', 'keywords', 'raw_payload'],
            improved_fields: ['rating', 'genres', 'raw_payload'],
            field_counts: {
              genres: 2,
              keywords: 1,
              studios: 1,
              raw: 99,
            },
            reason_codes: ['provider_payload:sanitized'],
            tmdb_id: 10674,
            raw_provider_payload: { title: 'Mulan' },
          }],
          raw_adapter_context: { leaked: true },
        },
        tmdb_metadata_coverage_comparison: {
          schema_version: 1,
          mode: 'replay_tmdb_metadata_coverage_comparison',
          enabled: true,
          status: 'improved',
          sample_count: 1,
          comparable_count: 1,
          improved_sample_count: 1,
          upgraded_completeness_count: 1,
          added_field_count: 2,
          remaining_missing_field_count: 1,
          before_strong_count: 0,
          after_strong_count: 1,
          reason_codes: ['coverage:would_improve'],
          items: [{
            sample_id: 1,
            status: 'improved',
            before_completeness: 'partial',
            after_completeness: 'strong',
            before_available_fields: ['genres', 'language', 'raw_payload'],
            added_fields: ['rating', 'keywords', 'raw_payload'],
            after_available_fields: ['rating', 'genres', 'keywords', 'language'],
            remaining_missing_fields: ['studio'],
            reason_codes: ['coverage:would_add_fields'],
            raw_provider_payload: { title: 'Mulan' },
            tmdb_id: 10674,
          }],
          raw_rows: [{ leaked: true }],
        },
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
    expect(normalized.sample.diagnostics).toEqual(expect.objectContaining({
      enabled: true,
      selection_status: 'selected',
      total_history_count: 3,
      eligible_history_count: 2,
      final_success_count: 1,
      review_or_pending_count: 1,
      media_type_filtered_out_count: 1,
      sparse_evidence_count: 1,
      reason_codes: ['status:selected', 'media_type:filtered'],
    }))
    expect(normalized.sample.diagnostics).not.toHaveProperty('raw_query')
    expect(normalized.sample.evidence_completeness).toEqual(expect.objectContaining({
      enabled: true,
      sample_count: 1,
      strong_count: 1,
      partial_count: 0,
      sparse_count: 0,
    }))
    expect(normalized.sample.evidence_completeness.items[0]).toEqual(expect.objectContaining({
      sample_id: 1,
      completeness: 'strong',
      available_fields: ['rating', 'genres', 'keywords', 'language', 'overview'],
      missing_fields: ['studio'],
      field_counts: {
        genres: 2,
        keywords: 1,
        studios: 0,
      },
      reason_codes: ['status:strong', 'evidence:rating_available'],
    }))
    expect(normalized.sample.evidence_completeness).not.toHaveProperty('raw_rows')
    expect(normalized.sample.evidence_completeness.items[0]).not.toHaveProperty('raw_values')
    expect(normalized.sample.enrichment_eligibility).toEqual(expect.objectContaining({
      enabled: true,
      provider_calls_enabled: false,
      eligible_count: 1,
      not_needed_count: 0,
    }))
    expect(normalized.sample.enrichment_eligibility.items[0]).toEqual(expect.objectContaining({
      sample_id: 1,
      status: 'eligible',
      missing_fields: ['studio', 'runtime'],
      eligible_sources: ['tmdb_metadata', 'web_search_metadata'],
      provider_calls_enabled: false,
      ai_calls_enabled: false,
      persistence_enabled: false,
      arr_writes_enabled: false,
      reason_codes: ['status:eligible', 'identity:tmdb_available'],
    }))
    expect(normalized.sample.enrichment_eligibility).not.toHaveProperty('raw_rows')
    expect(normalized.sample.enrichment_eligibility.items[0]).not.toHaveProperty('tmdb_id')
    expect(normalized.sample.provider_readiness).toEqual(expect.objectContaining({
      enabled: true,
      live_provider_calls_enabled: false,
      ai_calls_enabled: false,
      persistence_enabled: false,
      arr_writes_enabled: false,
      source_count: 3,
      ready_source_count: 2,
      unavailable_source_count: 1,
      demanded_source_count: 3,
      readiness: 'partial',
    }))
    expect(normalized.sample.provider_readiness.sources[0]).toEqual({
      source: 'tmdb_metadata',
      status: 'ready',
      configured: true,
      quota_safe: true,
      cooldown_active: false,
      eligible_sample_count: 1,
      selected_provider_key: 'tmdb',
      available_provider_count: 1,
      reason_codes: ['provider:tmdb_configured'],
    })
    expect(normalized.sample.provider_readiness.sources[1]).toEqual({
      source: 'web_search_metadata',
      status: 'ready',
      configured: true,
      quota_safe: true,
      cooldown_active: false,
      eligible_sample_count: 1,
      selected_provider_key: 'tavily',
      available_provider_count: 1,
      reason_codes: ['route:web_search_available'],
    })
    expect(normalized.sample.provider_readiness).not.toHaveProperty('provider_config')
    expect(normalized.sample.provider_readiness.sources[0]).not.toHaveProperty('api_key')
    expect(normalized.sample.provider_readiness.sources[1]).not.toHaveProperty('raw_config')
    expect(normalized.sample.enrichment_adapter_contract).toEqual(expect.objectContaining({
      enabled: true,
      live_provider_calls_enabled: false,
      ai_calls_enabled: false,
      persistence_enabled: false,
      arr_writes_enabled: false,
      adapter_count: 3,
      enabled_adapter_count: 0,
      ready_adapter_count: 0,
      blocked_adapter_count: 3,
      unavailable_adapter_count: 0,
      demanded_adapter_count: 2,
      readiness: 'blocked',
    }))
    expect(normalized.sample.enrichment_adapter_contract.sources[0]).toEqual({
      source: 'tmdb_metadata',
      status: 'blocked',
      enabled: false,
      provider_ready: true,
      configured: true,
      quota_safe: true,
      cooldown_active: false,
      eligible_sample_count: 1,
      selected_provider_key: 'tmdb',
      available_provider_count: 1,
      reason_codes: ['adapter:source_not_enabled'],
    })
    expect(normalized.sample.enrichment_adapter_contract.sources[1]).toEqual({
      source: 'web_search_metadata',
      status: 'blocked',
      enabled: false,
      provider_ready: true,
      configured: true,
      quota_safe: true,
      cooldown_active: false,
      eligible_sample_count: 1,
      selected_provider_key: 'tavily',
      available_provider_count: 1,
      reason_codes: ['adapter:source_not_enabled'],
    })
    expect(normalized.sample.enrichment_adapter_contract).not.toHaveProperty('raw_adapter_context')
    expect(normalized.sample.enrichment_adapter_contract.sources[0]).not.toHaveProperty('raw_provider_payload')
    expect(normalized.sample.enrichment_adapter_contract.sources[1]).not.toHaveProperty('api_key')
    expect(normalized.sample.tmdb_metadata_adapter_preview).toEqual(expect.objectContaining({
      enabled: true,
      status: 'blocked',
      provider_payload_exposed: false,
      live_provider_calls_enabled: false,
      ai_calls_enabled: false,
      persistence_enabled: false,
      arr_writes_enabled: false,
      cache_mutation_enabled: false,
      requested_field_count: 8,
      eligible_sample_count: 1,
      preview_limit: 1,
      previewed_count: 0,
      improved_sample_count: 0,
      improved_field_count: 0,
      reason_codes: [],
      execution_switch: {
        schema_version: 1,
        mode: 'replay_tmdb_metadata_execution_switch',
        source: 'tmdb_metadata',
        enabled: false,
        status: 'blocked',
        requested: true,
        server_enabled: false,
        provider_ready: true,
        quota_safe: true,
        cooldown_active: false,
        selected_provider_key: 'tmdb',
        reason_codes: ['server:tmdb_live_preview_disabled'],
      },
    }))
    expect(normalized.sample.tmdb_metadata_adapter_preview.execution_switch)
      .not.toHaveProperty('api_key')
    expect(normalized.sample.tmdb_metadata_adapter_preview.execution_switch)
      .not.toHaveProperty('raw_payload')
    expect(normalized.sample.tmdb_metadata_adapter_preview.items[0]).toEqual({
      sample_id: 1,
      status: 'ready',
      available_fields: ['rating', 'genres', 'keywords'],
      improved_fields: ['rating', 'genres'],
      field_counts: {
        genres: 2,
        keywords: 1,
        studios: 1,
      },
      reason_codes: ['provider_payload:sanitized'],
    })
    expect(normalized.sample.tmdb_metadata_adapter_preview).not.toHaveProperty('raw_adapter_context')
    expect(normalized.sample.tmdb_metadata_adapter_preview.items[0]).not.toHaveProperty('tmdb_id')
    expect(normalized.sample.tmdb_metadata_adapter_preview.items[0]).not.toHaveProperty('raw_provider_payload')
    expect(normalized.sample.tmdb_metadata_coverage_comparison).toEqual(expect.objectContaining({
      enabled: true,
      status: 'improved',
      sample_count: 1,
      comparable_count: 1,
      improved_sample_count: 1,
      upgraded_completeness_count: 1,
      added_field_count: 2,
      remaining_missing_field_count: 1,
      before_strong_count: 0,
      after_strong_count: 1,
      reason_codes: ['coverage:would_improve'],
    }))
    expect(normalized.sample.tmdb_metadata_coverage_comparison.items[0]).toEqual({
      sample_id: 1,
      status: 'improved',
      before_completeness: 'partial',
      after_completeness: 'strong',
      before_available_fields: ['genres', 'language'],
      added_fields: ['rating', 'keywords'],
      after_available_fields: ['rating', 'genres', 'keywords', 'language'],
      remaining_missing_fields: ['studio'],
      reason_codes: ['coverage:would_add_fields'],
    })
    expect(normalized.sample.tmdb_metadata_coverage_comparison).not.toHaveProperty('raw_rows')
    expect(normalized.sample.tmdb_metadata_coverage_comparison.items[0])
      .not.toHaveProperty('raw_provider_payload')
    expect(normalized.sample.tmdb_metadata_coverage_comparison.items[0]).not.toHaveProperty('tmdb_id')
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
