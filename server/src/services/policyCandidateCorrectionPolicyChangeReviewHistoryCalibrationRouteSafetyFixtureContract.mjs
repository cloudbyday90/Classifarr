/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CLASSIFICATION_ROUTE_SAFETY_GATE_IDS,
} from './classificationRouteSafetyGate.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_CORPUS_VERSION =
  'policy.candidate_correction_policy_change_calibration_route_safety_fixture_corpus.v1';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS = Object.freeze({
  DUPLICATE_FIXTURE_ID: 'duplicate_fixture_id',
  INVALID_DOCUMENT: 'invalid_document',
  INVALID_EXPECTATION: 'invalid_expectation',
  INVALID_FIXTURE_ID: 'invalid_fixture_id',
  INVALID_SCENARIO: 'invalid_scenario',
  INVALID_VERSION: 'invalid_version',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  UNKNOWN_FIELD: 'unknown_field',
});

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_PROVENANCE_IDS = Object.freeze({
  CURRENT: 'current',
  MISMATCHED_LIBRARY: 'mismatched_library',
});

const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const MIN_FIXTURES = 9;
const MAX_FIXTURES = 16;
const DOCUMENT_FIELDS = new Set(['version', 'fixtures']);
const FIXTURE_FIELDS = new Set(['id', 'scenario', 'expected']);
const SCENARIO_FIELDS = new Set([
  'providerRecoveryReviewRequired',
  'manualEvidenceReviewRequired',
  'aiAdvisory',
  'policyAutoProvenance',
  'requireAllConfirmations',
  'fallbackResult',
  'lowConfidence',
  'clarificationRequested',
]);
const EXPECTATION_FIELDS = new Set([
  'automaticRouteAllowed',
  'primaryGateId',
  'blockingGateIds',
]);
const VALID_GATE_IDS = new Set(Object.values(CLASSIFICATION_ROUTE_SAFETY_GATE_IDS));
const VALID_PROVENANCE_IDS = new Set(
  Object.values(POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_PROVENANCE_IDS),
);

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
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.INVALID_DOCUMENT,
      path,
      'Value must be a plain object.',
    ));
    return false;
  }

  Object.keys(value).filter(field => !allowedFields.has(field)).forEach((field) => {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.UNKNOWN_FIELD,
      `${path}.${field}`,
      'Unknown fields are not allowed in the fixed route-safety corpus.',
    ));
  });
  return true;
}

function validateRequiredFields(value, fields, path, issues) {
  fields.filter(field => !(field in value)).forEach((field) => {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.MISSING_REQUIRED_FIELD,
      `${path}.${field}`,
      'Required field is missing.',
    ));
  });
}

function isValidExpectedGateId(value) {
  return typeof value === 'string' && VALID_GATE_IDS.has(value);
}

function hasValidScenario(value) {
  return [...SCENARIO_FIELDS]
    .filter(field => field !== 'policyAutoProvenance')
    .every(field => typeof value?.[field] === 'boolean') &&
    VALID_PROVENANCE_IDS.has(value?.policyAutoProvenance);
}

function hasValidExpectation(value) {
  const allowed = value?.automaticRouteAllowed === true;
  const blocked = value?.automaticRouteAllowed === false;
  const gateIds = value?.blockingGateIds;
  const hasUniqueValidGateIds = Array.isArray(gateIds) && gateIds.length <= 4 &&
    gateIds.every(isValidExpectedGateId) && new Set(gateIds).size === gateIds.length;

  if (!hasUniqueValidGateIds || (!allowed && !blocked)) return false;
  if (allowed) return value.primaryGateId === null && gateIds.length === 0;

  return isValidExpectedGateId(value.primaryGateId) &&
    gateIds.length > 0 && gateIds[0] === value.primaryGateId;
}

export function validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixture(fixture) {
  const issues = [];
  if (!validateAllowedFields(fixture, FIXTURE_FIELDS, 'fixture', issues)) {
    return { ok: false, issues };
  }

  validateRequiredFields(fixture, ['id', 'scenario', 'expected'], 'fixture', issues);
  if (typeof fixture.id !== 'string' || !FIXTURE_ID_PATTERN.test(fixture.id)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.INVALID_FIXTURE_ID,
      'fixture.id',
      'Fixture ID must be a stable lowercase identifier.',
    ));
  }

  if (validateAllowedFields(fixture.scenario, SCENARIO_FIELDS, 'fixture.scenario', issues)) {
    validateRequiredFields(fixture.scenario, [...SCENARIO_FIELDS], 'fixture.scenario', issues);
    if (!hasValidScenario(fixture.scenario)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.INVALID_SCENARIO,
        'fixture.scenario',
        'Scenario must use only complete, fixed boolean controls and an allowed provenance state.',
      ));
    }
  }

  if (validateAllowedFields(fixture.expected, EXPECTATION_FIELDS, 'fixture.expected', issues)) {
    validateRequiredFields(fixture.expected, [...EXPECTATION_FIELDS], 'fixture.expected', issues);
    if (!hasValidExpectation(fixture.expected)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.INVALID_EXPECTATION,
        'fixture.expected',
        'Expected route safety must be a coherent, bounded gate projection.',
      ));
    }
  }

  return { ok: issues.length === 0, issues };
}

export function validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixtureCorpus(document) {
  const issues = [];
  if (!validateAllowedFields(document, DOCUMENT_FIELDS, 'corpus', issues)) {
    return { ok: false, fixtureCount: 0, issues };
  }

  validateRequiredFields(document, ['version', 'fixtures'], 'corpus', issues);
  if (document.version !==
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_CORPUS_VERSION) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.INVALID_VERSION,
      'corpus.version',
      'Corpus version does not match the fixed route-safety contract.',
    ));
  }

  if (!Array.isArray(document.fixtures) || document.fixtures.length < MIN_FIXTURES || document.fixtures.length > MAX_FIXTURES) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.INVALID_DOCUMENT,
      'corpus.fixtures',
      `Corpus must contain between ${MIN_FIXTURES} and ${MAX_FIXTURES} synthetic fixtures.`,
    ));
    return { ok: false, fixtureCount: 0, issues };
  }

  const ids = new Set();
  document.fixtures.forEach((fixture, index) => {
    const validation = validatePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationRouteSafetyFixture(fixture);
    validation.issues.forEach((issue) => {
      const relativePath = issue.path.replace(/^fixture\.?/u, '');
      issues.push(buildIssue(issue.riskId, `corpus.fixtures[${index}]${relativePath ? `.${relativePath}` : ''}`, issue.message));
    });
    const fixtureIdIsValid = typeof fixture?.id === 'string' && FIXTURE_ID_PATTERN.test(fixture.id);
    if (fixtureIdIsValid && ids.has(fixture.id)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_ROUTE_SAFETY_FIXTURE_RISK_IDS.DUPLICATE_FIXTURE_ID,
        `corpus.fixtures[${index}].id`,
        'Fixture IDs must be unique within one synthetic corpus.',
      ));
    }
    if (fixtureIdIsValid) ids.add(fixture.id);
  });

  return { ok: issues.length === 0, fixtureCount: document.fixtures.length, issues };
}
