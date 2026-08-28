/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import PolicyNativeIntentReconciliation from '@/views/PolicyNativeIntentReconciliation.vue'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getNativeIntentReconciliationStatus: vi.fn(),
    getNativeIntentReconciliationRemediationInventory: vi.fn(),
    getPolicyPurposeCoverageReview: vi.fn(),
  },
}))

const { routeMock } = vi.hoisted(() => ({
  routeMock: { query: {} },
}))

const { policyApiMock } = vi.hoisted(() => ({
  policyApiMock: {
    getPolicy: vi.fn(),
    getPolicyNativeIntentReconciliationPurposeSuggestion: vi.fn(),
    updatePolicy: vi.fn(),
  },
}))

vi.mock('@/api', () => ({ default: apiMock }))
vi.mock('@/api/policiesApi', () => policyApiMock)
vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
}))

const PolicyBuilderModalStub = defineComponent({
  name: 'PolicyBuilderModal',
  props: {
    policy: { type: Object, required: true },
    compatibilityPurposeSuggestion: { type: Object, default: null },
    submitPolicy: { type: Function, required: true },
  },
  template: '<div data-testid="policy-builder-modal">{{ policy.name }}</div>',
})

const reconciliationStatus = {
  statusId: 'attention_required',
  nextScheduledAttemptAt: '2026-07-16T02:10:00.000Z',
  control: {
    automationEnabled: true,
    circuitState: 'closed',
  },
  inventory: {
    unresolvedCount: 3,
  },
  latestRun: {
    completedAt: '2026-07-16T02:00:00.000Z',
    reasonId: 'eligible_candidates_converted',
    runtime: {
      appVersion: '0.47.5-c.beta',
      buildRevision: 'a0b1c2d3e4f5678901234567890abcdef1234567',
    },
    counts: {
      convertedCount: 2,
      deferredCount: 1,
      blockedCount: 1,
    },
  },
  blockerReasonGroups: [
    {
      outcomeState: 'requires_maintenance',
      reasonId: 'rollback_hold_active',
      policyCount: 3,
    },
  ],
}

const remediationInventory = {
  entries: [{
    policy: { id: 17, name: 'Kids TV Policy' },
    library: { id: 18, name: 'Kids TV', mediaType: 'tv' },
    reconciliation: {
      candidateStatusId: 'no_convertible_intent',
      outcomeState: 'requires_maintenance',
      reasonId: 'no_convertible_intent',
    },
    action: {
      available: true,
      title: 'Declare destination purpose',
      description: 'Review the policy.',
      actionLabel: 'Review policy',
      schedulerFollowUp: 'The scheduler re-evaluates the policy.',
    },
  }],
}

const purposeCoverageReview = {
  entries: [],
  summary: {
    reviewedPolicyCount: 0,
    declaredCoverageCount: 0,
    missingCoverageCount: 0,
    broadOverlapCount: 0,
  },
}

const purposeSuggestion = {
  version: 'native_intent_reconciliation_purpose_suggestion.v1',
  statusId: 'available',
  available: true,
  policy: { id: 17, name: 'Kids TV Policy' },
  library: { id: 18, name: 'Kids TV', mediaType: 'tv' },
  profile: {
    itemCount: 44,
    generatedAt: '2026-08-28T15:00:00.000Z',
    genreSignalCount: 2,
  },
  suggestion: {
    sourceId: 'current_library_profile',
    rules: [{
      signalType: 'genres',
      operator: 'require_any',
      values: ['Animation', 'Family'],
      semantics: 'identity',
      constraintMode: 'advisory',
    }],
  },
  rawProfileExposed: false,
  persisted: false,
  routingAffected: false,
  learningAffected: false,
  aiInvoked: false,
}

function mountView() {
  return mount(PolicyNativeIntentReconciliation, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        PolicyBuilderModal: PolicyBuilderModalStub,
      },
    },
  })
}

describe('PolicyNativeIntentReconciliation.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeMock.query = {}
    apiMock.getNativeIntentReconciliationStatus.mockResolvedValue(reconciliationStatus)
    apiMock.getNativeIntentReconciliationRemediationInventory.mockResolvedValue(remediationInventory)
    apiMock.getPolicyPurposeCoverageReview.mockResolvedValue(purposeCoverageReview)
    policyApiMock.getPolicy.mockResolvedValue({
      id: 17,
      name: 'Kids TV Policy',
      library_id: 18,
    })
    policyApiMock.getPolicyNativeIntentReconciliationPurposeSuggestion.mockResolvedValue(purposeSuggestion)
    policyApiMock.updatePolicy.mockResolvedValue({ data: { success: true } })
  })

  it('shows automatic scheduler status and bounded blocker evidence without conversion controls', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Native intent reconciliation')
    expect(wrapper.text()).toContain('Automation needs attention')
    expect(wrapper.text()).toContain('Current blocker groups')
    expect(wrapper.text()).toContain('Rollback Hold Active')
    expect(wrapper.text()).toContain('Automatic reconciliation remains the only normal conversion path')
    expect(wrapper.text()).toContain('Policy remediation')
    expect(wrapper.text()).toContain('Policy purpose coverage')
    expect(wrapper.text()).toContain('Declare destination purpose')
    expect(wrapper.text()).toContain('App 0.47.5-c.beta | revision a0b1c2d3e4f5678901234567890abcdef1234567')
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Confirm native intent conversion')
    expect(wrapper.text()).not.toContain('Review conversion')
  })

  it('refreshes the read-only status and remediation contracts', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(apiMock.getNativeIntentReconciliationStatus).toHaveBeenCalledTimes(2)
    expect(apiMock.getNativeIntentReconciliationRemediationInventory).toHaveBeenCalledTimes(2)
    expect(apiMock.getPolicyPurposeCoverageReview).toHaveBeenCalledTimes(2)
  })

  it('opens the established policy editor and lets the scheduler re-evaluate after a normal policy save', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === 'Review policy').trigger('click')
    await flushPromises()

    expect(policyApiMock.getPolicy).toHaveBeenCalledWith(17)
    expect(policyApiMock.getPolicyNativeIntentReconciliationPurposeSuggestion).toHaveBeenCalledWith(17)
    const editor = wrapper.findComponent({ name: 'PolicyBuilderModal' })
    expect(editor.exists()).toBe(true)
    expect(editor.props('policy')).toEqual(expect.objectContaining({ id: 17, library_id: 18 }))
    expect(editor.props('compatibilityPurposeSuggestion')).toEqual(expect.objectContaining({
      available: true,
      suggestion: expect.objectContaining({ sourceId: 'current_library_profile' }),
    }))

    await editor.props('submitPolicy')({ name: 'Kids TV Policy' })

    expect(policyApiMock.updatePolicy).toHaveBeenCalledWith(17, { name: 'Kids TV Policy' })
    expect(wrapper.text()).toContain('The protected reconciliation scheduler will independently re-evaluate')
    expect(apiMock.getNativeIntentReconciliationStatus).toHaveBeenCalledTimes(2)
    expect(apiMock.getNativeIntentReconciliationRemediationInventory).toHaveBeenCalledTimes(2)
    expect(apiMock.getPolicyPurposeCoverageReview).toHaveBeenCalledTimes(2)
  })

  it('reports unavailable control state without treating it as a paused scheduler', async () => {
    apiMock.getNativeIntentReconciliationStatus.mockResolvedValue({
      ...reconciliationStatus,
      statusId: 'control_unavailable',
      control: {
        available: false,
        automationEnabled: true,
        circuitState: 'closed',
      },
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Control unavailable')
    expect(wrapper.text()).toContain('Unavailable')
    expect(wrapper.text()).not.toContain('AutomationEnabled')
  })

  it('labels pre-provenance reconciliation rows as historical without hiding status', async () => {
    apiMock.getNativeIntentReconciliationStatus.mockResolvedValue({
      ...reconciliationStatus,
      latestRun: {
        ...reconciliationStatus.latestRun,
        runtime: { appVersion: 'unknown', buildRevision: null },
      },
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Unknown (historical run)')
  })

  it('focuses the remediation record selected by the contextual policy action', async () => {
    routeMock.query = { policy: '17' }
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('#policy-reconciliation-remediation-17').attributes('tabindex')).toBe('-1')
  })
})
