/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentReadinessSummary from '@/components/policies/PolicyIntentReadinessSummary.vue'

describe('PolicyIntentReadinessSummary.vue', () => {
  it('renders non-blocking readiness counts and issue details', () => {
    const wrapper = mount(PolicyIntentReadinessSummary, {
      props: {
        summary: {
          status: 'needs_review',
          tone: 'warning',
          label: 'Needs review',
          message: '1 structural warning should be reviewed before relying on this policy.',
          warningCount: 1,
          infoCount: 1,
          issues: [
            {
              sectionKey: 'identity',
              sectionLabel: 'Belongs Here',
              code: 'missing_identity',
              severity: 'warning',
              message: 'Add at least one belongs-here signal.',
            },
          ],
        },
      },
    })

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-live')).toBe('polite')
    expect(wrapper.text()).toContain('Policy Readiness')
    expect(wrapper.text()).toContain('Needs review')
    expect(wrapper.text()).toContain('1 warning')
    expect(wrapper.text()).toContain('1 note')
    expect(wrapper.text()).toContain('Belongs Here: Add at least one belongs-here signal.')
    expect(wrapper.find('.text-amber-100').exists()).toBe(true)
  })

  it('renders ready state without issue rows', () => {
    const wrapper = mount(PolicyIntentReadinessSummary, {
      props: {
        summary: {
          status: 'ready',
          tone: 'success',
          label: 'Ready',
          message: 'This policy has clear destination identity and no weak-section warnings.',
          warningCount: 0,
          infoCount: 0,
          issues: [],
        },
      },
    })

    expect(wrapper.text()).toContain('Ready')
    expect(wrapper.find('ul').exists()).toBe(false)
    expect(wrapper.find('.text-green-100').exists()).toBe(true)
  })
})
