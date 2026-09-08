/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'

import {
  normalizePolicyPurposeLifecycleProvenanceReceipt,
} from '@/utils/policyPurposeLifecycleProvenanceReceipt'

const retainedLifecycleReceipt = {
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
    libraryRebuildReplacementCount: 0,
    verifiableReceiptCount: 2,
    unverifiableReceiptCount: 0,
    retainedPurposeReceiptCount: 2,
    profileOnlyPurposeReceiptCount: 0,
    noSpecializedPurposeReceiptCount: 0,
    unverifiedPurposeReceiptCount: 0,
    semanticCohortReady: true,
    routingAffected: true,
  },
}

describe('policyPurposeLifecycleProvenanceReceipt', () => {
  it('keeps only consistent aggregate counts and refuses semantic or routing authority', () => {
    expect(normalizePolicyPurposeLifecycleProvenanceReceipt(retainedLifecycleReceipt)).toEqual({
      statusId: 'declared_purpose_retained_for_observed_lifecycle_receipts',
      scope: {
        observedReceiptCount: 2,
        receiptLimit: 100,
        truncated: false,
        fullHistoryObserved: true,
      },
      summary: {
        normalLifecycleReceiptCount: 2,
        initialIntentEstablishmentCount: 1,
        nativeIntentChangeCount: 1,
        libraryRebuildReplacementCount: 0,
        verifiableReceiptCount: 2,
        unverifiableReceiptCount: 0,
        retainedPurposeReceiptCount: 2,
        profileOnlyPurposeReceiptCount: 0,
        noSpecializedPurposeReceiptCount: 0,
        unverifiedPurposeReceiptCount: 0,
        retainedForEveryVerifiableReceipt: true,
        normalPolicyChangeObserved: true,
        normalPolicyChangeRetentionVerified: true,
      },
      rawConfigurationExposed: false,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      labelingAffected: false,
      routingAffected: false,
    })
  })

  it('fails closed for unknown status and inconsistent aggregate counts', () => {
    expect(normalizePolicyPurposeLifecycleProvenanceReceipt({
      ...retainedLifecycleReceipt,
      statusId: 'provider_supplied_status',
    })).toBeNull()

    expect(normalizePolicyPurposeLifecycleProvenanceReceipt({
      ...retainedLifecycleReceipt,
      summary: {
        ...retainedLifecycleReceipt.summary,
        retainedPurposeReceiptCount: 1,
      },
    })).toBeNull()

    expect(normalizePolicyPurposeLifecycleProvenanceReceipt({
      ...retainedLifecycleReceipt,
      summary: {
        ...retainedLifecycleReceipt.summary,
        retainedPurposeReceiptCount: 0,
        profileOnlyPurposeReceiptCount: 2,
      },
    })).toBeNull()
  })

  it('accepts an aggregate-only verified rebuild replacement as a normal change', () => {
    const rebuildReceipt = {
      ...retainedLifecycleReceipt,
      scope: {
        ...retainedLifecycleReceipt.scope,
        observedReceiptCount: 1,
      },
      summary: {
        ...retainedLifecycleReceipt.summary,
        normalLifecycleReceiptCount: 1,
        initialIntentEstablishmentCount: 0,
        nativeIntentChangeCount: 0,
        libraryRebuildReplacementCount: 1,
        verifiableReceiptCount: 1,
        retainedPurposeReceiptCount: 1,
      },
    }

    expect(normalizePolicyPurposeLifecycleProvenanceReceipt(rebuildReceipt)).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          libraryRebuildReplacementCount: 1,
          normalPolicyChangeObserved: true,
        }),
      }),
    )
  })
})
