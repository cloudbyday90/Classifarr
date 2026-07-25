/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVIDENCE_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS,
  buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint,
  evaluatePolicyCompatibilityDeletionReleasePrerequisiteEvidence,
} from '../../services/policyCompatibilityDeletionReleasePrerequisiteEvidence.mjs';
import {
  buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence,
} from '../helpers/policyCompatibilityDeletionReleasePrerequisiteEvidence.mjs';

const EVIDENCE_TIME = '2026-07-25T12:00:00.000Z';

function readyContext() {
  return {
    currentPolicyInventory: {
      version: 'policy.compatibility_deletion_current_inventory.v1',
      generatedAt: EVIDENCE_TIME,
      statusId: 'all_enabled_policies_native',
      policyCounts: { unconvertedPolicyCount: 0 },
      validation: { ok: true },
    },
    reconciliationStateInventory: {
      version: 'policy.compatibility_deletion_reconciliation_state_inventory.v1',
      generatedAt: EVIDENCE_TIME,
      statusId: 'no_requires_maintenance_states',
      requiresMaintenanceStateCount: 0,
      validation: { ok: true },
    },
    cutoverVerification: {
      version: 'policy.native_runtime_cutover_verification.v1',
      generatedAt: EVIDENCE_TIME,
      statusId: 'ready_for_cutover_monitoring',
      validation: { ok: true },
    },
    deletionGatePlan: {
      version: 'policy.compatibility_deletion_gates.v1',
      generatedAt: EVIDENCE_TIME,
      statusId: 'ready_to_delete',
      unconvertedPolicyCount: 0,
      requiresMaintenanceStateCount: 0,
      validation: { ok: true },
    },
    backupRestoreEvidence: {
      version: 'policy.backup_restore_verification_evidence.v1',
      generatedAt: EVIDENCE_TIME,
      statusId: 'verified',
      backupRestoreVerified: true,
      verification: { latestVerifiedAt: EVIDENCE_TIME },
      validation: { ok: true },
    },
    residualCompatibilityReferences: [],
  };
}

function evaluate(evidence, context = readyContext(), now = EVIDENCE_TIME) {
  return evaluatePolicyCompatibilityDeletionReleasePrerequisiteEvidence({
    evidence,
    expectedContextFingerprint:
      buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint(context),
    now,
  });
}

describe('policyCompatibilityDeletionReleasePrerequisiteEvidence', () => {
  test('accepts exactly the fresh, subject-bound prerequisites for the current context', () => {
    const context = readyContext();
    const evidence = buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence(context, {
      generatedAt: EVIDENCE_TIME,
    });

    const outcome = evaluate(evidence, context);

    expect(outcome).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVIDENCE_STATUS_IDS.READY,
      ready: true,
      riskCount: 0,
      subject: {
        subjectId: 'operator:release',
        subjectType: 'release_operator',
      },
    }));
  });

  test('fails closed for legacy booleans, omitted evidence, and unknown fields', () => {
    const missing = evaluate(null);
    const legacy = evaluate({
      rollbackSupportVerified: true,
      supportDiagnosticsVerified: true,
      deletionManifestApproved: true,
    });

    expect(missing.ready).toBe(false);
    expect(missing.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.EVIDENCE_MISSING,
      }),
    ]));
    expect(legacy.ready).toBe(false);
    expect(legacy.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.UNKNOWN_FIELD,
      }),
    ]));
  });

  test('rejects a stale or context-mismatched attestation', () => {
    const context = readyContext();
    const evidence = buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence(context, {
      generatedAt: EVIDENCE_TIME,
    });
    const changedContext = {
      ...context,
      deletionGatePlan: {
        ...context.deletionGatePlan,
        requiresMaintenanceStateCount: 1,
      },
    };

    const mismatched = evaluate(evidence, changedContext);
    const stale = evaluate(evidence, context, '2026-07-25T12:06:00.001Z');

    expect(mismatched.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS
            .CONTEXT_FINGERPRINT_MISMATCH,
      }),
    ]));
    expect(stale.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.EVIDENCE_STALE,
      }),
    ]));
  });

  test('rejects unknown subjects and duplicate prerequisite attestations', () => {
    const context = readyContext();
    const evidence = buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence(context, {
      generatedAt: EVIDENCE_TIME,
      subject: {
        subjectId: 'operator:release',
        subjectType: 'unknown_subject',
      },
    });
    evidence.attestations.push({ ...evidence.attestations[0] });

    const outcome = evaluate(evidence, context);

    expect(outcome.ready).toBe(false);
    expect(outcome.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS.SUBJECT_INVALID,
      }),
      expect.objectContaining({
        riskId:
          POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_RISK_IDS
            .PREREQUISITE_DUPLICATE,
      }),
    ]));
  });
});
