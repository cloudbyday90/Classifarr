/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getPolicyNativeIntentPurposeChange: vi.fn(),
    getPolicyNativeIntentChangeRecentReceipt: vi.fn(),
    preflightPolicyNativeIntentPurposeChange: vi.fn(),
    applyPolicyNativeIntentPurposeChange: vi.fn(),
  },
}))

vi.mock('@/api/policiesApi', () => apiMock)

import PolicyNativeIntentPurposeChangeSurface from '@/components/policies/PolicyNativeIntentPurposeChangeSurface.vue'

function purposeRead(revision = 3, term = 'Animation') {
  return {
    version: 'policy.native_intent_purpose_change_read.v1',
    statusId: 'native_intent_purpose_change_available',
    policyId: 17,
    revision,
    changeCommand: {
      command_id: 'update_purpose',
      values: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: [term] },
        constraint_mode: 'advisory',
        semantics: 'identity',
      }],
    },
    authority: {
      source: 'server_owned_native_intent',
      purposeChangeAllowed: true,
      browserAuthorityAccepted: false,
    },
    compatibilityDataExposed: false,
    aiDataExposed: false,
    routingDataExposed: false,
    learningDataExposed: false,
  }
}

function recentReceiptDiscovery(recentChange = null) {
  return {
    version: 'policy.native_intent_change_recent_receipt_discovery.v1',
    statusId: 'native_intent_change_recent_receipt_discovery_complete',
    mode: 'read_only',
    policyId: 17,
    recentChange,
    scope: {
      actorBound: true,
      policyBound: true,
      browserAuthorityAccepted: false,
      mutationAuthorized: false,
    },
    sideEffects: {
      storedReceiptRead: true,
      providerAccessed: false,
      policyStorageMutated: false,
      routingAffected: false,
      learningAffected: false,
      databaseWritten: false,
    },
    idempotencyKeyExposed: false,
    commandFingerprintExposed: false,
    commandValuesExposed: false,
    receiptHistoryExposed: false,
    receiptIdentifierExposed: false,
    receiptTimestampExposed: false,
    rawPolicyDataExposed: false,
    compatibilityDataExposed: false,
    aiDataExposed: false,
    routingDataExposed: false,
    learningDataExposed: false,
  }
}

describe('PolicyNativeIntentPurposeChangeSurface', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getPolicyNativeIntentChangeRecentReceipt.mockResolvedValue(recentReceiptDiscovery())
  })

  it('uses the bounded purpose command, then emits the refreshed server-owned read after applying', async () => {
    apiMock.getPolicyNativeIntentPurposeChange
      .mockResolvedValueOnce(purposeRead(3, 'Animation'))
      .mockResolvedValueOnce(purposeRead(4, 'Comedy'))
    apiMock.preflightPolicyNativeIntentPurposeChange.mockResolvedValue({
      data: {
        advisory: true,
        commandId: 'update_purpose',
        expectedRevision: 3,
        currentRevision: 3,
        coverage: { overlappingDestinationCount: 0, requiredTermCount: 1 },
        guidance: { title: 'Coverage reviewed', description: 'Advisory only.' },
      },
    })
    apiMock.applyPolicyNativeIntentPurposeChange.mockResolvedValue({
      data: { statusId: 'applied', change: { applied: true, newIntentVersion: 4 } },
    })

    const wrapper = mount(PolicyNativeIntentPurposeChangeSurface, { props: { policyId: 17 } })
    await flushPromises()

    expect(wrapper.text()).toContain('Declared purpose maintenance')
    expect(wrapper.text()).toContain('Current native revision: 3')
    expect(wrapper.text()).toContain('compatibility policy data, select routing, invoke AI')

    await wrapper.get('button').trigger('click')
    await wrapper.get('input[aria-label="Purpose terms for rule 1"]').setValue('Comedy')
    const reviewButton = wrapper.findAll('button').find(button => button.text() === 'Review coverage')
    await reviewButton.trigger('click')
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(apiMock.preflightPolicyNativeIntentPurposeChange).toHaveBeenCalledWith(17, 3, expect.objectContaining({
      command_id: 'update_purpose',
      values: expect.any(Array),
    }))
    expect(apiMock.applyPolicyNativeIntentPurposeChange).toHaveBeenCalledWith(
      17,
      3,
      expect.objectContaining({
        command_id: 'update_purpose',
        values: expect.any(Array),
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    )
    expect(wrapper.emitted('authority-refreshed')).toEqual([[purposeRead(4, 'Comedy')]])
  })

  it('hides the administrator-only surface when the server denies access', async () => {
    apiMock.getPolicyNativeIntentPurposeChange.mockRejectedValue({ response: { status: 403 } })

    const wrapper = mount(PolicyNativeIntentPurposeChangeSurface, { props: { policyId: 17 } })
    await flushPromises()

    expect(wrapper.find('#policy-native-purpose-change').exists()).toBe(false)
  })

  it('shows a passive recent-change status without replay material or a new action', async () => {
    apiMock.getPolicyNativeIntentPurposeChange.mockResolvedValue(purposeRead())
    apiMock.getPolicyNativeIntentChangeRecentReceipt.mockResolvedValue(recentReceiptDiscovery({
      resultStatusId: 'applied',
      sourceIntentVersion: 3,
      targetIntentVersion: 4,
    }))

    const wrapper = mount(PolicyNativeIntentPurposeChangeSurface, { props: { policyId: 17 } })
    await flushPromises()

    const receiptNotice = wrapper.get('#policy-native-purpose-change-recent-receipt')
    expect(receiptNotice.text()).toContain('revision 4')
    expect(receiptNotice.text()).not.toContain('idempotency')
    expect(wrapper.findAll('button').map(button => button.text())).not.toContain('Retry receipt')
  })
})
