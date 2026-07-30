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
  MAX_READINESS_AGE_MS,
  POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS,
  buildPolicyLibraryRebuildLegacyFinalRemovalPlan,
  buildPolicyLibraryRebuildLegacyFinalRemovalPlanAudit,
  validatePolicyLibraryRebuildLegacyFinalRemovalPlan,
} from '../../services/policyLibraryRebuildLegacyFinalRemovalPlan.mjs';
import {
  buildPolicyLibraryRebuildLegacyDeletionReadiness,
} from '../../services/policyLibraryRebuildLegacyDeletionReadiness.mjs';
import {
  buildPolicyLibraryRebuildLegacyRemovalInventory,
} from '../../services/policyLibraryRebuildLegacyRemovalInventory.mjs';

const NOW = '2026-07-29T14:00:00.000Z';
const FINGERPRINTS = Object.freeze({
  transition: 'a'.repeat(64),
  proposal: 'b'.repeat(64),
  verifier: 'd'.repeat(64),
});

function readyEvidence() {
  return {
    policy: { id: 44, library_id: 6 },
    executionGate: {
      id: 801,
      policy_id: 44,
      intent_id: 101,
      library_id: 6,
      state: 'replacement_applied',
      transition_fingerprint: FINGERPRINTS.transition,
      proposal_fingerprint: FINGERPRINTS.proposal,
      verification_run_id: 701,
      verification_run_fingerprint: FINGERPRINTS.verifier,
      rollback_snapshot_id: 901,
      replacement_intent_id: 202,
      replacement_event_id: 303,
      replacement_applied_at: '2026-07-20T14:00:00.000Z',
    },
    verificationReceipt: {
      id: 701,
      policy_id: 44,
      intent_id: 101,
      library_id: 6,
      acceptance_transition_fingerprint: FINGERPRINTS.transition,
      source_id: 'persisted_destination_library_final_outcomes',
      source_media_type: 'movie',
      source_deterministic_order_id: 'created_at_desc_id_desc',
      source_coverage_sufficient: true,
      source_audit_ok: true,
      source_audit_issue_count: 0,
      verifier_status_id: 'no_migration_differences',
      verifier_fingerprint: FINGERPRINTS.verifier,
      verifier_difference_count: 0,
      verifier_emitted_difference_count: 0,
      verifier_differences_truncated: false,
      verifier_audit_ok: true,
      verifier_audit_issue_count: 0,
      coordinator_audit_ok: true,
      coordinator_audit_issue_count: 0,
    },
    rollbackSnapshot: {
      id: 901,
      policy_id: 44,
      intent_id: 101,
      payload_redacted: true,
      expires_at: '2026-07-21T14:00:00.000Z',
      restored_at: null,
    },
    replacementEvent: {
      id: 303,
      policy_id: 44,
      intent_id: 202,
      event_type: 'library_rebuild_replacement_applied',
      execution_gate_id: 801,
      rollback_snapshot_id: 901,
      verification_run_id: 701,
      transition_fingerprint: FINGERPRINTS.transition,
      verification_run_fingerprint: FINGERPRINTS.verifier,
    },
    activeNativeIntents: [{ id: 202, policy_id: 44, library_id: 6 }],
  };
}

function readyInventory() {
  return buildPolicyLibraryRebuildLegacyRemovalInventory();
}

function readyReadiness({ inventory = readyInventory(), now = NOW } = {}) {
  return buildPolicyLibraryRebuildLegacyDeletionReadiness({
    ...readyEvidence(),
    removalInventory: inventory,
    now,
  });
}

describe('policyLibraryRebuildLegacyFinalRemovalPlan', () => {
  test('produces a compact non-executing plan only from fresh matching evidence', () => {
    const inventory = readyInventory();
    const readiness = readyReadiness({ inventory });
    const plan = buildPolicyLibraryRebuildLegacyFinalRemovalPlan({
      readiness,
      removalInventory: inventory,
      now: NOW,
    });
    const audit = buildPolicyLibraryRebuildLegacyFinalRemovalPlanAudit(plan);

    expect(plan.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS
        .READY_FOR_GLOBAL_RELEASE_RETIREMENT_GATE,
    );
    expect(plan.readyForGlobalReleaseRetirementGate).toBe(true);
    expect(plan.removalInventory).toEqual(expect.objectContaining({
      candidateCount: inventory.candidateCount,
      inventoryFingerprint: inventory.inventoryFingerprint,
      validationOk: true,
    }));
    expect(plan.plan).toEqual({
      planKindId: 'global_release_legacy_path_retirement',
      candidateCount: inventory.candidateCount,
      inventoryFingerprint: inventory.inventoryFingerprint,
      candidatePathsExposed: false,
      executionAuthorized: false,
      repositoryMutationAuthorized: false,
      runtimeDeletionAuthorized: false,
      requiresGlobalReleaseDecision: true,
    });
    expect(plan.validation).toEqual({ ok: true, issueCount: 0, issues: [] });
    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      legacyDeletionAuthorized: false,
      repositoryMutationAuthorized: false,
      runtimeDeletionAuthorized: false,
    }));
    expect(plan).not.toHaveProperty('readiness');
    expect(JSON.stringify(plan)).not.toContain('snapshot_payload');
    expect(JSON.stringify(plan)).not.toContain('PolicyIntentImpactPreviewCard.vue');
  });

  test('blocks stale or future readiness instead of accepting stored evidence', () => {
    const inventory = readyInventory();
    const staleNow = new Date(new Date(NOW).getTime() + MAX_READINESS_AGE_MS + 1).toISOString();
    const stalePlan = buildPolicyLibraryRebuildLegacyFinalRemovalPlan({
      readiness: readyReadiness({ inventory }),
      removalInventory: inventory,
      now: staleNow,
    });
    const futureReadiness = readyReadiness({
      inventory,
      now: '2026-07-29T14:02:00.000Z',
    });
    const futurePlan = buildPolicyLibraryRebuildLegacyFinalRemovalPlan({
      readiness: futureReadiness,
      removalInventory: inventory,
      now: NOW,
    });

    expect(stalePlan.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS.BLOCKED_BY_FRESHNESS,
    );
    expect(stalePlan.risks).toContainEqual({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.READINESS_TIMESTAMP_STALE,
    });
    expect(futurePlan.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS.BLOCKED_BY_FRESHNESS,
    );
    expect(futurePlan.risks).toContainEqual({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.READINESS_TIMESTAMP_FUTURE,
    });
  });

  test('blocks changed current inventory even when the previous readiness is valid', () => {
    const inventory = readyInventory();
    const changedInventory = buildPolicyLibraryRebuildLegacyRemovalInventory({ artifacts: [] });
    const plan = buildPolicyLibraryRebuildLegacyFinalRemovalPlan({
      readiness: readyReadiness({ inventory }),
      removalInventory: changedInventory,
      now: NOW,
    });

    expect(plan.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS.BLOCKED_BY_REMOVAL_INVENTORY,
    );
    expect(plan.risks).toEqual(expect.arrayContaining([
      { riskId: POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.REMOVAL_INVENTORY_INVALID },
      { riskId: POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.REMOVAL_INVENTORY_MISMATCH },
    ]));
  });

  test('rejects forged execution authorization in an otherwise ready plan', () => {
    const inventory = readyInventory();
    const plan = buildPolicyLibraryRebuildLegacyFinalRemovalPlan({
      readiness: readyReadiness({ inventory }),
      removalInventory: inventory,
      now: NOW,
    });
    const forged = {
      ...plan,
      plan: {
        ...plan.plan,
        executionAuthorized: true,
      },
    };

    expect(validatePolicyLibraryRebuildLegacyFinalRemovalPlan(forged)).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([{
          riskId: POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.UNSAFE_PLAN_OUTPUT,
        }]),
      }),
    );
  });

  test('rejects a ready plan that omits an explicit non-execution boundary', () => {
    const inventory = readyInventory();
    const plan = buildPolicyLibraryRebuildLegacyFinalRemovalPlan({
      readiness: readyReadiness({ inventory }),
      removalInventory: inventory,
      now: NOW,
    });
    const forged = {
      ...plan,
      plan: {
        ...plan.plan,
        candidatePathsExposed: undefined,
      },
    };

    expect(validatePolicyLibraryRebuildLegacyFinalRemovalPlan(forged)).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([{
          riskId: POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS.UNSAFE_PLAN_OUTPUT,
        }]),
      }),
    );
  });
});
