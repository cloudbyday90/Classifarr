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
  POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS,
  POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS,
  buildPolicyLibraryRebuildLegacyDeletionReadiness,
  buildPolicyLibraryRebuildLegacyDeletionReadinessAudit,
  validatePolicyLibraryRebuildLegacyDeletionReadiness,
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

function removalInventory() {
  return buildPolicyLibraryRebuildLegacyRemovalInventory({
    artifacts: [{
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
    }],
  });
}

function evidence(overrides = {}) {
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
    removalInventory: removalInventory(),
    now: NOW,
    ...overrides,
  };
}

describe('policyLibraryRebuildLegacyDeletionReadiness', () => {
  test('requires matching completed evidence, a closed redacted rollback window, and one native authority', () => {
    const readiness = buildPolicyLibraryRebuildLegacyDeletionReadiness(evidence());

    expect(readiness.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS.READY_FOR_FINAL_REMOVAL_AUDIT,
    );
    expect(readiness.readyForFinalRemovalAudit).toBe(true);
    expect(readiness.rollback).toEqual({
      rollbackSnapshotId: 901,
      dispositionId: POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_DISPOSITION_IDS
        .WINDOW_CLOSED_PAYLOAD_REDACTED,
      expiresAt: '2026-07-21T14:00:00.000Z',
    });
    expect(readiness.sideEffects).toEqual(expect.objectContaining({
      legacyPathsDeleted: false,
      legacyPathsHidden: false,
      legacyPathsArchived: false,
      routingWritten: false,
      browserControlsRendered: false,
    }));
    expect(readiness.validation).toEqual({ ok: true, issueCount: 0, issues: [] });
    expect(JSON.stringify(readiness)).not.toContain('snapshot_payload');
    expect(readiness).not.toHaveProperty('replacementEvent');
  });

  test('blocks final removal while the rollback window is still open', () => {
    const readiness = buildPolicyLibraryRebuildLegacyDeletionReadiness(evidence({
      rollbackSnapshot: {
        ...evidence().rollbackSnapshot,
        expires_at: '2026-08-01T14:00:00.000Z',
      },
    }));

    expect(readiness.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS.BLOCKED_BY_ROLLBACK_WINDOW,
    );
    expect(readiness.risks).toContainEqual({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.ROLLBACK_WINDOW_OPEN,
    });
    expect(readiness.readyForFinalRemovalAudit).toBe(false);
  });

  test('blocks conflicting receipt provenance and multiple active native authorities', () => {
    const readyEvidence = evidence();
    const readiness = buildPolicyLibraryRebuildLegacyDeletionReadiness({
      ...readyEvidence,
      verificationReceipt: {
        ...readyEvidence.verificationReceipt,
        verifier_fingerprint: 'e'.repeat(64),
      },
      activeNativeIntents: [
        { id: 202, policy_id: 44, library_id: 6 },
        { id: 203, policy_id: 44, library_id: 6 },
      ],
    });

    expect(readiness.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS
        .BLOCKED_BY_VERIFICATION_PROVENANCE,
    );
    expect(readiness.risks).toEqual(expect.arrayContaining([
      { riskId: POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.VERIFICATION_RECEIPT_MISMATCH },
      { riskId: POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.RUNTIME_AUTHORITY_AMBIGUOUS },
    ]));
  });

  test('rejects invalid inventory and never converts a readiness result into deletion authorization', () => {
    const readyEvidence = evidence();
    const readiness = buildPolicyLibraryRebuildLegacyDeletionReadiness({
      ...readyEvidence,
      removalInventory: {
        ...readyEvidence.removalInventory,
        candidateCount: 0,
      },
    });
    const audit = buildPolicyLibraryRebuildLegacyDeletionReadinessAudit(readiness);

    expect(readiness.statusId).toBe(
      POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_STATUS_IDS.BLOCKED_BY_REMOVAL_INVENTORY,
    );
    expect(readiness.risks).toContainEqual({
      riskId: POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.REMOVAL_INVENTORY_INVALID,
    });
    expect(audit.legacyDeletionAuthorized).toBe(false);
    expect(audit.nextStep.stepId).toBe('library_rebuild_legacy_path_final_removal_audit');
    expect(validatePolicyLibraryRebuildLegacyDeletionReadiness(readiness).ok).toBe(true);
  });

  test('does not accept a forged ready result with an unvalidated removal inventory', () => {
    const readiness = buildPolicyLibraryRebuildLegacyDeletionReadiness(evidence());
    const forged = {
      ...readiness,
      removalInventory: {
        ...readiness.removalInventory,
        validationOk: false,
      },
    };

    expect(validatePolicyLibraryRebuildLegacyDeletionReadiness(forged)).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([{
          riskId: POLICY_LIBRARY_REBUILD_LEGACY_DELETION_READINESS_RISK_IDS.UNSAFE_READINESS_OUTPUT,
        }]),
      }),
    );
  });
});
