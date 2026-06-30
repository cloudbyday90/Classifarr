/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentReviewTriggerControl from '@/components/policies/PolicyIntentReviewTriggerControl.vue'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

describe('PolicyIntentReviewTriggerControl.vue', () => {
  function mountControl(overrides = {}) {
    return mount(PolicyIntentReviewTriggerControl, {
      props: {
        section: {
          key: POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS,
          actionLabel: 'Add review triggers',
          entries: [],
          optionDiagnostics: {
            status: 'available',
            optionKind: 'review trigger',
          },
          optionStates: [
            {
              value: 'evidence_missing',
              label: 'Evidence is missing',
              help: 'Ask when Classifarr does not have enough evidence to automate safely.',
              disabled: false,
              reason: '',
            },
            {
              value: 'profile_stale',
              label: 'Library profile is stale',
              help: 'Ask when the observed library profile needs refresh before automation.',
              disabled: false,
              reason: '',
            },
          ],
          ...overrides,
        },
      },
    })
  }

  it('emits one typed add-value event for each selected trigger', async () => {
    const wrapper = mountControl()

    await wrapper.find('input[value="evidence_missing"]').setValue(true)
    await wrapper.find('input[value="profile_stale"]').setValue(true)
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('add-value')).toEqual([
      [{ sectionKey: POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS, value: 'evidence_missing' }],
      [{ sectionKey: POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS, value: 'profile_stale' }],
    ])
  })

  it('disables duplicate trigger choices with a reason', () => {
    const wrapper = mountControl({
      optionStates: [
        {
          value: 'evidence_missing',
          label: 'Evidence is missing',
          disabled: true,
          reason: 'Evidence is missing is already configured as a review trigger.',
        },
      ],
      optionDiagnostics: {
        status: 'all_configured',
        optionKind: 'review trigger',
        message: 'All available review triggers are already configured.',
      },
    })

    expect(wrapper.find('input[value="evidence_missing"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Evidence is missing is already configured as a review trigger.')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
