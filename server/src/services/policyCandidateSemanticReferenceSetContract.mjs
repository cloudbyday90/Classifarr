/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
} from './policyCandidateEvidenceOfflineEvaluationContract.mjs';

export const POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION =
  'policy.candidate_semantic_reference_set_document.v1';

export const POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS = Object.freeze({
  INDEPENDENT_DOUBLE_BLIND_HUMAN: 'independent_double_blind_human.v1',
  SYNTHETIC_EXAMPLE: 'synthetic_example.v1',
});

export const POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_CONSENSUS_STATUS_IDS = Object.freeze({
  ADJUDICATED: 'adjudicated',
  UNANIMOUS: 'unanimous',
});

export const POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS = Object.freeze({
  DUPLICATE_FIXTURE_ID: 'duplicate_fixture_id',
  INVALID_CONSENSUS_STATUS: 'invalid_consensus_status',
  INVALID_DOCUMENT: 'invalid_document',
  INVALID_FIXTURE_FINGERPRINT: 'invalid_fixture_fingerprint',
  INVALID_FIXTURE_ID: 'invalid_fixture_id',
  INVALID_LABELING_PROTOCOL: 'invalid_labeling_protocol',
  INVALID_REFERENCE_DECISION: 'invalid_reference_decision',
  INVALID_REFERENCE_SET_ID: 'invalid_reference_set_id',
  INVALID_REVIEWER_COUNT: 'invalid_reviewer_count',
  INVALID_VERSION: 'invalid_version',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  UNKNOWN_FIELD: 'unknown_field',
});

const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const REFERENCE_SET_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/u;
const MAX_LABELS = 32;
const VALID_CONSENSUS_STATUS_IDS = new Set(Object.values(
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_CONSENSUS_STATUS_IDS,
));
const VALID_DECISION_IDS = new Set(Object.values(
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
));
const VALID_LABELING_PROTOCOL_IDS = new Set(Object.values(
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS,
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
    POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.MISSING_REQUIRED_FIELD,
    `${path}.${key}`,
    'Field is required by the semantic reference-set contract.',
  ));
  return false;
}

function hasOnlyKeys(value, allowedKeys, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.INVALID_DOCUMENT,
      path,
      'Value must be a plain JSON object.',
    ));
    return false;
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.UNKNOWN_FIELD,
        `${path}.${key}`,
        'Field is not allowed by the semantic reference-set contract.',
      ));
    }
  }
  return true;
}

function validateIdentifier(value, path, pattern, riskId, issues) {
  if (typeof value === 'string' && pattern.test(value)) return true;
  issues.push(buildIssue(riskId, path, 'Value must be a lower-case bounded identifier.'));
  return false;
}

function validateReviewerCount(value, consensusStatusId, path, issues) {
  const minimum = consensusStatusId ===
    POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_CONSENSUS_STATUS_IDS.ADJUDICATED ? 3 : 2;
  if (Number.isInteger(value) && value >= minimum && value <= 8) return;
  issues.push(buildIssue(
    POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.INVALID_REVIEWER_COUNT,
    path,
    `Reviewer count must be an integer between ${minimum} and 8 for this consensus status.`,
  ));
}

function validateLabel(value, index, issues) {
  const path = `referenceSet.labels[${index}]`;
  if (!hasOnlyKeys(value, ['consensusStatusId', 'fixtureId', 'referenceDecisionId', 'reviewerCount'], path, issues)) {
    return null;
  }

  const hasConsensusStatusId = requireOwnField(value, 'consensusStatusId', path, issues);
  const hasFixtureId = requireOwnField(value, 'fixtureId', path, issues);
  const hasReferenceDecisionId = requireOwnField(value, 'referenceDecisionId', path, issues);
  const hasReviewerCount = requireOwnField(value, 'reviewerCount', path, issues);

  if (hasConsensusStatusId && !VALID_CONSENSUS_STATUS_IDS.has(value.consensusStatusId)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.INVALID_CONSENSUS_STATUS,
      `${path}.consensusStatusId`,
      'Consensus status must be unanimous or adjudicated.',
    ));
  }
  if (hasFixtureId) validateIdentifier(
    value.fixtureId,
    `${path}.fixtureId`,
    FIXTURE_ID_PATTERN,
    POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.INVALID_FIXTURE_ID,
    issues,
  );
  if (hasReferenceDecisionId && !VALID_DECISION_IDS.has(value.referenceDecisionId)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.INVALID_REFERENCE_DECISION,
      `${path}.referenceDecisionId`,
      'Reference decision must be admit, review, or abstain.',
    ));
  }
  if (hasReviewerCount && hasConsensusStatusId &&
      VALID_CONSENSUS_STATUS_IDS.has(value.consensusStatusId)) {
    validateReviewerCount(value.reviewerCount, value.consensusStatusId, `${path}.reviewerCount`, issues);
  }

  return hasFixtureId ? value.fixtureId : null;
}

/**
 * Validates the content-free provenance record that binds independently
 * reviewed decisions to a redacted offline fixture document. The contract
 * deliberately has no title, description, library, provider, prompt, model,
 * response, vector, reviewer identity, or free-text field.
 */
export function validatePolicyCandidateSemanticReferenceSetDocument(referenceSet) {
  const issues = [];
  if (!isPlainRecord(referenceSet)) {
    return {
      labelCount: 0,
      ok: false,
      issues: [buildIssue(
        POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.INVALID_DOCUMENT,
        'referenceSet',
        'Reference set must be a plain JSON object.',
      )],
    };
  }

  hasOnlyKeys(referenceSet, [
    'fixtureDocumentFingerprint',
    'labels',
    'labelingProtocolId',
    'referenceSetId',
    'version',
  ], 'referenceSet', issues);
  const hasVersion = requireOwnField(referenceSet, 'version', 'referenceSet', issues);
  const hasReferenceSetId = requireOwnField(referenceSet, 'referenceSetId', 'referenceSet', issues);
  const hasLabelingProtocolId = requireOwnField(referenceSet, 'labelingProtocolId', 'referenceSet', issues);
  const hasFixtureDocumentFingerprint = requireOwnField(
    referenceSet,
    'fixtureDocumentFingerprint',
    'referenceSet',
    issues,
  );
  const hasLabels = requireOwnField(referenceSet, 'labels', 'referenceSet', issues);

  if (hasVersion && referenceSet.version !== POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.INVALID_VERSION,
      'referenceSet.version',
      'Reference set must declare the current semantic reference-set contract version.',
    ));
  }
  if (hasReferenceSetId) validateIdentifier(
    referenceSet.referenceSetId,
    'referenceSet.referenceSetId',
    REFERENCE_SET_ID_PATTERN,
    POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.INVALID_REFERENCE_SET_ID,
    issues,
  );
  if (hasLabelingProtocolId && !VALID_LABELING_PROTOCOL_IDS.has(referenceSet.labelingProtocolId)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.INVALID_LABELING_PROTOCOL,
      'referenceSet.labelingProtocolId',
      'Labeling protocol is not supported by this reference-set contract.',
    ));
  }
  if (hasFixtureDocumentFingerprint &&
      (typeof referenceSet.fixtureDocumentFingerprint !== 'string' ||
        !FINGERPRINT_PATTERN.test(referenceSet.fixtureDocumentFingerprint))) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.INVALID_FIXTURE_FINGERPRINT,
      'referenceSet.fixtureDocumentFingerprint',
      'Fixture document fingerprint must be a lower-case SHA-256 content address.',
    ));
  }

  if (!hasLabels || !Array.isArray(referenceSet.labels) ||
      referenceSet.labels.length === 0 || referenceSet.labels.length > MAX_LABELS) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.INVALID_DOCUMENT,
      'referenceSet.labels',
      `Reference set must contain between one and ${MAX_LABELS} labels.`,
    ));
  } else {
    const fixtureIds = new Set();
    referenceSet.labels.forEach((label, index) => {
      const fixtureId = validateLabel(label, index, issues);
      if (!fixtureId) return;
      if (fixtureIds.has(fixtureId)) {
        issues.push(buildIssue(
          POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_RISK_IDS.DUPLICATE_FIXTURE_ID,
          `referenceSet.labels[${index}].fixtureId`,
          'Each fixture may have only one final reference decision.',
        ));
      }
      fixtureIds.add(fixtureId);
    });
  }

  return {
    labelCount: Array.isArray(referenceSet.labels) ? referenceSet.labels.length : 0,
    ok: issues.length === 0,
    issues,
  };
}
