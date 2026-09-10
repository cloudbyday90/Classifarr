/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { randomBytes } from 'node:crypto';

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
} from './policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REVIEWER_SUBMISSION_VERSION,
  validatePolicyCandidateSemanticReviewerSubmission,
} from './policyCandidateSemanticIndependentReviewConsensus.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_VERSION,
} from './heldOutSemanticStudyReviewerPacket.mjs';

export const HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_TEMPLATE_VERSION =
  'policy.held_out_semantic_study_reviewer_submission_template.v1';

const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const SUBMISSION_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/u;
const MIN_CASES = 24;
const MAX_CASES = 32;
const VALID_DECISION_IDS = new Set(Object.values(
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
));

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value, keys) {
  return isPlainRecord(value) && Object.keys(value).every((key) => keys.includes(key));
}

function hasExactlyKeys(value, keys) {
  return hasOnlyKeys(value, keys) && keys.every((key) => Object.hasOwn(value, key));
}

function canonicalTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function projectPacket(packet, { now = null, requireCurrent = false } = {}) {
  if (!hasExactlyKeys(packet, [
    'cases',
    'fixtureDocumentFingerprint',
    'instructions',
    'packetId',
    'studyWindow',
    'version',
  ]) || packet.version !== HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_VERSION ||
      typeof packet.fixtureDocumentFingerprint !== 'string' ||
      !FINGERPRINT_PATTERN.test(packet.fixtureDocumentFingerprint) ||
      !hasExactlyKeys(packet.studyWindow, ['expiresAt', 'startsAt'])) return null;

  const startsAt = canonicalTimestamp(packet.studyWindow.startsAt);
  const expiresAt = canonicalTimestamp(packet.studyWindow.expiresAt);
  if (!startsAt || !expiresAt || startsAt >= expiresAt) return null;
  if (requireCurrent) {
    const current = canonicalTimestamp(now);
    if (!current || startsAt > current || current >= expiresAt) return null;
  }
  if (!Array.isArray(packet.cases) || packet.cases.length < MIN_CASES || packet.cases.length > MAX_CASES) return null;

  const fixtureIds = [];
  const knownFixtureIds = new Set();
  for (const studyCase of packet.cases) {
    if (!isPlainRecord(studyCase) || typeof studyCase.fixtureId !== 'string' ||
        !FIXTURE_ID_PATTERN.test(studyCase.fixtureId) || knownFixtureIds.has(studyCase.fixtureId)) return null;
    knownFixtureIds.add(studyCase.fixtureId);
    fixtureIds.push(studyCase.fixtureId);
  }
  return Object.freeze({
    expiresAt,
    fixtureDocumentFingerprint: packet.fixtureDocumentFingerprint,
    fixtureIds: Object.freeze(fixtureIds),
  });
}

/**
 * Returns the redacted binding of a structurally valid reviewer packet. It
 * intentionally permits an expired packet because finalized submissions have
 * already proved their review-time expiry boundary; consensus only needs to
 * prove that their fixture set belongs to the same packet.
 */
export function getHeldOutSemanticStudyReviewerPacketBinding({ packet } = {}) {
  return projectPacket(packet);
}

function buildSubmissionId(random) {
  const entropy = random(16);
  return Buffer.isBuffer(entropy) && entropy.length === 16
    ? `review_submission_${entropy.toString('hex')}`
    : null;
}

function projectTemplate(template, packet, { requireCompleteLabels = false } = {}) {
  if (!hasExactlyKeys(template, [
    'fixtureDocumentFingerprint',
    'labels',
    'studyWindow',
    'submissionId',
    'version',
  ]) || template.version !== HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_TEMPLATE_VERSION ||
      template.fixtureDocumentFingerprint !== packet.fixtureDocumentFingerprint ||
      !hasExactlyKeys(template.studyWindow, ['expiresAt']) ||
      canonicalTimestamp(template.studyWindow.expiresAt) !== packet.expiresAt ||
      typeof template.submissionId !== 'string' || !SUBMISSION_ID_PATTERN.test(template.submissionId) ||
      !Array.isArray(template.labels) || template.labels.length !== packet.fixtureIds.length) return null;

  const expectedFixtureIds = new Set(packet.fixtureIds);
  const labels = [];
  for (const label of template.labels) {
    if (!hasExactlyKeys(label, ['fixtureId', 'referenceDecisionId']) ||
        typeof label.fixtureId !== 'string' || !expectedFixtureIds.delete(label.fixtureId)) return null;
    if (requireCompleteLabels && !VALID_DECISION_IDS.has(label.referenceDecisionId)) return null;
    if (!requireCompleteLabels && label.referenceDecisionId !== null &&
        !VALID_DECISION_IDS.has(label.referenceDecisionId)) return null;
    labels.push(Object.freeze({
      fixtureId: label.fixtureId,
      referenceDecisionId: label.referenceDecisionId,
    }));
  }
  return expectedFixtureIds.size === 0
    ? Object.freeze({ labels: Object.freeze(labels), submissionId: template.submissionId })
    : null;
}

/**
 * Produces a deliberately incomplete, content-free worksheet for one reviewer.
 * It preserves only the opaque fixture binding and review window; source media,
 * policies, model output, and current placement remain in the private packet.
 */
export function buildHeldOutSemanticStudyReviewerSubmissionTemplate({
  now = new Date(),
  packet,
  random = randomBytes,
} = {}) {
  const projectedPacket = projectPacket(packet, { now, requireCurrent: true });
  const submissionId = buildSubmissionId(random);
  if (!projectedPacket || !submissionId) return null;
  return Object.freeze({
    fixtureDocumentFingerprint: projectedPacket.fixtureDocumentFingerprint,
    labels: Object.freeze(projectedPacket.fixtureIds.map((fixtureId) => Object.freeze({
      fixtureId,
      referenceDecisionId: null,
    }))),
    studyWindow: Object.freeze({ expiresAt: projectedPacket.expiresAt }),
    submissionId,
    version: HELD_OUT_SEMANTIC_STUDY_REVIEWER_SUBMISSION_TEMPLATE_VERSION,
  });
}

/**
 * Converts a completed worksheet to the existing strict reviewer-submission
 * contract only while the original packet remains current and bound.
 */
export function finalizeHeldOutSemanticStudyReviewerSubmission({
  now = new Date(),
  packet,
  template,
} = {}) {
  const projectedPacket = projectPacket(packet, { now, requireCurrent: true });
  const projectedTemplate = projectedPacket
    ? projectTemplate(template, projectedPacket, { requireCompleteLabels: true })
    : null;
  if (!projectedTemplate) return null;

  const submission = Object.freeze({
    fixtureDocumentFingerprint: projectedPacket.fixtureDocumentFingerprint,
    labels: projectedTemplate.labels,
    submissionId: projectedTemplate.submissionId,
    version: POLICY_CANDIDATE_SEMANTIC_REVIEWER_SUBMISSION_VERSION,
  });
  return validatePolicyCandidateSemanticReviewerSubmission(submission).ok ? submission : null;
}
