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
      },
    })

    expect(wrapper.attributes('aria-label')).toBe('Policy library context')
    expect(wrapper.text()).toContain('Library')
    expect(wrapper.text()).toContain('Family')
    expect(wrapper.text()).toContain('Uses the connected media server library as the source of truth.')
  })

  it('falls back when the library is not available yet', () => {
    const wrapper = mount(PolicyBuilderLibraryContext)

    expect(wrapper.text()).toContain('Unknown Library')
  })
})
