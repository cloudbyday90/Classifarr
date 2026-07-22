/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DestinationContextCard from '@/components/policies/DestinationContextCard.vue'

describe('DestinationContextCard.vue', () => {
  it('renders the destination context with the workflow heading anchor', () => {
    const wrapper = mount(DestinationContextCard, {
      props: {
        title: 'Define this destination',
        summary: 'Start with the connected library before adding policy details.',
      },
    })

    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.find('#policy-builder-workflow-title').text()).toBe('Define this destination')
    expect(wrapper.text()).toContain('Policy setup')
    expect(wrapper.text()).toContain('Start with the connected library before adding policy details.')
  })
})
