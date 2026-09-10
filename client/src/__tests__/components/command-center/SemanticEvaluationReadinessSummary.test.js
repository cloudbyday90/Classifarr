/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SemanticEvaluationReadinessSummary from '@/components/command-center/SemanticEvaluationReadinessSummary.vue'
import { ROUTER_LINK_SIMPLE_STUB } from '../../helpers/vueTestUtils'

const baselineReadiness = {
  version: 'policy.held_out_semantic_study_readiness.v5',
  statusId: 'normal_lifecycle_receipt_required',
  normalLifecycleReceiptCount: 0,
  completePolicyEvidenceCount: 0,
  currentCompleteAuditAvailable: false,
  measuredBlockerId: 'normal_lifecycle_receipt_required',
  reAuditPreconditionSatisfied: false,
  rawConfigurationExposed: false,
  libraryIdentityExposed: false,
  mediaIdentityExposed: false,
  semanticCohortReady: false,
  privateCohortCaptureReady: false,
  independentLabelsAvailable: false,
  semanticSelectionAffected: false,
  routingAffected: false,
}

describe('SemanticEvaluationReadinessSummary', () => {
  it('uses one plain-language automatic status with progressively disclosed detail', () => {
    const wrapper = mount(SemanticEvaluationReadinessSummary, {
      props: { readiness: baselineReadiness },
      global: { stubs: { RouterLink: ROUTER_LINK_SIMPLE_STUB } },
    })

    expect(wrapper.text()).toContain('Semantic evaluation')
    expect(wrapper.text()).toContain('Building baseline')
    expect(wrapper.text()).toContain('waiting for ordinary policy lifecycle activity')
    expect(wrapper.text()).toContain('Updates automatically while this page is open.')
    expect(wrapper.text()).toContain('does not label media, tune AI/RAG, or change routing')
    expect(wrapper.text()).toContain('See evaluation details')
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.get('[role="status"]').attributes()).toMatchObject({
      'aria-live': 'polite',
      'aria-atomic': 'true',
    })
  })

  it('explains that eligible source evidence still needs independent review before measurement', () => {
    const wrapper = mount(SemanticEvaluationReadinessSummary, {
      props: {
        readiness: {
          ...baselineReadiness,
          statusId: 'eligibility_audit_available',
          normalLifecycleReceiptCount: 2,
          completePolicyEvidenceCount: 1,
          currentCompleteAuditAvailable: true,
          measuredBlockerId: 'await_balanced_eligible_cohort',
          reAuditPreconditionSatisfied: true,
        },
      },
      global: { stubs: { RouterLink: ROUTER_LINK_SIMPLE_STUB } },
    })

    expect(wrapper.text()).toContain('Checking evidence')
    expect(wrapper.text()).toContain('independently reviewed labels')
  })

  it('withholds an invalid projection', () => {
    const wrapper = mount(SemanticEvaluationReadinessSummary, {
      props: { readiness: { ...baselineReadiness, libraryName: 'must-not-project' } },
    })

    expect(wrapper.find('#semantic-evaluation-readiness').exists()).toBe(false)
  })

  it('summarizes a capture-ready handoff without adding an action', () => {
    const wrapper = mount(SemanticEvaluationReadinessSummary, {
      props: {
        readiness: {
          ...baselineReadiness,
          statusId: 'eligibility_audit_available',
          normalLifecycleReceiptCount: 2,
          completePolicyEvidenceCount: 1,
          currentCompleteAuditAvailable: true,
          measuredBlockerId: 'private_cohort_capture_ready',
          reAuditPreconditionSatisfied: true,
          privateCohortCaptureReady: true,
        },
      },
      global: { stubs: { RouterLink: ROUTER_LINK_SIMPLE_STUB } },
    })

    expect(wrapper.text()).toContain('Private capture ready')
    expect(wrapper.text()).toContain('nothing is retained, routed, or labeled automatically')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})
