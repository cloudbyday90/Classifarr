import {
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';
import {
  BROAD_GENRE_LABELS,
} from './policyBuilderPhase6IntentEngine.mjs';
import {
  POLICY_EVIDENCE_BUCKET_IDS,
  POLICY_EVIDENCE_SOURCE_IDS,
  buildPolicyEvidenceProjection,
  getPolicyEvidenceBucket,
  getPolicyEvidenceSource,
  listPolicyEvidenceBuckets,
} from './policyEvidenceEngine.mjs';
import {
  PHASE7R_RUNTIME_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES,
  buildPolicyBuilderPhase7RuntimeEvidenceFingerprint,
} from './policyBuilderPhase7RuntimeEvidenceFingerprint.mjs';

const PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS = Object.freeze({
  LIBRARY_PROFILE: 'library_profile',
  OPERATOR_INTENT: 'operator_intent',
  HISTORY: 'history',
  RAG_NEIGHBOR: 'rag_neighbor',
  METADATA_SIGNAL: 'metadata_signal',
  ROUTING_OUTCOME: 'routing_outcome',
  PROFILE_FRESHNESS: 'profile_freshness',
});

const PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS = Object.freeze({
  BROAD_GENRE_WITHOUT_IDENTITY: 'broad_genre_without_identity',
  LOW_TRUST_RAG_NEIGHBOR: 'low_trust_rag_neighbor',
  UNKNOWN_LIBRARY_NEIGHBOR: 'unknown_library_neighbor',
  STALE_PROFILE: 'stale_profile',
  ROUTING_NOT_PROVEN: 'routing_not_proven',
  RAW_PAYLOAD_SUPPRESSED: 'raw_payload_suppressed',
});

const PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_BUCKET: 'unknown_bucket',
  UNKNOWN_PHASE6_SOURCE: 'unknown_phase6_source',
  UNKNOWN_AUTHORITY_SOURCE: 'unknown_authority_source',
  MISSING_ENTRY_LABEL: 'missing_entry_label',
  RAW_PAYLOAD_EXPOSED: 'raw_payload_exposed',
  LIVE_LOOKUP_USED: 'live_lookup_used',
  UI_LANGUAGE_EXPOSED: 'ui_language_exposed',
  BROAD_GENRE_PROMOTED_TO_IDENTITY: 'broad_genre_promoted_to_identity',
  LOW_TRUST_RAG_NOT_DEMOTED: 'low_trust_rag_not_demoted',
  UNKNOWN_LIBRARY_NOT_DEMOTED: 'unknown_library_not_demoted',
  STALE_PROFILE_NOT_INSUFFICIENT: 'stale_profile_not_insufficient',
  MISSING_TRACE_REASON: 'missing_trace_reason',
  MISSING_PROJECTION_FINGERPRINT: 'missing_projection_fingerprint',
  MALFORMED_PROJECTION_FINGERPRINT: 'malformed_projection_fingerprint',
  PROJECTION_FINGERPRINT_MISMATCH: 'projection_fingerprint_mismatch',
  PROJECTION_FINGERPRINT_PROVENANCE_MISMATCH:
    'projection_fingerprint_provenance_mismatch',
  PROJECTION_FINGERPRINT_TRACE_MISMATCH:
    'projection_fingerprint_trace_mismatch',
  RAW_PROVENANCE_EXPOSED: 'raw_provenance_exposed',
});

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

const BROAD_GENRE_SET = new Set(BROAD_GENRE_LABELS.map(label => label.toLowerCase()));
const AUTHORITY_IDS = Object.freeze(Object.values(AUTHORITY_SOURCE_IDS));
const PHASE6_BUCKET_IDS = Object.freeze(Object.values(POLICY_EVIDENCE_BUCKET_IDS));
const PHASE6_SOURCE_IDS = Object.freeze(Object.values(POLICY_EVIDENCE_SOURCE_IDS));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeConfidence(value) {
  const numeric = normalizeNumber(value);
  if (numeric === null) return null;
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
  return Math.max(0, Math.min(1, numeric));
}

function normalizeCount(value) {
  const numeric = normalizeNumber(value);
  if (numeric === null) return null;
  return Math.max(0, Math.trunc(numeric));
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(item => stableValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = stableValue(value[key]);
      return acc;
    }, {});
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function addProjectionFingerprintIssues(projection, issues) {
  const actualFingerprint = projection.projectionFingerprint;
  const expectedFingerprint =
    buildPolicyBuilderPhase7RuntimeEvidenceFingerprint(projection);
  const actualTraceAttributes = projection.trace?.attributes || {};
  const projectionTraceAttributes = actualFingerprint?.traceAttributes || {};
  const traceFingerprintKey =
    PHASE7R_RUNTIME_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTES.FINGERPRINT;

  if (!actualFingerprint?.fingerprint) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.MISSING_PROJECTION_FINGERPRINT,
      message: 'Runtime evidence projection must include a stable sanitized fingerprint.',
    });
    return;
  }

  if (!SHA256_HEX_PATTERN.test(actualFingerprint.fingerprint)) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.MALFORMED_PROJECTION_FINGERPRINT,
      message: 'Runtime evidence projection fingerprint must be a lowercase SHA-256 hex digest.',
    });
  }

  if (actualFingerprint.fingerprint !== expectedFingerprint.fingerprint) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_FINGERPRINT_MISMATCH,
      message: 'Runtime evidence projection fingerprint must match the sanitized projection payload.',
    });
  }

  if (
    stableJson(actualFingerprint.provenance || {}) !==
    stableJson(expectedFingerprint.provenance)
  ) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
        .PROJECTION_FINGERPRINT_PROVENANCE_MISMATCH,
      message: 'Runtime evidence projection fingerprint provenance must match the sanitized projection payload.',
    });
  }

  if (
    stableJson(projectionTraceAttributes) !==
    stableJson(expectedFingerprint.traceAttributes) ||
    actualTraceAttributes[traceFingerprintKey] !== actualFingerprint.fingerprint ||
    projectionTraceAttributes[traceFingerprintKey] !== actualFingerprint.fingerprint
  ) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS
        .PROJECTION_FINGERPRINT_TRACE_MISMATCH,
      message: 'Runtime evidence projection trace attributes must mirror the sanitized projection fingerprint.',
    });
  }
}

function isBroadGenreLabel(value) {
  return BROAD_GENRE_SET.has(normalizeString(value).toLowerCase());
}

function createEmptyRuntimeProjection() {
  return {
    version: 'phase7r.runtime_evidence_projection.v1',
    phase6EvidenceVersion: 'policy.evidence.v1',
    generatedFromLiveProvider: false,
    exposesRawProviderPayloads: false,
    exposesUiChipLanguage: false,
    buckets: Object.fromEntries(
      listPolicyEvidenceBuckets().map(bucket => [bucket.id, []])
    ),
    trace: {
      attributes: {
        'classifarr.runtime.evidence.version': 'phase7r.runtime_evidence_projection.v1',
      },
      reasons: [],
    },
    warnings: [],
    projectionFingerprint: null,
  };
}

function createRuntimeEvidenceEntry({
  bucketId,
  phase6SourceId,
  authoritySourceId,
  runtimeSourceId,
  key,
  label,
  value = null,
  count = null,
  confidence = null,
  reasonCode,
  demotedFromBucketId = null,
  observedAt = null,
  stale = null,
  trusted = null,
}) {
  const bucket = getPolicyEvidenceBucket(bucketId);
  const phase6Source = getPolicyEvidenceSource(phase6SourceId);
  const normalizedLabel = normalizeNullableString(label ?? key ?? value);

  if (!bucket || !phase6Source || !normalizedLabel) {
    return null;
  }

  if (!bucket.allowedSourceIds.includes(phase6SourceId) ||
      !bucket.authoritySourceIds.includes(authoritySourceId)) {
    return null;
  }

  return {
    bucketId,
    sourceId: phase6SourceId,
    runtimeSourceId,
    authoritySourceId,
    key: normalizeNullableString(key) || normalizedLabel.toLowerCase(),
    label: normalizedLabel,
    value: normalizeNullableString(value),
    count: normalizeCount(count),
    confidence: normalizeConfidence(confidence),
    reasonCode: normalizeNullableString(reasonCode),
    demotedFromBucketId: normalizeNullableString(demotedFromBucketId),
    observedAt: normalizeNullableString(observedAt),
    stale: typeof stale === 'boolean' ? stale : null,
    trusted: typeof trusted === 'boolean' ? trusted : null,
    includesRawPayload: false,
    liveLookupPerformed: false,
    exposesUiLanguage: false,
  };
}

function addEntry(projection, entry) {
  if (!entry) return;
  projection.buckets[entry.bucketId].push(entry);
  projection.trace.reasons.push({
    bucketId: entry.bucketId,
    sourceId: entry.sourceId,
    runtimeSourceId: entry.runtimeSourceId,
    reasonCode: entry.reasonCode,
    demotedFromBucketId: entry.demotedFromBucketId,
  });
}

function mapSignal(value) {
  if (typeof value === 'string') {
    return {
      key: value,
      label: value,
    };
  }

  if (!isObject(value)) {
    return null;
  }

  return {
    key: value.key ?? value.id ?? value.name ?? value.label ?? value.value,
    label: value.label ?? value.name ?? value.value ?? value.key ?? value.id,
    value: value.value,
    count: value.count ?? value.occurrences,
    confidence: value.confidence ?? value.score ?? value.similarity,
    observedAt: value.observedAt ?? value.updatedAt,
    trusted: value.trusted,
    stale: value.stale,
    libraryKnown: value.libraryKnown,
    hasTrustedOutcome: value.hasTrustedOutcome ?? value.trustedOutcome,
    compatibleProfile: value.compatibleProfile,
    rawPayloadPresent: Boolean(value.raw || value.payload || value.providerPayload),
  };
}

function mapProfileEvidence(projection, libraryProfile = {}) {
  asArray(libraryProfile.identityCandidates).forEach(value => {
    const signal = mapSignal(value);
    if (!signal) return;
    const broadGenre = isBroadGenreLabel(signal.label);
    const hasSupport = signal.count >= 2 || signal.trusted === true;
    const bucketId = broadGenre && !hasSupport
      ? POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY
      : POLICY_EVIDENCE_BUCKET_IDS.IDENTITY;

    addEntry(projection, createRuntimeEvidenceEntry({
      bucketId,
      phase6SourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.LIBRARY_PROFILE,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      ...signal,
      reasonCode: bucketId === POLICY_EVIDENCE_BUCKET_IDS.IDENTITY
        ? 'runtime_profile_identity'
        : PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.BROAD_GENRE_WITHOUT_IDENTITY,
      demotedFromBucketId: bucketId === POLICY_EVIDENCE_BUCKET_IDS.IDENTITY
        ? null
        : POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
    }));
  });

  asArray(libraryProfile.compatibilityCandidates).forEach(value => {
    const signal = mapSignal(value);
    addEntry(projection, createRuntimeEvidenceEntry({
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      phase6SourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.LIBRARY_PROFILE,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      ...signal,
      reasonCode: isBroadGenreLabel(signal?.label)
        ? PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.BROAD_GENRE_WITHOUT_IDENTITY
        : 'runtime_profile_compatibility',
      demotedFromBucketId: isBroadGenreLabel(signal?.label)
        ? POLICY_EVIDENCE_BUCKET_IDS.IDENTITY
        : null,
    }));
  });

  asArray(libraryProfile.outliers).forEach(value => {
    const signal = mapSignal(value);
    addEntry(projection, createRuntimeEvidenceEntry({
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      phase6SourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.LIBRARY_PROFILE,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      ...signal,
      reasonCode: 'runtime_profile_outlier',
    }));
  });
}

function mapOperatorIntentEvidence(projection, operatorIntent = {}) {
  const intentProjection = buildPolicyEvidenceProjection({ operatorIntent });

  Object.values(intentProjection.buckets).flat().forEach(entry => {
    addEntry(projection, {
      ...entry,
      runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.OPERATOR_INTENT,
      reasonCode: entry.reasonCode || 'runtime_operator_intent',
      exposesUiLanguage: false,
    });
  });
}

function mapHistoryEvidence(projection, input = {}) {
  asArray(input.classificationFinalOutcomes).forEach(value => {
    const signal = mapSignal(value);
    addEntry(projection, createRuntimeEvidenceEntry({
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      phase6SourceId: POLICY_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
      runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.HISTORY,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
      ...signal,
      reasonCode: 'runtime_final_outcome_compatibility',
    }));
  });

  asArray(input.manualCorrections).forEach(value => {
    const signal = mapSignal(value);
    addEntry(projection, createRuntimeEvidenceEntry({
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      phase6SourceId: POLICY_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
      runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.HISTORY,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
      ...signal,
      reasonCode: 'runtime_manual_correction_outlier',
    }));
  });

  asArray(input.pendingItemAnswers).forEach(value => {
    const signal = mapSignal(value);
    addEntry(projection, createRuntimeEvidenceEntry({
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
      phase6SourceId: POLICY_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
      runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.HISTORY,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
      ...signal,
      reasonCode: 'runtime_pending_answer_requires_learning_guard',
    }));
  });
}

function mapRagEvidence(projection, ragNeighbors = []) {
  asArray(ragNeighbors).forEach(value => {
    const signal = mapSignal(value);
    if (!signal) return;

    const knownLibrary = signal.libraryKnown !== false &&
      normalizeString(value.libraryName ?? value.library ?? signal.value).toLowerCase() !== 'unknown library';
    const trusted = signal.trusted === true || signal.hasTrustedOutcome === true;
    const compatibleProfile = signal.compatibleProfile === true;
    const strongEnough = knownLibrary && trusted && compatibleProfile;
    const bucketId = strongEnough
      ? POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY
      : POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT;
    const reasonCode = knownLibrary
      ? PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.LOW_TRUST_RAG_NEIGHBOR
      : PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.UNKNOWN_LIBRARY_NEIGHBOR;

    addEntry(projection, createRuntimeEvidenceEntry({
      bucketId,
      phase6SourceId: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.RAG_NEIGHBOR,
      authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      ...signal,
      reasonCode: strongEnough ? 'runtime_rag_compatibility' : reasonCode,
      demotedFromBucketId: strongEnough ? null : POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      trusted: strongEnough,
    }));
  });
}

function mapMetadataEvidence(projection, metadataSignals = []) {
  asArray(metadataSignals).forEach(value => {
    const signal = mapSignal(value);
    if (!signal) return;
    const broadGenre = isBroadGenreLabel(signal.label);
    const bucketId = broadGenre
      ? POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY
      : POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY;

    addEntry(projection, createRuntimeEvidenceEntry({
      bucketId,
      phase6SourceId: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.METADATA_SIGNAL,
      authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      ...signal,
      reasonCode: broadGenre
        ? PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.BROAD_GENRE_WITHOUT_IDENTITY
        : 'runtime_metadata_compatibility',
      demotedFromBucketId: broadGenre ? POLICY_EVIDENCE_BUCKET_IDS.IDENTITY : null,
    }));

    if (signal.rawPayloadPresent) {
      projection.warnings.push({
        reasonCode: PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.RAW_PAYLOAD_SUPPRESSED,
        message: 'Runtime metadata evidence suppressed a raw provider payload.',
      });
    }
  });
}

function mapRoutingEvidence(projection, routingOutcomes = []) {
  asArray(routingOutcomes).forEach(value => {
    const signal = mapSignal(value);
    if (!signal) return;
    const routed = value.routed === true || value.routeReady === true;
    const bucketId = routed
      ? POLICY_EVIDENCE_BUCKET_IDS.ROUTING
      : POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT;

    addEntry(projection, createRuntimeEvidenceEntry({
      bucketId,
      phase6SourceId: POLICY_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
      runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.ROUTING_OUTCOME,
      authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
      ...signal,
      reasonCode: routed
        ? 'runtime_arr_routing_outcome'
        : PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.ROUTING_NOT_PROVEN,
      demotedFromBucketId: routed ? null : POLICY_EVIDENCE_BUCKET_IDS.ROUTING,
    }));
  });
}

function mapProfileFreshnessEvidence(projection, profileFreshness = null) {
  if (!isObject(profileFreshness)) return;
  const stale = profileFreshness.stale === true;

  addEntry(projection, createRuntimeEvidenceEntry({
    bucketId: stale ? POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT : POLICY_EVIDENCE_BUCKET_IDS.FRESHNESS,
    phase6SourceId: POLICY_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
    runtimeSourceId: PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    key: profileFreshness.key ?? 'profile_freshness',
    label: profileFreshness.label ?? (stale ? 'Profile is stale' : 'Profile is fresh'),
    value: profileFreshness.value ?? profileFreshness.updatedAt,
    confidence: profileFreshness.confidence,
    observedAt: profileFreshness.updatedAt,
    stale,
    reasonCode: stale
      ? PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.STALE_PROFILE
      : 'runtime_profile_current',
    demotedFromBucketId: stale ? POLICY_EVIDENCE_BUCKET_IDS.FRESHNESS : null,
  }));
}

function buildPolicyBuilderPhase7RuntimeEvidenceProjection(input = {}) {
  const projection = createEmptyRuntimeProjection();

  mapProfileEvidence(projection, input.libraryProfile || {});
  mapOperatorIntentEvidence(projection, input.operatorIntent || {});
  mapHistoryEvidence(projection, input);
  mapRagEvidence(projection, input.ragNeighbors || input.ragEvidence || []);
  mapMetadataEvidence(projection, input.metadataSignals || input.metadataEvidence || []);
  mapRoutingEvidence(projection, input.routingOutcomes || []);
  mapProfileFreshnessEvidence(projection, input.profileFreshness || null);

  if (Object.values(projection.buckets).every(entries => entries.length === 0)) {
    projection.warnings.push({
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
      reasonCode: 'no_runtime_evidence_inputs',
      message: 'No Phase 7R runtime evidence inputs were provided.',
    });
  }

  projection.trace.attributes['classifarr.runtime.evidence.entry_count'] =
    Object.values(projection.buckets).flat().length;
  projection.trace.attributes['classifarr.runtime.evidence.warning_count'] =
    projection.warnings.length;
  projection.projectionFingerprint =
    buildPolicyBuilderPhase7RuntimeEvidenceFingerprint(projection);
  Object.assign(
    projection.trace.attributes,
    projection.projectionFingerprint.traceAttributes
  );

  return projection;
}

function validateRuntimeEvidenceEntry(entry = {}) {
  const issues = [];

  if (!PHASE6_BUCKET_IDS.includes(entry.bucketId)) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_BUCKET,
      message: 'Runtime evidence entry must use a Phase 6R bucket.',
    });
  }

  if (!PHASE6_SOURCE_IDS.includes(entry.sourceId)) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_PHASE6_SOURCE,
      message: 'Runtime evidence entry must use a Phase 6R source.',
    });
  }

  if (!AUTHORITY_IDS.includes(entry.authoritySourceId)) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_AUTHORITY_SOURCE,
      message: 'Runtime evidence entry must use an approved authority source.',
    });
  }

  if (!normalizeString(entry.label)) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.MISSING_ENTRY_LABEL,
      message: 'Runtime evidence entries must have bounded labels.',
    });
  }

  if (!normalizeString(entry.reasonCode)) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      message: 'Runtime evidence entries must include reason codes.',
    });
  }

  if (entry.includesRawPayload === true) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      message: 'Runtime evidence entries must not expose raw provider payloads.',
    });
  }

  if (entry.liveLookupPerformed === true) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.LIVE_LOOKUP_USED,
      message: 'Runtime evidence projection must not perform live provider lookups.',
    });
  }

  if (entry.exposesUiLanguage === true) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.UI_LANGUAGE_EXPOSED,
      message: 'Runtime evidence entries must not expose UI chip language as evidence.',
    });
  }

  if (
    entry.bucketId === POLICY_EVIDENCE_BUCKET_IDS.IDENTITY &&
    isBroadGenreLabel(entry.label) &&
    entry.authoritySourceId !== AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT &&
    entry.reasonCode !== 'runtime_profile_identity'
  ) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.BROAD_GENRE_PROMOTED_TO_IDENTITY,
      message: 'Broad genres cannot become runtime identity without strong profile or declared intent support.',
    });
  }

  if (
    entry.runtimeSourceId === PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS.RAG_NEIGHBOR &&
    entry.trusted !== true &&
    entry.bucketId !== POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT
  ) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.LOW_TRUST_RAG_NOT_DEMOTED,
      message: 'Low-trust RAG neighbors must be demoted to insufficient evidence.',
    });
  }

  if (
    entry.reasonCode === PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS.UNKNOWN_LIBRARY_NEIGHBOR &&
    entry.bucketId !== POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT
  ) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_LIBRARY_NOT_DEMOTED,
      message: 'Unknown-library evidence must be demoted to insufficient evidence.',
    });
  }

  if (
    entry.stale === true &&
    entry.bucketId !== POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT
  ) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.STALE_PROFILE_NOT_INSUFFICIENT,
      message: 'Stale profile evidence must be represented as insufficient evidence.',
    });
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

function validatePolicyBuilderPhase7RuntimeEvidenceProjection(projection = {}) {
  const entries = Object.values(projection.buckets || {}).flat();
  const issues = entries.flatMap(entry => validateRuntimeEvidenceEntry(entry).issues);
  const projectionFingerprint = projection.projectionFingerprint;

  if (projection.generatedFromLiveProvider === true) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.LIVE_LOOKUP_USED,
      message: 'Runtime evidence projection cannot be generated from a live provider lookup.',
    });
  }

  if (projection.exposesRawProviderPayloads === true) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      message: 'Runtime evidence projection cannot expose raw provider payloads.',
    });
  }

  if (projection.exposesUiChipLanguage === true) {
    issues.push({
      riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.UI_LANGUAGE_EXPOSED,
      message: 'Runtime evidence projection cannot expose UI chip language.',
    });
  }

  addProjectionFingerprintIssues(projection, issues);

  const serializedProvenance = JSON.stringify(projectionFingerprint?.provenance || {});
  entries.forEach(entry => {
    if (entry.label && serializedProvenance.includes(entry.label)) {
      issues.push({
        riskId: PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS.RAW_PROVENANCE_EXPOSED,
        message: 'Runtime evidence fingerprint provenance must not expose raw evidence labels.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    entryCount: entries.length,
    issues,
  };
}

function buildPolicyBuilderPhase7RuntimeEvidenceProjectionAudit(
  projection = buildPolicyBuilderPhase7RuntimeEvidenceProjection()
) {
  const validation = validatePolicyBuilderPhase7RuntimeEvidenceProjection(projection);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedEntryCount: validation.entryCount,
    checkedBucketCount: listPolicyEvidenceBuckets().length,
    validation,
    nextPhase: {
      phaseId: '7r_3',
      label: 'Automation Decision Contract',
      reason: 'Runtime evidence now maps into Phase 6R buckets, so automation can decide classify, route, ask, skip, and block states from server-owned evidence.',
    },
  };
}

export {
  PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS,
  PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS,
  PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS,
  buildPolicyBuilderPhase7RuntimeEvidenceProjection,
  buildPolicyBuilderPhase7RuntimeEvidenceProjectionAudit,
  validatePolicyBuilderPhase7RuntimeEvidenceProjection,
  validateRuntimeEvidenceEntry,
};
