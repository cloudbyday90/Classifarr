/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS,
} from './policyCandidateContrastiveEvidence.mjs';
import {
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
} from './policyRuntimeCandidateSetSelectionOutcome.mjs';

export const POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_FIXTURE_VERSION =
  'policy.candidate_evidence_offline_evaluation_fixture.v1';

export const POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS = Object.freeze({
  ADMIT: 'admit',
  REVIEW: 'review',
  ABSTAIN: 'abstain',
});

export const POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SEMANTIC_SIGNAL_IDS = Object.freeze({
  SUPPORTS_LEADING_CANDIDATE: 'supports_leading_candidate',
  SUPPORTS_ALTERNATIVE_CANDIDATE: 'supports_alternative_candidate',
  ABSTAIN: 'abstain',
});

export const POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS = Object.freeze({
  DUPLICATE_FIXTURE_ID: 'duplicate_fixture_id',
  INVALID_CONTRASTIVE_STATUS: 'invalid_contrastive_status',
  INVALID_DOCUMENT: 'invalid_document',
  INVALID_FIXTURE_ID: 'invalid_fixture_id',
  INVALID_FIXTURE_VERSION: 'invalid_fixture_version',
  INVALID_REFERENCE_DECISION: 'invalid_reference_decision',
  INVALID_SELECTION_STATUS: 'invalid_selection_status',
  INVALID_SEMANTIC_SIGNAL: 'invalid_semantic_signal',
  INVALID_SEMANTIC_SNAPSHOT_ID: 'invalid_semantic_snapshot_id',
  INVALID_STRING: 'invalid_string',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  UNKNOWN_FIELD: 'unknown_field',
});

const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const TAG_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,47}$/u;
const MAX_DOCUMENT_FIXTURES = 32;
const MAX_NAME_LENGTH = 240;
const MAX_TAGS = 8;
const VALID_CONTRASTIVE_STATUS_IDS = new Set([
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.LEADING_IDENTITY_MATCH,
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.ALTERNATIVE_IDENTITY_MATCH,
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.SHARED_IDENTITY_MATCH,
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.NO_CANDIDATE_IDENTITY_MATCH,
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.IDENTITY_UNVERIFIED,
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.RETRIEVAL_UNAVAILABLE,
]);
const VALID_DECISION_IDS = new Set(Object.values(POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS));
const VALID_SELECTION_STATUS_IDS = new Set(Object.values(POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS));
const VALID_SEMANTIC_SIGNAL_IDS = new Set(Object.values(POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SEMANTIC_SIGNAL_IDS));

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
    POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.MISSING_REQUIRED_FIELD,
    `${path}.${key}`,
    'Field is required by this offline evaluation contract.',
  ));
  return false;
}

function hasOnlyKeys(value, allowedKeys, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_DOCUMENT,
      path,
      'Value must be a plain JSON object.',
    ));
    return false;
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.UNKNOWN_FIELD,
        `${path}.${key}`,
        'Field is not allowed by this offline evaluation contract.',
      ));
    }
  }
  return true;
}

function validateBoundedText(value, path, issues) {
  const valid = typeof value === 'string' && value.trim().length > 0 &&
    value.length <= MAX_NAME_LENGTH && !/[\u0000-\u001F\u007F]/u.test(value);
  if (!valid) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_STRING,
      path,
      `Value must be non-empty, at most ${MAX_NAME_LENGTH} characters, and contain no control characters.`,
    ));
  }
  return valid;
}

function validateIdentifier(value, path, issues, pattern, riskId) {
  const valid = typeof value === 'string' && pattern.test(value);
  if (!valid) {
    issues.push(buildIssue(
      riskId,
      path,
      'Value must be a lower-case bounded identifier.',
    ));
  }
  return valid;
}

function validateTags(value, issues) {
  const path = 'fixture.tags';
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TAGS) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_FIXTURE_ID,
      path,
      `Tags must contain between one and ${MAX_TAGS} unique identifiers.`,
    ));
    return;
  }

  const seen = new Set();
  value.forEach((tag, index) => {
    validateIdentifier(
      tag,
      `${path}[${index}]`,
      issues,
      TAG_ID_PATTERN,
      POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_FIXTURE_ID,
    );
    if (seen.has(tag)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_FIXTURE_ID,
        `${path}[${index}]`,
        'Tags must be unique.',
      ));
    }
    seen.add(tag);
  });
}

function validateReference(value, issues) {
  const path = 'fixture.reference';
  if (!hasOnlyKeys(value, ['decisionId'], path, issues)) return;
  if (requireOwnField(value, 'decisionId', path, issues) && !VALID_DECISION_IDS.has(value.decisionId)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_REFERENCE_DECISION,
      `${path}.decisionId`,
      'Reference decision must be admit, review, or abstain.',
    ));
  }
}

function validateObservations(value, issues) {
  const path = 'fixture.observations';
  if (!hasOnlyKeys(value, [
    'candidateSetSelectionStatusId',
    'contrastiveStatusId',
    'semanticRetrievalSignalId',
    'semanticSnapshotId',
  ], path, issues)) return;

  if (requireOwnField(value, 'candidateSetSelectionStatusId', path, issues) &&
      !VALID_SELECTION_STATUS_IDS.has(value.candidateSetSelectionStatusId)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_SELECTION_STATUS,
      `${path}.candidateSetSelectionStatusId`,
      'Candidate-set selection status is not supported.',
    ));
  }
  if (requireOwnField(value, 'contrastiveStatusId', path, issues) &&
      !VALID_CONTRASTIVE_STATUS_IDS.has(value.contrastiveStatusId)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_CONTRASTIVE_STATUS,
      `${path}.contrastiveStatusId`,
      'Contrastive status is not supported by this offline evidence evaluation.',
    ));
  }
  if (requireOwnField(value, 'semanticRetrievalSignalId', path, issues) &&
      !VALID_SEMANTIC_SIGNAL_IDS.has(value.semanticRetrievalSignalId)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_SEMANTIC_SIGNAL,
      `${path}.semanticRetrievalSignalId`,
      'Semantic retrieval signal must be a fixed offline proposal or abstention.',
    ));
  }
  if (requireOwnField(value, 'semanticSnapshotId', path, issues)) {
    validateIdentifier(
      value.semanticSnapshotId,
      `${path}.semanticSnapshotId`,
      issues,
      FIXTURE_ID_PATTERN,
      POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_SEMANTIC_SNAPSHOT_ID,
    );
  }
}

export function validatePolicyCandidateEvidenceOfflineEvaluationFixture(fixture) {
  const issues = [];
  if (!isPlainRecord(fixture)) {
    return {
      ok: false,
      issues: [buildIssue(
        POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_DOCUMENT,
        'fixture',
        'Fixture must be a plain JSON object.',
      )],
    };
  }

  hasOnlyKeys(fixture, ['id', 'name', 'observations', 'reference', 'tags', 'version'], 'fixture', issues);
  const hasVersion = requireOwnField(fixture, 'version', 'fixture', issues);
  const hasId = requireOwnField(fixture, 'id', 'fixture', issues);
  const hasName = requireOwnField(fixture, 'name', 'fixture', issues);
  const hasTags = requireOwnField(fixture, 'tags', 'fixture', issues);
  const hasReference = requireOwnField(fixture, 'reference', 'fixture', issues);
  const hasObservations = requireOwnField(fixture, 'observations', 'fixture', issues);

  if (hasVersion && fixture.version !== POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_FIXTURE_VERSION) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_FIXTURE_VERSION,
      'fixture.version',
      'Fixture must declare the current offline evaluation fixture contract version.',
    ));
  }
  if (hasId) validateIdentifier(
    fixture.id,
    'fixture.id',
    issues,
    FIXTURE_ID_PATTERN,
    POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_FIXTURE_ID,
  );
  if (hasName) validateBoundedText(fixture.name, 'fixture.name', issues);
  if (hasTags) validateTags(fixture.tags, issues);
  if (hasReference) validateReference(fixture.reference, issues);
  if (hasObservations) validateObservations(fixture.observations, issues);

  return { ok: issues.length === 0, issues };
}

export function validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument(document) {
  if (!Array.isArray(document) || document.length === 0 || document.length > MAX_DOCUMENT_FIXTURES) {
    return {
      ok: false,
      fixtureCount: 0,
      issues: [buildIssue(
        POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_DOCUMENT,
        'fixtures',
        `Fixture document must contain between one and ${MAX_DOCUMENT_FIXTURES} entries.`,
      )],
    };
  }

  const fixtureIds = new Set();
  const issues = [];
  document.forEach((fixture, index) => {
    const validation = validatePolicyCandidateEvidenceOfflineEvaluationFixture(fixture);
    validation.issues.forEach((issue) => {
      const relativePath = issue.path.replace(/^fixture\.?/u, '');
      issues.push(buildIssue(
        issue.riskId,
        `fixtures[${index}]${relativePath ? `.${relativePath}` : ''}`,
        issue.message,
      ));
    });
    if (validation.ok && fixtureIds.has(fixture.id)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.DUPLICATE_FIXTURE_ID,
        `fixtures[${index}].id`,
        'Fixture IDs must be unique within one offline evaluation document.',
      ));
    }
    if (validation.ok) fixtureIds.add(fixture.id);
  });

  return { ok: issues.length === 0, fixtureCount: document.length, issues };
}
