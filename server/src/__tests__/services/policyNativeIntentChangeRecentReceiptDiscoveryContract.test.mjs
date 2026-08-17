/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS,
  buildRecentReceiptDiscoveryCompleteResult,
  validatePolicyNativeIntentChangeRecentReceiptDiscovery,
} from '../../services/policyNativeIntentChangeRecentReceiptDiscoveryContract.mjs';

describe('policyNativeIntentChangeRecentReceiptDiscoveryContract', () => {
  test('projects only one applied revision transition for an actor- and policy-bound read', () => {
    const result = buildRecentReceiptDiscoveryCompleteResult({
      policyId: 17,
      recentChange: {
        result_status_id: 'applied',
        source_intent_version: 3,
        target_intent_version: 4,
      },
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_DISCOVERY_STATUS_IDS.COMPLETE,
      mode: 'read_only',
      policyId: 17,
      recentChange: {
        resultStatusId: 'applied',
        sourceIntentVersion: 3,
        targetIntentVersion: 4,
      },
      scope: expect.objectContaining({
        actorBound: true,
        policyBound: true,
        mutationAuthorized: false,
      }),
    }));
    expect(result).toEqual(expect.objectContaining({
      idempotencyKeyExposed: false,
      commandFingerprintExposed: false,
      commandValuesExposed: false,
      receiptHistoryExposed: false,
      receiptIdentifierExposed: false,
      receiptTimestampExposed: false,
    }));
    expect(validatePolicyNativeIntentChangeRecentReceiptDiscovery(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('keeps an empty discovery distinct from an invalid receipt projection', () => {
    const empty = buildRecentReceiptDiscoveryCompleteResult({ policyId: 17 });
    expect(empty.recentChange).toBeNull();
    expect(validatePolicyNativeIntentChangeRecentReceiptDiscovery(empty).ok).toBe(true);

    const invalid = {
      ...empty,
      recentChange: {
        resultStatusId: 'applied',
        sourceIntentVersion: 4,
        targetIntentVersion: 4,
      },
    };
    expect(validatePolicyNativeIntentChangeRecentReceiptDiscovery(invalid)).toEqual(
      expect.objectContaining({ ok: false }),
    );

    const unavailableWithPayload = {
      ...empty,
      statusId: 'native_intent_change_recent_receipt_discovery_unavailable',
      recentChange: {
        resultStatusId: 'applied',
        sourceIntentVersion: 3,
        targetIntentVersion: 4,
      },
    };
    expect(validatePolicyNativeIntentChangeRecentReceiptDiscovery(unavailableWithPayload)).toEqual(
      expect.objectContaining({ ok: false }),
    );
  });

  test('fails closed when a future reader attempts to widen any response object', () => {
    const result = buildRecentReceiptDiscoveryCompleteResult({ policyId: 17 });
    const widened = {
      ...result,
      receiptId: 'must-not-leak',
      sideEffects: { ...result.sideEffects, replayed: true },
    };

    expect(validatePolicyNativeIntentChangeRecentReceiptDiscovery(widened)).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            riskId: 'unsafe_native_intent_change_recent_receipt_discovery_projection',
          }),
        ]),
      }),
    );
  });
});
