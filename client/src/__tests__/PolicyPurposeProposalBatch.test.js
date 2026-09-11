/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyPurposeProposalBatch from '@/components/policies/PolicyPurposeProposalBatch.vue'

const proposal = {
  statusId: 'ready_for_apply',
  summary: { candidatePolicyCount: 2, exceptionPolicyCount: 1 },
  candidates: [
    { policy: { id: 7, name: 'Animation Policy' }, library: { id: 17, name: 'Animation', mediaType: 'movie' } },
    { policy: { id: 9, name: 'Drama Policy' }, library: { id: 19, name: 'Drama', mediaType: 'movie' } },
  ],
  action: { available: true, candidatePolicyIds: [7, 9] },
}

describe('PolicyPurposeProposalBatch', () => {
  it('uses one accessible apply action and progressive disclosure for compatible policies', async () => {
    const wrapper = mount(PolicyPurposeProposalBatch, { props: { proposal } })

    expect(wrapper.text()).toContain('2 profile-derived purpose drafts are ready to apply together')
    expect(wrapper.text()).toContain('1 policy needs individual review')
    expect(wrapper.get('button').text()).toContain('Apply 2 reviewed purposes')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('apply')).toEqual([[]])
  })

  it('does not render a bulk action for a truncated proposal window', () => {
    const wrapper = mount(PolicyPurposeProposalBatch, {
      props: { proposal: { ...proposal, statusId: 'review_window_truncated', action: { available: false } } },
    })

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('No bulk action is available')
  })
})
