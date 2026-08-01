/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyBuilderLibraryContext from '@/components/policies/PolicyBuilderLibraryContext.vue'

describe('PolicyBuilderLibraryContext.vue', () => {
  it('renders the selected library as read-only context', () => {
    const wrapper = mount(PolicyBuilderLibraryContext, {
      props: {
        library: {
          id: 14,
          name: 'Family',
        },
        profile: {
          genre_distribution: {
            Family: 42,
          },
        },
        genreSummary: ['Family (42)', 'Animation (45)'],
        freshness: {
          status: 'current',
          tone: 'success',
          label: 'Profile current',
          message: 'Last generated 2 hours ago.',
          updatedAtLabel: 'Last generated: 6/28/2026, 8:00:00 AM',
        },
      },
    })

    expect(wrapper.attributes('aria-label')).toBe('Policy library context')
    expect(wrapper.text()).toContain('Library')
    expect(wrapper.text()).toContain('Family')
    expect(wrapper.text()).toContain('Uses the connected media server library as the source of truth.')
    expect(wrapper.text()).toContain('Profile current:')
    expect(wrapper.text()).toContain('Last generated 2 hours ago.')
    expect(wrapper.text()).toContain('Already here:')
    expect(wrapper.text()).toContain('Family (42), Animation (45)')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('falls back when the library is not available yet', () => {
    const wrapper = mount(PolicyBuilderLibraryContext)

    expect(wrapper.text()).toContain('Unknown Library')
    expect(wrapper.text()).toContain('No profile yet:')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('does not expose a browser profile regeneration control', () => {
    const wrapper = mount(PolicyBuilderLibraryContext, {
      props: {
        library: { id: 14, name: 'Family' },
      },
    })

    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('can leave profile freshness to the native automatic recovery status', () => {
    const wrapper = mount(PolicyBuilderLibraryContext, {
      props: {
        library: { id: 14, name: 'Family' },
        showFreshness: false,
      },
    })

    expect(wrapper.text()).not.toContain('No profile yet:')
  })

  it('marks the context busy only while its observed profile is loading', () => {
    const wrapper = mount(PolicyBuilderLibraryContext, {
      props: {
        library: { id: 14, name: 'Family' },
        loading: true,
      },
    })

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
