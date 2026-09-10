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

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_VERSION =
  'policy.held_out_semantic_study_retrieval_representation_submission.v1';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS = Object.freeze({
  DUPLICATE_FIXTURE_ID: 'duplicate_fixture_id',
  FIXTURE_DOCUMENT_FINGERPRINT_MISMATCH: 'fixture_document_fingerprint_mismatch',
  INCOMPLETE_FIXTURE_SET: 'incomplete_fixture_set',
  INVALID_DECISION_ID: 'invalid_decision_id',
  INVALID_FIXTURE_ID: 'invalid_fixture_id',
  INVALID_FINGERPRINT: 'invalid_fingerprint',
  INVALID_SUBMISSION: 'invalid_submission',
  INVALID_VERSION: 'invalid_version',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  SNAPSHOT_DOCUMENT_FINGERPRINT_MISMATCH: 'snapshot_document_fingerprint_mismatch',
  UNKNOWN_FIELD: 'unknown_field',
});

const SUBMISSION_KEYS = Object.freeze([
  'fixtureDocumentFingerprint',
  'signals',
  'snapshotDocumentFingerprint',
  'version',
]);
const SIGNAL_KEYS = Object.freeze([
  'declaredLibraryPurposeDecisionId',
  'fixtureId',
  'mediaDescriptionDecisionId',
  'nearestItemHistoryClassificationLabelExcludedDecisionId',
  'nearestItemHistoryClassificationLabelIncludedDecisionId',
]);
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const DECISION_IDS = new Set(Object.values(POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS));

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function buildIssue(riskId, path, message) {
  return Object.freeze({ riskId, path, message });
}

function hasExactKeys(value, keys, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS.INVALID_SUBMISSION,
      path,
      'Value must be a plain JSON object.',
    ));
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      issues.push(buildIssue(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS.UNKNOWN_FIELD,
        `${path}.${key}`,
        'Field is not allowed by the retrieval-representation submission.',
      ));
    }
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) {
      issues.push(buildIssue(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS.MISSING_REQUIRED_FIELD,
        `${path}.${key}`,
        'Field is required by the retrieval-representation submission.',
      ));
    }
  }
  return true;
}

function validateFingerprint(value, path, issues) {
  if (typeof value === 'string' && FINGERPRINT_PATTERN.test(value)) return;
  issues.push(buildIssue(
    HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS.INVALID_FINGERPRINT,
    path,
    'Fingerprint must be a SHA-256 content address.',
  ));
}

function validateSignal(signal, index, issues) {
  const path = `submission.signals[${index}]`;
  if (!hasExactKeys(signal, SIGNAL_KEYS, path, issues)) return null;
  if (typeof signal.fixtureId !== 'string' || !FIXTURE_ID_PATTERN.test(signal.fixtureId)) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS.INVALID_FIXTURE_ID,
      `${path}.fixtureId`,
      'Fixture ID must be a bounded opaque study identifier.',
    ));
  }
  for (const key of SIGNAL_KEYS.filter((key) => key !== 'fixtureId')) {
    if (!DECISION_IDS.has(signal[key])) {
      issues.push(buildIssue(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS.INVALID_DECISION_ID,
        `${path}.${key}`,
        'Every representation decision must be admit, review, or abstain.',
      ));
    }
  }
  return typeof signal.fixtureId === 'string' ? signal.fixtureId : null;
}

/**
 * Validates categorical evaluator output only. It deliberately has no fields
 * for prompts, source text, candidate names, model/provider data, embeddings,
 * reviewers, or independent labels, preventing them from crossing this
 * artifact-production boundary.
 */
export function validateHeldOutSemanticStudyRetrievalRepresentationSubmission(submission) {
  const issues = [];
  if (!hasExactKeys(submission, SUBMISSION_KEYS, 'submission', issues)) {
    return Object.freeze({ issues: Object.freeze(issues), ok: false, signalCount: 0 });
  }
  if (submission.version !== HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_VERSION) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS.INVALID_VERSION,
      'submission.version',
      'Submission must declare the current retrieval-representation version.',
    ));
  }
  validateFingerprint(submission.fixtureDocumentFingerprint, 'submission.fixtureDocumentFingerprint', issues);
  validateFingerprint(submission.snapshotDocumentFingerprint, 'submission.snapshotDocumentFingerprint', issues);
  if (!Array.isArray(submission.signals) || submission.signals.length === 0 || submission.signals.length > 32) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS.INVALID_SUBMISSION,
      'submission.signals',
      'Submission requires between one and 32 fixed-fixture signal rows.',
    ));
  } else {
    const fixtureIds = new Set();
    submission.signals.forEach((signal, index) => {
      const fixtureId = validateSignal(signal, index, issues);
      if (fixtureId && fixtureIds.has(fixtureId)) {
        issues.push(buildIssue(
          HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS.DUPLICATE_FIXTURE_ID,
          `submission.signals[${index}].fixtureId`,
          'Submission can contain one signal row for each fixture.',
        ));
      }
      if (fixtureId) fixtureIds.add(fixtureId);
    });
  }
  return Object.freeze({
    issues: Object.freeze(issues),
    ok: issues.length === 0,
    signalCount: Array.isArray(submission.signals) ? submission.signals.length : 0,
  });
}

/** Binds status-only evaluator output to the exact fixed, redacted study. */
export function validateHeldOutSemanticStudyRetrievalRepresentationSubmissionBinding({
  fixtureDocument,
  snapshotDocument,
  submission,
} = {}) {
  const submissionValidation = validateHeldOutSemanticStudyRetrievalRepresentationSubmission(submission);
  const fixtureValidation = validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument(fixtureDocument);
  const issues = [...submissionValidation.issues];
  if (!submissionValidation.ok || !fixtureValidation.ok || !snapshotDocument) {
    return Object.freeze({ issues: Object.freeze(issues), ok: false });
  }
  if (submission.fixtureDocumentFingerprint !==
      createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument)) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS
        .FIXTURE_DOCUMENT_FINGERPRINT_MISMATCH,
      'submission.fixtureDocumentFingerprint',
      'Submission is not pinned to the redacted fixture document.',
    ));
  }
  if (submission.snapshotDocumentFingerprint !==
      createPolicyCandidateSemanticSnapshotFingerprint(snapshotDocument)) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS
        .SNAPSHOT_DOCUMENT_FINGERPRINT_MISMATCH,
      'submission.snapshotDocumentFingerprint',
      'Submission is not pinned to the fixed retrieval snapshot document.',
    ));
  }
  const expectedFixtureIds = new Set(fixtureDocument.map((fixture) => fixture.id));
  const actualFixtureIds = new Set(submission.signals.map((signal) => signal.fixtureId));
  const exactFixtureSet = actualFixtureIds.size === expectedFixtureIds.size &&
    [...expectedFixtureIds].every((fixtureId) => actualFixtureIds.has(fixtureId));
  if (!exactFixtureSet) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SUBMISSION_RISK_IDS.INCOMPLETE_FIXTURE_SET,
      'submission.signals',
      'Every pinned fixture must have exactly one evaluator signal row.',
    ));
  }
  return Object.freeze({ issues: Object.freeze(issues), ok: issues.length === 0 });
}
