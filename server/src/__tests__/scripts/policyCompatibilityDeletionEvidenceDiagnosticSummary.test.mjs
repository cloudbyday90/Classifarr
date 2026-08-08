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
  POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS,
  POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_SUMMARY_STATUS_IDS,
  buildPolicyCompatibilityDeletionEvidenceDiagnosticSummary,
} from '../../../../scripts/lib/policyCompatibilityDeletionEvidenceDiagnosticSummary.mjs';

function nativeAutomationReadyEvidence(overrides = {}) {
  return {
    readyForExecutionPlan: false,
    validation: { ok: true },
    evidence: {
      currentPolicyInventory: {
        statusId: 'all_enabled_policies_native',
        validationOk: true,
      },
      reconciliationStateInventory: {
        statusId: 'no_requires_maintenance_states',
        validationOk: true,
      },
      cutoverVerification: {
        statusId: 'ready_for_cutover_monitoring',
        validationOk: true,
      },
    },
    deletionReadiness: {
      risks: [
        { riskId: 'deletion_gates_not_ready', message: 'internal gate details' },
        { riskId: 'backup_restore_not_verified', message: 'internal backup details' },
        { riskId: 'rollback_support_not_verified', message: 'internal support details' },
        { riskId: 'support_diagnostics_not_verified', message: 'internal diagnostics' },
        { riskId: 'deletion_manifest_not_approved', message: 'internal approval details' },
      ],
    },
    ...overrides,
  };
}

describe('policyCompatibilityDeletionEvidenceDiagnosticSummary', () => {
  test('separates ready native automation from blocked release prerequisites', () => {
    const summary = buildPolicyCompatibilityDeletionEvidenceDiagnosticSummary(
      nativeAutomationReadyEvidence()
    );

    expect(summary).toEqual({
      version: 'policy.compatibility_deletion_evidence_diagnostic_summary.v1',
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_SUMMARY_STATUS_IDS.BLOCKED,
      nativePolicyAutomation: { ready: true },
      compatibilityDeletionRelease: {
        ready: false,
        blockerIds: [
          POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
            .BACKUP_RESTORE_VERIFICATION,
          POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
            .COMPATIBILITY_DELETION_GATES,
          POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
            .ROLLBACK_SUPPORT,
          POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
            .SUPPORT_DIAGNOSTICS,
          POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
            .DELETION_MANIFEST_APPROVAL,
        ],
      },
      nextStep: {
        stepId: 'complete_compatibility_deletion_release_prerequisites',
        label: 'Complete Compatibility Deletion Release Prerequisites',
      },
    });
    expect(JSON.stringify(summary)).not.toContain('internal');
  });

  test('keeps native automation ready when rollback blocks only compatibility retirement', () => {
    const evidence = nativeAutomationReadyEvidence();
    evidence.evidence.cutoverVerification.statusId = 'blocked_by_rollback';

    const summary = buildPolicyCompatibilityDeletionEvidenceDiagnosticSummary(evidence);

    expect(summary.nativePolicyAutomation).toEqual({ ready: true });
    expect(summary.compatibilityDeletionRelease).toEqual({
      ready: false,
      blockerIds: [
        POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
          .BACKUP_RESTORE_VERIFICATION,
        POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
          .COMPATIBILITY_DELETION_GATES,
        POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
          .ROLLBACK_SUPPORT,
        POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
          .SUPPORT_DIAGNOSTICS,
        POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
          .DELETION_MANIFEST_APPROVAL,
      ],
    });
    expect(summary.nextStep.stepId)
      .toBe('complete_compatibility_deletion_release_prerequisites');
  });

  test('routes unresolved native automation to its own readiness step', () => {
    const summary = buildPolicyCompatibilityDeletionEvidenceDiagnosticSummary({
      readyForExecutionPlan: false,
      validation: { ok: true },
    });

    expect(summary.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_SUMMARY_STATUS_IDS.BLOCKED);
    expect(summary.nativePolicyAutomation.ready).toBe(false);
    expect(summary.compatibilityDeletionRelease.blockerIds).toEqual([
      POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
        .NATIVE_POLICY_AUTOMATION,
    ]);
    expect(summary.nextStep.stepId).toBe('resolve_native_policy_automation_readiness');
  });

  test('keeps a valid ready result free of blockers', () => {
    const summary = buildPolicyCompatibilityDeletionEvidenceDiagnosticSummary(
      nativeAutomationReadyEvidence({ readyForExecutionPlan: true })
    );

    expect(summary.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_SUMMARY_STATUS_IDS.READY);
    expect(summary.compatibilityDeletionRelease).toEqual({
      ready: true,
      blockerIds: [],
    });
    expect(summary.nextStep.stepId).toBe('compatibility_deletion_execution_plan');
  });
});
