/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  NATIVE_INTENT_RECONCILIATION_REMEDIATION_ACTION_IDS,
  buildNativeIntentReconciliationRemediationInventory,
  normalizeRemediationLimit,
} from '../../services/nativeIntentReconciliationRemediationContract.mjs';

describe('nativeIntentReconciliationRemediationContract', () => {
  test('offers only the explicit legacy-purpose review for a no-convertible-intent state', () => {
    const inventory = buildNativeIntentReconciliationRemediationInventory({
      evaluatedAt: '2026-08-16T12:00:00.000Z',
      records: [{
        policy_id: 17,
        policy_name: 'Kids TV Policy',
        library_id: 18,
        library_name: 'Kids TV',
        library_media_type: 'tv',
        candidate_status_id: 'no_convertible_intent',
        outcome_state: 'requires_maintenance',
        reason_id: 'no_convertible_intent',
        evaluated_at: '2026-08-16T11:50:00.000Z',
        legacy_configuration_present: true,
        native_authority_active: false,
        candidate_fingerprint: 'sha256:should-not-be-exposed',
      }],
    });

    expect(inventory).toEqual(expect.objectContaining({
      version: 'native_intent_reconciliation_remediation_inventory.v1',
      rawPayloadExposed: false,
      summary: { unresolvedCount: 1, actionableCount: 1 },
    }));
    expect(inventory.entries[0]).toEqual(expect.objectContaining({
      policy: { id: 17, name: 'Kids TV Policy' },
      library: { id: 18, name: 'Kids TV', mediaType: 'tv' },
      action: expect.objectContaining({
        actionId: NATIVE_INTENT_RECONCILIATION_REMEDIATION_ACTION_IDS.DECLARE_LEGACY_POLICY_PURPOSE,
        available: true,
        actionLabel: 'Review policy',
      }),
    }));
    expect(inventory.entries[0]).not.toHaveProperty('candidate_fingerprint');
    expect(JSON.stringify(inventory)).not.toContain('should-not-be-exposed');
  });

  test('does not offer a write action when the row has no compatible legacy editor path', () => {
    const inventory = buildNativeIntentReconciliationRemediationInventory({
      records: [{
        policy_id: 17,
        policy_name: 'Native policy',
        library_id: 18,
        library_name: 'Kids TV',
        candidate_status_id: 'no_convertible_intent',
        outcome_state: 'requires_maintenance',
        reason_id: 'no_convertible_intent',
        legacy_configuration_present: false,
        native_authority_active: true,
      }],
    });

    expect(inventory.entries[0].action).toEqual(expect.objectContaining({
      actionId: NATIVE_INTENT_RECONCILIATION_REMEDIATION_ACTION_IDS.REVIEW_POLICY_CONFIGURATION,
      available: false,
      actionLabel: null,
    }));
  });

  test('bounds inventory requests without exposing an unbounded SQL limit', () => {
    expect(normalizeRemediationLimit()).toBe(50);
    expect(normalizeRemediationLimit('not-a-number')).toBe(50);
    expect(normalizeRemediationLimit(0)).toBe(50);
    expect(normalizeRemediationLimit(1000)).toBe(100);
    expect(normalizeRemediationLimit('25')).toBe(25);
  });
});
