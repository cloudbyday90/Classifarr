/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyPurposeDeclarationWorklist from '@/components/policies/PolicyPurposeDeclarationWorklist.vue'

const entry = {
  policy: { id: 17, name: 'Animation policy' },
  library: { id: 18, name: 'Animation', mediaType: 'movie' },
  purposeProvenance: {
    id: 'profile_derived',
    declarationRequired: true,
    rawRuleProvenanceExposed: false,
  },
  action: { actionId: 'review_and_declare_purpose', available: true },
}

const worklist = {
  version: 'policy_purpose_declaration_worklist.v1',
  statusId: 'declaration_review_required',
  groups: [{
    id: 'purpose_declaration_group_1',
    policyCount: 1,
    libraryCount: 1,
    entries: [entry],
  }],
  summary: {
    reviewedPolicyCount: 1,
    declarationRequiredPolicyCount: 1,
    groupCount: 1,
    truncated: false,
  },
  rawPurposeRulesExposed: false,
  policyStorageMutated: false,
  semanticSelectionAffected: false,
  routingAffected: false,
}

describe('PolicyPurposeDeclarationWorklist', () => {
  it('uses a labelled table and sends an individual policy to the existing declaration form', async () => {
    const wrapper = mount(PolicyPurposeDeclarationWorklist, { props: { worklist } })

    expect(wrapper.get('caption').text()).toContain('purpose declaration review')
    expect(wrapper.findAll('th[scope="col"]')).toHaveLength(4)
    expect(wrapper.get('th[scope="rowgroup"]').text()).toContain('Shared stored-purpose group 1')
    expect(wrapper.text()).toContain('Profile-derived terms require review')

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('review-purpose')).toEqual([[entry]])
  })

  it('fails closed for a payload that contains raw purpose data', () => {
    const wrapper = mount(PolicyPurposeDeclarationWorklist, {
      props: {
        worklist: {
          ...worklist,
          groups: [{ ...worklist.groups[0], purposeRules: ['must-not-display'] }],
        },
      },
    })

    expect(wrapper.find('#policy-purpose-declaration-worklist').exists()).toBe(false)
  })
})
