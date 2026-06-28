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
    expect(wrapper.text()).toContain('Samples: 1 / 5')
    expect(wrapper.text()).toContain('Dry-run fit: 1 strong / 0 review / 0 blocked / 0 insufficient')
    expect(wrapper.text()).toContain('Draft fit: strong')
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
