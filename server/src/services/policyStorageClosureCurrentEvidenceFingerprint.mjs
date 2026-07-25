/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';
import path from 'node:path';

const POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_VERSION =
  'policy.storage_closure_current_evidence_fingerprint.v1';

const POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_STATUS_IDS =
  Object.freeze({
    COMPLETE: 'complete',
    INCOMPLETE: 'incomplete',
  });

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRepositoryPath(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(item => stableValue(item));
  if (!value || typeof value !== 'object') {
    return typeof value === 'bigint' ? value.toString() : value;
  }

  return Object.keys(value)
    .filter(key => !['function', 'symbol', 'undefined'].includes(typeof value[key]))
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = stableValue(value[key]);
      return normalized;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value = '') {
  return createHash('sha256').update(String(value)).digest('hex');
}

function uniqueSortedPaths(paths = []) {
  return [...new Set(asArray(paths).map(normalizeRepositoryPath).filter(Boolean))].sort();
}

function readContentDigest({ cwd, repositoryPath, readTextFile }) {
  try {
    return {
      repositoryPath,
      contentDigest: sha256(readTextFile(path.resolve(cwd, repositoryPath))),
    };
  } catch (_err) {
    return {
      repositoryPath,
      contentDigest: null,
    };
  }
}

function buildPolicyStorageClosureCurrentEvidenceFingerprint({
  cwd = process.cwd(),
  artifactPaths = [],
  roadmapPath = '',
  roadmapContent = '',
  changelogPath = '',
  changelogContent = '',
  readTextFile,
} = {}) {
  const artifactContent = uniqueSortedPaths(artifactPaths).map(repositoryPath => (
    readContentDigest({ cwd, repositoryPath, readTextFile })
  ));
  const missingArtifactPaths = artifactContent
    .filter(entry => entry.contentDigest === null)
    .map(entry => entry.repositoryPath);
  const normalizedRoadmapPath = normalizeRepositoryPath(roadmapPath);
  const normalizedChangelogPath = normalizeRepositoryPath(changelogPath);
  const source = {
    artifactContent,
    roadmap: {
      repositoryPath: normalizedRoadmapPath,
      contentDigest: normalizedRoadmapPath ? sha256(roadmapContent) : null,
    },
    changelog: {
      repositoryPath: normalizedChangelogPath,
      contentDigest: normalizedChangelogPath ? sha256(changelogContent) : null,
    },
  };
  const complete = (
    missingArtifactPaths.length === 0 &&
    source.roadmap.contentDigest !== null &&
    source.changelog.contentDigest !== null
  );

  return {
    version: POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_VERSION,
    algorithm: 'sha256',
    statusId: complete
      ? POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_STATUS_IDS.COMPLETE
      : POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_STATUS_IDS.INCOMPLETE,
    complete,
    artifactPathCount: artifactContent.length,
    missingArtifactPaths,
    roadmapPath: normalizedRoadmapPath || null,
    changelogPath: normalizedChangelogPath || null,
    fingerprint: sha256(stableStringify(source)),
  };
}

function validatePolicyStorageClosureCurrentEvidenceFingerprint({
  currentEvidenceFingerprint = null,
} = {}) {
  const value = currentEvidenceFingerprint &&
    typeof currentEvidenceFingerprint === 'object' &&
    !Array.isArray(currentEvidenceFingerprint)
    ? currentEvidenceFingerprint
    : {};
  const issues = [];

  if (
    value.version !== POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_VERSION ||
    value.algorithm !== 'sha256' ||
    !SHA256_FINGERPRINT_PATTERN.test(String(value.fingerprint || '').trim())
  ) {
    issues.push({
      riskId: 'current_evidence_fingerprint_invalid',
      message: 'Current closure evidence must include a versioned SHA-256 checkout fingerprint.',
    });
  }

  if (
    !Object.values(POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_STATUS_IDS)
      .includes(value.statusId) ||
    value.complete !== (value.statusId ===
      POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_STATUS_IDS.COMPLETE)
  ) {
    issues.push({
      riskId: 'current_evidence_fingerprint_status_invalid',
      message: 'Current closure evidence fingerprint status must agree with its complete flag.',
    });
  }

  if (!Number.isInteger(value.artifactPathCount) || value.artifactPathCount < 0) {
    issues.push({
      riskId: 'current_evidence_fingerprint_path_count_invalid',
      message: 'Current closure evidence fingerprint must report a non-negative mapped artifact count.',
    });
  }

  if (!Array.isArray(value.missingArtifactPaths)) {
    issues.push({
      riskId: 'current_evidence_fingerprint_missing_paths_invalid',
      message: 'Current closure evidence fingerprint must retain a missing-path list.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_STATUS_IDS,
  POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_VERSION,
  buildPolicyStorageClosureCurrentEvidenceFingerprint,
  validatePolicyStorageClosureCurrentEvidenceFingerprint,
};
