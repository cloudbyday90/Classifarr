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
  POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_RISK_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS,
  buildPolicyLibraryRebuildLegacyRemovalInventory,
  validatePolicyLibraryRebuildLegacyRemovalInventory,
} from '../../services/policyLibraryRebuildLegacyRemovalInventory.mjs';

const deletionCandidate = Object.freeze({
  path: 'client/src/components/policies/LegacyProfileRefreshPanel.vue',
  owner: 'policy-builder',
  decisionId: 'delete_after_migration',
  verifierKindId: 'representative_replay',
  replacement: 'Server-owned native intent readiness contract',
  removalGateIds: ['native_intent_runtime_authority'],
  rollbackPlan: {
    snapshotRequired: true,
    restorePathRequired: true,
    retentionWindowDays: 30,
    nativeStorageMigrationAllowed: false,
  },
  normalWorkflowAllowed: false,
});

describe('policyLibraryRebuildLegacyRemovalInventory', () => {
  test('returns a compact, non-destructive inventory with a stable candidate fingerprint', () => {
    const inventory = buildPolicyLibraryRebuildLegacyRemovalInventory({
      artifacts: [deletionCandidate],
    });

    expect(inventory.statusId).toBe(POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS.READY);
    expect(inventory.candidateCount).toBe(1);
    expect(inventory.inventoryFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(inventory.validation).toEqual({ ok: true, issueCount: 0, issues: [] });
    expect(inventory.sideEffects).toEqual({
      filesDeleted: false,
      filesHidden: false,
      filesArchived: false,
      routesRemoved: false,
      browserControlsRendered: false,
    });
    expect(inventory).not.toHaveProperty('artifacts');
    expect(inventory).not.toHaveProperty('candidates');
    expect(JSON.stringify(inventory)).not.toContain(deletionCandidate.path);
  });

  test('fails closed when no legacy removal candidate remains', () => {
    const inventory = buildPolicyLibraryRebuildLegacyRemovalInventory({ artifacts: [] });

    expect(inventory.statusId).toBe(POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS.BLOCKED);
    expect(inventory.risks).toEqual([{
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_RISK_IDS.NO_REMOVAL_CANDIDATES,
    }]);
    expect(inventory.validation.ok).toBe(true);
  });

  test('blocks an invalid removal candidate and rejects unsafe inventory output', () => {
    const inventory = buildPolicyLibraryRebuildLegacyRemovalInventory({
      artifacts: [{ ...deletionCandidate, normalWorkflowAllowed: true }],
    });
    const unsafeInventory = {
      ...inventory,
      statusId: POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS.READY,
      filesDeleted: true,
      candidates: [deletionCandidate],
    };

    expect(inventory.statusId).toBe(POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_STATUS_IDS.BLOCKED);
    expect(inventory.risks).toContainEqual({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_RISK_IDS.NORMAL_WORKFLOW_CANDIDATE,
    });
    expect(validatePolicyLibraryRebuildLegacyRemovalInventory(unsafeInventory)).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([{
          riskId: POLICY_LIBRARY_REBUILD_LEGACY_REMOVAL_INVENTORY_RISK_IDS.UNSAFE_INVENTORY_OUTPUT,
        }]),
      }),
    );
  });
});
