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
  buildPolicyCompatibilityDeletionPreflightEvidenceArtifactFingerprint,
  validatePolicyCompatibilityDeletionPreflightEvidenceArtifactFingerprint,
} from './policyCompatibilityDeletionPreflightEvidenceArtifactFingerprint.mjs';
import {
  buildArtifactSummary,
  determinePreflightEvidenceStatus,
  evaluateArtifactObservation,
  evaluateCheckoutObservation,
  evaluateManifestObservation,
  evaluateRuntimeEvidenceReference,
} from './policyCompatibilityDeletionPreflightEvidenceArtifactObservations.mjs';
import {
  buildPolicyCompatibilityDeletionRuntimeEvidenceEscalation,
} from './policyCompatibilityDeletionRuntimeEvidenceEscalation.mjs';
import {
  MAX_MANIFEST_ENTRY_COUNT,
  OBSERVATION_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_VERSION,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS,
  asArray,
  asObject,
  buildRisk,
  normalizeStatusId,
  resolveTimestamp,
} from './policyCompatibilityDeletionPreflightEvidenceArtifactShared.mjs';

const SIDE_EFFECT_KEYS = Object.freeze([
  'appEndpointInvoked',
  'databaseRead',
  'dockerInvoked',
  'filesDeleted',
  'storageChanged',
]);

function buildSideEffectState(sideEffects = {}) {
  const reported = asObject(sideEffects);

  return Object.fromEntries(
    SIDE_EFFECT_KEYS.map(key => [key, reported[key] === true])
  );
}

function buildSideEffectRisks(sideEffects = {}) {
  return Object.entries(asObject(sideEffects)).flatMap(([key, value]) => (
    value === true
      ? [buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Preflight evidence collection cannot report side effect "${key}".`
      )]
      : []
  ));
}

function buildRuntimeEvidenceEscalation({ artifact, checkout, manifest, runtimeEvidence }) {
  return buildPolicyCompatibilityDeletionRuntimeEvidenceEscalation({
    artifactStatusId: artifact.statusId,
    checkoutStatusId: checkout.statusId,
    manifestStatusId: manifest.statusId,
    runtimeEvidenceStatusId: runtimeEvidence.statusId,
  });
}

function determineArtifactStatus({
  artifact,
  checkout,
  manifest,
  runtimeEvidence,
  sideEffectReported = false,
}) {
  if (sideEffectReported) {
    return POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID;
  }

  return determinePreflightEvidenceStatus({ artifact, checkout, manifest, runtimeEvidence });
}

function buildPolicyCompatibilityDeletionPreflightEvidenceArtifact({
  executionPlanArtifact = null,
  artifactObservation = {},
  checkoutObservation = {},
  manifestObservations = [],
  generatedAt = null,
  now = null,
  sideEffects = {},
} = {}) {
  const evaluationTime = resolveTimestamp(now || generatedAt);
  const artifact = asObject(executionPlanArtifact);
  const artifactEvaluation = evaluateArtifactObservation({
    artifact,
    artifactObservation,
    evaluationTime,
  });
  const checkout = evaluateCheckoutObservation(checkoutObservation);
  const manifest = evaluateManifestObservation({
    artifact,
    artifactStatusId: artifactEvaluation.statusId,
    manifestObservations,
  });
  const runtimeEvidence = evaluateRuntimeEvidenceReference({ artifact, evaluationTime });
  const runtimeEvidenceEscalation = buildRuntimeEvidenceEscalation({
    artifact: artifactEvaluation,
    checkout,
    manifest,
    runtimeEvidence,
  });
  const observedSideEffects = buildSideEffectState(sideEffects);
  const sideEffectRisks = buildSideEffectRisks(sideEffects);
  const risks = [
    ...artifactEvaluation.risks,
    ...checkout.risks,
    ...manifest.risks,
    ...runtimeEvidence.risks,
    ...sideEffectRisks,
  ];
  const artifactValue = {
    version: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_VERSION,
    generatedAt: evaluationTime.value,
    statusId: determineArtifactStatus({
      artifact: artifactEvaluation,
      checkout,
      manifest,
      runtimeEvidence,
      sideEffectReported: sideEffectRisks.length > 0,
    }),
    executionPlanArtifact: {
      ...buildArtifactSummary(artifact, artifactObservation),
      statusId: artifactEvaluation.statusId,
    },
    checkout: {
      clean: checkout.clean,
      observedAt: evaluationTime.value,
      sourceRevision: checkout.sourceRevision,
      statusId: checkout.statusId,
    },
    manifest,
    runtimeEvidence,
    runtimeEvidenceEscalation,
    riskCount: risks.length,
    risks,
    sideEffects: observedSideEffects,
    nextStep: {
      stepId: runtimeEvidenceEscalation.nextStep.stepId,
      label: runtimeEvidenceEscalation.runtimeProbeRequired
        ? 'Collect Provenance-Bound Runtime Evidence'
        : runtimeEvidenceEscalation.statusId === 'blocked'
          ? 'Repair Compatibility Deletion Preflight'
          : 'Complete Compatibility Deletion Execution Gate',
      reason: runtimeEvidenceEscalation.runtimeProbeRequired
        ? 'The otherwise valid preflight artifact needs current embedded runtime evidence from the provenance-bound read-only maintenance runner.'
        : runtimeEvidenceEscalation.statusId === 'blocked'
          ? 'The preflight artifact has an invalid or incomplete non-runtime observation. Repair that evidence before any runtime probe is considered.'
          : 'Machine-verifiable checkout, artifact, manifest, and runtime-evidence observations are retained. Recovery proof, final stances, and operator approval remain separate execution-gate evidence.',
    },
  };
  const artifactWithFingerprint = {
    ...artifactValue,
    artifactFingerprint: buildPolicyCompatibilityDeletionPreflightEvidenceArtifactFingerprint({
      artifact: artifactValue,
    }),
  };

  return {
    ...artifactWithFingerprint,
    validation: validatePolicyCompatibilityDeletionPreflightEvidenceArtifact(artifactWithFingerprint),
  };
}

function validatePolicyCompatibilityDeletionPreflightEvidenceArtifact(artifact = {}) {
  const issues = [];

  if (artifact.version !== POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_VERSION) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.UNKNOWN_VERSION,
      'Preflight evidence artifact version must be recognized.',
      { version: artifact.version || null }
    ));
  }
  if (!OBSERVATION_STATUS_IDS.has(artifact.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.UNKNOWN_STATUS,
      'Preflight evidence artifact status must be recognized.'
    ));
  }
  if (artifact.riskCount !== asArray(artifact.risks).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.RISK_COUNT_MISMATCH,
      'Preflight evidence artifact risk count must match its retained risks.'
    ));
  }

  const fingerprintValidation = validatePolicyCompatibilityDeletionPreflightEvidenceArtifactFingerprint({
    artifact,
    artifactFingerprint: artifact.artifactFingerprint,
  });
  if (!fingerprintValidation.ok) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS
        .PREFLIGHT_ARTIFACT_FINGERPRINT_INVALID,
      'Preflight evidence artifact fingerprint must bind the retained observation evidence.',
      { issueCount: fingerprintValidation.issueCount }
    ));
  }

  const sideEffectReported = asArray(artifact.risks).some(risk => (
    risk?.riskId === POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.SIDE_EFFECT_REPORTED
  ));
  const expectedRuntimeEvidenceEscalation = buildRuntimeEvidenceEscalation({
    artifact: { statusId: normalizeStatusId(artifact.executionPlanArtifact?.statusId) },
    checkout: { statusId: normalizeStatusId(artifact.checkout?.statusId) },
    manifest: { statusId: normalizeStatusId(artifact.manifest?.statusId) },
    runtimeEvidence: { statusId: normalizeStatusId(artifact.runtimeEvidence?.statusId) },
  });
  if (
    JSON.stringify(artifact.runtimeEvidenceEscalation) !==
    JSON.stringify(expectedRuntimeEvidenceEscalation)
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS
        .RUNTIME_EVIDENCE_ESCALATION_MISMATCH,
      'Preflight evidence runtime escalation must match the retained artifact, checkout, manifest, and runtime-evidence observation states.'
    ));
  }
  const derivedStatusId = determineArtifactStatus({
    artifact: { statusId: normalizeStatusId(artifact.executionPlanArtifact?.statusId) },
    checkout: { statusId: normalizeStatusId(artifact.checkout?.statusId) },
    manifest: { statusId: normalizeStatusId(artifact.manifest?.statusId) },
    runtimeEvidence: { statusId: normalizeStatusId(artifact.runtimeEvidence?.statusId) },
    sideEffectReported,
  });
  if (artifact.statusId !== derivedStatusId) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.STATUS_MISMATCH,
      'Preflight evidence artifact status must match its retained observation statuses.',
      { expectedStatusId: derivedStatusId, actualStatusId: artifact.statusId || null }
    ));
  }

  const reportedSideEffectKeys = Object.entries(asObject(artifact.sideEffects))
    .filter(([, value]) => value === true)
    .map(([key]) => key);
  if (sideEffectReported || reportedSideEffectKeys.length > 0) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.SIDE_EFFECT_REPORTED,
      'Preflight evidence artifact cannot report side effects.',
      { sideEffectKeys: reportedSideEffectKeys }
    ));
  }

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  MAX_MANIFEST_ENTRY_COUNT,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_VERSION,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS,
  buildPolicyCompatibilityDeletionPreflightEvidenceArtifact,
  validatePolicyCompatibilityDeletionPreflightEvidenceArtifact,
};
