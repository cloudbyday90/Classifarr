/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_DECISION_BAND_IDS,
} from './policyCandidateDecisionBand.mjs';
import {
  matchesPolicyCandidateDecisionBandSpecification,
  POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION_VERSION,
} from './policyCandidateDecisionBandSpecification.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_CORPUS_VERSION =
  'policy.candidate_correction_policy_change_calibration_band_fixture_corpus.v1';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS = Object.freeze({
  DUPLICATE_FIXTURE_ID: 'duplicate_fixture_id',
  INVALID_DOCUMENT: 'invalid_document',
  INVALID_EXPECTATION: 'invalid_expectation',
  INVALID_FIXTURE_ID: 'invalid_fixture_id',
  INVALID_SCORE: 'invalid_score',
  INVALID_SPECIFICATION: 'invalid_specification',
  INVALID_VERSION: 'invalid_version',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  UNKNOWN_FIELD: 'unknown_field',
});

const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const MAX_FIXTURES = 16;
const MIN_FIXTURES = 8;
const DOCUMENT_FIELDS = new Set(['version', 'specification', 'fixtures']);
const SPECIFICATION_FIELDS = new Set([
  'version',
  'selectionMinimum',
  'confirmationMinimum',
  'automaticMinimum',
]);
const FIXTURE_FIELDS = new Set(['id', 'score', 'expected']);
const EXPECTATION_FIELDS = new Set(['bandId', 'action']);
const EXPECTED_ACTIONS = Object.freeze({
  [POLICY_CANDIDATE_DECISION_BAND_IDS.AUTOMATIC_CANDIDATE]: 'auto_classify',
  [POLICY_CANDIDATE_DECISION_BAND_IDS.MANUAL_REVIEW]: 'manual',
  [POLICY_CANDIDATE_DECISION_BAND_IDS.OPERATOR_CONFIRMATION]: 'prompt_confirm',
  [POLICY_CANDIDATE_DECISION_BAND_IDS.OPERATOR_SELECTION]: 'prompt_select',
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
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.INVALID_DOCUMENT,
      path,
      'Value must be a plain object.',
    ));
    return false;
  }

  Object.keys(value).filter(field => !allowedFields.has(field)).forEach((field) => {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.UNKNOWN_FIELD,
      `${path}.${field}`,
      'Unknown fields are not allowed in the fixed-band corpus.',
    ));
  });
  return true;
}

function validateRequiredFields(value, fields, path, issues) {
  fields.filter(field => !(field in value)).forEach((field) => {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.MISSING_REQUIRED_FIELD,
      `${path}.${field}`,
      'Required field is missing.',
    ));
  });
}

export function validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixture(fixture) {
  const issues = [];
  if (!validateAllowedFields(fixture, FIXTURE_FIELDS, 'fixture', issues)) {
    return { ok: false, issues };
  }

  validateRequiredFields(fixture, ['id', 'score', 'expected'], 'fixture', issues);
  if (typeof fixture.id !== 'string' || !FIXTURE_ID_PATTERN.test(fixture.id)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.INVALID_FIXTURE_ID,
      'fixture.id',
      'Fixture ID must be a stable lowercase identifier.',
    ));
  }
  if (!Number.isSafeInteger(fixture.score) || fixture.score < 0 || fixture.score > 100) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.INVALID_SCORE,
      'fixture.score',
      'Synthetic score must be a whole number from 0 through 100.',
    ));
  }

  if (!validateAllowedFields(fixture.expected, EXPECTATION_FIELDS, 'fixture.expected', issues)) {
    return { ok: false, issues };
  }
  validateRequiredFields(fixture.expected, ['bandId', 'action'], 'fixture.expected', issues);
  if (EXPECTED_ACTIONS[fixture.expected.bandId] !== fixture.expected.action) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.INVALID_EXPECTATION,
      'fixture.expected',
      'Expected band ID and action must be one fixed, matching pair.',
    ));
  }

  return { ok: issues.length === 0, issues };
}

export function validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixtureCorpus(document) {
  const issues = [];
  if (!validateAllowedFields(document, DOCUMENT_FIELDS, 'corpus', issues)) {
    return { ok: false, fixtureCount: 0, issues };
  }

  validateRequiredFields(document, ['version', 'specification', 'fixtures'], 'corpus', issues);
  if (document.version !== POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_CORPUS_VERSION) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.INVALID_VERSION,
      'corpus.version',
      'Corpus version does not match the fixed-band contract.',
    ));
  }

  if (validateAllowedFields(document.specification, SPECIFICATION_FIELDS, 'corpus.specification', issues)) {
    validateRequiredFields(
      document.specification,
      ['version', 'selectionMinimum', 'confirmationMinimum', 'automaticMinimum'],
      'corpus.specification',
      issues,
    );
    if (document.specification?.version !== POLICY_CANDIDATE_DECISION_BAND_SPECIFICATION_VERSION ||
        !matchesPolicyCandidateDecisionBandSpecification(document.specification)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.INVALID_SPECIFICATION,
        'corpus.specification',
        'Corpus must pin the current versioned fixed-band specification exactly.',
      ));
    }
  }

  if (!Array.isArray(document.fixtures) || document.fixtures.length < MIN_FIXTURES || document.fixtures.length > MAX_FIXTURES) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.INVALID_DOCUMENT,
      'corpus.fixtures',
      `Corpus must contain between ${MIN_FIXTURES} and ${MAX_FIXTURES} synthetic fixtures.`,
    ));
    return { ok: false, fixtureCount: 0, issues };
  }

  const ids = new Set();
  document.fixtures.forEach((fixture, index) => {
    const validation = validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationBandFixture(fixture);
    validation.issues.forEach((issue) => {
      const relativePath = issue.path.replace(/^fixture\.?/u, '');
      issues.push(buildIssue(issue.riskId, `corpus.fixtures[${index}]${relativePath ? `.${relativePath}` : ''}`, issue.message));
    });
    const fixtureIdIsValid = typeof fixture?.id === 'string' && FIXTURE_ID_PATTERN.test(fixture.id);
    if (fixtureIdIsValid && ids.has(fixture.id)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_BAND_FIXTURE_RISK_IDS.DUPLICATE_FIXTURE_ID,
        `corpus.fixtures[${index}].id`,
        'Fixture IDs must be unique within one synthetic corpus.',
      ));
    }
    if (fixtureIdIsValid) ids.add(fixture.id);
  });

  return { ok: issues.length === 0, fixtureCount: document.fixtures.length, issues };
}
