/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_VERSION,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS,
  validateHeldOutSemanticStudyRetrievalRepresentationArtifact,
  validateHeldOutSemanticStudyRetrievalRepresentationArtifactBinding,
} from './heldOutSemanticStudyRetrievalRepresentationArtifact.mjs';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_VERSION =
  'policy.held_out_semantic_study_retrieval_representation_artifact_set.v1';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_CONDITION_IDS = Object.freeze({
  HISTORICAL_CLASSIFICATION_LABEL_EXCLUDED: 'historical_classification_label_excluded',
  HISTORICAL_CLASSIFICATION_LABEL_INCLUDED: 'historical_classification_label_included',
});

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS = Object.freeze({
  CONFOUNDED_ABLATION: 'confounded_ablation',
  DUPLICATE_CONDITION_ID: 'duplicate_condition_id',
  FIXTURE_DOCUMENT_FINGERPRINT_MISMATCH: 'fixture_document_fingerprint_mismatch',
  INCOMPLETE_CONDITION_SET: 'incomplete_condition_set',
  INVALID_ARTIFACT: 'invalid_artifact',
  INVALID_CONDITION_ID: 'invalid_condition_id',
  INVALID_FINGERPRINT: 'invalid_fingerprint',
  INVALID_VERSION: 'invalid_version',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  SNAPSHOT_DOCUMENT_FINGERPRINT_MISMATCH: 'snapshot_document_fingerprint_mismatch',
  UNKNOWN_FIELD: 'unknown_field',
});

const ARTIFACT_SET_KEYS = Object.freeze([
  'conditions',
  'fixtureDocumentFingerprint',
  'snapshotDocumentFingerprint',
  'version',
]);
const CONDITION_KEYS = Object.freeze(['conditionId', 'representationArtifact']);
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const CONDITION_IDS = new Set(Object.values(
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_CONDITION_IDS,
));
const SHARED_REPRESENTATION_IDS = Object.freeze([
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS.DECLARED_LIBRARY_PURPOSE,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_IDS.MEDIA_DESCRIPTION,
]);

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function buildIssue(riskId, path, message) {
  return Object.freeze({ riskId, path, message });
}

function hasExactKeys(value, keys, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.INVALID_ARTIFACT,
      path,
      'Value must be a plain JSON object.',
    ));
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      issues.push(buildIssue(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.UNKNOWN_FIELD,
        `${path}.${key}`,
        'Field is not allowed by the retrieval-representation artifact set.',
      ));
    }
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) {
      issues.push(buildIssue(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.MISSING_REQUIRED_FIELD,
        `${path}.${key}`,
        'Field is required by the retrieval-representation artifact set.',
      ));
    }
  }
  return true;
}

function validateFingerprint(value, path, issues) {
  if (typeof value === 'string' && FINGERPRINT_PATTERN.test(value)) return;
  issues.push(buildIssue(
    HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.INVALID_FINGERPRINT,
    path,
    'Fingerprint must be a SHA-256 content address.',
  ));
}

function signalsByFixtureId(artifact, representationId) {
  const representation = artifact?.representationResults?.find((entry) => (
    entry?.representationId === representationId
  ));
  if (!representation || !Array.isArray(representation.signals)) return null;
  return new Map(representation.signals.map((signal) => [signal.fixtureId, signal.decisionId]));
}

function sharedRepresentationSignalsMatch(leftArtifact, rightArtifact, representationId) {
  const left = signalsByFixtureId(leftArtifact, representationId);
  const right = signalsByFixtureId(rightArtifact, representationId);
  if (!(left instanceof Map) || !(right instanceof Map) || left.size !== right.size) return false;
  return [...left].every(([fixtureId, decisionId]) => right.get(fixtureId) === decisionId);
}

function validateCondition(condition, index, artifactSet, issues) {
  const path = `artifactSet.conditions[${index}]`;
  if (!hasExactKeys(condition, CONDITION_KEYS, path, issues)) return null;
  if (!CONDITION_IDS.has(condition.conditionId)) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.INVALID_CONDITION_ID,
      `${path}.conditionId`,
      'Condition must include or exclude historical classification labels.',
    ));
  }
  const validation = validateHeldOutSemanticStudyRetrievalRepresentationArtifact(
    condition.representationArtifact,
  );
  validation.issues.forEach((issue) => issues.push(buildIssue(
    HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.INVALID_ARTIFACT,
    `${path}.representationArtifact.${issue.path.replace(/^artifact\.?/u, '')}`,
    issue.message,
  )));
  if (condition.representationArtifact?.fixtureDocumentFingerprint !==
      artifactSet.fixtureDocumentFingerprint) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS
        .FIXTURE_DOCUMENT_FINGERPRINT_MISMATCH,
      `${path}.representationArtifact.fixtureDocumentFingerprint`,
      'Every condition must use the artifact set fixture-document fingerprint.',
    ));
  }
  if (condition.representationArtifact?.snapshotDocumentFingerprint !==
      artifactSet.snapshotDocumentFingerprint) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS
        .SNAPSHOT_DOCUMENT_FINGERPRINT_MISMATCH,
      `${path}.representationArtifact.snapshotDocumentFingerprint`,
      'Every condition must use the artifact set snapshot-document fingerprint.',
    ));
  }
  return CONDITION_IDS.has(condition.conditionId) && validation.ok ? condition.conditionId : null;
}

export function isHeldOutSemanticStudyRetrievalRepresentationArtifactSetShape(value) {
  return isPlainRecord(value) &&
    value.version === HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_VERSION;
}

/**
 * Validates paired outputs for the sole historical-classification-label
 * ablation. Media-description and declared-purpose signals must be identical
 * across conditions; otherwise the proposed ablation is confounded.
 */
export function validateHeldOutSemanticStudyRetrievalRepresentationArtifactSet(artifactSet) {
  const issues = [];
  if (!hasExactKeys(artifactSet, ARTIFACT_SET_KEYS, 'artifactSet', issues)) {
    return Object.freeze({ conditionCount: 0, issues: Object.freeze(issues), ok: false });
  }
  if (artifactSet.version !== HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_VERSION) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.INVALID_VERSION,
      'artifactSet.version',
      'Artifact set must declare the current paired-ablation version.',
    ));
  }
  validateFingerprint(artifactSet.fixtureDocumentFingerprint, 'artifactSet.fixtureDocumentFingerprint', issues);
  validateFingerprint(artifactSet.snapshotDocumentFingerprint, 'artifactSet.snapshotDocumentFingerprint', issues);
  if (!Array.isArray(artifactSet.conditions) || artifactSet.conditions.length !== CONDITION_IDS.size) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.INCOMPLETE_CONDITION_SET,
      'artifactSet.conditions',
      'Artifact set must contain both fixed historical-label conditions.',
    ));
  } else {
    const conditionIds = new Set();
    artifactSet.conditions.forEach((condition, index) => {
      const conditionId = validateCondition(condition, index, artifactSet, issues);
      if (conditionId && conditionIds.has(conditionId)) {
        issues.push(buildIssue(
          HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.DUPLICATE_CONDITION_ID,
          `artifactSet.conditions[${index}].conditionId`,
          'A paired ablation can include each condition exactly once.',
        ));
      }
      if (conditionId) conditionIds.add(conditionId);
    });
    for (const conditionId of CONDITION_IDS) {
      if (!conditionIds.has(conditionId)) {
        issues.push(buildIssue(
          HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.INCOMPLETE_CONDITION_SET,
          'artifactSet.conditions',
          'Artifact set omits one required historical-label condition.',
        ));
      }
    }
    const included = artifactSet.conditions.find((condition) => condition?.conditionId ===
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_CONDITION_IDS
        .HISTORICAL_CLASSIFICATION_LABEL_INCLUDED);
    const excluded = artifactSet.conditions.find((condition) => condition?.conditionId ===
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_CONDITION_IDS
        .HISTORICAL_CLASSIFICATION_LABEL_EXCLUDED);
    if (included && excluded) {
      for (const representationId of SHARED_REPRESENTATION_IDS) {
        if (!sharedRepresentationSignalsMatch(
          included.representationArtifact,
          excluded.representationArtifact,
          representationId,
        )) {
          issues.push(buildIssue(
            HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.CONFOUNDED_ABLATION,
            `artifactSet.conditions.${representationId}`,
            'Only nearest-item history may differ between the two label-ablation conditions.',
          ));
        }
      }
    }
  }
  return Object.freeze({
    conditionCount: Array.isArray(artifactSet.conditions) ? artifactSet.conditions.length : 0,
    issues: Object.freeze(issues),
    ok: issues.length === 0,
  });
}

/** Validates every condition against the exact redacted evaluation inputs. */
export function validateHeldOutSemanticStudyRetrievalRepresentationArtifactSetBinding({
  artifactSet,
  fixtureDocument,
  snapshotDocument,
} = {}) {
  const setValidation = validateHeldOutSemanticStudyRetrievalRepresentationArtifactSet(artifactSet);
  const issues = [...setValidation.issues];
  if (!setValidation.ok) return Object.freeze({ issues: Object.freeze(issues), ok: false });
  for (const condition of artifactSet.conditions) {
    const binding = validateHeldOutSemanticStudyRetrievalRepresentationArtifactBinding({
      artifact: condition.representationArtifact,
      fixtureDocument,
      snapshotDocument,
    });
    binding.issues.forEach((issue) => issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.INVALID_ARTIFACT,
      `artifactSet.conditions.${condition.conditionId}.${issue.path}`,
      issue.message,
    )));
  }
  return Object.freeze({ issues: Object.freeze(issues), ok: issues.length === 0 });
}

/** Creates a paired, content-free artifact set from already-validated artifacts. */
export function buildHeldOutSemanticStudyRetrievalRepresentationArtifactSet({
  fixtureDocumentFingerprint,
  includedArtifact,
  excludedArtifact,
  snapshotDocumentFingerprint,
} = {}) {
  return Object.freeze({
    conditions: Object.freeze([
      Object.freeze({
        conditionId: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_CONDITION_IDS
          .HISTORICAL_CLASSIFICATION_LABEL_INCLUDED,
        representationArtifact: includedArtifact,
      }),
      Object.freeze({
        conditionId: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_CONDITION_IDS
          .HISTORICAL_CLASSIFICATION_LABEL_EXCLUDED,
        representationArtifact: excludedArtifact,
      }),
    ]),
    fixtureDocumentFingerprint,
    snapshotDocumentFingerprint,
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_VERSION,
  });
}

export { HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_VERSION };
