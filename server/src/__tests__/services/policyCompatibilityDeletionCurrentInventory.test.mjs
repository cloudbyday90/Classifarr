import { jest } from '@jest/globals';
import {
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS,
  buildPolicyCompatibilityDeletionCurrentInventory,
  loadPolicyCompatibilityDeletionCurrentInventory,
  validatePolicyCompatibilityDeletionCurrentInventory,
} from '../../services/policyCompatibilityDeletionCurrentInventory.mjs';

function authoritativePolicy(policyId = 14) {
  return {
    policy_id: policyId,
    active_intent_count: 1,
    authoritative_native_intent_count: 1,
    active_intent_sources: ['native_intent'],
    active_intent_validation_statuses: ['valid'],
  };
}

describe('policyCompatibilityDeletionCurrentInventory', () => {
  test('accepts a read-only inventory only when every enabled policy has one valid active native intent', () => {
    const inventory = buildPolicyCompatibilityDeletionCurrentInventory({
      policyRows: [authoritativePolicy(14), authoritativePolicy(15)],
      generatedAt: '2026-07-14T19:00:00.000Z',
    });

    expect(inventory.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS
        .ALL_ENABLED_POLICIES_NATIVE);
    expect(inventory.allEnabledPoliciesNative).toBe(true);
    expect(inventory.policyCounts).toEqual(expect.objectContaining({
      enabledPolicyCount: 2,
      nativeAuthoritativePolicyCount: 2,
      unconvertedPolicyCount: 0,
    }));
    expect(inventory.validation.ok).toBe(true);
    expect(inventory.collectionPolicy).toEqual(expect.objectContaining({
      readsCurrentDatabaseState: true,
      includesPolicyPayloads: false,
      writesDatabase: false,
    }));
    expect(Object.values(inventory.sideEffects).some(Boolean)).toBe(false);
  });

  test('blocks deletion planning with bounded diagnostics for missing, ambiguous, and invalid native authority', () => {
    const inventory = buildPolicyCompatibilityDeletionCurrentInventory({
      policyRows: [
        {
          policy_id: 14,
          active_intent_count: 0,
          authoritative_native_intent_count: 0,
          active_intent_sources: [],
          active_intent_validation_statuses: [],
        },
        {
          policy_id: 15,
          active_intent_count: 2,
          authoritative_native_intent_count: 1,
          active_intent_sources: ['native_intent'],
          active_intent_validation_statuses: ['valid'],
        },
        {
          policy_id: 16,
          active_intent_count: 1,
          authoritative_native_intent_count: 0,
          active_intent_sources: ['legacy_presets'],
          active_intent_validation_statuses: ['valid'],
        },
      ],
    });

    expect(inventory.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS
        .BLOCKED_BY_UNCONVERTED_POLICIES);
    expect(inventory.allEnabledPoliciesNative).toBe(false);
    expect(inventory.policyCounts).toEqual(expect.objectContaining({
      unconvertedPolicyCount: 3,
      missingActiveIntentPolicyCount: 1,
      ambiguousActiveIntentPolicyCount: 1,
      nonAuthoritativeActiveIntentPolicyCount: 1,
    }));
    expect(inventory.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.MISSING_ACTIVE_INTENT,
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.AMBIGUOUS_ACTIVE_INTENT,
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS
        .NON_AUTHORITATIVE_ACTIVE_INTENT,
    ]));
    expect(inventory.risks.every(risk => !('policyPayload' in risk))).toBe(true);
  });

  test('marks malformed current evidence invalid instead of accepting a partial count', () => {
    const inventory = buildPolicyCompatibilityDeletionCurrentInventory({
      policyRows: [authoritativePolicy(14), { policy_id: 15, active_intent_count: -1 }],
    });

    expect(inventory.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS.INVALID_INVENTORY);
    expect(inventory.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.INVALID_POLICY_ROW,
        invalidRowCount: 1,
      }),
    ]));
  });

  test('loads only enabled-policy authority metadata with current validation status', async () => {
    const dbClient = {
      query: jest.fn(async () => ({ rows: [authoritativePolicy()] })),
    };

    const inventory = await loadPolicyCompatibilityDeletionCurrentInventory(dbClient, {
      generatedAt: '2026-07-14T19:00:00.000Z',
    });

    expect(dbClient.query).toHaveBeenCalledWith(expect.stringContaining('WHERE policy.enabled = TRUE'));
    expect(dbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('policy_intent_validation_status')
    );
    expect(inventory.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS
        .ALL_ENABLED_POLICIES_NATIVE);
  });

  test('rejects a mutated inventory with inconsistent counts or side effects', () => {
    const inventory = buildPolicyCompatibilityDeletionCurrentInventory({
      policyRows: [authoritativePolicy()],
    });
    const validation = validatePolicyCompatibilityDeletionCurrentInventory({
      ...inventory,
      policyCounts: {
        ...inventory.policyCounts,
        unconvertedPolicyCount: 1,
      },
      allEnabledPoliciesNative: true,
      sideEffects: {
        ...inventory.sideEffects,
        writesDatabase: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.POLICY_COUNT_MISMATCH,
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.STATUS_MISMATCH,
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });
});
