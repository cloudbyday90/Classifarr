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
    expect(wrapper.text()).toContain('Dry-run fit: 1 strong / 0 review / 0 blocked / 0 insufficient')
    expect(wrapper.text()).toContain('Delta: 1 remain / 0 candidate / 0 review / 0 block / 0 insufficient')
    expect(wrapper.text()).toContain('Draft fit: strong')
    expect(wrapper.text()).toContain('Policy engine: 80% (strong)')
    expect(wrapper.text()).toContain('Delta: would remain')
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
