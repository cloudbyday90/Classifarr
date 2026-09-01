/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { CANDIDATE_VIABILITY } from './policyCandidateDiagnostics.mjs';

export const POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_CORPUS_VERSION =
  'policy.candidate_synthetic_replay_fixture_corpus.v1';

export const POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS = Object.freeze({
  DUPLICATE_CANDIDATE_ID: 'duplicate_candidate_id',
  DUPLICATE_FIXTURE_ID: 'duplicate_fixture_id',
  INVALID_CANDIDATE: 'invalid_candidate',
  INVALID_DOCUMENT: 'invalid_document',
  INVALID_EXPECTATION: 'invalid_expectation',
  INVALID_FIXTURE_ID: 'invalid_fixture_id',
  INVALID_VERSION: 'invalid_version',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  UNKNOWN_FIELD: 'unknown_field',
});

const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const MIN_FIXTURES = 6;
const MAX_FIXTURES = 16;
const MAX_CANDIDATES_PER_STATE = 4;
const DOCUMENT_FIELDS = new Set(['version', 'fixtures']);
const FIXTURE_FIELDS = new Set(['id', 'baselineCandidates', 'proposedCandidates', 'expected']);
const CANDIDATE_FIELDS = new Set([
  'candidateId',
  'rawScore',
  'evidenceClass',
  'primaryViability',
  'primaryAnchorEligible',
]);
const EXPECTATION_FIELDS = new Set([
  'baselineActionId',
  'baselineLeadingCandidateId',
  'proposedActionId',
  'proposedLeadingCandidateId',
  'proposedLeadingCalibrationReasonCode',
]);
const ACTION_IDS = new Set(['auto_classify', 'manual', 'prompt_confirm', 'prompt_select']);
const CALIBRATION_REASON_CODES = new Set([
  'broad_compatibility_overlap',
  'compatibility_only',
  'insufficient_specialized_evidence',
  'negative_conflict',
  'no_positive_evidence',
  'profile_only',
  'rag_only',
  'strong_evidence',
]);
const EVIDENCE_CLASS_VIABILITY = Object.freeze({
  identity: new Set([
    CANDIDATE_VIABILITY.IDENTITY_EVIDENCE,
    CANDIDATE_VIABILITY.MULTI_SOURCE_SUPPORT,
  ]),
  multi_source: new Set([CANDIDATE_VIABILITY.MULTI_SOURCE_SUPPORT]),
  compatibility: new Set([CANDIDATE_VIABILITY.COMPATIBILITY_ONLY]),
  broad_compatibility_overlap: new Set([CANDIDATE_VIABILITY.COMPATIBILITY_ONLY]),
  insufficient_specialized_evidence: new Set([CANDIDATE_VIABILITY.COMPATIBILITY_ONLY]),
  profile_only: new Set([CANDIDATE_VIABILITY.PROFILE_ONLY]),
  rag_only: new Set([CANDIDATE_VIABILITY.RAG_IMPROVED]),
  negative_conflict: new Set([
    CANDIDATE_VIABILITY.COMPATIBILITY_ONLY,
    CANDIDATE_VIABILITY.IDENTITY_EVIDENCE,
    CANDIDATE_VIABILITY.MULTI_SOURCE_SUPPORT,
    CANDIDATE_VIABILITY.PROFILE_ONLY,
    CANDIDATE_VIABILITY.RAG_IMPROVED,
  ]),
  none: new Set([CANDIDATE_VIABILITY.NO_POSITIVE_EVIDENCE]),
});

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function buildIssue(riskId, path, message) {
  return Object.freeze({ riskId, path, message });
}

function validateAllowedFields(value, allowedFields, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.INVALID_DOCUMENT,
      path,
      'Value must be a plain JSON object.',
    ));
    return false;
  }

  Object.keys(value).filter(field => !allowedFields.has(field)).forEach((field) => {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.UNKNOWN_FIELD,
      `${path}.${field}`,
      'Unknown fields are not allowed in the fixed synthetic replay corpus.',
    ));
  });
  return true;
}

function validateRequiredFields(value, fields, path, issues) {
  fields.filter(field => !Object.hasOwn(value, field)).forEach((field) => {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.MISSING_REQUIRED_FIELD,
      `${path}.${field}`,
      'Required field is missing from the fixed synthetic replay corpus.',
    ));
  });
}

function isCandidateId(value) {
  return Number.isSafeInteger(value) && value >= 1 && value <= 99;
}

function hasValidCandidate(value) {
  return isCandidateId(value?.candidateId) &&
    Number.isFinite(value?.rawScore) && value.rawScore > 0 && value.rawScore <= 100 &&
    typeof value?.primaryAnchorEligible === 'boolean' &&
    EVIDENCE_CLASS_VIABILITY[value?.evidenceClass]?.has(value?.primaryViability) === true;
}

function validateCandidateSet(value, path, issues) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CANDIDATES_PER_STATE) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.INVALID_CANDIDATE,
      path,
      `Candidate state must contain between one and ${MAX_CANDIDATES_PER_STATE} bounded synthetic candidates.`,
    ));
    return;
  }

  const candidateIds = new Set();
  value.forEach((candidate, index) => {
    const candidatePath = `${path}[${index}]`;
    const isRecord = validateAllowedFields(candidate, CANDIDATE_FIELDS, candidatePath, issues);
    if (!isRecord) return;
    validateRequiredFields(candidate, [...CANDIDATE_FIELDS], candidatePath, issues);
    if (!hasValidCandidate(candidate)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.INVALID_CANDIDATE,
        candidatePath,
        'Synthetic candidates must use an allow-listed evidence/viability pair and bounded opaque values only.',
      ));
    }
    if (isCandidateId(candidate.candidateId) && candidateIds.has(candidate.candidateId)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.DUPLICATE_CANDIDATE_ID,
        `${candidatePath}.candidateId`,
        'Candidate IDs must be unique within one synthetic state.',
      ));
    }
    if (isCandidateId(candidate.candidateId)) candidateIds.add(candidate.candidateId);
  });
}

function containsCandidateId(candidates, candidateId) {
  return Array.isArray(candidates) && candidates.some(candidate => candidate?.candidateId === candidateId);
}

function isExpectedCandidateId(value, candidates) {
  return value === null || (isCandidateId(value) && containsCandidateId(candidates, value));
}

function hasValidExpectation(value, fixture) {
  return ACTION_IDS.has(value?.baselineActionId) && ACTION_IDS.has(value?.proposedActionId) &&
    isExpectedCandidateId(value?.baselineLeadingCandidateId, fixture?.baselineCandidates) &&
    isExpectedCandidateId(value?.proposedLeadingCandidateId, fixture?.proposedCandidates) &&
    (value?.proposedLeadingCalibrationReasonCode === null ||
      CALIBRATION_REASON_CODES.has(value?.proposedLeadingCalibrationReasonCode)) &&
    (value?.proposedLeadingCandidateId !== null ||
      (value?.proposedActionId === 'manual' && value?.proposedLeadingCalibrationReasonCode === null));
}

function validateExpectation(value, fixture, issues) {
  const path = 'fixture.expected';
  if (!validateAllowedFields(value, EXPECTATION_FIELDS, path, issues)) return;
  validateRequiredFields(value, [...EXPECTATION_FIELDS], path, issues);
  if (!hasValidExpectation(value, fixture)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.INVALID_EXPECTATION,
      path,
      'Expectation must be a bounded projection over candidates in its own fixed synthetic states.',
    ));
  }
}

export function validatePolicyCandidateSyntheticReplayFixture(fixture) {
  const issues = [];
  if (!validateAllowedFields(fixture, FIXTURE_FIELDS, 'fixture', issues)) {
    return { ok: false, issues };
  }

  validateRequiredFields(fixture, [...FIXTURE_FIELDS], 'fixture', issues);
  if (typeof fixture.id !== 'string' || !FIXTURE_ID_PATTERN.test(fixture.id)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.INVALID_FIXTURE_ID,
      'fixture.id',
      'Fixture ID must be a stable lower-case identifier.',
    ));
  }
  validateCandidateSet(fixture.baselineCandidates, 'fixture.baselineCandidates', issues);
  validateCandidateSet(fixture.proposedCandidates, 'fixture.proposedCandidates', issues);
  validateExpectation(fixture.expected, fixture, issues);

  return { ok: issues.length === 0, issues };
}

/**
 * Validates only committed, synthetic candidate states. A corpus never admits
 * media, library names, policy text, thresholds, provider data, RAG text,
 * prompts, responses, or any live identifiers.
 */
export function validatePolicyCandidateSyntheticReplayFixtureCorpus(document) {
  const issues = [];
  if (!validateAllowedFields(document, DOCUMENT_FIELDS, 'corpus', issues)) {
    return { ok: false, fixtureCount: 0, issues };
  }

  validateRequiredFields(document, [...DOCUMENT_FIELDS], 'corpus', issues);
  if (document.version !== POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_CORPUS_VERSION) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.INVALID_VERSION,
      'corpus.version',
      'Corpus version does not match the fixed synthetic replay contract.',
    ));
  }

  if (!Array.isArray(document.fixtures) || document.fixtures.length < MIN_FIXTURES ||
      document.fixtures.length > MAX_FIXTURES) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.INVALID_DOCUMENT,
      'corpus.fixtures',
      `Corpus must contain between ${MIN_FIXTURES} and ${MAX_FIXTURES} synthetic fixtures.`,
    ));
    return { ok: false, fixtureCount: 0, issues };
  }

  const fixtureIds = new Set();
  document.fixtures.forEach((fixture, index) => {
    const validation = validatePolicyCandidateSyntheticReplayFixture(fixture);
    validation.issues.forEach((issue) => {
      const relativePath = issue.path.replace(/^fixture\.?/u, '');
      issues.push(buildIssue(
        issue.riskId,
        `corpus.fixtures[${index}]${relativePath ? `.${relativePath}` : ''}`,
        issue.message,
      ));
    });
    if (typeof fixture?.id === 'string' && FIXTURE_ID_PATTERN.test(fixture.id) && fixtureIds.has(fixture.id)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SYNTHETIC_REPLAY_FIXTURE_RISK_IDS.DUPLICATE_FIXTURE_ID,
        `corpus.fixtures[${index}].id`,
        'Fixture IDs must be unique within one synthetic corpus.',
      ));
    }
    if (typeof fixture?.id === 'string' && FIXTURE_ID_PATTERN.test(fixture.id)) fixtureIds.add(fixture.id);
  });

  return { ok: issues.length === 0, fixtureCount: document.fixtures.length, issues };
}
