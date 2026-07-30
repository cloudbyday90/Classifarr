/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

import {
  POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS,
  buildPolicyLibraryRebuildLegacyGlobalReleaseRetirementGate,
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
import {
  createPolicyLibraryRebuildLegacyGlobalReleaseRetirementGateService,
} from '../../services/policyLibraryRebuildLegacyGlobalReleaseRetirementGateService.mjs';

const NOW = '2026-07-30T14:00:00.000Z';
const REMOVAL_CANDIDATE = Object.freeze({
  path: 'server/src/routes/legacyPolicyVerifier.mjs',
  owner: 'policy-rebuild-test',
  decisionId: 'delete_after_migration',
  verifierKindId: 'representative_replay',
  replacement: 'Bounded native policy contracts',
  removalGateIds: ['native_intent_runtime_authority'],
  rollbackPlan: {
    snapshotRequired: true,
    restorePathRequired: true,
    retentionWindowDays: 30,
    nativeStorageMigrationAllowed: false,
  },
  normalWorkflowAllowed: false,
});

function readyEvidence(policyId, libraryId) {
  return {
    policy: { id: policyId, library_id: libraryId },
    executionGate: {
      id: 801,
      policy_id: policyId,
      intent_id: 101,
      library_id: libraryId,
      state: 'replacement_applied',
      transition_fingerprint: 'a'.repeat(64),
      proposal_fingerprint: 'b'.repeat(64),
      verification_run_id: 701,
      verification_run_fingerprint: 'd'.repeat(64),
      rollback_snapshot_id: 901,
      replacement_intent_id: 202,
      replacement_event_id: 303,
      replacement_applied_at: '2026-07-20T14:00:00.000Z',
    },
    verificationReceipt: {
      id: 701,
      policy_id: policyId,
      intent_id: 101,
      library_id: libraryId,
      acceptance_transition_fingerprint: 'a'.repeat(64),
      source_id: 'persisted_destination_library_final_outcomes',
      source_media_type: 'movie',
      source_deterministic_order_id: 'created_at_desc_id_desc',
      source_coverage_sufficient: true,
      source_audit_ok: true,
      source_audit_issue_count: 0,
      verifier_status_id: 'no_migration_differences',
      verifier_fingerprint: 'd'.repeat(64),
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
      policy_id: policyId,
      intent_id: 101,
      payload_redacted: true,
      expires_at: '2026-07-21T14:00:00.000Z',
      restored_at: null,
    },
    replacementEvent: {
      id: 303,
      policy_id: policyId,
      intent_id: 202,
      event_type: 'library_rebuild_replacement_applied',
      execution_gate_id: 801,
      rollback_snapshot_id: 901,
      verification_run_id: 701,
      transition_fingerprint: 'a'.repeat(64),
      verification_run_fingerprint: 'd'.repeat(64),
    },
    activeNativeIntents: [{ id: 202, policy_id: policyId, library_id: libraryId }],
  };
}

describe('policyLibraryRebuildLegacyGlobalReleaseRetirementGateService', () => {
  test('evaluates one shared-lock inventory and fresh plan per enabled policy in one transaction', async () => {
    const calls = [];
    const client = {};
    const inventory = buildPolicyLibraryRebuildLegacyRemovalInventory({
      artifacts: [REMOVAL_CANDIDATE],
    });
    const loadEnabledPolicyInventory = jest.fn(async () => {
      calls.push('inventory-lock');
      return [
        { policy_id: 44, library_id: 6 },
        { policy_id: 45, library_id: 7 },
      ];
    });
    const loadEvidence = jest.fn(async ({ policyId }) => {
      calls.push(`evidence-${policyId}`);
      return readyEvidence(policyId, policyId === 44 ? 6 : 7);
    });
    const buildRemovalInventory = jest.fn(() => {
      calls.push('removal-inventory');
      return inventory;
    });
    const buildReadiness = jest.fn(input => {
      calls.push(`readiness-${input.policy.id}`);
      return buildPolicyLibraryRebuildLegacyDeletionReadiness(input);
    });
    const buildFinalRemovalPlan = jest.fn(input => {
      calls.push(`plan-${input.readiness.policy.policyId}`);
      return buildPolicyLibraryRebuildLegacyFinalRemovalPlan(input);
    });
    const buildGlobalGate = jest.fn(input => {
      calls.push('global-gate');
      return buildPolicyLibraryRebuildLegacyGlobalReleaseRetirementGate(input);
    });
    const dbClient = {
      withTransaction: jest.fn(async callback => {
        calls.push('transaction');
        return callback(client);
      }),
    };
    const service = createPolicyLibraryRebuildLegacyGlobalReleaseRetirementGateService({
      dbClient,
      loadEnabledPolicyInventory,
      loadEvidence,
      buildRemovalInventory,
      buildReadiness,
      buildFinalRemovalPlan,
      buildGlobalGate,
    });

    const result = await service.evaluate({ now: NOW });

    expect(result.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS
        .READY_FOR_REPOSITORY_RETIREMENT_PROPOSAL,
    );
    expect(result.sideEffects).toEqual(expect.objectContaining({
      databaseRead: true,
      repositoryModified: false,
      legacyPathsDeleted: false,
      routingWritten: false,
      browserControlsRendered: false,
    }));
    expect(calls).toEqual([
      'transaction',
      'inventory-lock',
      'removal-inventory',
      'evidence-44',
      'readiness-44',
      'plan-44',
      'evidence-45',
      'readiness-45',
      'plan-45',
      'global-gate',
    ]);
    expect(loadEvidence).toHaveBeenNthCalledWith(1, { client, policyId: 44 });
    expect(loadEvidence).toHaveBeenNthCalledWith(2, { client, policyId: 45 });
  });

  test('fails closed when the global evidence boundary is unavailable', async () => {
    const service = createPolicyLibraryRebuildLegacyGlobalReleaseRetirementGateService({
      dbClient: {
        withTransaction: jest.fn().mockRejectedValue(new Error('database unavailable')),
      },
    });

    const result = await service.evaluate({ now: NOW });

    expect(result.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_STATUS_IDS
        .BLOCKED_BY_EVIDENCE_BOUNDARY,
    );
    expect(result.risks).toContainEqual({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_GLOBAL_RELEASE_RETIREMENT_GATE_RISK_IDS
        .EVIDENCE_BOUNDARY_UNAVAILABLE,
    });
    expect(result.sideEffects.databaseRead).toBe(false);
    expect(result.retirementDecision.repositoryMutationAuthorized).toBe(false);
  });
});
