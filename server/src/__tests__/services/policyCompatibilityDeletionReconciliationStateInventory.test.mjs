import { jest } from '@jest/globals';
import {
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS,
  buildPolicyCompatibilityDeletionReconciliationStateInventory,
  loadPolicyCompatibilityDeletionReconciliationStateInventory,
  validatePolicyCompatibilityDeletionReconciliationStateInventory,
} from '../../services/policyCompatibilityDeletionReconciliationStateInventory.mjs';

describe('policyCompatibilityDeletionReconciliationStateInventory', () => {
  test('requires a measured count and blocks unresolved requires-maintenance states', () => {
    const unknown = buildPolicyCompatibilityDeletionReconciliationStateInventory();
    const blocked = buildPolicyCompatibilityDeletionReconciliationStateInventory({
      requiresMaintenanceStateCount: 2,
    });

    expect(unknown.statusId).toBe(
      POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS
        .INVALID_INVENTORY
    );
    expect(unknown.hasNoRequiresMaintenanceStates).toBe(false);
    expect(blocked.statusId).toBe(
      POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS
        .BLOCKED_BY_REQUIRES_MAINTENANCE_STATES
    );
    expect(blocked.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_RISK_IDS
            .REQUIRES_MAINTENANCE_STATES_REMAIN,
        requiresMaintenanceStateCount: 2,
      }),
    ]));
  });

  test('accepts only a zero current count and does not expose reconciliation payloads', async () => {
    const dbClient = {
      query: jest.fn(async () => ({
        rows: [{ requires_maintenance_state_count: 0 }],
      })),
    };
    const inventory = await loadPolicyCompatibilityDeletionReconciliationStateInventory(
      dbClient,
      { generatedAt: '2026-07-16T00:00:00.000Z' }
    );

    expect(dbClient.query).toHaveBeenCalledWith(expect.stringContaining(
      "outcome_state = 'requires_maintenance'"
    ));
    expect(inventory.statusId).toBe(
      POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS
        .NO_REQUIRES_MAINTENANCE_STATES
    );
    expect(inventory).toEqual(expect.objectContaining({
      requiresMaintenanceStateCount: 0,
      hasNoRequiresMaintenanceStates: true,
      collectionPolicy: expect.objectContaining({
        includesPolicyIds: false,
        includesFailureReasons: false,
        writesDatabase: false,
      }),
    }));
  });

  test('rejects mutated readiness and side effects', () => {
    const inventory = buildPolicyCompatibilityDeletionReconciliationStateInventory({
      requiresMaintenanceStateCount: 0,
    });
    const validation = validatePolicyCompatibilityDeletionReconciliationStateInventory({
      ...inventory,
      hasNoRequiresMaintenanceStates: false,
      sideEffects: {
        ...inventory.sideEffects,
        writesDatabase: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_RISK_IDS.STATUS_MISMATCH,
      POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_RISK_IDS
        .SIDE_EFFECT_PERFORMED,
    ]));
  });
});
