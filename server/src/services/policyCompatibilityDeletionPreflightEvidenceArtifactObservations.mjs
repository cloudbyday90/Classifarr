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
  DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS,
} from './policyCompatibilityDeletionExecutionGateShared.mjs';
import {
  buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
  isPolicyCompatibilityDeletionPreflightNamedScopeEntry,
} from './policyCompatibilityDeletionPreflightManifestObservationIdentity.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION,
  validatePolicyCompatibilityDeletionExecutionPlanArtifact,
} from './policyCompatibilityDeletionExecutionPlanArtifact.mjs';
import {
  validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint,
} from './policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION,
} from './policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from './policyCompatibilityDeletionExecutionPlan.mjs';
import {
  MAX_MANIFEST_ENTRY_COUNT,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS,
  REVISION_PATTERN,
  asArray,
  asObject,
  buildRisk,
  normalizeStatusId,
  parseTimestamp,
} from './policyCompatibilityDeletionPreflightEvidenceArtifactShared.mjs';

const MAX_FUTURE_TIMESTAMP_SKEW_MS = 1000;

function buildArtifactSummary(artifact = {}, input = {}, statusId = null) {
  const value = asObject(artifact);
  const observation = asObject(input);

  return {
    artifactPath: typeof observation.artifactPath === 'string'
      ? observation.artifactPath
      : null,
    fingerprint: value.artifactFingerprint?.fingerprint || null,
    generatedAt: value.generatedAt || null,
    manifestApproved: value.executionPlan?.manifest?.approved === true,
    manifestApprovedBy: value.executionPlan?.manifest?.approvedBy || null,
    statusId: statusId || normalizeStatusId(observation.statusId),
  };
}

function evaluateArtifactObservation({ artifact, artifactObservation, evaluationTime }) {
  const value = asObject(artifact);
  const observation = asObject(artifactObservation);
  const risks = [];
  const statusId = normalizeStatusId(observation.statusId);

  if (statusId === POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.ARTIFACT_MISSING,
      'Preflight evidence requires the approved execution-plan artifact to be present.'
    ));
    return { risks, statusId };
  }

  if (statusId !== POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.ARTIFACT_INVALID,
      'Preflight evidence requires a readable execution-plan artifact inside the reviewed checkout.'
    ));
    return { risks, statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID };
  }

  const validation = validatePolicyCompatibilityDeletionExecutionPlanArtifact(value);
  const fingerprintValidation = validatePolicyCompatibilityDeletionExecutionPlanArtifactFingerprint({
    artifact: value,
    artifactFingerprint: value.artifactFingerprint,
  });
  const artifactTimestamp = parseTimestamp(value.generatedAt);

  if (
    value.version !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_VERSION ||
    value.statusId !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_ARTIFACT_STATUS_IDS.READY ||
    value.ready !== true ||
    value.executionPlan?.statusId !==
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE ||
    value.executionPlan?.readyForExecutionGate !== true ||
    value.validation?.ok !== true ||
    validation.ok !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.ARTIFACT_INVALID,
      'Preflight evidence requires a ready, valid execution-plan artifact.',
      { artifactStatusId: value.statusId || null }
    ));
  }

  if (!fingerprintValidation.ok) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.ARTIFACT_FINGERPRINT_INVALID,
      'Preflight evidence requires an intact execution-plan artifact fingerprint.',
      { issueCount: fingerprintValidation.issueCount }
    ));
  }

  if (
    value.executionPlan?.manifest?.approved !== true ||
    !String(value.executionPlan?.manifest?.approvedBy || '').trim()
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.ARTIFACT_NOT_APPROVED,
      'Preflight evidence requires a manifest-approved execution-plan artifact with an approving actor.'
    ));
  }

  if (!artifactTimestamp) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.ARTIFACT_TIMESTAMP_INVALID,
      'Preflight evidence requires a valid execution-plan artifact timestamp.'
    ));
  } else {
    const ageMs = evaluationTime.timestampMs - artifactTimestamp.timestampMs;

    if (ageMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.ARTIFACT_TIMESTAMP_FUTURE,
        'Preflight evidence cannot be collected before its execution-plan artifact exists.',
        { artifactGeneratedAt: artifactTimestamp.value }
      ));
    } else if (ageMs > DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.ARTIFACT_TIMESTAMP_STALE,
        'Preflight evidence requires a freshly generated execution-plan artifact.',
        { ageMs, maximumAgeMs: DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS }
      ));
    }
  }

  return {
    risks,
    statusId: risks.some(risk => risk.riskId ===
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.ARTIFACT_TIMESTAMP_STALE)
      ? POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.STALE
      : risks.length > 0
        ? POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID
        : POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED,
  };
}

function evaluateCheckoutObservation(checkoutObservation) {
  const value = asObject(checkoutObservation);
  const statusId = normalizeStatusId(value.statusId);
  const sourceRevision = String(value.sourceRevision || '').toLowerCase();
  const clean = value.clean === true;
  const risks = [];

  if (
    statusId !== POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED ||
    !REVISION_PATTERN.test(sourceRevision)
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.CHECKOUT_INVALID,
      'Preflight evidence requires a readable reviewed checkout and full source revision.'
    ));
  }
  if (!clean) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.CHECKOUT_NOT_CLEAN,
      'Preflight evidence requires a clean reviewed checkout before controlled removal.'
    ));
  }

  return {
    clean,
    risks,
    sourceRevision: REVISION_PATTERN.test(sourceRevision) ? sourceRevision : null,
    statusId: risks.length === 0
      ? POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED
      : POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
  };
}

function summarizeManifestEntries(entries = []) {
  return asArray(entries).slice(0, MAX_MANIFEST_ENTRY_COUNT).map((entry, index) => {
    const value = asObject(entry);

    return {
      entryIdentity: typeof value.entryIdentity === 'string' && value.entryIdentity.trim()
        ? value.entryIdentity.trim()
        : null,
      index: Number.isInteger(value.index) ? value.index : index,
      path: typeof value.path === 'string' ? value.path : null,
      statusId: normalizeStatusId(value.statusId),
    };
  });
}

function buildExpectedManifestEntries(entries = []) {
  return asArray(entries).map(entry => ({
    entryIdentity: buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(entry),
    namedScope: isPolicyCompatibilityDeletionPreflightNamedScopeEntry(entry),
    path: typeof entry?.path === 'string' ? entry.path : null,
  }));
}

function hasDuplicateEntryIdentity(entries = []) {
  const identities = entries
    .map(entry => entry?.entryIdentity)
    .filter(Boolean);

  return new Set(identities).size !== identities.length;
}

function evaluateManifestObservation({ artifact, artifactStatusId, manifestObservations }) {
  const entries = asArray(artifact?.executionPlan?.manifest?.entries);
  const expectedEntries = buildExpectedManifestEntries(entries);
  const observedEntries = summarizeManifestEntries(manifestObservations);
  const risks = [];

  if (artifactStatusId === POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING) {
    return {
      entries: observedEntries,
      risks: [buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_MISSING,
        'Manifest continuity cannot be observed until the approved execution-plan artifact is available.'
      )],
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING,
    };
  }

  if (artifactStatusId === POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.STALE) {
    const containsInvalidObservation = observedEntries.some(entry => (
      entry.statusId === POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID
    ));

    if (containsInvalidObservation) {
      return {
        entries: observedEntries,
        risks: [buildRisk(
          POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_INVALID,
          'Even stale execution-plan evidence must not contain an unsafe manifest-path observation.'
        )],
        statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
      };
    }

    return {
      entries: observedEntries,
      risks: [],
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.STALE,
    };
  }

  if (artifactStatusId !== POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED) {
    return {
      entries: observedEntries,
      risks: [buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_INVALID,
        'Manifest continuity cannot be trusted from an invalid execution-plan artifact.'
      )],
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
    };
  }

  if (entries.length === 0 || entries.length > MAX_MANIFEST_ENTRY_COUNT) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_INVALID,
      'Preflight evidence requires a bounded execution-plan manifest with exact entries.',
      { entryCount: entries.length }
    ));
  }
  if (entries.length !== observedEntries.length) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_MISSING,
      'Preflight evidence requires an observation for every execution-plan manifest entry.',
      { expectedEntryCount: entries.length, observedEntryCount: observedEntries.length }
    ));
  }

  if (expectedEntries.some(entry => !entry.path || !entry.entryIdentity)) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_INVALID,
      'Preflight evidence requires every approved manifest entry to have a stable observation identity.'
    ));
  }

  if (hasDuplicateEntryIdentity(expectedEntries)) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS
        .MANIFEST_DUPLICATE_ENTRY_IDENTITY,
      'Preflight evidence cannot observe an approved manifest that repeats an exact entry identity.'
    ));
  }

  observedEntries.forEach((entry, index) => {
    const expectedEntry = expectedEntries[index];
    const expectedPath = expectedEntry?.path || null;
    const requiresExactIdentity = expectedEntry?.namedScope === true;
    const identityMatches = requiresExactIdentity
      ? entry.entryIdentity === expectedEntry?.entryIdentity
      : !entry.entryIdentity || entry.entryIdentity === expectedEntry?.entryIdentity;

    if (!expectedPath || entry.path !== expectedPath) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_INVALID,
        'Preflight evidence manifest observations must preserve the approved manifest entry order.',
        { index }
      ));
      return;
    }
    if (!identityMatches) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_INVALID,
        'Preflight evidence manifest observations must preserve the approved exact-entry identity.',
        { index, path: entry.path }
      ));
      return;
    }
    if (entry.statusId === POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_MISSING,
        'Preflight evidence requires every approved manifest path to exist at the reviewed source revision.',
        { path: entry.path }
      ));
    } else if (entry.statusId !== POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_INVALID,
        'Preflight evidence requires every approved manifest path to be safe, regular, and tracked.',
        { path: entry.path }
      ));
    }
  });

  const observedIdentityEntries = observedEntries.map((entry, index) => ({
    entryIdentity: entry.entryIdentity || (
      expectedEntries[index]?.namedScope === false
        ? buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity({
          path: entry.path,
        })
        : null
    ),
  }));
  if (hasDuplicateEntryIdentity(observedIdentityEntries)) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS
        .MANIFEST_DUPLICATE_ENTRY_IDENTITY,
      'Preflight evidence cannot contain duplicate approved manifest entry identities.'
    ));
  }

  const statusId = risks.some(risk => (
    risk.riskId === POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_INVALID ||
    risk.riskId === POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS
      .MANIFEST_DUPLICATE_ENTRY_IDENTITY
  ))
    ? POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID
    : risks.length > 0
      ? POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING
      : POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED;

  return { entries: observedEntries, risks, statusId };
}

function evaluateRuntimeEvidenceReference({ artifact, evaluationTime }) {
  const evidenceBundle = asObject(artifact?.evidenceBundle);
  const evidenceTimestamp = parseTimestamp(evidenceBundle.generatedAt);
  const risks = [];

  if (Object.keys(evidenceBundle).length === 0) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.RUNTIME_EVIDENCE_MISSING,
      'Preflight evidence requires a retained runtime evidence-bundle reference.'
    ));
  } else if (
    evidenceBundle.version !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_VERSION ||
    evidenceBundle.statusId !== POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_EVIDENCE_BUNDLE_STATUS_IDS.READY ||
    evidenceBundle.validationOk !== true
  ) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.RUNTIME_EVIDENCE_INVALID,
      'Preflight evidence requires a ready, valid retained runtime evidence-bundle reference.',
      { evidenceBundleStatusId: evidenceBundle.statusId || null }
    ));
  }

  if (!evidenceTimestamp) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.RUNTIME_EVIDENCE_MISSING,
      'Preflight evidence requires a timestamped runtime evidence-bundle reference.'
    ));
  } else {
    const ageMs = evaluationTime.timestampMs - evidenceTimestamp.timestampMs;

    if (ageMs < -MAX_FUTURE_TIMESTAMP_SKEW_MS) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.RUNTIME_EVIDENCE_INVALID,
        'Preflight runtime evidence cannot be collected after the preflight observation.',
        { evidenceGeneratedAt: evidenceTimestamp.value }
      ));
    } else if (ageMs > DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.RUNTIME_EVIDENCE_STALE,
        'Preflight evidence requires a current retained runtime evidence-bundle reference.',
        { ageMs, maximumAgeMs: DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS }
      ));
    }
  }

  const statusId = risks.some(risk => risk.riskId ===
    POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.RUNTIME_EVIDENCE_INVALID)
    ? POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID
    : risks.some(risk => risk.riskId ===
      POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.RUNTIME_EVIDENCE_STALE)
      ? POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.STALE
      : risks.length > 0
        ? POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING
        : POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED;

  return {
    evidenceBundle: {
      generatedAt: evidenceBundle.generatedAt || null,
      statusId: evidenceBundle.statusId || null,
      validationOk: evidenceBundle.validationOk === true,
      version: evidenceBundle.version || null,
    },
    risks,
    statusId,
  };
}

function determinePreflightEvidenceStatus({ artifact, checkout, manifest, runtimeEvidence }) {
  const statuses = [artifact.statusId, checkout.statusId, manifest.statusId, runtimeEvidence.statusId];

  if (statuses.includes(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID)) {
    return POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID;
  }
  if (statuses.includes(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING)) {
    return POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING;
  }
  if (statuses.includes(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.STALE)) {
    return POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.STALE;
  }

  return POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED;
}

export {
  buildArtifactSummary,
  determinePreflightEvidenceStatus,
  evaluateArtifactObservation,
  evaluateCheckoutObservation,
  evaluateManifestObservation,
  evaluateRuntimeEvidenceReference,
};
