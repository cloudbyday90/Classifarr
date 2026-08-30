/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyDestinationCompetitionPreview from '@/components/policies/PolicyDestinationCompetitionPreview.vue'

describe('PolicyDestinationCompetitionPreview', () => {
  it('shows only aggregate destination-competition counts and emits one explicit preview request', async () => {
    const wrapper = mount(PolicyDestinationCompetitionPreview, {
      props: {
        available: true,
        preview: {
          sample: {
            maximumItems: 100,
            evaluatedItemCount: 12,
          },
          competitors: {
            activePolicyCount: 3,
            maximumPolicyCount: 25,
            policyLimitReached: false,
          },
          comparisonCoverage: {
            comparedActiveCompetitorPolicyCount: 3,
            maximumCompetitorPolicyCount: 25,
            additionalActiveCompetitorsExcluded: false,
          },
          proposed: { eligibleItemCount: 4 },
          competition: {
            proposedUncontestedEligibleItemCount: 2,
            proposedSharedEligibleItemCount: 2,
            competitorOnlyEligibleItemCount: 1,
          },
          sharedEligibilityExplanation: {
            categories: [{
              categoryId: 'genre_purpose',
              label: 'Genre-based declared purpose',
              configuredCompetitorPolicyCount: 2,
            }],
            guidance: {
              description: 'This category may contribute to shared eligibility.',
            },
          },
          guidance: {
            title: 'The proposed policy shares deterministic eligibility',
            description: 'Review the declared purpose and constraints before saving.',
          },
          advisory: true,
          draftRetained: false,
          rawConfigurationExposed: false,
          rawHistoricItemsExposed: false,
          routingAffected: false,
          providerAccessed: false,
          databaseWritten: false,
        },
      },
    })

    expect(wrapper.get('[role="status"]').text()).toContain(
      'The proposed policy shares deterministic eligibility',
    )
    expect(wrapper.text()).toContain('Active destinations considered')
    expect(wrapper.text()).toContain('Shared eligible')
    expect(wrapper.text()).toContain('Comparison coverage is complete')
    expect(wrapper.text()).toContain('Why shared eligibility may occur')
    expect(wrapper.text()).toContain('no destination names, AI calls, saving, or routing')
    expect(wrapper.text()).not.toContain('Range of Stars')

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('preview')).toEqual([[]])
  })

  it('keeps unavailable and error feedback bounded', () => {
    const wrapper = mount(PolicyDestinationCompetitionPreview, {
      props: {
        available: false,
        error: 'Administrator access is required',
      },
    })

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="alert"]').text()).toBe('Administrator access is required')
    expect(wrapper.text()).toContain('Save this policy once')
  })
})
