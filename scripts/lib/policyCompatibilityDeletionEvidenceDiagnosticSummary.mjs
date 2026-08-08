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

const POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_SUMMARY_VERSION =
  'policy.compatibility_deletion_evidence_diagnostic_summary.v1';

const POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_SUMMARY_STATUS_IDS = Object.freeze({
  BLOCKED: 'blocked',
  READY: 'ready',
  UNKNOWN: 'unknown',
});

const POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS = Object.freeze({
  BACKUP_RESTORE_VERIFICATION: 'backup_restore_verification',
  COMPATIBILITY_DELETION_GATES: 'compatibility_deletion_gates',
  DELETION_MANIFEST_APPROVAL: 'deletion_manifest_approval',
  NATIVE_POLICY_AUTOMATION: 'native_policy_automation',
  ROLLBACK_SUPPORT: 'rollback_support',
  SUPPORT_DIAGNOSTICS: 'support_diagnostics',
});

const READINESS_RISK_TO_BLOCKER_ID = Object.freeze({
  backup_restore_not_verified:
    POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
      .BACKUP_RESTORE_VERIFICATION,
  deletion_gates_not_ready:
    POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
      .COMPATIBILITY_DELETION_GATES,
  deletion_manifest_not_approved:
    POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
      .DELETION_MANIFEST_APPROVAL,
  rollback_support_not_verified:
    POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
      .ROLLBACK_SUPPORT,
  support_diagnostics_not_verified:
    POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
      .SUPPORT_DIAGNOSTICS,
});

// These cutover states have already verified native reads. Their remaining
// risks govern compatibility-code retirement, not normal policy automation.
const NATIVE_AUTOMATION_READY_CUTOVER_STATUS_IDS = Object.freeze([
  'ready_for_cutover_monitoring',
  'blocked_by_rollback',
  'blocked_by_deletion_gate',
]);

const BLOCKER_ORDER = Object.freeze([
  POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
    .NATIVE_POLICY_AUTOMATION,
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
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function isNativePolicyAutomationReady(evidence = {}) {
  const sources = asObject(asObject(evidence).evidence);
  const inventory = asObject(sources.currentPolicyInventory);
  const reconciliation = asObject(sources.reconciliationStateInventory);
  const cutover = asObject(sources.cutoverVerification);

  return inventory.statusId === 'all_enabled_policies_native' &&
    inventory.validationOk === true &&
    reconciliation.statusId === 'no_requires_maintenance_states' &&
    reconciliation.validationOk === true &&
    NATIVE_AUTOMATION_READY_CUTOVER_STATUS_IDS.includes(cutover.statusId) &&
    cutover.validationOk === true;
}

function collectBlockerIds(evidence = {}, nativePolicyAutomationReady = false) {
  const readiness = asObject(asObject(evidence).deletionReadiness);
  const blockers = new Set();

  if (!nativePolicyAutomationReady) {
    blockers.add(
      POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS
        .NATIVE_POLICY_AUTOMATION
    );
  }

  asArray(readiness.risks).forEach(risk => {
    const blockerId = READINESS_RISK_TO_BLOCKER_ID[asObject(risk).riskId];
    if (blockerId) blockers.add(blockerId);
  });

  return BLOCKER_ORDER.filter(blockerId => blockers.has(blockerId));
}

function buildNextStep({ nativePolicyAutomationReady, releaseReady }) {
  if (releaseReady) {
    return {
      stepId: 'compatibility_deletion_execution_plan',
      label: 'Compatibility Path Deletion Execution Plan',
    };
  }

  if (nativePolicyAutomationReady) {
    return {
      stepId: 'complete_compatibility_deletion_release_prerequisites',
      label: 'Complete Compatibility Deletion Release Prerequisites',
    };
  }

  return {
    stepId: 'resolve_native_policy_automation_readiness',
    label: 'Resolve Native Policy Automation Readiness',
  };
}

function buildPolicyCompatibilityDeletionEvidenceDiagnosticSummary(evidence = {}) {
  const source = asObject(evidence);
  const releaseReady = source.readyForExecutionPlan === true &&
    source.validation?.ok === true;
  const nativePolicyAutomationReady = isNativePolicyAutomationReady(source);
  const blockerIds = releaseReady
    ? []
    : collectBlockerIds(source, nativePolicyAutomationReady);
  const statusId = releaseReady
    ? POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_SUMMARY_STATUS_IDS.READY
    : source.readyForExecutionPlan === false
      ? POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_SUMMARY_STATUS_IDS.BLOCKED
      : POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_SUMMARY_STATUS_IDS.UNKNOWN;

  return {
    version: POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_SUMMARY_VERSION,
    statusId,
    nativePolicyAutomation: {
      ready: nativePolicyAutomationReady,
    },
    compatibilityDeletionRelease: {
      ready: releaseReady,
      blockerIds,
    },
    nextStep: buildNextStep({
      nativePolicyAutomationReady,
      releaseReady,
    }),
  };
}

export {
  POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_BLOCKER_IDS,
  POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_SUMMARY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EVIDENCE_DIAGNOSTIC_SUMMARY_VERSION,
  buildPolicyCompatibilityDeletionEvidenceDiagnosticSummary,
};
