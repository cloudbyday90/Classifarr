/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HeldOutSemanticStudyReadiness from '@/components/policies/HeldOutSemanticStudyReadiness.vue'

const readiness = {
  version: 'policy.held_out_semantic_study_readiness.v5',
  statusId: 'eligibility_audit_available',
  normalLifecycleReceiptCount: 2,
  completePolicyEvidenceCount: 1,
  currentCompleteAuditAvailable: true,
  measuredBlockerId: 'governed_declared_purpose_evidence_required',
  reAuditPreconditionSatisfied: true,
  rawConfigurationExposed: false,
  libraryIdentityExposed: false,
  mediaIdentityExposed: false,
  semanticCohortReady: false,
  privateCohortCaptureReady: false,
  independentLabelsAvailable: false,
  semanticSelectionAffected: false,
  routingAffected: false,
}

describe('HeldOutSemanticStudyReadiness.vue', () => {
  it('explains the fixed aggregate blocker without presenting a study action', () => {
    const wrapper = mount(HeldOutSemanticStudyReadiness, { props: { readiness } })

    expect(wrapper.text()).toContain('Current measured condition')
    expect(wrapper.text()).toContain('Governed Declared Purpose Evidence Required')
    expect(wrapper.text()).toContain('profile-derived purpose observations were excluded')
    expect(wrapper.text()).toContain('without selecting media or changing routing')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('withholds an invalid projection from the interface', () => {
    const wrapper = mount(HeldOutSemanticStudyReadiness, {
      props: { readiness: { ...readiness, libraryName: 'must-not-project' } },
    })

    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('states the capture-ready boundary without presenting an action', () => {
    const wrapper = mount(HeldOutSemanticStudyReadiness, {
      props: {
        readiness: {
          ...readiness,
          measuredBlockerId: 'private_cohort_capture_ready',
          privateCohortCaptureReady: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Private Cohort Capture Ready')
    expect(wrapper.text()).toContain('enough balanced, policy-eligible cases')
    expect(wrapper.text()).toContain('has not selected media')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})
