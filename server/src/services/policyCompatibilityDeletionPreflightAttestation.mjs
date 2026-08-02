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
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_VERSION,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS,
  validatePolicyCompatibilityDeletionPreflightEvidenceArtifact,
} from './policyCompatibilityDeletionPreflightEvidenceArtifact.mjs';
import {
  validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
} from './policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs';
import {
  buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
  isPolicyCompatibilityDeletionPreflightNamedScopeEntry,
} from './policyCompatibilityDeletionPreflightManifestObservationIdentity.mjs';
import {
  DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS,
  MAX_FUTURE_TIMESTAMP_SKEW_MS,
  REVISION_PATTERN,
  asArray,
  asObject,
  buildRisk,
  normalizeFingerprint,
  normalizeMaximumAge,
  parseTimestamp,
} from './policyCompatibilityDeletionExecutionGateShared.mjs';

const POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_VERSION =
  'policy.compatibility_deletion_preflight_attestation.v2';

const POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_STATUS_IDS = Object.freeze({
  OBSERVED: 'observed',
  MISSING: 'missing',
  STALE: 'stale',
  INVALID: 'invalid',
});

const POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS = Object.freeze({
  PREFLIGHT_ARTIFACT_MISSING: 'preflight_artifact_missing',
  PREFLIGHT_ARTIFACT_INVALID: 'preflight_artifact_invalid',
  PREFLIGHT_ARTIFACT_FINGERPRINT_INVALID: 'preflight_artifact_fingerprint_invalid',
  PREFLIGHT_ARTIFACT_STATUS_INVALID: 'preflight_artifact_status_invalid',
  PREFLIGHT_ARTIFACT_TIMESTAMP_INVALID: 'preflight_artifact_timestamp_invalid',
  PREFLIGHT_ARTIFACT_TIMESTAMP_STALE: 'preflight_artifact_timestamp_stale',
  PREFLIGHT_ARTIFACT_TIMESTAMP_FUTURE: 'preflight_artifact_timestamp_future',
  PREFLIGHT_ARTIFACT_PRECEDES_EXECUTION_PLAN: 'preflight_artifact_precedes_execution_plan',
  EXECUTION_PLAN_FINGERPRINT_INVALID: 'execution_plan_fingerprint_invalid',
  EXECUTION_PLAN_FINGERPRINT_MISMATCH: 'execution_plan_fingerprint_mismatch',
  EXECUTION_PLAN_SUMMARY_MISMATCH: 'execution_plan_summary_mismatch',
  CHECKOUT_INVALID: 'checkout_invalid',
  CHECKOUT_NOT_CLEAN: 'checkout_not_clean',
  CHECKOUT_TIMESTAMP_MISMATCH: 'checkout_timestamp_mismatch',
  MANIFEST_INVALID: 'manifest_invalid',
  MANIFEST_ORDER_MISMATCH: 'manifest_order_mismatch',
  MANIFEST_DUPLICATE_PATH: 'manifest_duplicate_path',
  MANIFEST_DUPLICATE_ENTRY_IDENTITY: 'manifest_duplicate_entry_identity',
  RUNTIME_EVIDENCE_INVALID: 'runtime_evidence_invalid',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
});

function hasReportedSideEffect(sideEffects = {}) {
  return Object.values(asObject(sideEffects)).some(value => value === true);
}

function buildAttestationStatusId(risks = []) {
  const riskIds = new Set(risks.map(risk => risk.riskId));

  if (riskIds.has(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
    .PREFLIGHT_ARTIFACT_MISSING)) {
    return POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_STATUS_IDS.MISSING;
  }
  if (riskIds.has(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
    .PREFLIGHT_ARTIFACT_TIMESTAMP_STALE)) {
    return POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_STATUS_IDS.STALE;
  }

  return risks.length === 0
    ? POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_STATUS_IDS.OBSERVED
    : POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_STATUS_IDS.INVALID;
}

function evaluateArtifactBinding({
  executionPlanArtifact,
  preflightEvidenceArtifact,
  evaluationTime,
  maximumAgeMs,
}) {
  const executionPlan = asObject(executionPlanArtifact);
  const preflight = asObject(preflightEvidenceArtifact);
  const risks = [];

  if (Object.keys(preflight).length === 0) {
    return {
      preflight,
      risks: [buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.PREFLIGHT_ARTIFACT_MISSING,
        'Compatibility deletion requires a separately collected preflight evidence artifact.'
      )],
    };
  }

  const executionPlanFingerprintValidation =
    validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
      artifact: executionPlan,
      artifactFingerprint: executionPlan.artifactFingerprint,
    });
  const preflightValidation = validatePolicyCompatibilityDeletionPreflightEvidenceArtifact(preflight);
  const expectedFingerprint = normalizeFingerprint(executionPlan.artifactFingerprint?.fingerprint);
  const observedFingerprint = normalizeFingerprint(preflight.executionPlanArtifact?.fingerprint);
  const executionPlanGeneratedAt = parseTimestamp(executionPlan.generatedAt);
  const preflightGeneratedAt = parseTimestamp(preflight.generatedAt);

  if (!executionPlanFingerprintValidation.ok || !expectedFingerprint) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.EXECUTION_PLAN_FINGERPRINT_INVALID,
      'Compatibility deletion preflight attestation requires an intact current execution-plan fingerprint.',
      { issueCount: executionPlanFingerprintValidation.issueCount }
    ));
  }

  if (
    preflight.version !== POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_ARTIFACT_VERSION ||
    preflight.statusId !== POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED ||
    preflight.validation?.ok !== true ||
    !preflightValidation.ok
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.PREFLIGHT_ARTIFACT_INVALID,
      'Compatibility deletion preflight attestation requires an observed, valid preflight evidence artifact.',
      { issueCount: preflightValidation.issueCount, statusId: preflight.statusId || null }
    ));
  }

  if (!preflight.artifactFingerprint?.fingerprint) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
        .PREFLIGHT_ARTIFACT_FINGERPRINT_INVALID,
      'Compatibility deletion preflight attestation requires an intact preflight evidence fingerprint.'
    ));
  }

  if (!observedFingerprint || !expectedFingerprint || observedFingerprint !== expectedFingerprint) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
        .EXECUTION_PLAN_FINGERPRINT_MISMATCH,
      'Compatibility deletion preflight evidence must bind to the exact current execution-plan artifact.',
      {
        expectedExecutionPlanArtifactFingerprint: expectedFingerprint || null,
        observedExecutionPlanArtifactFingerprint: observedFingerprint || null,
      }
    ));
  }

  if (
    preflight.executionPlanArtifact?.generatedAt !== executionPlan.generatedAt ||
    preflight.executionPlanArtifact?.manifestApproved !==
      (executionPlan.executionPlan?.manifest?.approved === true) ||
    preflight.executionPlanArtifact?.manifestApprovedBy !==
      (executionPlan.executionPlan?.manifest?.approvedBy || null)
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
        .EXECUTION_PLAN_SUMMARY_MISMATCH,
      'Compatibility deletion preflight artifact summary must match the current execution-plan artifact.'
    ));
  }

  if (!preflightGeneratedAt || !executionPlanGeneratedAt || !evaluationTime) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
        .PREFLIGHT_ARTIFACT_TIMESTAMP_INVALID,
      'Compatibility deletion preflight attestation requires valid execution-plan, preflight, and evaluation timestamps.'
    ));
  } else {
    const preflightAgeMs = evaluationTime.timestampMs - preflightGeneratedAt.timestampMs;

    if (preflightAgeMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
          .PREFLIGHT_ARTIFACT_TIMESTAMP_FUTURE,
        'Compatibility deletion preflight evidence cannot be collected after the execution-gate evaluation.',
        { generatedAt: preflightGeneratedAt.value }
      ));
    } else if (preflightAgeMs > maximumAgeMs) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
          .PREFLIGHT_ARTIFACT_TIMESTAMP_STALE,
        'Compatibility deletion preflight evidence must be refreshed immediately before controlled removal.',
        { maximumAgeMs, preflightAgeMs }
      ));
    }

    if (
      preflightGeneratedAt.timestampMs <
      executionPlanGeneratedAt.timestampMs - MAX_FUTURE_TIMESTAMP_SKEW_MS
    ) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
          .PREFLIGHT_ARTIFACT_PRECEDES_EXECUTION_PLAN,
        'Compatibility deletion preflight evidence must be collected after the bound execution plan is generated.',
        {
          executionPlanGeneratedAt: executionPlanGeneratedAt.value,
          preflightGeneratedAt: preflightGeneratedAt.value,
        }
      ));
    }
  }

  if (hasReportedSideEffect(preflight.sideEffects)) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.SIDE_EFFECT_REPORTED,
      'Compatibility deletion preflight evidence cannot report side effects.'
    ));
  }

  return { preflight, risks };
}

function evaluateCheckoutObservation({ preflightEvidenceArtifact }) {
  const checkout = asObject(preflightEvidenceArtifact.checkout);
  const generatedAt = parseTimestamp(preflightEvidenceArtifact.generatedAt);
  const observedAt = parseTimestamp(checkout.observedAt);
  const sourceRevision = String(checkout.sourceRevision || '').toLowerCase();
  const risks = [];

  if (
    checkout.statusId !== POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED ||
    !REVISION_PATTERN.test(sourceRevision)
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.CHECKOUT_INVALID,
      'Compatibility deletion preflight attestation requires a valid observed checkout revision.'
    ));
  }
  if (checkout.clean !== true) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.CHECKOUT_NOT_CLEAN,
      'Compatibility deletion preflight attestation requires a clean reviewed checkout.'
    ));
  }
  if (!generatedAt || !observedAt || generatedAt.timestampMs !== observedAt.timestampMs) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.CHECKOUT_TIMESTAMP_MISMATCH,
      'Compatibility deletion checkout observation must be collected in the same bounded preflight artifact.'
    ));
  }

  return {
    checkout: {
      clean: checkout.clean === true,
      observedAt: checkout.observedAt || null,
      sourceRevision: REVISION_PATTERN.test(sourceRevision) ? sourceRevision : null,
      statusId: checkout.statusId || null,
    },
    risks,
  };
}

function evaluateManifestObservation({ executionPlanArtifact, preflightEvidenceArtifact }) {
  const expectedEntries = asArray(executionPlanArtifact.executionPlan?.manifest?.entries);
  const observedEntries = asArray(preflightEvidenceArtifact.manifest?.entries);
  const risks = [];
  const expectedIdentityEntries = expectedEntries.map(entry => ({
    entryIdentity: buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(entry),
    namedScope: isPolicyCompatibilityDeletionPreflightNamedScopeEntry(entry),
    path: typeof entry?.path === 'string' ? entry.path : null,
  }));
  const observedIdentityEntries = observedEntries.map((entry, index) => ({
    entryIdentity: typeof entry?.entryIdentity === 'string' && entry.entryIdentity.trim()
      ? entry.entryIdentity.trim()
      : expectedIdentityEntries[index]?.namedScope === false
        ? buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity({
          path: entry?.path,
        })
        : null,
    namedScope: expectedIdentityEntries[index]?.namedScope === true,
  }));

  const hasDuplicateIdentity = entries => {
    const identities = entries.map(entry => entry?.entryIdentity).filter(Boolean);
    return new Set(identities).size !== identities.length;
  };
  const hasDuplicateFilePathIdentity = entries => entries
    .map(entry => entry?.entryIdentity)
    .filter(identity => identity?.startsWith('file_path:'))
    .some((identity, index, identities) => identities.indexOf(identity) !== index);

  if (
    preflightEvidenceArtifact.manifest?.statusId !==
    POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.MANIFEST_INVALID,
      'Compatibility deletion preflight attestation requires observed manifest continuity.'
    ));
  }
  if (
    expectedEntries.length === 0 ||
    expectedEntries.length !== observedEntries.length
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.MANIFEST_ORDER_MISMATCH,
      'Compatibility deletion preflight manifest observations must have exact approved entry coverage.',
      { expectedEntryCount: expectedEntries.length, observedEntryCount: observedEntries.length }
    ));
  }
  if (
    expectedIdentityEntries.some(entry => !entry.path || !entry.entryIdentity) ||
    observedIdentityEntries.some((entry, index) => (
      expectedIdentityEntries[index]?.namedScope === true && !entry.entryIdentity
    ))
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.MANIFEST_INVALID,
      'Compatibility deletion preflight manifest observations require stable exact-entry identities.'
    ));
  }
  if (
    hasDuplicateFilePathIdentity(expectedIdentityEntries) ||
    hasDuplicateFilePathIdentity(observedIdentityEntries)
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.MANIFEST_DUPLICATE_PATH,
      'Compatibility deletion preflight manifest observations cannot contain duplicate paths.'
    ));
  }
  if (hasDuplicateIdentity(expectedIdentityEntries) || hasDuplicateIdentity(observedIdentityEntries)) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS
        .MANIFEST_DUPLICATE_ENTRY_IDENTITY,
      'Compatibility deletion preflight manifest observations cannot repeat an exact entry identity.'
    ));
  }

  expectedEntries.forEach((entry, index) => {
    const observed = asObject(observedEntries[index]);
    const expectedIdentityEntry = expectedIdentityEntries[index];
    const observedIdentityEntry = observedIdentityEntries[index];
    const observedEntryIdentity = typeof observed.entryIdentity === 'string' &&
      observed.entryIdentity.trim()
      ? observed.entryIdentity.trim()
      : null;
    const identityMatches = expectedIdentityEntry?.namedScope === true
      ? observedIdentityEntry?.entryIdentity === expectedIdentityEntry.entryIdentity
      : !observedEntryIdentity ||
        observedEntryIdentity === expectedIdentityEntry?.entryIdentity;

    if (
      observed.index !== index ||
      observed.path !== entry?.path ||
      !identityMatches ||
      observed.statusId !== POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED
    ) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.MANIFEST_ORDER_MISMATCH,
        'Compatibility deletion preflight manifest observations must preserve approved exact-entry ordering.',
        {
          index,
          expectedPath: entry?.path || null,
          observedPath: observed.path || null,
        }
      ));
    }
  });

  return {
    manifest: {
      entries: observedEntries.map(entry => ({
        entryIdentity: typeof entry?.entryIdentity === 'string' && entry.entryIdentity.trim()
          ? entry.entryIdentity.trim()
          : null,
        index: Number.isInteger(entry?.index) ? entry.index : null,
        path: typeof entry?.path === 'string' ? entry.path : null,
        statusId: entry?.statusId || null,
      })),
      observedAt: preflightEvidenceArtifact.generatedAt || null,
      statusId: preflightEvidenceArtifact.manifest?.statusId || null,
    },
    risks,
  };
}

function evaluateRuntimeEvidence({ preflightEvidenceArtifact }) {
  const runtimeEvidence = asObject(preflightEvidenceArtifact.runtimeEvidence);

  if (runtimeEvidence.statusId === POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS
    .OBSERVED) {
    return { risks: [], runtimeEvidence };
  }

  return {
    runtimeEvidence,
    risks: [buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS.RUNTIME_EVIDENCE_INVALID,
      'Compatibility deletion preflight attestation requires current retained runtime evidence.'
    )],
  };
}

function evaluatePolicyCompatibilityDeletionPreflightAttestation({
  executionPlanArtifact = null,
  preflightEvidenceArtifact = null,
  now = null,
  maxEvidenceAgeMs = null,
} = {}) {
  const executionPlan = asObject(executionPlanArtifact);
  const evaluationTime = parseTimestamp(now);
  const maximumAgeMs = normalizeMaximumAge(maxEvidenceAgeMs ||
    DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS);
  const artifactEvaluation = evaluateArtifactBinding({
    executionPlanArtifact: executionPlan,
    preflightEvidenceArtifact,
    evaluationTime,
    maximumAgeMs,
  });
  const checkoutEvaluation = evaluateCheckoutObservation({
    preflightEvidenceArtifact: artifactEvaluation.preflight,
  });
  const manifestEvaluation = evaluateManifestObservation({
    executionPlanArtifact: executionPlan,
    preflightEvidenceArtifact: artifactEvaluation.preflight,
  });
  const runtimeEvidenceEvaluation = evaluateRuntimeEvidence({
    preflightEvidenceArtifact: artifactEvaluation.preflight,
  });
  const runtimeEvidenceBundle = asObject(
    runtimeEvidenceEvaluation.runtimeEvidence.evidenceBundle
  );
  const risks = [
    ...artifactEvaluation.risks,
    ...checkoutEvaluation.risks,
    ...manifestEvaluation.risks,
    ...runtimeEvidenceEvaluation.risks,
  ];
  const artifact = artifactEvaluation.preflight;

  return {
    version: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_VERSION,
    generatedAt: artifact.generatedAt || null,
    statusId: buildAttestationStatusId(risks),
    executionPlanArtifactFingerprint:
      artifact.executionPlanArtifact?.fingerprint || null,
    preflightEvidenceArtifactFingerprint: artifact.artifactFingerprint?.fingerprint || null,
    checkout: checkoutEvaluation.checkout,
    manifest: manifestEvaluation.manifest,
    runtimeEvidence: {
      generatedAt: runtimeEvidenceBundle.generatedAt || null,
      statusId: runtimeEvidenceBundle.statusId || null,
      validationOk: runtimeEvidenceBundle.validationOk === true,
      version: runtimeEvidenceBundle.version || null,
    },
    riskCount: risks.length,
    risks,
  };
}

export {
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_ATTESTATION_VERSION,
  evaluatePolicyCompatibilityDeletionPreflightAttestation,
};
