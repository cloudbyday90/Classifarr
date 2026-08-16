/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyNativeIntentReconciliationRemediationInventory from '@/components/policies/PolicyNativeIntentReconciliationRemediationInventory.vue'

const entry = {
  policy: { id: 17, name: 'Kids TV Policy' },
  library: { id: 18, name: 'Kids TV', mediaType: 'tv' },
  reconciliation: { outcomeState: 'requires_maintenance' },
  action: {
    available: true,
    title: 'Declare destination purpose',
    description: 'Review the policy and add a Belongs Here rule.',
    actionLabel: 'Review policy',
    schedulerFollowUp: 'The scheduler re-evaluates it.',
  },
}

describe('PolicyNativeIntentReconciliationRemediationInventory', () => {
  it('presents the fixed remediation instruction and emits the selected policy only', async () => {
    const wrapper = mount(PolicyNativeIntentReconciliationRemediationInventory, {
      props: { inventory: { entries: [entry] } },
    })

    expect(wrapper.text()).toContain('Kids TV Policy')
    expect(wrapper.text()).toContain('Declare destination purpose')
    expect(wrapper.text()).toContain('never guesses a destination purpose')

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('edit-policy')).toEqual([[entry]])
  })
})
