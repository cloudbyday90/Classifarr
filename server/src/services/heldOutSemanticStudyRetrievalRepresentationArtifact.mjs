/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
  validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument,
} from './policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from './policyCandidateSemanticSnapshotFingerprint.mjs';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_VERSION =
  'policy.held_out_semantic_study_retrieval_representation_artifact.v1';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS = Object.freeze({
  DECLARED_LIBRARY_PURPOSE: 'declared_library_purpose',
  MEDIA_DESCRIPTION: 'media_description',
  NEAREST_ITEM_HISTORY: 'nearest_item_history',
});

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS = Object.freeze({
  DUPLICATE_FIXTURE_ID: 'duplicate_fixture_id',
  DUPLICATE_REPRESENTATION_ID: 'duplicate_representation_id',
  FIXTURE_DOCUMENT_FINGERPRINT_MISMATCH: 'fixture_document_fingerprint_mismatch',
  INCOMPLETE_FIXTURE_SET: 'incomplete_fixture_set',
  INVALID_ARTIFACT: 'invalid_artifact',
  INVALID_DECISION_ID: 'invalid_decision_id',
  INVALID_FIXTURE_ID: 'invalid_fixture_id',
  INVALID_FINGERPRINT: 'invalid_fingerprint',
  INVALID_REPRESENTATION_ID: 'invalid_representation_id',
  INVALID_VERSION: 'invalid_version',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  SNAPSHOT_DOCUMENT_FINGERPRINT_MISMATCH: 'snapshot_document_fingerprint_mismatch',
  UNKNOWN_FIELD: 'unknown_field',
});

const ARTIFACT_KEYS = Object.freeze([
  'fixtureDocumentFingerprint',
  'representationResults',
  'snapshotDocumentFingerprint',
  'version',
]);
const REPRESENTATION_RESULT_KEYS = Object.freeze(['representationId', 'signals']);
const SIGNAL_KEYS = Object.freeze(['decisionId', 'fixtureId']);
const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const REPRESENTATION_IDS = new Set(Object.values(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS));
const DECISION_IDS = new Set(Object.values(POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS));

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function buildIssue(riskId, path, message) {
  return Object.freeze({ riskId, path, message });
}

function requireOwnField(value, key, path, issues) {
  if (Object.hasOwn(value, key)) return true;
  issues.push(buildIssue(
    HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.MISSING_REQUIRED_FIELD,
    `${path}.${key}`,
    'Field is required by the retrieval-representation study artifact.',
  ));
  return false;
}

function hasOnlyKeys(value, allowedKeys, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.INVALID_ARTIFACT,
      path,
      'Value must be a plain JSON object.',
    ));
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push(buildIssue(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.UNKNOWN_FIELD,
        `${path}.${key}`,
        'Field is not allowed by the retrieval-representation study artifact.',
      ));
    }
  }
  return true;
}

function validateFingerprint(value, path, issues) {
  if (typeof value === 'string' && FINGERPRINT_PATTERN.test(value)) return;
  issues.push(buildIssue(
    HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.INVALID_FINGERPRINT,
    path,
    'Fingerprint must be a SHA-256 content address.',
  ));
}

function validateSignal(signal, path, issues) {
  if (!hasOnlyKeys(signal, SIGNAL_KEYS, path, issues)) return null;
  const hasFixtureId = requireOwnField(signal, 'fixtureId', path, issues);
  const hasDecisionId = requireOwnField(signal, 'decisionId', path, issues);
  if (hasFixtureId && (typeof signal.fixtureId !== 'string' || !FIXTURE_ID_PATTERN.test(signal.fixtureId))) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.INVALID_FIXTURE_ID,
      `${path}.fixtureId`,
      'Fixture ID must be a bounded opaque study identifier.',
    ));
  }
  if (hasDecisionId && !DECISION_IDS.has(signal.decisionId)) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.INVALID_DECISION_ID,
      `${path}.decisionId`,
      'Decision must be admit, review, or abstain.',
    ));
  }
  return hasFixtureId && hasDecisionId ? signal.fixtureId : null;
}

function validateRepresentationResult(result, index, issues) {
  const path = `artifact.representationResults[${index}]`;
  if (!hasOnlyKeys(result, REPRESENTATION_RESULT_KEYS, path, issues)) return null;
  const hasRepresentationId = requireOwnField(result, 'representationId', path, issues);
  const hasSignals = requireOwnField(result, 'signals', path, issues);
  if (hasRepresentationId && !REPRESENTATION_IDS.has(result.representationId)) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.INVALID_REPRESENTATION_ID,
      `${path}.representationId`,
      'Representation ID must identify media description, declared library purpose, or nearest-item history.',
    ));
  }
  if (!hasSignals || !Array.isArray(result.signals) || result.signals.length === 0 || result.signals.length > 32) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.INVALID_ARTIFACT,
      `${path}.signals`,
      'Each representation requires between one and 32 status-only fixture signals.',
    ));
    return hasRepresentationId ? result.representationId : null;
  }
  const fixtureIds = new Set();
  result.signals.forEach((signal, signalIndex) => {
    const fixtureId = validateSignal(signal, `${path}.signals[${signalIndex}]`, issues);
    if (fixtureId && fixtureIds.has(fixtureId)) {
      issues.push(buildIssue(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.DUPLICATE_FIXTURE_ID,
        `${path}.signals[${signalIndex}].fixtureId`,
        'A representation can contain only one signal for each fixture.',
      ));
    }
    if (fixtureId) fixtureIds.add(fixtureId);
  });
  return hasRepresentationId ? result.representationId : null;
}

/**
 * Validates the content-free scoring artifact for a fixed three-way
 * representation comparison. It contains only opaque fixture IDs, categorical
 * outcomes, and two pins; raw descriptions, purposes, neighbors, vectors,
 * prompts, libraries, and model output are never allowed.
 */
export function validateHeldOutSemanticStudyRetrievalRepresentationArtifact(artifact) {
  const issues = [];
  if (!hasOnlyKeys(artifact, ARTIFACT_KEYS, 'artifact', issues)) {
    return Object.freeze({ ok: false, representationCount: 0, issues: Object.freeze(issues) });
  }
  const hasVersion = requireOwnField(artifact, 'version', 'artifact', issues);
  const hasFixtureFingerprint = requireOwnField(artifact, 'fixtureDocumentFingerprint', 'artifact', issues);
  const hasSnapshotFingerprint = requireOwnField(artifact, 'snapshotDocumentFingerprint', 'artifact', issues);
  const hasResults = requireOwnField(artifact, 'representationResults', 'artifact', issues);
  if (hasVersion && artifact.version !== HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_VERSION) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.INVALID_VERSION,
      'artifact.version',
      'Artifact must declare the current retrieval-representation study version.',
    ));
  }
  if (hasFixtureFingerprint) validateFingerprint(artifact.fixtureDocumentFingerprint, 'artifact.fixtureDocumentFingerprint', issues);
  if (hasSnapshotFingerprint) validateFingerprint(artifact.snapshotDocumentFingerprint, 'artifact.snapshotDocumentFingerprint', issues);
  if (!hasResults || !Array.isArray(artifact.representationResults) ||
      artifact.representationResults.length !== REPRESENTATION_IDS.size) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.INVALID_ARTIFACT,
      'artifact.representationResults',
      'Artifact must include every fixed retrieval representation exactly once.',
    ));
  } else {
    const representationIds = new Set();
    artifact.representationResults.forEach((result, index) => {
      const representationId = validateRepresentationResult(result, index, issues);
      if (representationId && representationIds.has(representationId)) {
        issues.push(buildIssue(
          HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.DUPLICATE_REPRESENTATION_ID,
          `artifact.representationResults[${index}].representationId`,
          'Each fixed retrieval representation must occur exactly once.',
        ));
      }
      if (representationId) representationIds.add(representationId);
    });
    for (const representationId of REPRESENTATION_IDS) {
      if (!representationIds.has(representationId)) {
        issues.push(buildIssue(
          HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.INVALID_REPRESENTATION_ID,
          'artifact.representationResults',
          'Artifact omits a required retrieval representation.',
        ));
      }
    }
  }
  return Object.freeze({
    ok: issues.length === 0,
    representationCount: Array.isArray(artifact?.representationResults)
      ? artifact.representationResults.length
      : 0,
    issues: Object.freeze(issues),
  });
}

/**
 * Binds a valid status-only artifact to the exact redacted fixture and
 * snapshot documents. Any missing, substituted, or extra fixture fails
 * closed before comparison; no unbound variant can be cherry-picked.
 */
export function validateHeldOutSemanticStudyRetrievalRepresentationArtifactBinding({
  artifact,
  fixtureDocument,
  snapshotDocument,
} = {}) {
  const artifactValidation = validateHeldOutSemanticStudyRetrievalRepresentationArtifact(artifact);
  const fixtureValidation = validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument(fixtureDocument);
  const issues = [...artifactValidation.issues];
  if (!artifactValidation.ok || !fixtureValidation.ok || !snapshotDocument) {
    return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  }
  const fixtureFingerprint = createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument);
  const snapshotFingerprint = createPolicyCandidateSemanticSnapshotFingerprint(snapshotDocument);
  if (artifact.fixtureDocumentFingerprint !== fixtureFingerprint) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.FIXTURE_DOCUMENT_FINGERPRINT_MISMATCH,
      'artifact.fixtureDocumentFingerprint',
      'Artifact is not pinned to the redacted fixture document.',
    ));
  }
  if (artifact.snapshotDocumentFingerprint !== snapshotFingerprint) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.SNAPSHOT_DOCUMENT_FINGERPRINT_MISMATCH,
      'artifact.snapshotDocumentFingerprint',
      'Artifact is not pinned to the fixed retrieval snapshot document.',
    ));
  }
  const expectedFixtureIds = new Set(fixtureDocument.map((fixture) => fixture.id));
  for (const result of artifact.representationResults) {
    const signalFixtureIds = new Set(result.signals.map((signal) => signal.fixtureId));
    const sameFixtureSet = signalFixtureIds.size === expectedFixtureIds.size &&
      [...expectedFixtureIds].every((fixtureId) => signalFixtureIds.has(fixtureId));
    if (!sameFixtureSet) {
      issues.push(buildIssue(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_RISK_IDS.INCOMPLETE_FIXTURE_SET,
        `artifact.representationResults.${result.representationId}.signals`,
        'Every representation must cover exactly the pinned fixture set.',
      ));
    }
  }
  return Object.freeze({ ok: issues.length === 0, issues: Object.freeze(issues) });
}
