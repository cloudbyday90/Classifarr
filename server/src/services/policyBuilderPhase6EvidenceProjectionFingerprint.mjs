import { createHash } from 'node:crypto';

const PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_VERSION =
  'phase6r.evidence_projection_fingerprint.v1';

const PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES = Object.freeze({
  FINGERPRINT: 'classifarr.policy.evidence.projection_fingerprint',
  PROJECTION_VERSION: 'classifarr.policy.evidence.projection_version',
  TOTAL_ENTRY_COUNT: 'classifarr.policy.evidence.total_entry_count',
  SOURCE_IDS: 'classifarr.policy.evidence.source_ids',
  AUTHORITY_SOURCE_IDS: 'classifarr.policy.evidence.authority_source_ids',
});

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

function buildPolicyBuilderPhase6EvidenceProjectionFingerprint(projection = {}) {
  const summary = projection?.summary && typeof projection.summary === 'object'
    ? projection.summary
    : {};
  const sourceIds = asArray(summary.sourceIds).map(String).sort();
  const authoritySourceIds = asArray(summary.authoritySourceIds).map(String).sort();
  const bucketCounts = buildBucketCounts(summary);
  const payload = {
    version: PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_VERSION,
    projectionVersion: projection.version || null,
    generatedFromLiveProvider: projection.generatedFromLiveProvider === true,
    exposesRawProviderPayloads: projection.exposesRawProviderPayloads === true,
    exposesUiChipLanguage: projection.exposesUiChipLanguage === true,
    buckets: projection.buckets || {},
    warnings: asArray(projection.warnings),
    summary,
  };
  const serializedProjection = stableStringify(payload);
  const fingerprint = sha256(serializedProjection);

  return {
    version: PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_VERSION,
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
      [PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES.FINGERPRINT]: fingerprint,
      [PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES.PROJECTION_VERSION]:
        projection.version || null,
      [PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES.TOTAL_ENTRY_COUNT]:
        Number.isFinite(Number(summary.totalEntryCount)) ? Number(summary.totalEntryCount) : 0,
      [PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES.SOURCE_IDS]: sourceIds,
      [PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES.AUTHORITY_SOURCE_IDS]:
        authoritySourceIds,
    },
  };
}

export {
  PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_TRACE_ATTRIBUTES,
  PHASE6R_EVIDENCE_PROJECTION_FINGERPRINT_VERSION,
  buildPolicyBuilderPhase6EvidenceProjectionFingerprint,
  stableStringify,
};
