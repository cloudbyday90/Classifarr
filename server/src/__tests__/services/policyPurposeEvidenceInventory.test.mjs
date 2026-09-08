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
  POLICY_PURPOSE_EVIDENCE_INVENTORY_STATUS_IDS,
  buildPolicyPurposeEvidenceInventory,
} from '../../services/policyPurposeEvidenceInventory.mjs';

describe('policyPurposeEvidenceInventory', () => {
  test('fails closed when no active authoritative native policy exists', () => {
    expect(buildPolicyPurposeEvidenceInventory()).toEqual({
      version: 'policy_purpose_evidence_inventory.v1',
      statusId: POLICY_PURPOSE_EVIDENCE_INVENTORY_STATUS_IDS
        .NO_ACTIVE_VALIDATED_NATIVE_POLICY,
      activePolicyCount: 0,
      authoritativeActiveNativePolicyCount: 0,
      currentIntentVersionPolicyCount: 0,
      currentIntentSchemaVersionPolicyCount: 0,
      retainedDeclaredPurposePolicyCount: 0,
      normalLifecycleReceiptPolicyCount: 0,
      verifiableLifecycleReceiptPolicyCount: 0,
      currentIntentLifecycleReceiptPolicyCount: 0,
      completePolicyEvidenceCount: 0,
      incompletePolicyEvidenceCount: 0,
      completePolicyEvidenceAvailable: false,
      rawConfigurationExposed: false,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    });
  });

  test('marks a complete current-intent evidence chain as available without semantic authority', () => {
    expect(buildPolicyPurposeEvidenceInventory({
      active_policy_count: 4,
      authoritative_active_native_policy_count: 4,
      current_intent_version_policy_count: 4,
      current_intent_schema_version_policy_count: 4,
      retained_purpose_policy_count: 2,
      normal_lifecycle_receipt_policy_count: 3,
      verifiable_lifecycle_receipt_policy_count: 3,
      current_intent_lifecycle_receipt_policy_count: 2,
      complete_policy_evidence_count: 2,
    })).toEqual(expect.objectContaining({
      statusId: POLICY_PURPOSE_EVIDENCE_INVENTORY_STATUS_IDS
        .COMPLETE_POLICY_EVIDENCE_AVAILABLE,
      completePolicyEvidenceCount: 2,
      incompletePolicyEvidenceCount: 2,
      completePolicyEvidenceAvailable: true,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    }));
  });

  test('bounds malformed and contradictory aggregate counts', () => {
    expect(buildPolicyPurposeEvidenceInventory({
      active_policy_count: 2,
      authoritative_active_native_policy_count: 99,
      current_intent_version_policy_count: 99,
      current_intent_schema_version_policy_count: 99,
      retained_purpose_policy_count: 99,
      normal_lifecycle_receipt_policy_count: 99,
      verifiable_lifecycle_receipt_policy_count: 99,
      current_intent_lifecycle_receipt_policy_count: 99,
      complete_policy_evidence_count: 99,
    })).toEqual(expect.objectContaining({
      activePolicyCount: 2,
      authoritativeActiveNativePolicyCount: 2,
      currentIntentVersionPolicyCount: 2,
      currentIntentSchemaVersionPolicyCount: 2,
      retainedDeclaredPurposePolicyCount: 2,
      normalLifecycleReceiptPolicyCount: 2,
      verifiableLifecycleReceiptPolicyCount: 2,
      currentIntentLifecycleReceiptPolicyCount: 2,
      completePolicyEvidenceCount: 2,
      incompletePolicyEvidenceCount: 0,
    }));
  });
});
