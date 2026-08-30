/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_MANIFEST_VERSION =
  'policy.candidate_semantic_snapshot_manifest.v1';

export const POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_MANIFEST_RISK_IDS = Object.freeze({
  INVALID_DOCUMENT: 'invalid_document',
  INVALID_FINGERPRINT: 'invalid_fingerprint',
  INVALID_VERSION: 'invalid_version',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  UNKNOWN_FIELD: 'unknown_field',
});

const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function buildIssue(riskId, path, message) {
  return Object.freeze({ riskId, path, message });
}

function requireOwnField(value, key, issues) {
  if (Object.hasOwn(value, key)) return true;
  issues.push(buildIssue(
    POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_MANIFEST_RISK_IDS.MISSING_REQUIRED_FIELD,
    `manifest.${key}`,
    'Field is required by the semantic snapshot manifest contract.',
  ));
  return false;
}

export function validatePolicyCandidateSemanticSnapshotManifest(manifest) {
  const issues = [];
  if (!isPlainRecord(manifest)) {
    return {
      ok: false,
      issues: [buildIssue(
        POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_MANIFEST_RISK_IDS.INVALID_DOCUMENT,
        'manifest',
        'Manifest must be a plain JSON object.',
      )],
    };
  }

  const allowedKeys = ['fixtureDocumentFingerprint', 'snapshotDocumentFingerprint', 'version'];
  for (const key of Object.keys(manifest)) {
    if (!allowedKeys.includes(key)) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_MANIFEST_RISK_IDS.UNKNOWN_FIELD,
        `manifest.${key}`,
        'Field is not allowed by the semantic snapshot manifest contract.',
      ));
    }
  }

  const hasVersion = requireOwnField(manifest, 'version', issues);
  const hasFixtureFingerprint = requireOwnField(manifest, 'fixtureDocumentFingerprint', issues);
  const hasSnapshotFingerprint = requireOwnField(manifest, 'snapshotDocumentFingerprint', issues);

  if (hasVersion && manifest.version !== POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_MANIFEST_VERSION) {
    issues.push(buildIssue(
      POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_MANIFEST_RISK_IDS.INVALID_VERSION,
      'manifest.version',
      'Manifest must declare the current semantic snapshot manifest version.',
    ));
  }
  for (const [key, present] of [
    ['fixtureDocumentFingerprint', hasFixtureFingerprint],
    ['snapshotDocumentFingerprint', hasSnapshotFingerprint],
  ]) {
    if (present && (typeof manifest[key] !== 'string' || !FINGERPRINT_PATTERN.test(manifest[key]))) {
      issues.push(buildIssue(
        POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_MANIFEST_RISK_IDS.INVALID_FINGERPRINT,
        `manifest.${key}`,
        'Fingerprint must be a lower-case SHA-256 content address.',
      ));
    }
  }

  return { ok: issues.length === 0, issues };
}
