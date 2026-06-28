/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentReplayPreviewCard from '@/components/policies/PolicyIntentReplayPreviewCard.vue'

describe('PolicyIntentReplayPreviewCard', () => {
  it('renders replay sample readiness and no-execution guidance', () => {
    const wrapper = mount(PolicyIntentReplayPreviewCard, {
      props: {
        preview: {
          impact_summary: { impact_level: 'none' },
          sample: {
            requested_limit: 5,
            returned_count: 1,
            readiness: 'ready',
            diagnostics: {
              enabled: true,
              selection_status: 'selected',
              total_history_count: 3,
              eligible_history_count: 2,
              final_success_count: 1,
              review_or_pending_count: 1,
              media_type_filtered_out_count: 1,
              sparse_evidence_count: 1,
            },
            evidence_completeness: {
              enabled: true,
              sample_count: 1,
              strong_count: 1,
              partial_count: 0,
              sparse_count: 0,
              items: [{
                sample_id: 1,
                completeness: 'strong',
                available_fields: ['rating', 'genres', 'keywords', 'language', 'overview'],
                missing_fields: ['studio'],
                field_counts: {
                  genres: 2,
                  keywords: 1,
                  studios: 0,
                },
              }],
            },
            enrichment_eligibility: {
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
                missing_fields: ['studio'],
                eligible_sources: ['tmdb_metadata', 'web_search_metadata'],
              }],
            },
            provider_readiness: {
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
                },
                {
                  source: 'omdb_rating',
                  status: 'unavailable',
                  configured: false,
                  quota_safe: false,
                  cooldown_active: false,
                  eligible_sample_count: 1,
                  selected_provider_key: null,
                  available_provider_count: 0,
                },
              ],
            },
            enrichment_adapter_contract: {
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
              demanded_adapter_count: 3,
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
                },
              ],
            },
            tmdb_metadata_adapter_preview: {
              enabled: true,
              status: 'blocked',
              provider_payload_exposed: false,
              live_provider_calls_enabled: false,
              ai_calls_enabled: false,
              persistence_enabled: false,
              arr_writes_enabled: false,
              cache_mutation_enabled: false,
              execution_switch: {
                enabled: false,
                status: 'blocked',
                requested: false,
                server_enabled: false,
                provider_ready: true,
                quota_safe: true,
                cooldown_active: false,
                selected_provider_key: 'tmdb',
              },
              requested_field_count: 8,
              eligible_sample_count: 1,
              preview_limit: 1,
              previewed_count: 0,
              improved_sample_count: 0,
              improved_field_count: 0,
              items: [],
            },
          },
          dry_run_scoring: {
            enabled: true,
            strong_fit_count: 1,
            review_count: 0,
            blocked_count: 0,
            insufficient_count: 0,
            items: [{
              sample_id: 1,
              draft_signal_fit: 'strong',
              recommendation: 'would_remain_candidate',
              exclusion_hits: [],
              missing_required: [],
              policy_engine: {
                enabled: true,
                policy_engine_score: 80,
                policy_engine_fit: 'strong',
                blockers: [],
              },
            }],
          },
          parity_delta: {
            enabled: true,
            would_remain_count: 1,
            would_now_candidate_count: 0,
            would_now_review_count: 0,
            would_now_block_count: 0,
            insufficient_count: 0,
            items: [{
              sample_id: 1,
              delta_action: 'would_remain',
              delta_level: 'low',
            }],
          },
        },
        notice: {
          tone: 'success',
          title: 'Replay samples are ready',
          message: 'Classifarr selected recent sanitized classifications without running AI, providers, or arr writes.',
        },
        samples: [{
          sample_id: 1,
          title: 'Mulan',
          year: 1998,
          media_type: 'movie',
          library_name: 'Animated Movies',
          current_confidence: 81,
          current_method: 'ai_analysis',
          current_status: 'completed',
        }],
      },
    })

    expect(wrapper.text()).toContain('Representative Replay Preview')
    expect(wrapper.text()).toContain('No execution')
    expect(wrapper.text()).toContain('Selection: selected')
    expect(wrapper.text()).toContain('Samples: 1 / 5')
    expect(wrapper.text()).toContain('Sample selection diagnostics')
    expect(wrapper.text()).toContain('Total history: 3')
    expect(wrapper.text()).toContain('Eligible: 2')
    expect(wrapper.text()).toContain('Final: 1')
    expect(wrapper.text()).toContain('Review/Pending: 1')
    expect(wrapper.text()).toContain('Media filtered: 1')
    expect(wrapper.text()).toContain('Sparse evidence: 1')
    expect(wrapper.text()).toContain('Evidence: 1 strong / 0 partial / 0 sparse')
    expect(wrapper.text()).toContain('Enrichment: 1 eligible / 0 not needed / 0 insufficient identity / 0 no safe source')
    expect(wrapper.text()).toContain('Providers: partial / 2 ready / 1 unavailable')
    expect(wrapper.text()).toContain('Provider readiness')
    expect(wrapper.text()).toContain('No live calls')
    expect(wrapper.text()).toContain('tmdb metadata: ready')
    expect(wrapper.text()).toContain('web search metadata: ready')
    expect(wrapper.text()).toContain('omdb rating: unavailable')
    expect(wrapper.text()).toContain('Provider: tavily')
    expect(wrapper.text()).toContain('Eligible samples: 1')
    expect(wrapper.text()).toContain('Adapters: blocked / 0 enabled / 3 blocked')
    expect(wrapper.text()).toContain('Replay enrichment adapters')
    expect(wrapper.text()).toContain('No adapter runs unless explicitly enabled')
    expect(wrapper.text()).toContain('Enabled: 0 / 3')
    expect(wrapper.text()).toContain('Demanded: 3')
    expect(wrapper.text()).toContain('tmdb metadata: blocked')
    expect(wrapper.text()).toContain('Adapter blocked')
    expect(wrapper.text()).toContain('provider ready')
    expect(wrapper.text()).toContain('TMDB dry-run: blocked / 0 previewed / 0 fields')
    expect(wrapper.text()).toContain('TMDB metadata dry-run adapter')
    expect(wrapper.text()).toContain('Switch: blocked')
    expect(wrapper.text()).toContain('Provider: tmdb')
    expect(wrapper.text()).toContain('Server opt-in off')
    expect(wrapper.text()).toContain('Quota safe')
    expect(wrapper.text()).toContain('Provider payload hidden')
    expect(wrapper.text()).toContain('Dry-run fit: 1 strong / 0 review / 0 blocked / 0 insufficient')
    expect(wrapper.text()).toContain('Delta: 1 remain / 0 candidate / 0 review / 0 block / 0 insufficient')
    expect(wrapper.text()).toContain('Draft fit: strong')
    expect(wrapper.text()).toContain('Policy engine: 80% (strong)')
    expect(wrapper.text()).toContain('Delta: would remain')
    expect(wrapper.text()).toContain('Evidence: strong')
    expect(wrapper.text()).toContain('rating, genres, keywords, language, overview')
    expect(wrapper.text()).toContain('Enrichment: eligible')
    expect(wrapper.text()).toContain('via tmdb metadata, web search metadata')
    expect(wrapper.text()).toContain('would remain candidate')
    expect(wrapper.text()).toContain('Mulan')
    expect(wrapper.text()).toContain('Animated Movies')
    expect(wrapper.text()).toContain('This is read-only')
  })

  it('shows stale replay guidance while preserving samples', () => {
    const wrapper = mount(PolicyIntentReplayPreviewCard, {
      props: {
        stale: true,
        preview: {
          impact_summary: { impact_level: 'none' },
          sample: {
            requested_limit: 5,
            returned_count: 1,
            readiness: 'ready',
          },
        },
        notice: {
          tone: 'success',
          title: 'Replay samples are ready',
          message: 'Samples are available.',
        },
        samples: [{ sample_id: 1, title: 'Mulan' }],
      },
    })

    expect(wrapper.text()).toContain('Replay preview is out of date')
    expect(wrapper.text()).toContain('Mulan')
    expect(wrapper.text()).toContain('Refresh Replay')
  })
})
