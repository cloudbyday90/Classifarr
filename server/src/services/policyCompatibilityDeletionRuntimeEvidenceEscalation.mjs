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
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS,
} from './policyCompatibilityDeletionPreflightEvidenceArtifactShared.mjs';

const POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_VERSION =
  'policy.compatibility_deletion_runtime_evidence_escalation.v1';

const POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STATUS_IDS = Object.freeze({
  BLOCKED: 'blocked',
  PROBE_REQUIRED: 'embedded_runtime_probe_required',
  RETAINED_EVIDENCE_SUFFICIENT: 'retained_runtime_evidence_sufficient',
});

const POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS = Object.freeze({
  ARTIFACT_NOT_OBSERVED: 'execution_plan_artifact_not_observed',
  CHECKOUT_NOT_OBSERVED: 'checkout_not_observed',
  MANIFEST_NOT_OBSERVED: 'manifest_not_observed',
  RETAINED_EVIDENCE_CURRENT: 'retained_runtime_evidence_current',
  RETAINED_EVIDENCE_INVALID: 'retained_runtime_evidence_invalid',
  RETAINED_EVIDENCE_MISSING: 'retained_runtime_evidence_missing',
  RETAINED_EVIDENCE_STALE: 'retained_runtime_evidence_stale',
});

const POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STEP_IDS = Object.freeze({
  COMPLETE_EXECUTION_GATE: 'complete_compatibility_deletion_execution_gate',
  COLLECT_EMBEDDED_RUNTIME_EVIDENCE: 'collect_provenance_bound_runtime_evidence',
  REPAIR_PREFLIGHT: 'repair_compatibility_deletion_preflight',
});

const OBSERVED = POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED;
const MISSING = POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING;
const STALE = POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.STALE;

function normalizeStatusId(value) {
  return Object.values(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS)
    .includes(value)
    ? value
    : POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID;
}

function buildEscalation({ statusId, reasonIds, runtimeProbeRequired, stepId }) {
  return {
    version: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_VERSION,
    statusId,
    reasonIds,
    runtimeProbeRequired,
    nextStep: { stepId },
  };
}

function buildPolicyCompatibilityDeletionRuntimeEvidenceEscalation({
  artifactStatusId = null,
  checkoutStatusId = null,
  manifestStatusId = null,
  runtimeEvidenceStatusId = null,
} = {}) {
  const prerequisites = [
    [
      POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS.ARTIFACT_NOT_OBSERVED,
      normalizeStatusId(artifactStatusId),
    ],
    [
      POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS.CHECKOUT_NOT_OBSERVED,
      normalizeStatusId(checkoutStatusId),
    ],
    [
      POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS.MANIFEST_NOT_OBSERVED,
      normalizeStatusId(manifestStatusId),
    ],
  ];
  const blockedPrerequisiteReasons = prerequisites
    .filter(([, statusId]) => statusId !== OBSERVED)
    .map(([reasonId]) => reasonId);

  if (blockedPrerequisiteReasons.length > 0) {
    return buildEscalation({
      statusId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STATUS_IDS.BLOCKED,
      reasonIds: blockedPrerequisiteReasons,
      runtimeProbeRequired: false,
      stepId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STEP_IDS.REPAIR_PREFLIGHT,
    });
  }

  const runtimeStatusId = normalizeStatusId(runtimeEvidenceStatusId);

  if (runtimeStatusId === OBSERVED) {
    return buildEscalation({
      statusId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STATUS_IDS
        .RETAINED_EVIDENCE_SUFFICIENT,
      reasonIds: [
        POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS
          .RETAINED_EVIDENCE_CURRENT,
      ],
      runtimeProbeRequired: false,
      stepId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STEP_IDS
        .COMPLETE_EXECUTION_GATE,
    });
  }

  if (runtimeStatusId === MISSING || runtimeStatusId === STALE) {
    return buildEscalation({
      statusId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STATUS_IDS
        .PROBE_REQUIRED,
      reasonIds: [
        runtimeStatusId === MISSING
          ? POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS
            .RETAINED_EVIDENCE_MISSING
          : POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS
            .RETAINED_EVIDENCE_STALE,
      ],
      runtimeProbeRequired: true,
      stepId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STEP_IDS
        .COLLECT_EMBEDDED_RUNTIME_EVIDENCE,
    });
  }

  return buildEscalation({
    statusId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STATUS_IDS.BLOCKED,
    reasonIds: [
      POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS
        .RETAINED_EVIDENCE_INVALID,
    ],
    runtimeProbeRequired: false,
    stepId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STEP_IDS.REPAIR_PREFLIGHT,
  });
}

export {
  POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS,
  POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STEP_IDS,
  POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_VERSION,
  buildPolicyCompatibilityDeletionRuntimeEvidenceEscalation,
};
