/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
} from './currentLibraryCandidateSemanticRetrievalContract.mjs';

export const POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_DOCUMENT_VERSION =
  'policy.candidate_current_inventory_semantic_study_snapshot_document.v1';
export const POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_VERSION =
  'policy.candidate_current_inventory_semantic_study_snapshot.v1';

export const POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_STATUS_IDS = Object.freeze({
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
});

export const POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS = Object.freeze({
  DUPLICATE_FIXTURE_ID: 'duplicate_fixture_id',
  DUPLICATE_SNAPSHOT_ID: 'duplicate_snapshot_id',
  INVALID_CANDIDATE_COUNT: 'invalid_candidate_count',
  INVALID_DOCUMENT: 'invalid_document',
  INVALID_FIXTURE_ID: 'invalid_fixture_id',
  INVALID_RELEVANCE: 'invalid_relevance',
  INVALID_RETRIEVAL_PROTOCOL: 'invalid_retrieval_protocol',
  INVALID_RETRIEVAL_STATUS: 'invalid_retrieval_status',
  INVALID_SNAPSHOT_ID: 'invalid_snapshot_id',
  INVALID_VERSION: 'invalid_version',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  UNKNOWN_FIELD: 'unknown_field',
});

const FIXTURE_ID_PATTERN = /^fixture_[a-f0-9]{16,64}$/u;
const SNAPSHOT_ID_PATTERN = /^snapshot_[a-f0-9]{16,64}$/u;
const SNAPSHOT_SET_ID_PATTERN = /^snapshot_set_[a-f0-9]{16,64}$/u;
const MAX_SNAPSHOTS = 32;
const RETRIEVAL_STATUS_IDS = new Set(
  Object.values(POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_STATUS_IDS),
);

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
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.MISSING_REQUIRED_FIELD,
    `${path}.${key}`,
    'Field is required by the current-inventory study snapshot contract.',
  ));
  return false;
}

function hasOnlyKeys(value, allowedKeys, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_DOCUMENT,
      path,
      'Value must be a plain JSON object.',
    ));
    return false;
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.UNKNOWN_FIELD,
        `${path}.${key}`,
        'Field is not allowed by the current-inventory study snapshot contract.',
      ));
    }
  }
  return true;
}

function validateIdentifier(value, path, pattern, riskId, issues) {
  if (typeof value === 'string' && pattern.test(value)) return true;
  issues.push(buildIssue(
    riskId,
    path,
    'Value must be a fixed-length opaque study identifier.',
  ));
  return false;
}

function validateCandidateCount(value, path, issues) {
  if (Number.isInteger(value) && value >= 2 && value <= 3) return;
  issues.push(buildIssue(
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_CANDIDATE_COUNT,
    path,
    'A current-inventory study snapshot requires two or three policy-owned candidates.',
  ));
}

function validateRelevance(value, path, issues) {
  if (Number.isInteger(value) && value >= 0 && value <= 100) return;
  issues.push(buildIssue(
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_RELEVANCE,
    path,
    'Relevance must be a bounded whole-number percentage.',
  ));
}

export function validatePolicyCandidateCurrentInventorySemanticStudySnapshot(snapshot) {
  const issues = [];
  if (!isPlainRecord(snapshot)) {
    return {
      ok: false,
      issues: [buildIssue(
        POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_DOCUMENT,
        'snapshot',
        'Snapshot must be a plain JSON object.',
      )],
    };
  }

  hasOnlyKeys(snapshot, [
    'alternativeRelevance',
    'candidateCount',
    'fixtureId',
    'id',
    'leadingRelevance',
    'retrievalStatusId',
    'version',
  ], 'snapshot', issues);
  const hasVersion = requireOwnField(snapshot, 'version', 'snapshot', issues);
  const hasId = requireOwnField(snapshot, 'id', 'snapshot', issues);
  const hasFixtureId = requireOwnField(snapshot, 'fixtureId', 'snapshot', issues);
  const hasCandidateCount = requireOwnField(snapshot, 'candidateCount', 'snapshot', issues);
  const hasStatus = requireOwnField(snapshot, 'retrievalStatusId', 'snapshot', issues);
  const hasLeadingRelevance = requireOwnField(snapshot, 'leadingRelevance', 'snapshot', issues);
  const hasAlternativeRelevance = requireOwnField(snapshot, 'alternativeRelevance', 'snapshot', issues);

  if (hasVersion && snapshot.version !== POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_VERSION) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_VERSION,
      'snapshot.version',
      'Snapshot must declare the current current-inventory study snapshot version.',
    ));
  }
  if (hasId) validateIdentifier(
    snapshot.id,
    'snapshot.id',
    SNAPSHOT_ID_PATTERN,
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_SNAPSHOT_ID,
    issues,
  );
  if (hasFixtureId) validateIdentifier(
    snapshot.fixtureId,
    'snapshot.fixtureId',
    FIXTURE_ID_PATTERN,
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_FIXTURE_ID,
    issues,
  );
  if (hasCandidateCount) validateCandidateCount(snapshot.candidateCount, 'snapshot.candidateCount', issues);
  if (hasStatus && !RETRIEVAL_STATUS_IDS.has(snapshot.retrievalStatusId)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_RETRIEVAL_STATUS,
      'snapshot.retrievalStatusId',
      'Retrieval status must be available or unavailable.',
    ));
  }
  if (snapshot.retrievalStatusId === POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_STATUS_IDS.AVAILABLE) {
    if (hasLeadingRelevance) validateRelevance(snapshot.leadingRelevance, 'snapshot.leadingRelevance', issues);
    if (hasAlternativeRelevance) validateRelevance(snapshot.alternativeRelevance, 'snapshot.alternativeRelevance', issues);
  } else {
    if (hasLeadingRelevance && snapshot.leadingRelevance !== null) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_RELEVANCE,
        'snapshot.leadingRelevance',
        'Unavailable retrieval must not retain a leading relevance value.',
      ));
    }
    if (hasAlternativeRelevance && snapshot.alternativeRelevance !== null) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_RELEVANCE,
        'snapshot.alternativeRelevance',
        'Unavailable retrieval must not retain an alternative relevance value.',
      ));
    }
  }

  return { ok: issues.length === 0, issues };
}

export function validatePolicyCandidateCurrentInventorySemanticStudySnapshotDocument(document) {
  const issues = [];
  if (!isPlainRecord(document)) {
    return {
      ok: false,
      snapshotCount: 0,
      issues: [buildIssue(
        POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_DOCUMENT,
        'document',
        'Snapshot document must be a plain JSON object.',
      )],
    };
  }

  hasOnlyKeys(document, [
    'retrievalProtocolVersion',
    'snapshotSetId',
    'snapshots',
    'version',
  ], 'document', issues);
  const hasVersion = requireOwnField(document, 'version', 'document', issues);
  const hasSnapshotSetId = requireOwnField(document, 'snapshotSetId', 'document', issues);
  const hasProtocol = requireOwnField(document, 'retrievalProtocolVersion', 'document', issues);
  const hasSnapshots = requireOwnField(document, 'snapshots', 'document', issues);

  if (hasVersion && document.version !== POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_DOCUMENT_VERSION) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_VERSION,
      'document.version',
      'Document must declare the current current-inventory study snapshot document version.',
    ));
  }
  if (hasSnapshotSetId) validateIdentifier(
    document.snapshotSetId,
    'document.snapshotSetId',
    SNAPSHOT_SET_ID_PATTERN,
    POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_SNAPSHOT_ID,
    issues,
  );
  if (hasProtocol && document.retrievalProtocolVersion !== CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_RETRIEVAL_PROTOCOL,
      'document.retrievalProtocolVersion',
      'Document must bind to the current server-owned semantic retrieval protocol.',
    ));
  }

  if (!hasSnapshots || !Array.isArray(document.snapshots) ||
      document.snapshots.length === 0 || document.snapshots.length > MAX_SNAPSHOTS) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.INVALID_DOCUMENT,
      'document.snapshots',
      `Snapshot document must contain between one and ${MAX_SNAPSHOTS} snapshots.`,
    ));
  } else {
    const snapshotIds = new Set();
    const fixtureIds = new Set();
    document.snapshots.forEach((snapshot, index) => {
      const validation = validatePolicyCandidateCurrentInventorySemanticStudySnapshot(snapshot);
      validation.issues.forEach((issue) => {
        const relativePath = issue.path.replace(/^snapshot\.?/u, '');
        issues.push(buildIssue(
          issue.riskId,
          `document.snapshots[${index}]${relativePath ? `.${relativePath}` : ''}`,
          issue.message,
        ));
      });
      if (!validation.ok) return;
      if (snapshotIds.has(snapshot.id)) {
        issues.push(buildIssue(
          POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.DUPLICATE_SNAPSHOT_ID,
          `document.snapshots[${index}].id`,
          'Snapshot IDs must be unique within one document.',
        ));
      }
      if (fixtureIds.has(snapshot.fixtureId)) {
        issues.push(buildIssue(
          POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_RISK_IDS.DUPLICATE_FIXTURE_ID,
          `document.snapshots[${index}].fixtureId`,
          'Fixture IDs must be unique within one document.',
        ));
      }
      snapshotIds.add(snapshot.id);
      fixtureIds.add(snapshot.fixtureId);
    });
  }

  return {
    ok: issues.length === 0,
    snapshotCount: Array.isArray(document.snapshots) ? document.snapshots.length : 0,
    issues,
  };
}
