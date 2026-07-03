import { createHash } from 'node:crypto';

const POLICY_RUNTIME_EVIDENCE_FINGERPRINT_VERSION =
  'policy.runtime_evidence_fingerprint.v1';

const POLICY_RUNTIME_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES = Object.freeze({
  FINGERPRINT: 'classifarr.runtime.evidence.projection_fingerprint',
  PROJECTION_VERSION: 'classifarr.runtime.evidence.projection_version',
  TOTAL_ENTRY_COUNT: 'classifarr.runtime.evidence.total_entry_count',
  SOURCE_IDS: 'classifarr.runtime.evidence.source_ids',
  RUNTIME_SOURCE_IDS: 'classifarr.runtime.evidence.runtime_source_ids',
  AUTHORITY_SOURCE_IDS: 'classifarr.runtime.evidence.authority_source_ids',
  DEMOTION_REASON_IDS: 'classifarr.runtime.evidence.demotion_reason_ids',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(item => stableValue(item));
  }

  if (!value || typeof value !== 'object') {
    if (typeof value === 'bigint') return value.toString();
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

function uniqueSorted(values) {
  return [...new Set(asArray(values).filter(Boolean).map(String))].sort();
}

function normalizeEntry(entry = {}) {
  return {
    bucketId: entry.bucketId || null,
    sourceId: entry.sourceId || null,
    runtimeSourceId: entry.runtimeSourceId || null,
    authoritySourceId: entry.authoritySourceId || null,
    key: entry.key || null,
    label: entry.label || null,
    value: entry.value || null,
    count: entry.count ?? null,
    confidence: entry.confidence ?? null,
    reasonCode: entry.reasonCode || null,
    demotedFromBucketId: entry.demotedFromBucketId || null,
    observedAt: entry.observedAt || null,
    stale: entry.stale,
    trusted: entry.trusted,
  };
}

function compareEntry(left, right) {
  return [
    'bucketId',
    'sourceId',
    'runtimeSourceId',
    'authoritySourceId',
    'key',
    'label',
    'reasonCode',
  ].reduce((result, fieldName) => {
    if (result !== 0) return result;
    return String(left[fieldName] || '').localeCompare(String(right[fieldName] || ''));
  }, 0);
}

function listRuntimeEvidenceEntries(projection = {}) {
  return Object.values(projection.buckets || {})
    .flat()
    .map(normalizeEntry)
    .sort(compareEntry);
}

function buildBucketCounts(entries = []) {
  const counts = new Map();

  entries.forEach(entry => {
    counts.set(entry.bucketId, (counts.get(entry.bucketId) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([bucketId, entryCount]) => ({ bucketId, entryCount }))
    .sort((left, right) => String(left.bucketId).localeCompare(String(right.bucketId)));
}

function buildPolicyRuntimeEvidenceFingerprint(projection = {}) {
  const entries = listRuntimeEvidenceEntries(projection);
  const sourceIds = uniqueSorted(entries.map(entry => entry.sourceId));
  const runtimeSourceIds = uniqueSorted(entries.map(entry => entry.runtimeSourceId));
  const authoritySourceIds = uniqueSorted(entries.map(entry => entry.authoritySourceId));
  const demotionReasonIds = uniqueSorted(
    entries
      .filter(entry => entry.demotedFromBucketId)
      .map(entry => entry.reasonCode)
  );
  const warningReasonIds = uniqueSorted(
    asArray(projection.warnings).map(warning => warning?.reasonCode)
  );
  const payload = {
    version: POLICY_RUNTIME_EVIDENCE_FINGERPRINT_VERSION,
    projectionVersion: projection.version || null,
    evidenceVersion: projection.evidenceVersion || null,
    generatedFromLiveProvider: projection.generatedFromLiveProvider === true,
    exposesRawProviderPayloads: projection.exposesRawProviderPayloads === true,
    exposesUiChipLanguage: projection.exposesUiChipLanguage === true,
    entries,
    warningReasonIds,
  };
  const fingerprint = sha256(stableStringify(payload));

  return {
    version: POLICY_RUNTIME_EVIDENCE_FINGERPRINT_VERSION,
    algorithm: 'sha256',
    fingerprint,
    provenance: {
      projectionVersion: projection.version || null,
      evidenceVersion: projection.evidenceVersion || null,
      totalEntryCount: entries.length,
      sourceIds,
      runtimeSourceIds,
      authoritySourceIds,
      demotionReasonIds,
      warningReasonIds,
      bucketCounts: buildBucketCounts(entries),
      generatedFromLiveProvider: projection.generatedFromLiveProvider === true,
      exposesRawProviderPayloads: projection.exposesRawProviderPayloads === true,
      exposesUiChipLanguage: projection.exposesUiChipLanguage === true,
    },
    traceAttributes: {
      [POLICY_RUNTIME_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.FINGERPRINT]: fingerprint,
      [POLICY_RUNTIME_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.PROJECTION_VERSION]:
        projection.version || null,
      [POLICY_RUNTIME_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.TOTAL_ENTRY_COUNT]:
        entries.length,
      [POLICY_RUNTIME_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.SOURCE_IDS]: sourceIds,
      [POLICY_RUNTIME_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.RUNTIME_SOURCE_IDS]:
        runtimeSourceIds,
      [POLICY_RUNTIME_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.AUTHORITY_SOURCE_IDS]:
        authoritySourceIds,
      [POLICY_RUNTIME_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.DEMOTION_REASON_IDS]:
        demotionReasonIds,
    },
  };
}

export {
  POLICY_RUNTIME_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES,
  POLICY_RUNTIME_EVIDENCE_FINGERPRINT_VERSION,
  buildPolicyRuntimeEvidenceFingerprint,
};
