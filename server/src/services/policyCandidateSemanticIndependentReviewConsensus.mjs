/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
} from './policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_CONSENSUS_STATUS_IDS,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS,
  validatePolicyCandidateSemanticReferenceSetDocument,
} from './policyCandidateSemanticReferenceSetContract.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from './policyCandidateSemanticSnapshotFingerprint.mjs';

export const POLICY_CANDIDATE_SEMANTIC_REVIEWER_SUBMISSION_VERSION =
  'policy.candidate_semantic_reviewer_submission.v1';

export const POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_VERSION =
  'policy.candidate_semantic_independent_review_consensus.v1';

export const POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS = Object.freeze({
  ADJUDICATION_REQUIRED: 'adjudication_required',
  COMPLETE: 'complete',
  INVALID: 'invalid',
});

const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const REFERENCE_SET_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/u;
const SUBMISSION_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/u;
const VALID_DECISIONS = new Set(Object.values(
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
));

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareIdentifiers(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function buildAuthority() {
  return Object.freeze({
    automaticActions: Object.freeze({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      retry: false,
      routing: false,
    }),
    scope: 'offline_independent_review_consensus_only',
  });
}

function buildValidationIssue(path, message) {
  return Object.freeze({ path, message });
}

function hasOnlyKeys(value, allowedKeys, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildValidationIssue(path, 'Value must be a plain JSON object.'));
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push(buildValidationIssue(`${path}.${key}`, 'Field is not allowed.'));
    }
  }
  return true;
}

function requireOwnField(value, key, path, issues) {
  if (Object.hasOwn(value, key)) return true;
  issues.push(buildValidationIssue(`${path}.${key}`, 'Field is required.'));
  return false;
}

function validateIdentifier(value, path, pattern, issues) {
  if (typeof value === 'string' && pattern.test(value)) return true;
  issues.push(buildValidationIssue(path, 'Value must be a bounded lower-case identifier.'));
  return false;
}

function validateReviewLabel(value, index, issues) {
  const path = `submission.labels[${index}]`;
  if (!hasOnlyKeys(value, ['fixtureId', 'referenceDecisionId'], path, issues)) return null;
  const hasFixtureId = requireOwnField(value, 'fixtureId', path, issues);
  const hasReferenceDecisionId = requireOwnField(value, 'referenceDecisionId', path, issues);
  const fixtureId = hasFixtureId && validateIdentifier(value.fixtureId, `${path}.fixtureId`, FIXTURE_ID_PATTERN, issues)
    ? value.fixtureId
    : null;
  if (hasReferenceDecisionId && !VALID_DECISIONS.has(value.referenceDecisionId)) {
    issues.push(buildValidationIssue(
      `${path}.referenceDecisionId`,
      'Reference decision must be admit, review, or abstain.',
    ));
  }
  return fixtureId;
}

/**
 * Validates a single redacted reviewer submission. It deliberately omits
 * reviewer identity, case text, candidate names, library data, and free text;
 * operational reviewer separation is an external control, not an assertion
 * this contract can prove.
 */
export function validatePolicyCandidateSemanticReviewerSubmission(submission) {
  const issues = [];
  if (!isPlainRecord(submission)) {
    return Object.freeze({
      fixtureCount: 0,
      ok: false,
      issues: Object.freeze([buildValidationIssue('submission', 'Submission must be a plain JSON object.')]),
    });
  }

  hasOnlyKeys(submission, [
    'fixtureDocumentFingerprint',
    'labels',
    'submissionId',
    'version',
  ], 'submission', issues);
  const hasVersion = requireOwnField(submission, 'version', 'submission', issues);
  const hasSubmissionId = requireOwnField(submission, 'submissionId', 'submission', issues);
  const hasFixtureDocumentFingerprint = requireOwnField(
    submission,
    'fixtureDocumentFingerprint',
    'submission',
    issues,
  );
  const hasLabels = requireOwnField(submission, 'labels', 'submission', issues);

  if (hasVersion && submission.version !== POLICY_CANDIDATE_SEMANTIC_REVIEWER_SUBMISSION_VERSION) {
    issues.push(buildValidationIssue('submission.version', 'Submission declares an unsupported version.'));
  }
  if (hasSubmissionId) {
    validateIdentifier(submission.submissionId, 'submission.submissionId', SUBMISSION_ID_PATTERN, issues);
  }
  if (hasFixtureDocumentFingerprint && (
    typeof submission.fixtureDocumentFingerprint !== 'string' ||
    !FINGERPRINT_PATTERN.test(submission.fixtureDocumentFingerprint)
  )) {
    issues.push(buildValidationIssue(
      'submission.fixtureDocumentFingerprint',
      'Fixture document fingerprint must be a SHA-256 content address.',
    ));
  }

  const fixtureIds = new Set();
  if (!hasLabels || !Array.isArray(submission.labels) ||
      submission.labels.length === 0 || submission.labels.length > 32) {
    issues.push(buildValidationIssue('submission.labels', 'Submission must contain between one and 32 labels.'));
  } else {
    submission.labels.forEach((label, index) => {
      const fixtureId = validateReviewLabel(label, index, issues);
      if (!fixtureId) return;
      if (fixtureIds.has(fixtureId)) {
        issues.push(buildValidationIssue(
          `submission.labels[${index}].fixtureId`,
          'Each fixture may have one decision per reviewer submission.',
        ));
      }
      fixtureIds.add(fixtureId);
    });
  }

  return Object.freeze({
    fixtureCount: Array.isArray(submission.labels) ? submission.labels.length : 0,
    ok: issues.length === 0,
    issues: Object.freeze(issues),
  });
}

function asDecisionMap(submission) {
  return new Map(submission.labels.map((label) => [label.fixtureId, label.referenceDecisionId]));
}

function sameFixtureSet(first, second) {
  return first.size === second.size && Array.from(first.keys()).every((fixtureId) => second.has(fixtureId));
}

function buildSummary({ fixtureCount = 0, disagreementCount = 0, adjudicatedCount = 0 } = {}) {
  return Object.freeze({
    adjudicatedFixtureCount: adjudicatedCount,
    disagreementFixtureCount: disagreementCount,
    fixtureCount,
    unanimousFixtureCount: fixtureCount - disagreementCount,
  });
}

function invalidResult() {
  return Object.freeze({
    authority: buildAuthority(),
    referenceSetDocument: null,
    referenceSetFingerprint: null,
    status: Object.freeze({ id: POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.INVALID }),
    summary: buildSummary(),
    version: POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_VERSION,
  });
}

function identifiersAreDistinct(submissions) {
  const identifiers = submissions.map((submission) => submission.submissionId);
  return new Set(identifiers).size === identifiers.length;
}

function completeReferenceSet({
  adjudicationDecisions,
  firstDecisions,
  fixtureDocumentFingerprint,
  secondDecisions,
  referenceSetId,
}) {
  const labels = Array.from(firstDecisions.keys()).sort(compareIdentifiers).map((fixtureId) => {
    const firstDecision = firstDecisions.get(fixtureId);
    const secondDecision = secondDecisions.get(fixtureId);
    const disputed = firstDecision !== secondDecision;
    return Object.freeze({
      consensusStatusId: disputed
        ? POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_CONSENSUS_STATUS_IDS.ADJUDICATED
        : POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_CONSENSUS_STATUS_IDS.UNANIMOUS,
      fixtureId,
      referenceDecisionId: disputed ? adjudicationDecisions.get(fixtureId) : firstDecision,
      reviewerCount: disputed ? 3 : 2,
    });
  });
  return Object.freeze({
    fixtureDocumentFingerprint,
    labelingProtocolId: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS
      .INDEPENDENT_DOUBLE_BLIND_HUMAN,
    labels: Object.freeze(labels),
    referenceSetId,
    version: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  });
}

/**
 * Composes two separately supplied redacted reviews and, only where needed,
 * one adjudication into the existing content-free reference-set format. It is
 * deterministic and in-memory: callers own protected review packets and may
 * choose whether to persist the returned final document.
 */
export function composePolicyCandidateSemanticIndependentReviewConsensus({
  adjudicationSubmission = null,
  referenceSetId,
  reviewerOneSubmission,
  reviewerTwoSubmission,
} = {}) {
  const reviewerOneValidation = validatePolicyCandidateSemanticReviewerSubmission(reviewerOneSubmission);
  const reviewerTwoValidation = validatePolicyCandidateSemanticReviewerSubmission(reviewerTwoSubmission);
  if (!reviewerOneValidation.ok || !reviewerTwoValidation.ok ||
      reviewerOneSubmission.fixtureDocumentFingerprint !== reviewerTwoSubmission.fixtureDocumentFingerprint ||
      !identifiersAreDistinct([reviewerOneSubmission, reviewerTwoSubmission])) {
    return invalidResult();
  }

  const firstDecisions = asDecisionMap(reviewerOneSubmission);
  const secondDecisions = asDecisionMap(reviewerTwoSubmission);
  if (!sameFixtureSet(firstDecisions, secondDecisions) ||
      typeof referenceSetId !== 'string' || !REFERENCE_SET_ID_PATTERN.test(referenceSetId)) {
    return invalidResult();
  }

  const disputedFixtureIds = Array.from(firstDecisions.keys())
    .filter((fixtureId) => firstDecisions.get(fixtureId) !== secondDecisions.get(fixtureId))
    .sort(compareIdentifiers);
  const summary = buildSummary({
    fixtureCount: firstDecisions.size,
    disagreementCount: disputedFixtureIds.length,
    adjudicatedCount: disputedFixtureIds.length,
  });

  if (disputedFixtureIds.length === 0 && adjudicationSubmission !== null) return invalidResult();
  if (disputedFixtureIds.length > 0 && adjudicationSubmission === null) {
    return Object.freeze({
      authority: buildAuthority(),
      referenceSetDocument: null,
      referenceSetFingerprint: null,
      status: Object.freeze({
        id: POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.ADJUDICATION_REQUIRED,
      }),
      summary,
      version: POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_VERSION,
    });
  }

  let adjudicationDecisions = new Map();
  if (adjudicationSubmission !== null) {
    const adjudicationValidation = validatePolicyCandidateSemanticReviewerSubmission(adjudicationSubmission);
    if (!adjudicationValidation.ok ||
        adjudicationSubmission.fixtureDocumentFingerprint !== reviewerOneSubmission.fixtureDocumentFingerprint ||
        !identifiersAreDistinct([
          reviewerOneSubmission,
          reviewerTwoSubmission,
          adjudicationSubmission,
        ])) {
      return invalidResult();
    }
    adjudicationDecisions = asDecisionMap(adjudicationSubmission);
    const adjudicatedFixtureIds = Array.from(adjudicationDecisions.keys()).sort(compareIdentifiers);
    if (adjudicatedFixtureIds.length !== disputedFixtureIds.length ||
        adjudicatedFixtureIds.some((fixtureId, index) => fixtureId !== disputedFixtureIds[index])) {
      return invalidResult();
    }
  }

  const referenceSetDocument = completeReferenceSet({
    adjudicationDecisions,
    firstDecisions,
    fixtureDocumentFingerprint: reviewerOneSubmission.fixtureDocumentFingerprint,
    secondDecisions,
    referenceSetId,
  });
  if (!validatePolicyCandidateSemanticReferenceSetDocument(referenceSetDocument).ok) return invalidResult();

  return Object.freeze({
    authority: buildAuthority(),
    referenceSetDocument,
    referenceSetFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(referenceSetDocument),
    status: Object.freeze({ id: POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.COMPLETE }),
    summary,
    version: POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_VERSION,
  });
}
