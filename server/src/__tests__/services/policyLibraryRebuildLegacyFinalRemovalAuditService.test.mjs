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
  POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS,
  buildPolicyLibraryRebuildLegacyFinalRemovalPlan,
} from '../../services/policyLibraryRebuildLegacyFinalRemovalPlan.mjs';
import {
  buildPolicyLibraryRebuildLegacyDeletionReadiness,
} from '../../services/policyLibraryRebuildLegacyDeletionReadiness.mjs';
import {
  buildPolicyLibraryRebuildLegacyRemovalInventory,
} from '../../services/policyLibraryRebuildLegacyRemovalInventory.mjs';
import {
  createPolicyLibraryRebuildLegacyFinalRemovalAuditService,
} from '../../services/policyLibraryRebuildLegacyFinalRemovalAuditService.mjs';

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

describe('policyLibraryRebuildLegacyFinalRemovalAuditService', () => {
  test('rebuilds readiness and inventory in one transaction before returning a non-executing plan', async () => {
    const calls = [];
    const client = {};
    const loadEvidence = jest.fn(async () => {
      calls.push('evidence');
      return readyEvidence();
    });
    const buildRemovalInventory = jest.fn(() => {
      calls.push('inventory');
      return buildPolicyLibraryRebuildLegacyRemovalInventory();
    });
    const buildReadiness = jest.fn(input => {
      calls.push('readiness');
      return buildPolicyLibraryRebuildLegacyDeletionReadiness(input);
    });
    const buildFinalRemovalPlan = jest.fn(input => {
      calls.push('plan');
      return buildPolicyLibraryRebuildLegacyFinalRemovalPlan(input);
    });
    const dbClient = {
      withTransaction: jest.fn(async callback => {
        calls.push('transaction');
        return callback(client);
      }),
    };
    const service = createPolicyLibraryRebuildLegacyFinalRemovalAuditService({
      dbClient,
      loadEvidence,
      buildRemovalInventory,
      buildReadiness,
      buildFinalRemovalPlan,
    });

    const result = await service.audit({ policyId: 44, now: NOW });

    expect(result.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS
        .READY_FOR_GLOBAL_RELEASE_RETIREMENT_GATE,
    );
    expect(result.sideEffects).toEqual(expect.objectContaining({
      databaseRead: true,
      finalRemovalPlanPersisted: false,
      legacyPathsDeleted: false,
      routingWritten: false,
      browserControlsRendered: false,
    }));
    expect(calls).toEqual(['transaction', 'evidence', 'inventory', 'readiness', 'plan']);
    expect(loadEvidence).toHaveBeenCalledWith({ client, policyId: 44 });
  });

  test('fails closed when the transaction boundary cannot provide fresh evidence', async () => {
    const service = createPolicyLibraryRebuildLegacyFinalRemovalAuditService({
      dbClient: {
        withTransaction: jest.fn().mockRejectedValue(new Error('database unavailable')),
      },
      loadEvidence: jest.fn(),
    });

    const result = await service.audit({ policyId: 44, now: NOW });

    expect(result.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY,
    );
    expect(result.risks).toContainEqual({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_FINAL_REMOVAL_PLAN_RISK_IDS
        .EVIDENCE_BOUNDARY_UNAVAILABLE,
    });
    expect(result.sideEffects.databaseRead).toBe(false);
    expect(result.plan.executionAuthorized).toBe(false);
  });
});
