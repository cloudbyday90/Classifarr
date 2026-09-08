/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyPurposeCoverageReview from '@/components/policies/PolicyPurposeCoverageReview.vue'

const entry = {
  policy: { id: 17, name: 'Broad TV Policy' },
  library: { id: 18, name: 'Broad TV', mediaType: 'tv' },
  coverage: {
    statusId: 'broad_overlap_review_required',
    requiredSignalTypeCount: 1,
    requiredTermCount: 2,
    uniqueRequiredTermCount: 0,
    sharedRequiredTermCount: 2,
    overlappingDestinationCount: 1,
    sharedRequireAnyTermCount: 1,
    sharedRequireAnyDestinationCount: 1,
  },
  provenance: {
    statusId: 'profile_only_specialized_purpose',
    specializedPurposeRuleCount: 2,
    inferredProfilePurposeRuleCount: 2,
    retainedPurposeRuleCount: 0,
  },
  action: {
    available: true,
    title: 'Review shared purpose coverage',
    description: 'Every required signal is shared.',
    actionLabel: 'Review policy',
  },
}

describe('PolicyPurposeCoverageReview', () => {
  it('exposes a labeled programmatic focus target for contextual maintenance handoffs', () => {
    const wrapper = mount(PolicyPurposeCoverageReview)

    expect(wrapper.find('#policy-purpose-coverage-review').attributes('tabindex')).toBe('-1')
    expect(wrapper.find('#policy-purpose-coverage-review').attributes('aria-labelledby'))
      .toBe('policy-purpose-coverage-heading')
  })

  it('shows fixed bounded coverage counts and opens only the selected policy editor', async () => {
    const wrapper = mount(PolicyPurposeCoverageReview, {
      props: {
        review: {
          entries: [entry],
          summary: {
            reviewedPolicyCount: 1,
            missingCoverageCount: 0,
            broadOverlapCount: 1,
            declaredCoverageCount: 0,
            profileOnlyPurposeCount: 1,
            retainedPurposeCount: 0,
            noSpecializedPurposeCount: 0,
          },
          studySourceReadiness: {
            statusId: 'no_retained_declared_purpose_source',
            activePolicyCount: 10,
            profileOnlyPurposePolicyCount: 10,
            retainedPurposePolicyCount: 0,
            lifecycleRetainedPurposePolicyCount: 0,
            lifecycleReceiptRequiredPolicyCount: 0,
            lifecycleReceiptReviewRequiredPolicyCount: 0,
            heldOutAuditCandidateSourceAvailable: false,
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Policy purpose coverage')
    expect(wrapper.text()).toContain('Broad Overlap Review Required')
    expect(wrapper.text()).toContain('Unshared terms')
    expect(wrapper.text()).toContain('Shared terms')
    expect(wrapper.text()).toContain('Overlapping destinations')
    expect(wrapper.text()).toContain('Shared “any” alternatives')
    expect(wrapper.text()).toContain('Profile-only purpose')
    expect(wrapper.text()).toContain('Held-out semantic study source')
    expect(wrapper.text()).toContain('No Retained Declared Purpose Source')
    expect(wrapper.text()).toContain('Profile observations remain excluded')
    expect(wrapper.text()).toContain('Active validated policies')
    expect(wrapper.text()).toContain('Lifecycle-qualified sources')
    expect(wrapper.text()).toContain('Profile Only Specialized Purpose')
    expect(wrapper.text()).toContain('Inferred profile rules')
    expect(wrapper.text()).toContain('does not expose rule values')
    expect(wrapper.text()).not.toContain('shared-review-token')

    await wrapper.findAll('button').find(button => button.text() === 'Review policy').trigger('click')

    expect(wrapper.emitted('edit-policy')).toEqual([[entry]])
  })

  it('fails closed when the server sends an unrecognized study-source status', () => {
    const wrapper = mount(PolicyPurposeCoverageReview, {
      props: {
        review: {
          entries: [entry],
          studySourceReadiness: {
            statusId: 'provider_supplied_status',
            activePolicyCount: 99,
          },
        },
      },
    })

    expect(wrapper.text()).not.toContain('Held-out semantic study source')
    expect(wrapper.text()).not.toContain('provider supplied status')
  })

  it('opens a bounded evidence digest only for the policy represented by the selected row', async () => {
    const wrapper = mount(PolicyPurposeCoverageReview, {
      props: { review: { entries: [entry], summary: {} } },
    })

    await wrapper.findAll('button').find(button => button.text() === 'Review evidence').trigger('click')

    expect(wrapper.emitted('review-evidence')).toEqual([[entry]])
  })
})
