/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_PROCEDURE_IDS,
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_STATUS_IDS,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolContract.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessContract.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS,
} from './policyCandidateCorrectionPolicyChangeReviewHistoryConsistencyContract.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_CORPUS_VERSION =
  'policy.candidate_correction_policy_change_calibration_fixture_corpus.v1';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS = Object.freeze({
  DUPLICATE_FIXTURE_ID: 'duplicate_fixture_id',
  INVALID_AUTHORITY: 'invalid_authority',
  INVALID_DOCUMENT: 'invalid_document',
  INVALID_EXPECTATION: 'invalid_expectation',
  INVALID_FIXTURE_ID: 'invalid_fixture_id',
  INVALID_STATUS: 'invalid_status',
  INVALID_VERSION: 'invalid_version',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  UNKNOWN_FIELD: 'unknown_field',
});

const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const MAX_FIXTURES = 16;
const READINESS_ELIGIBILITY = Object.freeze({
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS.COLLECTING_PERIODS]: false,
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS.INSUFFICIENT_ACTIVITY]: false,
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_STATUS_IDS.READY_FOR_HUMAN_REVIEW]: true,
});
const CONSISTENCY_AVAILABILITY = Object.freeze({
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.COLLECTING]: false,
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.INSUFFICIENT_ACTIVITY]: false,
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.CONSISTENT]: true,
  [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CONSISTENCY_STATUS_IDS.SHIFTED]: true,
});
const PROTOCOL_STATUS_IDS = new Set(Object.values(
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_STATUS_IDS,
));

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
    POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.MISSING_REQUIRED_FIELD,
    `${path}.${key}`,
    'Field is required by the synthetic calibration-fixture contract.',
  ));
  return false;
}

function validateOnlyKeys(value, allowedKeys, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.INVALID_DOCUMENT,
      path,
      'Value must be a plain JSON object.',
    ));
    return false;
  }

  Object.keys(value).forEach((key) => {
    if (!allowedKeys.includes(key)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.UNKNOWN_FIELD,
        `${path}.${key}`,
        'Field is not allowed by the synthetic calibration-fixture contract.',
      ));
    }
  });
  return true;
}

function hasNoAutomaticAuthority(value) {
  return value?.automaticPolicyChange === false && value?.automaticAiRagTuning === false &&
    value?.routingChanged === false;
}

function validateReadiness(value, issues) {
  const path = 'fixture.protocolInput.calibrationReadiness';
  if (!validateOnlyKeys(value, [
    'automaticAiRagTuning',
    'automaticPolicyChange',
    'reviewEligible',
    'routingChanged',
    'statusId',
  ], path, issues)) return;

  ['automaticAiRagTuning', 'automaticPolicyChange', 'reviewEligible', 'routingChanged', 'statusId']
    .forEach(key => requireOwnField(value, key, path, issues));
  if (!Object.hasOwn(READINESS_ELIGIBILITY, value.statusId) ||
      value.reviewEligible !== READINESS_ELIGIBILITY[value.statusId]) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.INVALID_STATUS,
      `${path}.statusId`,
      'Readiness status and review eligibility must be one supported aggregate combination.',
    ));
  }
  if (!hasNoAutomaticAuthority(value)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.INVALID_AUTHORITY,
      path,
      'Synthetic fixtures must explicitly deny automatic policy, AI/RAG, and routing authority.',
    ));
  }
}

function validateConsistency(value, issues) {
  const path = 'fixture.protocolInput.consistency';
  if (!validateOnlyKeys(value, [
    'automaticAiRagTuning',
    'automaticPolicyChange',
    'comparisonAvailable',
    'routingChanged',
    'statusId',
  ], path, issues)) return;

  ['automaticAiRagTuning', 'automaticPolicyChange', 'comparisonAvailable', 'routingChanged', 'statusId']
    .forEach(key => requireOwnField(value, key, path, issues));
  if (!Object.hasOwn(CONSISTENCY_AVAILABILITY, value.statusId) ||
      value.comparisonAvailable !== CONSISTENCY_AVAILABILITY[value.statusId]) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.INVALID_STATUS,
      `${path}.statusId`,
      'Consistency status and comparison availability must be one supported aggregate combination.',
    ));
  }
  if (!hasNoAutomaticAuthority(value)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.INVALID_AUTHORITY,
      path,
      'Synthetic fixtures must explicitly deny automatic policy, AI/RAG, and routing authority.',
    ));
  }
}

function validateProtocolInput(value, issues) {
  const path = 'fixture.protocolInput';
  if (!validateOnlyKeys(value, ['calibrationReadiness', 'consistency'], path, issues)) return;
  if (requireOwnField(value, 'calibrationReadiness', path, issues)) {
    validateReadiness(value.calibrationReadiness, issues);
  }
  if (requireOwnField(value, 'consistency', path, issues)) {
    validateConsistency(value.consistency, issues);
  }
}

function hasExpectedProcedureIds(value) {
  const expectedProcedureIds = value.protocolAvailable
    ? POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_PROCEDURE_IDS
    : [];
  return Array.isArray(value.procedureIds) && value.procedureIds.length === expectedProcedureIds.length &&
    value.procedureIds.every((procedureId, index) => procedureId === expectedProcedureIds[index]);
}

function validateExpectation(value, issues) {
  const path = 'fixture.expected';
  if (!validateOnlyKeys(value, ['procedureIds', 'protocolAvailable', 'statusId'], path, issues)) return;
  ['procedureIds', 'protocolAvailable', 'statusId'].forEach(key => requireOwnField(value, key, path, issues));

  if (!PROTOCOL_STATUS_IDS.has(value.statusId) || typeof value.protocolAvailable !== 'boolean' ||
      !hasExpectedProcedureIds(value)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.INVALID_EXPECTATION,
      path,
      'Expectation must use an exact supported protocol status, availability flag, and fixed procedure list.',
    ));
  }
}

export function validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixture(fixture) {
  const issues = [];
  if (!isPlainRecord(fixture)) {
    return {
      ok: false,
      issues: [buildIssue(
        POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.INVALID_DOCUMENT,
        'fixture',
        'Fixture must be a plain JSON object.',
      )],
    };
  }

  validateOnlyKeys(fixture, ['expected', 'id', 'protocolInput'], 'fixture', issues);
  const hasId = requireOwnField(fixture, 'id', 'fixture', issues);
  const hasProtocolInput = requireOwnField(fixture, 'protocolInput', 'fixture', issues);
  const hasExpected = requireOwnField(fixture, 'expected', 'fixture', issues);

  if (hasId && (typeof fixture.id !== 'string' || !FIXTURE_ID_PATTERN.test(fixture.id))) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.INVALID_FIXTURE_ID,
      'fixture.id',
      'Fixture ID must be a bounded lower-case identifier.',
    ));
  }
  if (hasProtocolInput) validateProtocolInput(fixture.protocolInput, issues);
  if (hasExpected) validateExpectation(fixture.expected, issues);

  return { ok: issues.length === 0, issues };
}

/**
 * Validates a committed, synthetic-only corpus. The corpus represents fixed
 * aggregate status combinations, never a policy, score, threshold, media item,
 * library, AI/RAG input, provider response, or operator action.
 */
export function validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixtureCorpus(document) {
  const issues = [];
  if (!validateOnlyKeys(document, ['fixtures', 'version'], 'corpus', issues)) {
    return { ok: false, fixtureCount: 0, issues };
  }

  const hasVersion = requireOwnField(document, 'version', 'corpus', issues);
  const hasFixtures = requireOwnField(document, 'fixtures', 'corpus', issues);
  if (hasVersion && document.version !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_CORPUS_VERSION) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.INVALID_VERSION,
      'corpus.version',
      'Corpus must declare the current calibration-fixture version.',
    ));
  }
  if (!hasFixtures || !Array.isArray(document.fixtures) || document.fixtures.length < 3 ||
      document.fixtures.length > MAX_FIXTURES) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.INVALID_DOCUMENT,
      'corpus.fixtures',
      `Corpus must contain between three and ${MAX_FIXTURES} synthetic fixtures.`,
    ));
    return { ok: false, fixtureCount: 0, issues };
  }

  const ids = new Set();
  document.fixtures.forEach((fixture, index) => {
    const validation = validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationFixture(fixture);
    validation.issues.forEach((issue) => {
      const relativePath = issue.path.replace(/^fixture\.?/u, '');
      issues.push(buildIssue(issue.riskId, `corpus.fixtures[${index}]${relativePath ? `.${relativePath}` : ''}`, issue.message));
    });
    if (validation.ok && ids.has(fixture.id)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_FIXTURE_RISK_IDS.DUPLICATE_FIXTURE_ID,
        `corpus.fixtures[${index}].id`,
        'Fixture IDs must be unique within one synthetic corpus.',
      ));
    }
    if (validation.ok) ids.add(fixture.id);
  });

  return { ok: issues.length === 0, fixtureCount: document.fixtures.length, issues };
}
