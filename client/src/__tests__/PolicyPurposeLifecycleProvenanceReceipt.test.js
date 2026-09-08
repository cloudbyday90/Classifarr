/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyPurposeLifecycleProvenanceReceipt from '@/components/policies/PolicyPurposeLifecycleProvenanceReceipt.vue'

const receipt = {
  statusId: 'declared_purpose_retained_for_observed_lifecycle_receipts',
  scope: {
    observedReceiptCount: 2,
    receiptLimit: 100,
    truncated: false,
  },
  summary: {
    normalLifecycleReceiptCount: 2,
    initialIntentEstablishmentCount: 1,
    nativeIntentChangeCount: 1,
    verifiableReceiptCount: 2,
    unverifiableReceiptCount: 0,
    retainedPurposeReceiptCount: 2,
    profileOnlyPurposeReceiptCount: 0,
    noSpecializedPurposeReceiptCount: 0,
  },
}

describe('PolicyPurposeLifecycleProvenanceReceipt', () => {
  it('presents bounded aggregate lifecycle evidence without semantic or routing actions', () => {
    const wrapper = mount(PolicyPurposeLifecycleProvenanceReceipt, {
      props: { receipt },
    })

    expect(wrapper.text()).toContain('Normal policy purpose lifecycle')
    expect(wrapper.text()).toContain('Initial establishments')
    expect(wrapper.text()).toContain('Normal changes')
    expect(wrapper.text()).toContain('Retained-purpose receipts')
    expect(wrapper.text()).toContain('does not create a cohort, labels, semantic selection, or routing authority')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('hides malformed receipt data', () => {
    const wrapper = mount(PolicyPurposeLifecycleProvenanceReceipt, {
      props: {
        receipt: {
          ...receipt,
          statusId: 'unknown',
        },
      },
    })

    expect(wrapper.find('section').exists()).toBe(false)
  })
})
