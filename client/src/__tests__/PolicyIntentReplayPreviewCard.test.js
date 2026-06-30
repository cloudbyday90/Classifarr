/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentReplayPreviewCard from '@/components/policies/PolicyIntentReplayPreviewCard.vue'

describe('PolicyIntentReplayPreviewCard', () => {
  it('renders replay verifier safety without requiring internal diagnostics', () => {
    const wrapper = mount(PolicyIntentReplayPreviewCard, {
      props: {
        preview: {
          impact_summary: { impact_level: 'none' },
          sample: {
            requested_limit: 5,
            returned_count: 1,
            readiness: 'ready',
            tmdb_metadata_adapter_preview: {
              enabled: true,
              status: 'blocked',
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
              preview_limit: 1,
              previewed_count: 0,
              improved_sample_count: 0,
              improved_field_count: 0,
            },
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
    expect(wrapper.text()).toContain('This is read-only')
    expect(wrapper.text()).toContain('No execution')
    expect(wrapper.text()).toContain('Samples: 1 / 5')
    expect(wrapper.text()).toContain('TMDB dry-run: blocked / 0 previewed / 0 fields')
    expect(wrapper.text()).toContain('Request TMDB live metadata preview on next replay')
    expect(wrapper.text()).toContain('Gate: server opt-in required')
    expect(wrapper.get('input[aria-label="Request TMDB live metadata preview on next replay"]').element.disabled).toBe(true)
    expect(wrapper.text()).toContain('Mulan')
    expect(wrapper.text()).toContain('Animated Movies')
    expect(wrapper.text()).not.toContain('Sample selection diagnostics')
    expect(wrapper.text()).not.toContain('Provider readiness')
    expect(wrapper.text()).not.toContain('Policy engine:')
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

  it('emits TMDB live preview opt-in when the gate is available', async () => {
    const wrapper = mount(PolicyIntentReplayPreviewCard, {
      props: {
        preview: {
          impact_summary: { impact_level: 'none' },
          sample: {
            requested_limit: 5,
            returned_count: 1,
            readiness: 'ready',
            tmdb_metadata_adapter_preview: {
              enabled: true,
              status: 'blocked',
              previewed_count: 0,
              preview_limit: 1,
              improved_sample_count: 0,
              improved_field_count: 0,
              execution_switch: {
                enabled: false,
                status: 'blocked',
                requested: false,
                server_enabled: true,
                provider_ready: true,
                quota_safe: true,
                cooldown_active: false,
                selected_provider_key: 'tmdb',
              },
            },
          },
        },
        notice: {
          tone: 'success',
          title: 'Replay samples are ready',
          message: 'Samples are available.',
        },
      },
    })

    const checkbox = wrapper.get('input[aria-label="Request TMDB live metadata preview on next replay"]')
    expect(checkbox.element.disabled).toBe(false)
    expect(wrapper.text()).toContain('Gate: available')

    await checkbox.setValue(true)

    expect(wrapper.emitted('update:tmdbLivePreviewOptIn')).toEqual([[true]])
  })
})
