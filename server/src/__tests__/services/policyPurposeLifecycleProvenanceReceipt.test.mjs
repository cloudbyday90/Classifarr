/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS,
  buildPolicyPurposeLifecycleProvenanceReceipt,
} from '../../services/policyPurposeLifecycleProvenanceReceipt.mjs';

describe('policyPurposeLifecycleProvenanceReceipt', () => {
  test('reports retained declared purpose across a complete observed normal lifecycle without exposing configuration', () => {
    const receipt = buildPolicyPurposeLifecycleProvenanceReceipt({
      records: [{
        lifecycle_transition: 'initial_intent_establishment',
        intent_available: true,
        specialized_purpose_rule_count: 2,
        inferred_profile_purpose_rule_count: 0,
        values: { require_any: ['must-not-leak'] },
      }, {
        lifecycle_transition: 'native_intent_change',
        intent_available: true,
        specialized_purpose_rule_count: 3,
        inferred_profile_purpose_rule_count: 1,
      }],
      limit: 100,
    });

    expect(receipt).toEqual(expect.objectContaining({
      version: 'policy_purpose_lifecycle_provenance_receipt.v2',
      statusId: POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS
        .DECLARED_PURPOSE_RETAINED_FOR_OBSERVED_LIFECYCLE_RECEIPTS,
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
        retainedForEveryVerifiableReceipt: true,
        normalPolicyChangeObserved: true,
        normalPolicyChangeRetentionVerified: true,
      },
      rawConfigurationExposed: false,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      labelingAffected: false,
      routingAffected: false,
    }));
    expect(JSON.stringify(receipt)).not.toContain('must-not-leak');
  });

  test('requires receipt verification before interpreting unavailable revisions or profile-only purpose', () => {
    const receipt = buildPolicyPurposeLifecycleProvenanceReceipt({
      records: [{
        lifecycle_transition: 'native_intent_change',
        intent_available: true,
        specialized_purpose_rule_count: 1,
        inferred_profile_purpose_rule_count: 1,
      }, {
        lifecycle_transition: 'native_intent_change',
        intent_available: false,
        specialized_purpose_rule_count: 99,
        inferred_profile_purpose_rule_count: 0,
      }],
      limit: 1,
      truncated: true,
    });

    expect(receipt.statusId).toBe(
      POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS
        .NORMAL_LIFECYCLE_RECEIPT_VERIFICATION_REQUIRED,
    );
    expect(receipt.scope).toEqual({
      observedReceiptCount: 2,
      receiptLimit: 1,
      truncated: true,
      fullHistoryObserved: false,
    });
    expect(receipt.summary).toEqual(expect.objectContaining({
      verifiableReceiptCount: 1,
      unverifiableReceiptCount: 1,
      retainedPurposeReceiptCount: 0,
      profileOnlyPurposeReceiptCount: 1,
      normalPolicyChangeRetentionVerified: false,
    }));
  });

  test('does not claim policy-change evidence when only initial establishments are observed', () => {
    const receipt = buildPolicyPurposeLifecycleProvenanceReceipt({
      records: [{
        lifecycle_transition: 'initial_intent_establishment',
        intent_available: true,
        specialized_purpose_rule_count: 1,
        inferred_profile_purpose_rule_count: 0,
      }],
    });

    expect(receipt.statusId).toBe(
      POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS
        .DECLARED_PURPOSE_RETAINED_FOR_OBSERVED_INITIAL_ESTABLISHMENTS,
    );
    expect(receipt.summary).toEqual(expect.objectContaining({
      nativeIntentChangeCount: 0,
      libraryRebuildReplacementCount: 0,
      normalPolicyChangeObserved: false,
      normalPolicyChangeRetentionVerified: false,
    }));
  });

  test('marks retained counts as incomplete when the bounded history omits older receipts', () => {
    const receipt = buildPolicyPurposeLifecycleProvenanceReceipt({
      records: [{
        lifecycle_transition: 'native_intent_change',
        intent_available: true,
        specialized_purpose_rule_count: 1,
        inferred_profile_purpose_rule_count: 0,
      }],
      truncated: true,
    });

    expect(receipt.statusId).toBe(
      POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS.NORMAL_LIFECYCLE_HISTORY_TRUNCATED,
    );
    expect(receipt.summary.normalPolicyChangeRetentionVerified).toBe(false);
  });

  test('counts a fully verified library rebuild replacement as normal lifecycle evidence', () => {
    const receipt = buildPolicyPurposeLifecycleProvenanceReceipt({
      records: [{
        lifecycle_transition: 'library_rebuild_replacement',
        intent_available: true,
        specialized_purpose_rule_count: 1,
        inferred_profile_purpose_rule_count: 0,
      }],
    });

    expect(receipt).toEqual(expect.objectContaining({
      version: 'policy_purpose_lifecycle_provenance_receipt.v2',
      statusId: POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_STATUS_IDS
        .DECLARED_PURPOSE_RETAINED_FOR_OBSERVED_LIFECYCLE_RECEIPTS,
      summary: expect.objectContaining({
        initialIntentEstablishmentCount: 0,
        nativeIntentChangeCount: 0,
        libraryRebuildReplacementCount: 1,
        normalPolicyChangeObserved: true,
        normalPolicyChangeRetentionVerified: true,
      }),
    }));
  });
});
