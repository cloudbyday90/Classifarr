/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyPurposeCoveragePreflight from '@/components/policies/PolicyPurposeCoveragePreflight.vue'

describe('PolicyPurposeCoveragePreflight', () => {
  it('shows only bounded aggregate coverage and emits one explicit advisory request', async () => {
    const wrapper = mount(PolicyPurposeCoveragePreflight, {
      props: {
        available: true,
        preflight: {
          coverage: {
            statusId: 'broad_overlap_review_required',
            requiredSignalTypeCount: 1,
            requiredTermCount: 2,
            unsharedRequiredTermCount: 0,
            sharedRequiredTermCount: 2,
            overlappingDestinationCount: 1,
          },
          guidance: {
            title: 'Review shared purpose coverage before saving',
            description: 'Every proposed required content signal is shared.',
          },
          advisory: true,
          draftRetained: false,
          rawConfigurationExposed: false,
          routingAffected: false,
          providerAccessed: false,
          databaseWritten: false,
        },
      },
    })

    expect(wrapper.text()).toContain('Check proposed purpose coverage')
    expect(wrapper.text()).toContain('Broad Overlap Review Required')
    expect(wrapper.text()).toContain('Required terms')
    expect(wrapper.text()).toContain('Unshared terms')
    expect(wrapper.text()).toContain('does not retain the draft')
    expect(wrapper.text()).not.toContain('shared-purpose-token')

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('preflight')).toEqual([[]])
  })

  it('keeps unavailable and error feedback bounded', () => {
    const wrapper = mount(PolicyPurposeCoveragePreflight, {
      props: {
        available: false,
        error: 'Admin access required',
      },
    })

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="alert"]').text()).toBe('Admin access required')
    expect(wrapper.text()).toContain('Save this policy once')
  })
})
