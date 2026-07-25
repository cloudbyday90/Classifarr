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
          canRefresh: true,
          updatedAtLabel: 'Last generated: 6/28/2026, 8:00:00 AM',
        },
        refreshResult: {
          status: 'success',
          tone: 'success',
          label: 'Profile refreshed',
          message: '2 genres, 1 rating available from the current library profile.',
        },
        canRefresh: true,
      },
    })

    expect(wrapper.attributes('aria-label')).toBe('Policy library context')
    expect(wrapper.text()).toContain('Library')
    expect(wrapper.text()).toContain('Family')
    expect(wrapper.text()).toContain('Uses the connected media server library as the source of truth.')
    expect(wrapper.text()).toContain('Profile current:')
    expect(wrapper.text()).toContain('Last generated 2 hours ago.')
    expect(wrapper.text()).toContain('Profile refreshed:')
    expect(wrapper.text()).toContain('2 genres, 1 rating available from the current library profile.')
    expect(wrapper.text()).toContain('Already here:')
    expect(wrapper.text()).toContain('Family (42), Animation (45)')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('falls back when the library is not available yet', () => {
    const wrapper = mount(PolicyBuilderLibraryContext)

    expect(wrapper.text()).toContain('Unknown Library')
    expect(wrapper.text()).toContain('No profile yet:')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('emits a profile refresh action when enabled', async () => {
    const wrapper = mount(PolicyBuilderLibraryContext, {
      props: {
        library: { id: 14, name: 'Family' },
        canRefresh: true,
      },
    })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('refresh-profile')).toHaveLength(1)
  })

  it('can leave native recovery actions to the focused workflow panel', () => {
    const wrapper = mount(PolicyBuilderLibraryContext, {
      props: {
        library: { id: 14, name: 'Family' },
        canRefresh: true,
        showRefreshAction: false,
      },
    })

    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('shows refreshing state and blocks duplicate refreshes', () => {
    const wrapper = mount(PolicyBuilderLibraryContext, {
      props: {
        library: { id: 14, name: 'Family' },
        canRefresh: true,
        refreshing: true,
        freshness: {
          status: 'refreshing',
          tone: 'info',
          label: 'Refreshing profile',
          message: 'Refreshing library profile from current synced media.',
          canRefresh: false,
          updatedAtLabel: '',
        },
      },
    })

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('Refreshing...')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
