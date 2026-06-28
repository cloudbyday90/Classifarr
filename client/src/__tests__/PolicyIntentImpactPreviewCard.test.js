/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentImpactPreviewCard from '@/components/policies/PolicyIntentImpactPreviewCard.vue'

describe('PolicyIntentImpactPreviewCard', () => {
  it('shows stale preview guidance while preserving the last preview summary', () => {
    const wrapper = mount(PolicyIntentImpactPreviewCard, {
      props: {
        stale: true,
        preview: {
          legacy: { preset_count: 1 },
          native_draft: { preset_count: 1 },
          comparison: {
            parity: 'matching',
            impact_level: 'none',
          },
        },
        notice: {
          tone: 'success',
          title: 'Intent preview matches saved policy behavior',
          message: 'The native intent draft and legacy preset path express the same policy structure.',
        },
        changedBuckets: [],
      },
    })

    expect(wrapper.text()).toContain('Preview is out of date')
    expect(wrapper.text()).toContain('Refresh the preview before treating these results as current')
    expect(wrapper.text()).toContain('Parity: matching')
    expect(wrapper.text()).toContain('Refresh Preview')
  })
})
