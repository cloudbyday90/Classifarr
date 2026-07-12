import { createHash } from 'node:crypto';
import { sortPolicyEvidenceEntries } from './policyEvidenceEntryIdentity.mjs';

const POLICY_EVIDENCE_FINGERPRINT_VERSION =
  'policy.evidence.fingerprint.v1';

const POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES = Object.freeze({
  FINGERPRINT: 'classifarr.policy.evidence.projection_fingerprint',
  PROJECTION_VERSION: 'classifarr.policy.evidence.projection_version',
  TOTAL_ENTRY_COUNT: 'classifarr.policy.evidence.total_entry_count',
  SOURCE_IDS: 'classifarr.policy.evidence.source_ids',
  AUTHORITY_SOURCE_IDS: 'classifarr.policy.evidence.authority_source_ids',
});

const POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS = Object.freeze({
  MISSING_PROJECTION: 'missing_projection',
  MISSING_FINGERPRINT: 'missing_fingerprint',
  MALFORMED_FINGERPRINT: 'malformed_fingerprint',
  FINGERPRINT_MISMATCH: 'fingerprint_mismatch',
  TRACE_FINGERPRINT_MISMATCH: 'trace_fingerprint_mismatch',
  PROVENANCE_MISMATCH: 'provenance_mismatch',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(item => stableValue(item));
  }

  if (!value || typeof value !== 'object') {
    if (typeof value === 'bigint') {
      return value.toString();
    }

    return value;
  }

  return Object.keys(value)
    .filter(key => !['function', 'symbol', 'undefined'].includes(typeof value[key]))
    .sort()
    .reduce((acc, key) => {
      acc[key] = stableValue(value[key]);
      return acc;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildBucketCounts(summary = {}) {
  return asArray(summary.bucketSummaries)
    .map(bucket => ({
      bucketId: bucket.bucketId,
      entryCount: Number.isFinite(Number(bucket.entryCount))
        ? Number(bucket.entryCount)
        : 0,
      readinessId: bucket.readinessId || null,
    }))
    .sort((left, right) => String(left.bucketId).localeCompare(String(right.bucketId)));
}

function buildCanonicalProjectionBuckets(buckets = {}) {
  if (!buckets || typeof buckets !== 'object' || Array.isArray(buckets)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(buckets).map(([bucketId, entries]) => [
      bucketId,
      sortPolicyEvidenceEntries(entries),
    ])
  );
}

function buildPolicyEvidenceFingerprint(projection = {}) {
  const summary = projection?.summary && typeof projection.summary === 'object'
    ? projection.summary
    : {};
  const sourceIds = asArray(summary.sourceIds).map(String).sort();
  const authoritySourceIds = asArray(summary.authoritySourceIds).map(String).sort();
  const bucketCounts = buildBucketCounts(summary);
  const payload = {
    version: POLICY_EVIDENCE_FINGERPRINT_VERSION,
    projectionVersion: projection.version || null,
    generatedFromLiveProvider: projection.generatedFromLiveProvider === true,
    exposesRawProviderPayloads: projection.exposesRawProviderPayloads === true,
    exposesUiChipLanguage: projection.exposesUiChipLanguage === true,
    buckets: buildCanonicalProjectionBuckets(projection.buckets),
    warnings: asArray(projection.warnings),
    summary,
  };
  const serializedProjection = stableStringify(payload);
  const fingerprint = sha256(serializedProjection);

  return {
    version: POLICY_EVIDENCE_FINGERPRINT_VERSION,
    algorithm: 'sha256',
    fingerprint,
    provenance: {
      projectionVersion: projection.version || null,
      totalEntryCount: Number.isFinite(Number(summary.totalEntryCount))
        ? Number(summary.totalEntryCount)
        : 0,
      sourceIds,
      authoritySourceIds,
      bucketCounts,
      hasBlockingEvidence: summary.hasBlockingEvidence === true,
      hasReviewEvidence: summary.hasReviewEvidence === true,
    },
    traceAttributes: {
      [POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.FINGERPRINT]: fingerprint,
      [POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.PROJECTION_VERSION]:
        projection.version || null,
      [POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.TOTAL_ENTRY_COUNT]:
        Number.isFinite(Number(summary.totalEntryCount)) ? Number(summary.totalEntryCount) : 0,
      [POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.SOURCE_IDS]: sourceIds,
      [POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.AUTHORITY_SOURCE_IDS]:
        authoritySourceIds,
    },
  };
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function arraysEqual(left = [], right = []) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function bucketCountsEqual(left = [], right = []) {
  if (left.length !== right.length) return false;

  return left.every((leftBucket, index) => {
    const rightBucket = right[index] || {};

    return leftBucket.bucketId === rightBucket.bucketId &&
      Number(leftBucket.entryCount) === Number(rightBucket.entryCount) &&
      (leftBucket.readinessId || null) === (rightBucket.readinessId || null);
  });
}

function validatePolicyEvidenceFingerprint({
  projection = null,
  projectionFingerprint = null,
} = {}) {
  const issues = [];

  if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
    issues.push({
      riskId: POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS.MISSING_PROJECTION,
      message: 'Evidence projection fingerprint validation requires the bounded projection.',
    });
  }

  if (
    !projectionFingerprint ||
    typeof projectionFingerprint !== 'object' ||
    Array.isArray(projectionFingerprint)
  ) {
    issues.push({
      riskId: POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS.MISSING_FINGERPRINT,
      message: 'Evidence projection fingerprint validation requires a fingerprint artifact.',
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issueCount: issues.length,
      issues,
    };
  }

  const expected = buildPolicyEvidenceFingerprint(projection);
  const fingerprintValue = normalizeString(projectionFingerprint.fingerprint).toLowerCase();
  const traceFingerprintValue = normalizeString(
    projectionFingerprint.traceAttributes?.[
      POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.FINGERPRINT
    ]
  ).toLowerCase();

  if (
    projectionFingerprint.version !== POLICY_EVIDENCE_FINGERPRINT_VERSION ||
    projectionFingerprint.algorithm !== 'sha256' ||
    !SHA256_FINGERPRINT_PATTERN.test(fingerprintValue)
  ) {
    issues.push({
      riskId: POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS.MALFORMED_FINGERPRINT,
      message: 'Evidence projection fingerprint must be a versioned SHA-256 hex digest.',
    });
  }

  if (fingerprintValue && fingerprintValue !== expected.fingerprint) {
    issues.push({
      riskId: POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS.FINGERPRINT_MISMATCH,
      message: 'Evidence projection fingerprint must match the bounded projection.',
    });
  }

  const traceAttributes = projectionFingerprint.traceAttributes || {};
  const traceSourceIds = asArray(traceAttributes[
    POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.SOURCE_IDS
  ]).map(String).sort();
  const traceAuthoritySourceIds = asArray(traceAttributes[
    POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.AUTHORITY_SOURCE_IDS
  ]).map(String).sort();

  if (
    traceFingerprintValue !== expected.fingerprint ||
    traceAttributes[
      POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.PROJECTION_VERSION
    ] !== expected.traceAttributes[
      POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.PROJECTION_VERSION
    ] ||
    Number(traceAttributes[
      POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.TOTAL_ENTRY_COUNT
    ]) !== expected.traceAttributes[
      POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.TOTAL_ENTRY_COUNT
    ] ||
    !arraysEqual(traceSourceIds, expected.traceAttributes[
      POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.SOURCE_IDS
    ]) ||
    !arraysEqual(traceAuthoritySourceIds, expected.traceAttributes[
      POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.AUTHORITY_SOURCE_IDS
    ])
  ) {
    issues.push({
      riskId: POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS.TRACE_FINGERPRINT_MISMATCH,
      message: 'Evidence projection fingerprint trace attributes must match the bounded projection.',
    });
  }

  const provenance = projectionFingerprint.provenance || {};
  if (
    Number(provenance.totalEntryCount) !== Number(expected.provenance.totalEntryCount) ||
    !arraysEqual(asArray(provenance.sourceIds).map(String).sort(), expected.provenance.sourceIds) ||
    !arraysEqual(
      asArray(provenance.authoritySourceIds).map(String).sort(),
      expected.provenance.authoritySourceIds
    ) ||
    !bucketCountsEqual(asArray(provenance.bucketCounts), expected.provenance.bucketCounts) ||
    provenance.hasBlockingEvidence !== expected.provenance.hasBlockingEvidence ||
    provenance.hasReviewEvidence !== expected.provenance.hasReviewEvidence
  ) {
    issues.push({
      riskId: POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS.PROVENANCE_MISMATCH,
      message: 'Evidence projection fingerprint provenance must match the bounded projection summary.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_EVIDENCE_FINGERPRINT_AUDIT_RISK_IDS,
  POLICY_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES,
  POLICY_EVIDENCE_FINGERPRINT_VERSION,
  buildPolicyEvidenceFingerprint,
  stableStringify,
  validatePolicyEvidenceFingerprint,
};
