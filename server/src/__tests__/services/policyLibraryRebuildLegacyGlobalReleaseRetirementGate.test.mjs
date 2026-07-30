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
  POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS,
  buildPolicyLibraryRebuildLegacyGlobalReleaseRetirementGate,
  validatePolicyLibraryRebuildLegacyGlobalReleaseRetirementGate,
} from '../../services/policyLibraryRebuildLegacyGlobalReleaseRetirementGate.mjs';
import {
  buildPolicyLibraryRebuildLegacyFinalRemovalPlan,
} from '../../services/policyLibraryRebuildLegacyFinalRemovalPlan.mjs';
import {
  buildPolicyLibraryRebuildLegacyDeletionReadiness,
} from '../../services/policyLibraryRebuildLegacyDeletionReadiness.mjs';
import {
  buildPolicyLibraryRebuildLegacyRemovalInventory,
} from '../../services/policyLibraryRebuildLegacyRemovalInventory.mjs';

const NOW = '2026-07-30T14:00:00.000Z';

function fingerprint(character) {
  return character.repeat(64);
}

function readyEvidence({ policyId, libraryId }) {
  const offset = policyId * 10;

  return {
    policy: { id: policyId, library_id: libraryId },
    executionGate: {
      id: 800 + offset,
      policy_id: policyId,
      intent_id: 100 + offset,
      library_id: libraryId,
      state: 'replacement_applied',
      transition_fingerprint: fingerprint('a'),
      proposal_fingerprint: fingerprint('b'),
      verification_run_id: 700 + offset,
      verification_run_fingerprint: fingerprint('d'),
      rollback_snapshot_id: 900 + offset,
      replacement_intent_id: 200 + offset,
      replacement_event_id: 300 + offset,
      replacement_applied_at: '2026-07-20T14:00:00.000Z',
    },
    verificationReceipt: {
      id: 700 + offset,
      policy_id: policyId,
      intent_id: 100 + offset,
      library_id: libraryId,
      acceptance_transition_fingerprint: fingerprint('a'),
      source_id: 'persisted_destination_library_final_outcomes',
      source_media_type: 'movie',
      source_deterministic_order_id: 'created_at_desc_id_desc',
      source_coverage_sufficient: true,
      source_audit_ok: true,
      source_audit_issue_count: 0,
      verifier_status_id: 'no_migration_differences',
      verifier_fingerprint: fingerprint('d'),
      verifier_difference_count: 0,
      verifier_emitted_difference_count: 0,
      verifier_differences_truncated: false,
      verifier_audit_ok: true,
      verifier_audit_issue_count: 0,
      coordinator_audit_ok: true,
      coordinator_audit_issue_count: 0,
    },
    rollbackSnapshot: {
      id: 900 + offset,
      policy_id: policyId,
      intent_id: 100 + offset,
      payload_redacted: true,
      expires_at: '2026-07-21T14:00:00.000Z',
      restored_at: null,
    },
    replacementEvent: {
      id: 300 + offset,
      policy_id: policyId,
      intent_id: 200 + offset,
      event_type: 'library_rebuild_replacement_applied',
      execution_gate_id: 800 + offset,
      rollback_snapshot_id: 900 + offset,
      verification_run_id: 700 + offset,
      transition_fingerprint: fingerprint('a'),
      verification_run_fingerprint: fingerprint('d'),
    },
    activeNativeIntents: [{ id: 200 + offset, policy_id: policyId, library_id: libraryId }],
  };
}

function readyPlan({ policyId, libraryId, inventory }) {
  const readiness = buildPolicyLibraryRebuildLegacyDeletionReadiness({
    ...readyEvidence({ policyId, libraryId }),
    removalInventory: inventory,
    now: NOW,
  });

  return buildPolicyLibraryRebuildLegacyFinalRemovalPlan({
    readiness,
    removalInventory: inventory,
    now: NOW,
  });
}

describe('policyLibraryRebuildLegacyGlobalReleaseRetirementGate', () => {
  test('requires every currently enabled policy to have one current ready final-removal plan', () => {
    const inventory = buildPolicyLibraryRebuildLegacyRemovalInventory();
    const finalRemovalPlans = [
      readyPlan({ policyId: 44, libraryId: 6, inventory }),
      readyPlan({ policyId: 45, libraryId: 7, inventory }),
    ];
    const gate = buildPolicyLibraryRebuildLegacyGlobalReleaseRetirementGate({
      policyInventory: [
        { policy_id: 44, library_id: 6 },
        { policy_id: 45, library_id: 7 },
      ],
      finalRemovalPlans,
      removalInventory: inventory,
      now: NOW,
    });

    expect(gate.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS
        .READY_FOR_REPOSITORY_RETIREMENT_PROPOSAL,
    );
    expect(gate.policyPlans).toEqual({
      enabledPolicyCount: 2,
      evaluatedPlanCount: 2,
      readyPlanCount: 2,
      blockedPlanCount: 0,
    });
    expect(gate.retirementDecision).toEqual(expect.objectContaining({
      candidatePathsExposed: false,
      executionAuthorized: false,
      repositoryMutationAuthorized: false,
      runtimeDeletionAuthorized: false,
      requiresRepositoryReview: true,
      requiresSeparateControlledRemovalTask: true,
    }));
    expect(gate.validation).toEqual({ ok: true, issueCount: 0, issues: [] });
    expect(gate).not.toHaveProperty('policyInventory');
    expect(gate).not.toHaveProperty('finalRemovalPlans');
    expect(JSON.stringify(gate)).not.toContain('PolicyIntentImpactPreviewCard.vue');
  });

  test('fails closed when enabled-policy coverage or current inventory agreement is incomplete', () => {
    const inventory = buildPolicyLibraryRebuildLegacyRemovalInventory();
    const changedInventory = buildPolicyLibraryRebuildLegacyRemovalInventory({ artifacts: [] });
    const gate = buildPolicyLibraryRebuildLegacyGlobalReleaseRetirementGate({
      policyInventory: [
        { policy_id: 44, library_id: 6 },
        { policy_id: 45, library_id: 7 },
      ],
      finalRemovalPlans: [readyPlan({ policyId: 44, libraryId: 6, inventory })],
      removalInventory: changedInventory,
      now: NOW,
    });

    expect(gate.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS
        .BLOCKED_BY_REMOVAL_INVENTORY,
    );
    expect(gate.risks).toEqual(expect.arrayContaining([
      { riskId: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .FINAL_REMOVAL_PLAN_MISSING },
      { riskId: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .REMOVAL_INVENTORY_INVALID },
      { riskId: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .FINAL_REMOVAL_PLAN_INVENTORY_MISMATCH },
    ]));
    expect(gate.readyForRepositoryRetirementProposal).toBe(false);
  });

  test('rejects a forged destructive authorization even if every plan is ready', () => {
    const inventory = buildPolicyLibraryRebuildLegacyRemovalInventory();
    const gate = buildPolicyLibraryRebuildLegacyGlobalReleaseRetirementGate({
      policyInventory: [{ policy_id: 44, library_id: 6 }],
      finalRemovalPlans: [readyPlan({ policyId: 44, libraryId: 6, inventory })],
      removalInventory: inventory,
      now: NOW,
    });
    const forged = {
      ...gate,
      retirementDecision: {
        ...gate.retirementDecision,
        repositoryMutationAuthorized: true,
      },
    };

    expect(validatePolicyLibraryRebuildLegacyGlobalReleaseRetirementGate(forged)).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([{
          riskId: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
            .UNSAFE_GATE_OUTPUT,
        }]),
      }),
    );
  });

  test('rejects a release-state fingerprint that no longer binds the policy plans and inventory', () => {
    const inventory = buildPolicyLibraryRebuildLegacyRemovalInventory();
    const gate = buildPolicyLibraryRebuildLegacyGlobalReleaseRetirementGate({
      policyInventory: [{ policy_id: 44, library_id: 6 }],
      finalRemovalPlans: [readyPlan({ policyId: 44, libraryId: 6, inventory })],
      removalInventory: inventory,
      now: NOW,
    });
    const forged = {
      ...gate,
      releaseState: {
        ...gate.releaseState,
        finalRemovalPlanFingerprint: 'f'.repeat(64),
      },
    };

    expect(validatePolicyLibraryRebuildLegacyGlobalReleaseRetirementGate(forged)).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([{
          riskId: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
            .UNSAFE_GATE_OUTPUT,
        }]),
      }),
    );
  });
});
