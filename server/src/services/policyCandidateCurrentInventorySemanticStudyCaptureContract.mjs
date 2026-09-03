/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_IDENTIFIER_PATTERNS,
} from './policyCandidateCurrentInventorySemanticStudySnapshotContract.mjs';

export const POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_VERSION =
  'policy.candidate_current_inventory_semantic_study_capture.v1';
export const POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_MINIMUM_CASES = 24;
export const POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_MAXIMUM_CASES = 32;

export const POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  INVALID_REQUEST: 'invalid_request',
});

export const POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS = Object.freeze({
  DUPLICATE_FIXTURE_ID: 'duplicate_fixture_id',
  DUPLICATE_SNAPSHOT_ID: 'duplicate_snapshot_id',
  INVALID_CANDIDATE_CONTRACT: 'invalid_candidate_contract',
  INVALID_CASE_COUNT: 'invalid_case_count',
  INVALID_DOCUMENT: 'invalid_document',
  INVALID_FIXTURE_ID: 'invalid_fixture_id',
  INVALID_METADATA: 'invalid_metadata',
  INVALID_SNAPSHOT_ID: 'invalid_snapshot_id',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  UNKNOWN_FIELD: 'unknown_field',
});

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function issue(riskId, path, message) {
  return Object.freeze({ riskId, path, message });
}

function requireOwnField(value, key, path, issues) {
  if (Object.hasOwn(value, key)) return true;
  issues.push(issue(
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.MISSING_REQUIRED_FIELD,
    `${path}.${key}`,
    'Field is required by the current-inventory semantic-study capture contract.',
  ));
  return false;
}

function hasOnlyKeys(value, allowedKeys, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(issue(
      POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.INVALID_DOCUMENT,
      path,
      'Value must be a plain JSON object.',
    ));
    return false;
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push(issue(
        POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.UNKNOWN_FIELD,
        `${path}.${key}`,
        'Field is not allowed by the current-inventory semantic-study capture contract.',
      ));
    }
  }
  return true;
}

function validateIdentifier(value, path, pattern, riskId, issues) {
  if (typeof value === 'string' && pattern.test(value)) return;
  issues.push(issue(riskId, path, 'Value must be an opaque current-inventory study identifier.'));
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validateCandidateContract(value, path, issues) {
  if (!isPlainRecord(value) || value.valid !== true || !Array.isArray(value.candidates) ||
      value.candidates.length < 2 ||
      value.candidates.length > 3) {
    issues.push(issue(
      POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.INVALID_CANDIDATE_CONTRACT,
      path,
      'A capture case requires a valid server-owned contract with two or three candidates.',
    ));
    return;
  }

  const libraryIds = new Set();
  for (const candidate of value.candidates) {
    const libraryId = candidate?.libraryId;
    if (!isPositiveInteger(libraryId) || libraryIds.has(libraryId)) {
      issues.push(issue(
        POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.INVALID_CANDIDATE_CONTRACT,
        path,
        'Each candidate contract must contain unique positive library identifiers.',
      ));
      return;
    }
    libraryIds.add(libraryId);
  }
}

function validateCase(value, index, issues) {
  const path = `request.cases[${index}]`;
  if (!hasOnlyKeys(value, ['contract', 'fixtureId', 'metadata', 'snapshotId'], path, issues)) {
    return;
  }

  const hasContract = requireOwnField(value, 'contract', path, issues);
  const hasFixtureId = requireOwnField(value, 'fixtureId', path, issues);
  const hasMetadata = requireOwnField(value, 'metadata', path, issues);
  const hasSnapshotId = requireOwnField(value, 'snapshotId', path, issues);

  if (hasContract) validateCandidateContract(value.contract, `${path}.contract`, issues);
  if (hasFixtureId) validateIdentifier(
    value.fixtureId,
    `${path}.fixtureId`,
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_IDENTIFIER_PATTERNS.FIXTURE_ID,
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.INVALID_FIXTURE_ID,
    issues,
  );
  if (hasMetadata && !isPlainRecord(value.metadata)) {
    issues.push(issue(
      POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.INVALID_METADATA,
      `${path}.metadata`,
      'Metadata must be a plain in-memory object and is never serialized by capture.',
    ));
  }
  if (hasSnapshotId) validateIdentifier(
    value.snapshotId,
    `${path}.snapshotId`,
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_IDENTIFIER_PATTERNS.SNAPSHOT_ID,
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.INVALID_SNAPSHOT_ID,
    issues,
  );
}

/**
 * Validates the in-memory input to a real-inventory study run. It deliberately
 * does not inspect media metadata values: they remain transient retriever
 * input and cannot enter the redacted output document.
 */
export function validatePolicyCandidateCurrentInventorySemanticStudyCaptureRequest(request) {
  const issues = [];
  if (!isPlainRecord(request)) {
    return {
      caseCount: 0,
      ok: false,
      issues: [issue(
        POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.INVALID_DOCUMENT,
        'request',
        'Capture request must be a plain JSON object.',
      )],
    };
  }

  hasOnlyKeys(request, ['cases', 'snapshotSetId'], 'request', issues);
  const hasCases = requireOwnField(request, 'cases', 'request', issues);
  const hasSnapshotSetId = requireOwnField(request, 'snapshotSetId', 'request', issues);

  if (hasSnapshotSetId) validateIdentifier(
    request.snapshotSetId,
    'request.snapshotSetId',
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_IDENTIFIER_PATTERNS.SNAPSHOT_SET_ID,
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.INVALID_SNAPSHOT_ID,
    issues,
  );

  if (!hasCases || !Array.isArray(request.cases) ||
      request.cases.length < POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_MINIMUM_CASES ||
      request.cases.length > POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_MAXIMUM_CASES) {
    issues.push(issue(
      POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.INVALID_CASE_COUNT,
      'request.cases',
      `Capture requires ${POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_MINIMUM_CASES}–${POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_MAXIMUM_CASES} cases.`,
    ));
  } else {
    const fixtureIds = new Set();
    const snapshotIds = new Set();
    request.cases.forEach((value, index) => {
      validateCase(value, index, issues);
      if (typeof value?.fixtureId === 'string') {
        if (fixtureIds.has(value.fixtureId)) {
          issues.push(issue(
            POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.DUPLICATE_FIXTURE_ID,
            `request.cases[${index}].fixtureId`,
            'Fixture IDs must be unique within one study capture.',
          ));
        }
        fixtureIds.add(value.fixtureId);
      }
      if (typeof value?.snapshotId === 'string') {
        if (snapshotIds.has(value.snapshotId)) {
          issues.push(issue(
            POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_RISK_IDS.DUPLICATE_SNAPSHOT_ID,
            `request.cases[${index}].snapshotId`,
            'Snapshot IDs must be unique within one study capture.',
          ));
        }
        snapshotIds.add(value.snapshotId);
      }
    });
  }

  return {
    caseCount: Array.isArray(request.cases) ? request.cases.length : 0,
    ok: issues.length === 0,
    issues,
  };
}
