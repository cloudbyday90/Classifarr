/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPolicyIntentReplayPreview,
  buildPolicyIntentReplaySampleQuery,
  normalizePolicyIntentReplayLimit,
  sanitizePolicyIntentReplaySample,
} from '../services/policyIntentReplayPreview.mjs';

describe('policyIntentReplayPreview', () => {
  test('normalizes replay limits with defaults and caps', () => {
    expect(normalizePolicyIntentReplayLimit(undefined)).toBe(10);
    expect(normalizePolicyIntentReplayLimit('not-a-number')).toBe(10);
    expect(normalizePolicyIntentReplayLimit(0)).toBe(1);
    expect(normalizePolicyIntentReplayLimit(99)).toBe(25);
    expect(normalizePolicyIntentReplayLimit('7')).toBe(7);
  });

  test('builds parameterized representative sample queries', () => {
    const query = buildPolicyIntentReplaySampleQuery({
      libraryId: 12,
      mediaType: 'movie',
      limit: 3,
    });

    expect(query.text).toContain('FROM classification_history');
    expect(query.text).toContain('tmdb_id');
    expect(query.text).toContain('metadata');
    expect(query.text).toContain('genre_names');
    expect(query.text).toContain('primary_studio_name');
    expect(query.text).toContain('library_id = $1');
    expect(query.text).toContain('media_type = $2');
    expect(query.text).toContain('LIMIT $3');
    expect(query.values).toEqual([12, 'movie', 3]);
  });

  test('rejects missing library id for replay samples', () => {
    expect(() => buildPolicyIntentReplaySampleQuery({
      libraryId: null,
      mediaType: 'movie',
      limit: 3,
    })).toThrow('A valid library_id is required for replay preview');
  });

  test('sanitizes sample rows without raw metadata identifiers', () => {
    const sample = sanitizePolicyIntentReplaySample({
      id: 42,
      tmdb_id: 10674,
      title: 'Mulan',
      year: 1998,
      media_type: 'movie',
      library_name: 'Animated Movies',
      confidence: '81.22',
      method: 'ai_analysis',
      status: 'completed',
      reason: 'Long internal reasoning should not leak',
      metadata: { rating: 'G' },
      created_at: '2026-06-01T10:00:00.000Z',
    }, 0);

    expect(sample).toEqual({
      sample_id: 1,
      title: 'Mulan',
      year: 1998,
      media_type: 'movie',
      library_name: 'Animated Movies',
      current_confidence: 81.22,
      current_method: 'ai_analysis',
      current_status: 'completed',
      current_outcome: 'final_success',
      created_at: '2026-06-01T10:00:00.000Z',
    });
    expect(sample).not.toHaveProperty('id');
    expect(sample).not.toHaveProperty('tmdb_id');
    expect(sample).not.toHaveProperty('metadata');
    expect(sample).not.toHaveProperty('reason');
  });

  test('builds no-execution replay readiness preview', () => {
    const preview = buildPolicyIntentReplayPreview({
      impactPreview: {
        validation: { valid: true, errors: [] },
        comparison: {
          parity: 'changed',
          impact_level: 'medium',
          changed_buckets: ['boosters'],
        },
      },
      samples: [{ title: 'Sample', status: 'pending', created_at: null }],
      scoring: {
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
        items: [{
          sample_id: 1,
          draft_signal_fit: 'strong',
          recommendation: 'would_remain_candidate',
          evidence_available: true,
          matched: { identity: ['genres:Family'], compatibility: [], boosters: [] },
          missing_required: [],
          exclusion_hits: [],
          policy_engine: {
            policy_engine_fit: 'strong',
            blockers: [],
          },
        }],
      },
      sampleDiagnostics: {
        schema_version: 1,
        mode: 'representative_sample_selection_diagnostics',
        enabled: true,
        requested_limit: 2,
        returned_count: 1,
        media_type_filter: 'movie',
        total_history_count: 3,
        eligible_history_count: 2,
        final_success_count: 1,
        review_or_pending_count: 1,
        media_type_filtered_out_count: 1,
        sparse_evidence_count: 0,
        selection_status: 'selected',
        reason_codes: ['status:selected', 'media_type:filtered'],
      },
      evidenceCompleteness: {
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
          available_fields: ['rating', 'genres', 'language'],
          missing_fields: ['keywords'],
          field_counts: { genres: 2, keywords: 0, studios: 0 },
          reason_codes: ['status:strong'],
        }],
      },
      enrichmentEligibility: {
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
          missing_fields: ['keywords'],
          eligible_sources: ['web_search_metadata'],
          provider_calls_enabled: false,
          ai_calls_enabled: false,
          persistence_enabled: false,
          arr_writes_enabled: false,
          reason_codes: ['status:eligible'],
        }],
      },
      providerReadiness: {
        schema_version: 1,
        mode: 'representative_replay_provider_readiness',
        enabled: true,
        live_provider_calls_enabled: false,
        ai_calls_enabled: false,
        persistence_enabled: false,
        arr_writes_enabled: false,
        source_count: 3,
        ready_source_count: 1,
        unavailable_source_count: 2,
        demanded_source_count: 1,
        readiness: 'ready',
        sources: [{
          source: 'web_search_metadata',
          status: 'ready',
          configured: true,
          quota_safe: true,
          cooldown_active: false,
          eligible_sample_count: 1,
          selected_provider_key: 'tavily',
          available_provider_count: 1,
          reason_codes: ['route:web_search_available'],
        }],
      },
      enrichmentAdapterContract: {
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
        demanded_adapter_count: 1,
        readiness: 'blocked',
        sources: [{
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
        }],
      },
      tmdbMetadataAdapterPreview: {
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
        requested_field_count: 8,
        eligible_sample_count: 1,
        preview_limit: 1,
        previewed_count: 0,
        improved_sample_count: 0,
        improved_field_count: 0,
        items: [],
        reason_codes: ['adapter_contract:blocked'],
      },
      requestedLimit: 2,
    });

    expect(preview).toEqual(expect.objectContaining({
      schema_version: 1,
      mode: 'read_only_replay_preview',
      persistence_enabled: false,
      execution: {
        classification_run: false,
        ai_calls_enabled: false,
        provider_calls_enabled: false,
        arr_writes_enabled: false,
      },
      impact_summary: {
        parity: 'changed',
        impact_level: 'medium',
        changed_bucket_count: 1,
      },
      sample: expect.objectContaining({
        requested_limit: 2,
        returned_count: 1,
        readiness: 'ready',
        diagnostics: expect.objectContaining({
          enabled: true,
          selection_status: 'selected',
          total_history_count: 3,
          media_type_filtered_out_count: 1,
          reason_codes: ['status:selected', 'media_type:filtered'],
        }),
        evidence_completeness: expect.objectContaining({
          enabled: true,
          sample_count: 1,
          strong_count: 1,
          items: [
            expect.objectContaining({
              sample_id: 1,
              completeness: 'strong',
              available_fields: ['rating', 'genres', 'language'],
            }),
          ],
        }),
        enrichment_eligibility: expect.objectContaining({
          enabled: true,
          provider_calls_enabled: false,
          eligible_count: 1,
          items: [
            expect.objectContaining({
              sample_id: 1,
              status: 'eligible',
              eligible_sources: ['web_search_metadata'],
            }),
          ],
        }),
        provider_readiness: expect.objectContaining({
          enabled: true,
          live_provider_calls_enabled: false,
          ready_source_count: 1,
          demanded_source_count: 1,
          readiness: 'ready',
          sources: [
            expect.objectContaining({
              source: 'web_search_metadata',
              status: 'ready',
              selected_provider_key: 'tavily',
            }),
          ],
        }),
        enrichment_adapter_contract: expect.objectContaining({
          enabled: true,
          live_provider_calls_enabled: false,
          ready_adapter_count: 0,
          blocked_adapter_count: 3,
          demanded_adapter_count: 1,
          readiness: 'blocked',
          sources: [
            expect.objectContaining({
              source: 'web_search_metadata',
              status: 'blocked',
              provider_ready: true,
              selected_provider_key: 'tavily',
            }),
          ],
        }),
        tmdb_metadata_adapter_preview: expect.objectContaining({
          enabled: true,
          status: 'blocked',
          provider_payload_exposed: false,
          live_provider_calls_enabled: false,
          persistence_enabled: false,
          arr_writes_enabled: false,
          cache_mutation_enabled: false,
          previewed_count: 0,
          improved_field_count: 0,
          reason_codes: ['adapter_contract:blocked'],
        }),
      }),
      dry_run_scoring: expect.objectContaining({
        mode: 'deterministic_signal_fit',
        enabled: true,
        full_classification_run: false,
        scored_count: 1,
        strong_fit_count: 1,
      }),
      parity_delta: expect.objectContaining({
        mode: 'representative_replay_parity_delta',
        enabled: true,
        compared_count: 1,
        would_now_candidate_count: 1,
        would_remain_count: 0,
      }),
    }));
  });
});
