/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_DOCUMENT_VERSION =
  'policy.candidate_semantic_snapshot_document.v1';
export const POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_VERSION =
  'policy.candidate_semantic_snapshot.v1';

export const POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_CANDIDATE_ROLE_IDS = Object.freeze({
  ALTERNATIVE: 'alternative',
  LEADING: 'leading',
});

export const POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS = Object.freeze({
  DUPLICATE_FIXTURE_ID: 'duplicate_fixture_id',
  DUPLICATE_SNAPSHOT_ID: 'duplicate_snapshot_id',
  INVALID_CANDIDATE_EMBEDDINGS: 'invalid_candidate_embeddings',
  INVALID_DOCUMENT: 'invalid_document',
  INVALID_EMBEDDING: 'invalid_embedding',
  INVALID_EMBEDDING_SPACE_ID: 'invalid_embedding_space_id',
  INVALID_FIXTURE_ID: 'invalid_fixture_id',
  INVALID_SNAPSHOT_ID: 'invalid_snapshot_id',
  INVALID_VERSION: 'invalid_version',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  UNKNOWN_FIELD: 'unknown_field',
});

const EMBEDDING_DIMENSION = 4;
const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const SNAPSHOT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/u;
const EMBEDDING_SPACE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
const MAX_SNAPSHOTS = 32;
const VALID_CANDIDATE_ROLE_IDS = new Set(Object.values(
  POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_CANDIDATE_ROLE_IDS,
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
    POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.MISSING_REQUIRED_FIELD,
    `${path}.${key}`,
    'Field is required by the semantic snapshot contract.',
  ));
  return false;
}

function hasOnlyKeys(value, allowedKeys, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_DOCUMENT,
      path,
      'Value must be a plain JSON object.',
    ));
    return false;
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.UNKNOWN_FIELD,
        `${path}.${key}`,
        'Field is not allowed by the semantic snapshot contract.',
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
    'Value must be a lower-case bounded identifier.',
  ));
  return false;
}

function validateEmbedding(value, path, issues) {
  const valid = Array.isArray(value) && value.length === EMBEDDING_DIMENSION && value.every((entry) => (
    typeof entry === 'number' && Number.isFinite(entry) && Math.abs(entry) <= 1
  )) && value.some((entry) => entry !== 0);

  if (!valid) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_EMBEDDING,
      path,
      `Embedding must contain ${EMBEDDING_DIMENSION} finite, bounded, non-zero numeric values.`,
    ));
  }
}

function validateCandidateEmbeddings(value, issues) {
  const path = 'snapshot.candidateEmbeddings';
  if (!Array.isArray(value) || value.length !== 2) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_CANDIDATE_EMBEDDINGS,
      path,
      'Exactly one leading and one alternative embedding are required.',
    ));
    return;
  }

  const seenRoles = new Set();
  value.forEach((candidate, index) => {
    const candidatePath = `${path}[${index}]`;
    if (!hasOnlyKeys(candidate, ['embedding', 'roleId'], candidatePath, issues)) return;
    const hasRole = requireOwnField(candidate, 'roleId', candidatePath, issues);
    const hasEmbedding = requireOwnField(candidate, 'embedding', candidatePath, issues);

    if (hasRole && !VALID_CANDIDATE_ROLE_IDS.has(candidate.roleId)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_CANDIDATE_EMBEDDINGS,
        `${candidatePath}.roleId`,
        'Candidate role must be leading or alternative.',
      ));
    }
    if (hasRole && seenRoles.has(candidate.roleId)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_CANDIDATE_EMBEDDINGS,
        `${candidatePath}.roleId`,
        'Candidate roles must be unique.',
      ));
    }
    if (hasRole) seenRoles.add(candidate.roleId);
    if (hasEmbedding) validateEmbedding(candidate.embedding, `${candidatePath}.embedding`, issues);
  });

  for (const roleId of VALID_CANDIDATE_ROLE_IDS) {
    if (!seenRoles.has(roleId)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_CANDIDATE_EMBEDDINGS,
        path,
        `Candidate embeddings must include ${roleId}.`,
      ));
    }
  }
}

export function validatePolicyCandidateSemanticSnapshot(snapshot) {
  const issues = [];
  if (!isPlainRecord(snapshot)) {
    return {
      ok: false,
      issues: [buildIssue(
        POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_DOCUMENT,
        'snapshot',
        'Snapshot must be a plain JSON object.',
      )],
    };
  }

  hasOnlyKeys(snapshot, [
    'candidateEmbeddings',
    'fixtureId',
    'id',
    'queryEmbedding',
    'version',
  ], 'snapshot', issues);
  const hasVersion = requireOwnField(snapshot, 'version', 'snapshot', issues);
  const hasId = requireOwnField(snapshot, 'id', 'snapshot', issues);
  const hasFixtureId = requireOwnField(snapshot, 'fixtureId', 'snapshot', issues);
  const hasQueryEmbedding = requireOwnField(snapshot, 'queryEmbedding', 'snapshot', issues);
  const hasCandidateEmbeddings = requireOwnField(snapshot, 'candidateEmbeddings', 'snapshot', issues);

  if (hasVersion && snapshot.version !== POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_VERSION) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_VERSION,
      'snapshot.version',
      'Snapshot must declare the current semantic snapshot contract version.',
    ));
  }
  if (hasId) validateIdentifier(
    snapshot.id,
    'snapshot.id',
    SNAPSHOT_ID_PATTERN,
    POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_SNAPSHOT_ID,
    issues,
  );
  if (hasFixtureId) validateIdentifier(
    snapshot.fixtureId,
    'snapshot.fixtureId',
    FIXTURE_ID_PATTERN,
    POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_FIXTURE_ID,
    issues,
  );
  if (hasQueryEmbedding) validateEmbedding(snapshot.queryEmbedding, 'snapshot.queryEmbedding', issues);
  if (hasCandidateEmbeddings) validateCandidateEmbeddings(snapshot.candidateEmbeddings, issues);

  return { ok: issues.length === 0, issues };
}

export function validatePolicyCandidateSemanticSnapshotDocument(document) {
  const issues = [];
  if (!isPlainRecord(document)) {
    return {
      ok: false,
      snapshotCount: 0,
      issues: [buildIssue(
        POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_DOCUMENT,
        'document',
        'Snapshot document must be a plain JSON object.',
      )],
    };
  }

  hasOnlyKeys(document, ['embeddingSpaceId', 'snapshots', 'snapshotSetId', 'version'], 'document', issues);
  const hasVersion = requireOwnField(document, 'version', 'document', issues);
  const hasSnapshotSetId = requireOwnField(document, 'snapshotSetId', 'document', issues);
  const hasEmbeddingSpaceId = requireOwnField(document, 'embeddingSpaceId', 'document', issues);
  const hasSnapshots = requireOwnField(document, 'snapshots', 'document', issues);

  if (hasVersion && document.version !== POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_DOCUMENT_VERSION) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_VERSION,
      'document.version',
      'Snapshot document must declare the current semantic snapshot document version.',
    ));
  }
  if (hasSnapshotSetId) validateIdentifier(
    document.snapshotSetId,
    'document.snapshotSetId',
    SNAPSHOT_ID_PATTERN,
    POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_SNAPSHOT_ID,
    issues,
  );
  if (hasEmbeddingSpaceId) validateIdentifier(
    document.embeddingSpaceId,
    'document.embeddingSpaceId',
    EMBEDDING_SPACE_ID_PATTERN,
    POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_EMBEDDING_SPACE_ID,
    issues,
  );

  if (!hasSnapshots || !Array.isArray(document.snapshots) ||
      document.snapshots.length === 0 || document.snapshots.length > MAX_SNAPSHOTS) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.INVALID_DOCUMENT,
      'document.snapshots',
      `Snapshot document must contain between one and ${MAX_SNAPSHOTS} snapshots.`,
    ));
  } else {
    const snapshotIds = new Set();
    const fixtureIds = new Set();
    document.snapshots.forEach((snapshot, index) => {
      const validation = validatePolicyCandidateSemanticSnapshot(snapshot);
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
          POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.DUPLICATE_SNAPSHOT_ID,
          `document.snapshots[${index}].id`,
          'Snapshot IDs must be unique within one document.',
        ));
      }
      if (fixtureIds.has(snapshot.fixtureId)) {
        issues.push(buildIssue(
          POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_RISK_IDS.DUPLICATE_FIXTURE_ID,
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
