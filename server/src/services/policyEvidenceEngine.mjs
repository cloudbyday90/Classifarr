import {
  AUTHORITY_SOURCE_IDS,
  getPolicyAuthoritySource,
} from './policyAuthorityVocabulary.mjs';
import {
  includesInternalPolicyLanguage,
  POLICY_UX_TERM_IDS,
} from './policyUserMentalModel.mjs';
import {
  buildPolicyEvidenceQualityAssessment,
  validatePolicyEvidenceQualityAssessment,
} from './policyEvidenceQuality.mjs';
import {
  buildPolicyEvidenceEntryAudit,
  normalizePolicyEvidenceEntry,
} from './policyEvidenceEntryNormalizer.mjs';
import {
  buildPolicyEvidenceEntrySemanticKey,
  findPolicyEvidenceEntryDuplicateIndexes,
} from './policyEvidenceEntryIdentity.mjs';

const POLICY_EVIDENCE_BUCKET_IDS = Object.freeze({
  IDENTITY: 'identity_evidence',
  COMPATIBILITY: 'compatibility_evidence',
  HARD_LIMIT: 'hard_limit_evidence',
  AVOID: 'avoid_evidence',
  OUTLIER: 'outlier_evidence',
  ROUTING: 'routing_evidence',
  FRESHNESS: 'freshness_evidence',
  INSUFFICIENT: 'insufficient_evidence',
});

const POLICY_EVIDENCE_SOURCE_IDS = Object.freeze({
  MEDIA_SERVER_LIBRARY_PROFILE: 'media_server_library_profile',
  OPERATOR_DECLARED_INTENT: 'operator_declared_intent',
  CLASSIFICATION_FINAL_OUTCOMES: 'classification_final_outcomes',
  MANUAL_CORRECTIONS: 'manual_corrections',
  PENDING_ITEM_ANSWERS: 'pending_item_answers',
  ARR_ROUTING_OUTCOMES: 'arr_routing_outcomes',
  METADATA_ENRICHMENT: 'metadata_enrichment',
  PROFILE_FRESHNESS: 'profile_freshness',
});

const POLICY_EVIDENCE_PROHIBITED_PAYLOAD_IDS = Object.freeze({
  RAW_PROVIDER_PAYLOAD: 'raw_provider_payload',
  LIVE_PROVIDER_LOOKUP: 'live_provider_lookup',
  PROVIDER_QUOTA_STATE: 'provider_quota_state',
  UI_CHIP_LANGUAGE: 'ui_chip_language',
  REPLAY_PREVIEW_PAYLOAD: 'replay_preview_payload',
  IMPACT_PREVIEW_PAYLOAD: 'impact_preview_payload',
});

const POLICY_EVIDENCE_BUCKET_READINESS_IDS = Object.freeze({
  EMPTY: 'empty',
  SUPPORTING: 'supporting',
  REVIEW: 'review',
  BLOCKING: 'blocking',
});

const POLICY_EVIDENCE_SOURCE_REASON_CODE_IDS = Object.freeze({
  [POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE]: Object.freeze([
    'observed_library_profile',
    'observed_distribution',
    'observed_absence_requires_review',
    'missing_profile_distributions',
  ]),
  [POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT]: Object.freeze([
    'operator_declared_belongs_here',
    'operator_declared_helpful_match',
    'operator_declared_hard_limit',
    'operator_declared_avoid',
    'operator_declared_routing_target',
  ]),
  [POLICY_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES]: Object.freeze([
    'final_outcome_observed',
    'persisted_final_outcome',
  ]),
  [POLICY_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS]: Object.freeze([
    'manual_correction_observed',
    'persisted_manual_correction',
  ]),
  [POLICY_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS]: Object.freeze([
    'pending_answer_requires_learning_guard',
    'persisted_pending_answer_requires_learning_guard',
  ]),
  [POLICY_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES]: Object.freeze([
    'arr_routing_outcome',
    'persisted_routing_succeeded',
    'persisted_routing_blocked',
    'persisted_routing_skipped',
  ]),
  [POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT]: Object.freeze([
    'metadata_enrichment',
    'persisted_metadata_genre_compatibility',
  ]),
  [POLICY_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS]: Object.freeze([
    'stale_profile',
    'current_profile',
  ]),
});

const POLICY_EVIDENCE_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_BUCKET: 'unknown_bucket',
  UNKNOWN_SOURCE: 'unknown_source',
  UNKNOWN_AUTHORITY_SOURCE: 'unknown_authority_source',
  MISSING_LABEL: 'missing_label',
  MISSING_PRODUCT_MEANING: 'missing_product_meaning',
  MISSING_TRACE_ATTRIBUTE: 'missing_trace_attribute',
  MISSING_ALLOWED_SOURCE: 'missing_allowed_source',
  MISSING_AUTHORITY_SOURCE: 'missing_authority_source',
  HARD_LIMIT_WITHOUT_OPERATOR_AUTHORITY: 'hard_limit_without_operator_authority',
  AVOID_WITHOUT_OPERATOR_AUTHORITY: 'avoid_without_operator_authority',
  SOURCE_ALLOWS_UNKNOWN_BUCKET: 'source_allows_unknown_bucket',
  SOURCE_ALLOWS_LIVE_LOOKUP: 'source_allows_live_lookup',
  SOURCE_EXPOSES_RAW_PAYLOAD: 'source_exposes_raw_payload',
  SOURCE_EXPOSES_UI_LANGUAGE: 'source_exposes_ui_language',
  SOURCE_ALLOWS_TRANSIENT_STATE: 'source_allows_transient_state',
  SOURCE_MISSING_PROHIBITED_PAYLOAD: 'source_missing_prohibited_payload',
  METADATA_OWNS_POLICY_MEANING: 'metadata_owns_policy_meaning',
  FINAL_OUTCOME_LEARNS_DIRECTLY: 'final_outcome_learns_directly',
  PROJECTION_MISSING_BUCKETS: 'projection_missing_buckets',
  PROJECTION_UNKNOWN_BUCKET: 'projection_unknown_bucket',
  PROJECTION_BUCKET_NOT_ARRAY: 'projection_bucket_not_array',
  PROJECTION_ENTRY_MISSING_LABEL: 'projection_entry_missing_label',
  PROJECTION_ENTRY_UNKNOWN_SOURCE: 'projection_entry_unknown_source',
  PROJECTION_ENTRY_SOURCE_NOT_ALLOWED: 'projection_entry_source_not_allowed',
  PROJECTION_ENTRY_UNKNOWN_AUTHORITY_SOURCE: 'projection_entry_unknown_authority_source',
  PROJECTION_ENTRY_AUTHORITY_NOT_ALLOWED: 'projection_entry_authority_not_allowed',
  PROJECTION_ENTRY_SOURCE_AUTHORITY_NOT_ALLOWED: 'projection_entry_source_authority_not_allowed',
  PROJECTION_ENTRY_BUCKET_MISMATCH: 'projection_entry_bucket_mismatch',
  PROJECTION_DUPLICATE_ENTRY: 'projection_duplicate_entry',
  PROJECTION_ENTRY_RAW_PAYLOAD: 'projection_entry_raw_payload',
  PROJECTION_ENTRY_LIVE_LOOKUP: 'projection_entry_live_lookup',
  PROJECTION_ENTRY_FIELD_CONTRACT: 'projection_entry_field_contract',
  PROJECTION_EXPOSES_RAW_PAYLOAD: 'projection_exposes_raw_payload',
  PROJECTION_EXPOSES_UI_LANGUAGE: 'projection_exposes_ui_language',
  PROJECTION_USED_LIVE_PROVIDER: 'projection_used_live_provider',
  PROJECTION_HARD_LIMIT_WITHOUT_OPERATOR_AUTHORITY: 'projection_hard_limit_without_operator_authority',
  PROJECTION_AVOID_WITHOUT_OPERATOR_AUTHORITY: 'projection_avoid_without_operator_authority',
  PROJECTION_METADATA_OWNS_IDENTITY: 'projection_metadata_owns_identity',
  PROJECTION_MISSING_SUMMARY: 'projection_missing_summary',
  PROJECTION_SUMMARY_COUNT_MISMATCH: 'projection_summary_count_mismatch',
  PROJECTION_MISSING_QUALITY: 'projection_missing_quality',
  PROJECTION_QUALITY_MISMATCH: 'projection_quality_mismatch',
  PROJECTION_QUALITY_EXPOSES_ENTRY_LABELS: 'projection_quality_exposes_entry_labels',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  Object.values(value).forEach(item => {
    deepFreeze(item);
  });

  return value;
}

const ALL_PROHIBITED_PAYLOAD_IDS = Object.freeze(
  Object.values(POLICY_EVIDENCE_PROHIBITED_PAYLOAD_IDS)
);

const POLICY_EVIDENCE_BUCKETS = deepFreeze([
  {
    id: POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
    label: 'Identity Evidence',
    uxTermIds: [POLICY_UX_TERM_IDS.BELONGS_HERE],
    productMeaning: 'Signals that help define what clearly belongs in a destination after observed examples or declared intent support them.',
    allowedSourceIds: [
      POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    traceAttribute: 'classifarr.policy.evidence.identity',
    canBlockAutomation: false,
  },
  {
    id: POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
    label: 'Compatibility Evidence',
    uxTermIds: [POLICY_UX_TERM_IDS.HELPFUL_MATCHES],
    productMeaning: 'Signals that can support a match after destination identity is plausible.',
    allowedSourceIds: [
      POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      POLICY_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
      POLICY_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
      POLICY_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
      POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    traceAttribute: 'classifarr.policy.evidence.compatibility',
    canBlockAutomation: false,
  },
  {
    id: POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
    label: 'Hard-Limit Evidence',
    uxTermIds: [POLICY_UX_TERM_IDS.HARD_LIMITS],
    productMeaning: 'Explicit operator constraints that can block classification or routing.',
    allowedSourceIds: [
      POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    traceAttribute: 'classifarr.policy.evidence.hard_limit',
    canBlockAutomation: true,
  },
  {
    id: POLICY_EVIDENCE_BUCKET_IDS.AVOID,
    label: 'Avoid Evidence',
    uxTermIds: [POLICY_UX_TERM_IDS.AVOID],
    productMeaning: 'Explicit operator negative evidence that lowers confidence without becoming a hard block by default.',
    allowedSourceIds: [
      POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    traceAttribute: 'classifarr.policy.evidence.avoid',
    canBlockAutomation: false,
  },
  {
    id: POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
    label: 'Outlier Evidence',
    uxTermIds: [POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE],
    productMeaning: 'Evidence that a candidate does not cleanly match the observed or declared destination shape.',
    allowedSourceIds: [
      POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      POLICY_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
      POLICY_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
      POLICY_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
      POLICY_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
      POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      POLICY_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    traceAttribute: 'classifarr.policy.evidence.outlier',
    canBlockAutomation: false,
  },
  {
    id: POLICY_EVIDENCE_BUCKET_IDS.ROUTING,
    label: 'Routing Evidence',
    uxTermIds: [POLICY_UX_TERM_IDS.ROUTING_TARGET],
    productMeaning: 'Evidence about whether confirmed matches can be sent to the destination target.',
    allowedSourceIds: [
      POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      POLICY_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    ],
    traceAttribute: 'classifarr.policy.evidence.routing',
    canBlockAutomation: false,
  },
  {
    id: POLICY_EVIDENCE_BUCKET_IDS.FRESHNESS,
    label: 'Freshness Evidence',
    uxTermIds: [POLICY_UX_TERM_IDS.READINESS],
    productMeaning: 'Evidence about whether observed profile or enrichment data is current enough to trust.',
    allowedSourceIds: [
      POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      POLICY_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    traceAttribute: 'classifarr.policy.evidence.freshness',
    canBlockAutomation: false,
  },
  {
    id: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    label: 'Insufficient Evidence',
    uxTermIds: [POLICY_UX_TERM_IDS.READINESS],
    productMeaning: 'Missing, stale, or conflicting evidence that should stop confident automation until resolved.',
    allowedSourceIds: [
      POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      POLICY_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
      POLICY_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
      POLICY_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
      POLICY_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
      POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      POLICY_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    traceAttribute: 'classifarr.policy.evidence.insufficient',
    canBlockAutomation: false,
  },
]);

const POLICY_EVIDENCE_SOURCES = deepFreeze([
  {
    id: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
    label: 'Media-server library profile',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS],
    allowedBucketIds: [
      POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
      POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      POLICY_EVIDENCE_BUCKET_IDS.FRESHNESS,
      POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    label: 'Operator-declared intent',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT],
    allowedBucketIds: [
      POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
      POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
      POLICY_EVIDENCE_BUCKET_IDS.AVOID,
      POLICY_EVIDENCE_BUCKET_IDS.ROUTING,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: POLICY_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
    label: 'Classification final outcomes',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME],
    allowedBucketIds: [
      POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: POLICY_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
    label: 'Manual corrections',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME],
    allowedBucketIds: [
      POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: POLICY_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
    label: 'Pending-item answers',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME],
    allowedBucketIds: [
      POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: POLICY_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
    label: 'Arr routing outcomes',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME],
    allowedBucketIds: [
      POLICY_EVIDENCE_BUCKET_IDS.ROUTING,
      POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
    label: 'Metadata enrichment',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.METADATA_PROVIDER],
    allowedBucketIds: [
      POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      POLICY_EVIDENCE_BUCKET_IDS.FRESHNESS,
      POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: POLICY_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
    label: 'Profile freshness',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    allowedBucketIds: [
      POLICY_EVIDENCE_BUCKET_IDS.FRESHNESS,
      POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
]);

function listPolicyEvidenceBuckets() {
  return POLICY_EVIDENCE_BUCKETS;
}

function listPolicyEvidenceSources() {
  return POLICY_EVIDENCE_SOURCES;
}

function getPolicyEvidenceBucket(bucketId) {
  return POLICY_EVIDENCE_BUCKETS.find(bucket => bucket.id === bucketId) || null;
}

function getPolicyEvidenceSource(sourceId) {
  return POLICY_EVIDENCE_SOURCES.find(source => source.id === sourceId) || null;
}

function isPolicyEvidenceQualityContribution(entry = {}, bucketId) {
  const bucket = getPolicyEvidenceBucket(bucketId);
  const source = getPolicyEvidenceSource(entry.sourceId);

  return Boolean(
    bucket &&
    source &&
    bucket.allowedSourceIds.includes(entry.sourceId) &&
    bucket.authoritySourceIds.includes(entry.authoritySourceId) &&
    source.authoritySourceIds.includes(entry.authoritySourceId)
  );
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isNonEmptyObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEvidenceInputList(value) {
  return Array.isArray(value) ? value : [];
}

function createEvidenceEntry({
  bucketId,
  sourceId,
  authoritySourceId,
  key,
  label,
  value = null,
  count = null,
  confidence = null,
  reasonCode = null,
  inputReasonCode = null,
  observedAt = null,
  stale = null,
}) {
  const bucket = getPolicyEvidenceBucket(bucketId);
  const source = getPolicyEvidenceSource(sourceId);

  if (!bucket || !source || !bucket.allowedSourceIds.includes(sourceId)) {
    return null;
  }

  const fallbackAuthoritySourceId = source.authoritySourceIds[0] || null;
  const normalizedAuthoritySourceId = authoritySourceId || fallbackAuthoritySourceId;
  if (!normalizedAuthoritySourceId ||
      !bucket.authoritySourceIds.includes(normalizedAuthoritySourceId) ||
      !source.authoritySourceIds.includes(normalizedAuthoritySourceId)) {
    return null;
  }

  const normalizedEntry = normalizePolicyEvidenceEntry({
    key,
    label,
    value,
    count,
    confidence,
    reasonCode: inputReasonCode,
    observedAt,
    stale,
  }, {
    defaultReasonCode: reasonCode,
    allowedReasonCodes: POLICY_EVIDENCE_SOURCE_REASON_CODE_IDS[sourceId],
  });
  if (!normalizedEntry) return null;

  return {
    bucketId,
    sourceId,
    authoritySourceId: normalizedAuthoritySourceId,
    ...normalizedEntry,
    includesRawPayload: false,
    liveLookupPerformed: false,
  };
}

function addEntries(projection, entries) {
  const entryKeysByBucket = new Map();

  entries.forEach(entry => {
    if (!entry) return;
    const bucketEntries = projection.buckets[entry.bucketId];
    if (!Array.isArray(bucketEntries)) return;

    let entryKeys = entryKeysByBucket.get(entry.bucketId);
    if (!entryKeys) {
      entryKeys = new Set(bucketEntries.map(buildPolicyEvidenceEntrySemanticKey).filter(Boolean));
      entryKeysByBucket.set(entry.bucketId, entryKeys);
    }

    const entryKey = buildPolicyEvidenceEntrySemanticKey(entry);
    if (entryKey && entryKeys.has(entryKey)) return;

    bucketEntries.push(entry);
    if (entryKey) entryKeys.add(entryKey);
  });
}

function mapSignalEntries(values, {
  bucketId,
  sourceId,
  authoritySourceId = null,
  reasonCode,
}) {
  return normalizeEvidenceInputList(values).map(value => {
    if (typeof value === 'string') {
      return createEvidenceEntry({
        bucketId,
        sourceId,
        authoritySourceId,
        key: value,
        label: value,
        reasonCode,
      });
    }

    if (!isNonEmptyObject(value)) {
      return null;
    }

    return createEvidenceEntry({
      bucketId,
      sourceId,
      authoritySourceId,
      key: value.key ?? value.id ?? value.name ?? value.label,
      label: value.label ?? value.name ?? value.value ?? value.key ?? value.id,
      value: value.value,
      count: value.count ?? value.occurrences,
      confidence: value.confidence ?? value.score,
      reasonCode,
      inputReasonCode: value.reasonCode,
      observedAt: value.observedAt ?? value.updatedAt,
      stale: value.stale,
    });
  });
}

function createEmptyEvidenceProjection() {
  const buckets = Object.fromEntries(
    POLICY_EVIDENCE_BUCKETS.map(bucket => [bucket.id, []])
  );

  return {
    version: 'policy.evidence.v1',
    generatedFromLiveProvider: false,
    exposesRawProviderPayloads: false,
    exposesUiChipLanguage: false,
    buckets,
    summary: null,
    quality: null,
    warnings: [],
  };
}

function summarizePolicyEvidenceProjection(projection = {}) {
  const buckets = isNonEmptyObject(projection.buckets) ? projection.buckets : {};
  const sourceIds = new Set();
  const authoritySourceIds = new Set();
  const blockingBucketIds = [];
  const reviewBucketIds = [];

  const bucketSummaries = POLICY_EVIDENCE_BUCKETS.map(bucket => {
    const entries = Array.isArray(buckets[bucket.id]) ? buckets[bucket.id] : [];
    entries.forEach(entry => {
      if (entry?.sourceId) sourceIds.add(entry.sourceId);
      if (entry?.authoritySourceId) authoritySourceIds.add(entry.authoritySourceId);
    });

    let readinessId = entries.length === 0
      ? POLICY_EVIDENCE_BUCKET_READINESS_IDS.EMPTY
      : POLICY_EVIDENCE_BUCKET_READINESS_IDS.SUPPORTING;

    if (entries.length > 0 && bucket.canBlockAutomation === true) {
      readinessId = POLICY_EVIDENCE_BUCKET_READINESS_IDS.BLOCKING;
      blockingBucketIds.push(bucket.id);
    } else if ([
      POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
      POLICY_EVIDENCE_BUCKET_IDS.FRESHNESS,
    ].includes(bucket.id) && entries.length > 0) {
      readinessId = POLICY_EVIDENCE_BUCKET_READINESS_IDS.REVIEW;
      reviewBucketIds.push(bucket.id);
    }

    return {
      bucketId: bucket.id,
      label: bucket.label,
      entryCount: entries.length,
      canBlockAutomation: bucket.canBlockAutomation === true,
      readinessId,
      traceAttribute: bucket.traceAttribute,
    };
  });

  return {
    version: 'policy.evidence.summary.v1',
    totalEntryCount: bucketSummaries.reduce((count, bucket) => count + bucket.entryCount, 0),
    bucketSummaries,
    sourceIds: [...sourceIds].sort(),
    authoritySourceIds: [...authoritySourceIds].sort(),
    blockingBucketIds,
    reviewBucketIds,
    hasBlockingEvidence: blockingBucketIds.length > 0,
    hasReviewEvidence: reviewBucketIds.length > 0 || Array.isArray(projection.warnings) && projection.warnings.length > 0,
  };
}

function buildPolicyEvidenceProjection(input = {}) {
  const projection = createEmptyEvidenceProjection();
  const libraryProfile = isNonEmptyObject(input.libraryProfile) ? input.libraryProfile : {};
  const operatorIntent = isNonEmptyObject(input.operatorIntent) ? input.operatorIntent : {};

  addEntries(projection, mapSignalEntries(libraryProfile.identityCandidates, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    reasonCode: 'observed_library_profile',
  }));
  addEntries(projection, mapSignalEntries(libraryProfile.compatibilityCandidates, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    reasonCode: 'observed_library_profile',
  }));
  addEntries(projection, mapSignalEntries(libraryProfile.outliers, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    reasonCode: 'observed_outlier',
  }));

  addEntries(projection, mapSignalEntries(operatorIntent.belongsHere, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.IDENTITY,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    reasonCode: 'operator_declared_belongs_here',
  }));
  addEntries(projection, mapSignalEntries(operatorIntent.helpfulMatches, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    reasonCode: 'operator_declared_helpful_match',
  }));
  addEntries(projection, mapSignalEntries(operatorIntent.hardLimits, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    reasonCode: 'operator_declared_hard_limit',
  }));
  addEntries(projection, mapSignalEntries(operatorIntent.avoid, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.AVOID,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    reasonCode: 'operator_declared_avoid',
  }));
  addEntries(projection, mapSignalEntries(operatorIntent.routingTargets, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.ROUTING,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    reasonCode: 'operator_declared_routing_target',
  }));

  addEntries(projection, mapSignalEntries(input.classificationFinalOutcomes, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    reasonCode: 'final_outcome_observed',
  }));
  addEntries(projection, mapSignalEntries(input.manualCorrections, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    reasonCode: 'manual_correction_observed',
  }));
  addEntries(projection, mapSignalEntries(input.pendingItemAnswers, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    reasonCode: 'pending_answer_requires_learning_guard',
  }));
  addEntries(projection, mapSignalEntries(input.routingOutcomes, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.ROUTING,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    reasonCode: 'arr_routing_outcome',
  }));
  addEntries(projection, mapSignalEntries(input.metadataEvidence, {
    bucketId: POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    reasonCode: 'metadata_enrichment',
  }));

  const profileFreshness = isNonEmptyObject(input.profileFreshness) ? input.profileFreshness : null;
  if (profileFreshness) {
    addEntries(projection, [
      createEvidenceEntry({
        bucketId: profileFreshness.stale === true
          ? POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT
          : POLICY_EVIDENCE_BUCKET_IDS.FRESHNESS,
        sourceId: POLICY_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
        authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
        key: profileFreshness.key ?? 'profile_freshness',
        label: profileFreshness.label ?? (profileFreshness.stale === true ? 'Profile is stale' : 'Profile is fresh'),
        value: profileFreshness.value ?? profileFreshness.updatedAt,
        confidence: profileFreshness.confidence,
        reasonCode: profileFreshness.stale === true ? 'stale_profile' : 'current_profile',
        observedAt: profileFreshness.updatedAt,
        stale: profileFreshness.stale,
      }),
    ]);
  }

  if (Object.values(projection.buckets).every(entries => entries.length === 0)) {
    projection.warnings.push({
      bucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
      reasonCode: 'no_evidence_inputs',
      message: 'No policy evidence inputs were provided.',
    });
  }

  projection.summary = summarizePolicyEvidenceProjection(projection);
  projection.quality = buildPolicyEvidenceQualityAssessment(projection, {
    bucketIds: POLICY_EVIDENCE_BUCKET_IDS,
    authoritySourceIds: AUTHORITY_SOURCE_IDS,
    isTrustedEntry: isPolicyEvidenceQualityContribution,
  });

  return projection;
}

function validatePolicyEvidenceBucket(candidate, sources = POLICY_EVIDENCE_SOURCES) {
  const issues = [];
  const knownSourceIds = new Set(sources.map(source => source.id));
  const knownAuthoritySourceIds = new Set(Object.values(AUTHORITY_SOURCE_IDS));

  if (!getPolicyEvidenceBucket(candidate?.id)) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_BUCKET,
      message: 'Evidence bucket must be part of the policy evidence vocabulary.',
    });
  }

  if (!normalizeString(candidate?.label)) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.MISSING_LABEL,
      message: 'Evidence bucket must have a label.',
    });
  }

  if (!normalizeString(candidate?.productMeaning)) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.MISSING_PRODUCT_MEANING,
      message: 'Evidence bucket must explain its destination-meaning role.',
    });
  }

  if (!normalizeString(candidate?.traceAttribute)) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.MISSING_TRACE_ATTRIBUTE,
      message: 'Evidence bucket must define a stable trace attribute name.',
    });
  }

  const allowedSourceIds = Array.isArray(candidate?.allowedSourceIds) ? candidate.allowedSourceIds : [];
  if (allowedSourceIds.length === 0) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.MISSING_ALLOWED_SOURCE,
      message: 'Evidence bucket must define which sources can populate it.',
    });
  }
  allowedSourceIds
    .filter(sourceId => !knownSourceIds.has(sourceId))
    .forEach(sourceId => {
      issues.push({
        riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_SOURCE,
        message: `Evidence bucket allows unknown source "${sourceId}".`,
      });
    });

  const authoritySourceIds = Array.isArray(candidate?.authoritySourceIds) ? candidate.authoritySourceIds : [];
  if (authoritySourceIds.length === 0) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.MISSING_AUTHORITY_SOURCE,
      message: 'Evidence bucket must define authority sources.',
    });
  }
  authoritySourceIds
    .filter(sourceId => !knownAuthoritySourceIds.has(sourceId) || !getPolicyAuthoritySource(sourceId))
    .forEach(sourceId => {
      issues.push({
        riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_AUTHORITY_SOURCE,
        message: `Evidence bucket references unknown authority source "${sourceId}".`,
      });
    });

  if (candidate?.id === POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT &&
      authoritySourceIds.some(sourceId => sourceId !== AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.HARD_LIMIT_WITHOUT_OPERATOR_AUTHORITY,
      message: 'Hard-limit evidence must come only from operator-declared intent.',
    });
  }

  if (candidate?.id === POLICY_EVIDENCE_BUCKET_IDS.AVOID &&
      authoritySourceIds.some(sourceId => sourceId !== AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.AVOID_WITHOUT_OPERATOR_AUTHORITY,
      message: 'Avoid evidence must come only from operator-declared intent.',
    });
  }

  return {
    ok: issues.length === 0,
    bucketId: candidate?.id || null,
    issues,
  };
}

function validatePolicyEvidenceSource(candidate, buckets = POLICY_EVIDENCE_BUCKETS) {
  const issues = [];
  const knownBucketIds = new Set(buckets.map(bucket => bucket.id));
  const knownAuthoritySourceIds = new Set(Object.values(AUTHORITY_SOURCE_IDS));

  if (!getPolicyEvidenceSource(candidate?.id)) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_SOURCE,
      message: 'Evidence source must be part of the policy evidence vocabulary.',
    });
  }

  if (!normalizeString(candidate?.label)) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.MISSING_LABEL,
      message: 'Evidence source must have a label.',
    });
  }

  const authoritySourceIds = Array.isArray(candidate?.authoritySourceIds) ? candidate.authoritySourceIds : [];
  if (authoritySourceIds.length === 0) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.MISSING_AUTHORITY_SOURCE,
      message: 'Evidence source must define authority sources.',
    });
  }
  authoritySourceIds
    .filter(sourceId => !knownAuthoritySourceIds.has(sourceId) || !getPolicyAuthoritySource(sourceId))
    .forEach(sourceId => {
      issues.push({
        riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_AUTHORITY_SOURCE,
        message: `Evidence source references unknown authority source "${sourceId}".`,
      });
    });

  const allowedBucketIds = Array.isArray(candidate?.allowedBucketIds) ? candidate.allowedBucketIds : [];
  allowedBucketIds
    .filter(bucketId => !knownBucketIds.has(bucketId))
    .forEach(bucketId => {
      issues.push({
        riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.SOURCE_ALLOWS_UNKNOWN_BUCKET,
        message: `Evidence source allows unknown bucket "${bucketId}".`,
      });
    });

  if (candidate?.liveLookupAllowed === true) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.SOURCE_ALLOWS_LIVE_LOOKUP,
      message: 'Evidence sources must not perform live provider lookups in the policy evidence contract.',
    });
  }

  if (candidate?.exposesRawPayload === true) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.SOURCE_EXPOSES_RAW_PAYLOAD,
      message: 'Evidence sources must not expose raw provider, replay, or impact payloads.',
    });
  }

  if (candidate?.exposesUiLanguage === true) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.SOURCE_EXPOSES_UI_LANGUAGE,
      message: 'Evidence sources must not expose UI chip language as contract fields.',
    });
  }

  if (candidate?.transientStateAllowed === true) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.SOURCE_ALLOWS_TRANSIENT_STATE,
      message: 'Evidence sources must not treat provider quota or cooldown state as policy evidence.',
    });
  }

  const prohibitedPayloadIds = Array.isArray(candidate?.prohibitedPayloadIds)
    ? candidate.prohibitedPayloadIds
    : [];
  ALL_PROHIBITED_PAYLOAD_IDS
    .filter(payloadId => !prohibitedPayloadIds.includes(payloadId))
    .forEach(payloadId => {
      issues.push({
        riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.SOURCE_MISSING_PROHIBITED_PAYLOAD,
        message: `Evidence source must explicitly prohibit "${payloadId}".`,
      });
    });

  if (candidate?.id === POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT &&
      allowedBucketIds.includes(POLICY_EVIDENCE_BUCKET_IDS.IDENTITY)) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.METADATA_OWNS_POLICY_MEANING,
      message: 'Metadata evidence cannot own destination identity in the policy evidence contract.',
    });
  }

  if (authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME) &&
      candidate?.directLearningAllowed === true) {
    issues.push({
      riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.FINAL_OUTCOME_LEARNS_DIRECTLY,
      message: 'Final outcomes can describe evidence but cannot learn directly before the learning guard.',
    });
  }

  return {
    ok: issues.length === 0,
    sourceId: candidate?.id || null,
    issues,
  };
}

function pushProjectionIssue(issues, riskId, message, details = {}) {
  issues.push({
    riskId,
    message,
    ...details,
  });
}

function validatePolicyEvidenceProjectionSummary(projection = {}) {
  const issues = [];
  const expectedSummary = summarizePolicyEvidenceProjection(projection);
  const summary = isNonEmptyObject(projection.summary) ? projection.summary : null;

  if (!summary) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_MISSING_SUMMARY,
      'Evidence projection must include a generated summary for downstream engines.'
    );
    return {
      ok: false,
      issues,
      expectedSummary,
    };
  }

  if (summary.totalEntryCount !== expectedSummary.totalEntryCount) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_SUMMARY_COUNT_MISMATCH,
      'Evidence projection summary must match bucket entry counts.',
      {
        expectedTotalEntryCount: expectedSummary.totalEntryCount,
        actualTotalEntryCount: summary.totalEntryCount,
      }
    );
  }

  const actualBucketCounts = new Map(
    (Array.isArray(summary.bucketSummaries) ? summary.bucketSummaries : [])
      .map(bucket => [bucket.bucketId, bucket.entryCount])
  );

  expectedSummary.bucketSummaries.forEach(bucket => {
    if (actualBucketCounts.get(bucket.bucketId) !== bucket.entryCount) {
      pushProjectionIssue(
        issues,
        POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_SUMMARY_COUNT_MISMATCH,
        `Evidence projection summary count for "${bucket.bucketId}" must match bucket entries.`,
        {
          bucketId: bucket.bucketId,
          expectedEntryCount: bucket.entryCount,
          actualEntryCount: actualBucketCounts.get(bucket.bucketId) ?? null,
        }
      );
    }
  });

  return {
    ok: issues.length === 0,
    issues,
    expectedSummary,
  };
}

function validatePolicyEvidenceProjectionQuality(projection = {}) {
  const result = validatePolicyEvidenceQualityAssessment(projection, {
    bucketIds: POLICY_EVIDENCE_BUCKET_IDS,
    authoritySourceIds: AUTHORITY_SOURCE_IDS,
    isTrustedEntry: isPolicyEvidenceQualityContribution,
  });

  return {
    ...result,
    issues: result.issues.map(issue => {
      switch (issue.riskId) {
        case 'missing_quality':
          return {
            ...issue,
            riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_MISSING_QUALITY,
          };
        case 'quality_mismatch':
          return {
            ...issue,
            riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_QUALITY_MISMATCH,
          };
        case 'quality_exposes_entry_labels':
          return {
            ...issue,
            riskId: POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_QUALITY_EXPOSES_ENTRY_LABELS,
          };
        default:
          return issue;
      }
    }),
  };
}

function validatePolicyEvidenceProjectionEntry(entry = {}, bucketId) {
  const issues = [];
  const bucket = getPolicyEvidenceBucket(bucketId);
  const source = getPolicyEvidenceSource(entry.sourceId);
  const entryFieldAudit = buildPolicyEvidenceEntryAudit(entry);

  if (entry.bucketId !== bucketId) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_BUCKET_MISMATCH,
      'Evidence projection entry bucket must match the bucket that contains it.',
      {
        bucketId,
        entryBucketId: entry.bucketId || null,
        sourceId: entry.sourceId || null,
      }
    );
  }

  if (!normalizeString(entry.label)) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_MISSING_LABEL,
      'Evidence projection entries must expose a bounded label.',
      { bucketId, sourceId: entry.sourceId || null }
    );
  }

  if (!entryFieldAudit.ok) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_FIELD_CONTRACT,
      'Evidence projection entries must satisfy the bounded field contract.',
      {
        bucketId,
        sourceId: entry.sourceId || null,
        entryRiskIds: entryFieldAudit.issues.map(issue => issue.riskId),
      }
    );
  }

  if (!source) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_UNKNOWN_SOURCE,
      'Evidence projection entry source must be part of the policy evidence vocabulary.',
      { bucketId, sourceId: entry.sourceId || null }
    );
  } else if (bucket && !bucket.allowedSourceIds.includes(entry.sourceId)) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_SOURCE_NOT_ALLOWED,
      `Evidence source "${entry.sourceId}" is not allowed to populate bucket "${bucketId}".`,
      { bucketId, sourceId: entry.sourceId }
    );
  }

  if (!getPolicyAuthoritySource(entry.authoritySourceId)) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_UNKNOWN_AUTHORITY_SOURCE,
      'Evidence projection entry authority source must be known.',
      { bucketId, authoritySourceId: entry.authoritySourceId || null }
    );
  } else if (bucket && !bucket.authoritySourceIds.includes(entry.authoritySourceId)) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_AUTHORITY_NOT_ALLOWED,
      `Authority source "${entry.authoritySourceId}" is not allowed to populate bucket "${bucketId}".`,
      { bucketId, authoritySourceId: entry.authoritySourceId }
    );
  }

  if (source && !source.authoritySourceIds.includes(entry.authoritySourceId)) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_SOURCE_AUTHORITY_NOT_ALLOWED,
      `Authority source "${entry.authoritySourceId}" is not allowed by evidence source "${entry.sourceId}".`,
      { bucketId, sourceId: entry.sourceId, authoritySourceId: entry.authoritySourceId }
    );
  }

  if (entry.includesRawPayload === true || Object.prototype.hasOwnProperty.call(entry, 'raw')) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_RAW_PAYLOAD,
      'Evidence projection entries must not expose raw provider, replay, or impact payloads.',
      { bucketId, sourceId: entry.sourceId || null }
    );
  }

  if (entry.liveLookupPerformed === true) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_ENTRY_LIVE_LOOKUP,
      'Evidence projection entries must not be generated from live provider lookups.',
      { bucketId, sourceId: entry.sourceId || null }
    );
  }

  if (includesInternalPolicyLanguage(entry.label) ||
      includesInternalPolicyLanguage(entry.reasonCode) ||
      includesInternalPolicyLanguage(entry.value)) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_EXPOSES_UI_LANGUAGE,
      'Evidence projection entries must not expose diagnostic or UI chip language.',
      { bucketId, sourceId: entry.sourceId || null }
    );
  }

  if (bucketId === POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT &&
      entry.authoritySourceId !== AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_HARD_LIMIT_WITHOUT_OPERATOR_AUTHORITY,
      'Hard-limit projection entries must come from operator-declared intent.',
      { bucketId, authoritySourceId: entry.authoritySourceId || null }
    );
  }

  if (bucketId === POLICY_EVIDENCE_BUCKET_IDS.AVOID &&
      entry.authoritySourceId !== AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_AVOID_WITHOUT_OPERATOR_AUTHORITY,
      'Avoid projection entries must come from operator-declared intent.',
      { bucketId, authoritySourceId: entry.authoritySourceId || null }
    );
  }

  if (bucketId === POLICY_EVIDENCE_BUCKET_IDS.IDENTITY &&
      entry.sourceId === POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_METADATA_OWNS_IDENTITY,
      'Metadata enrichment cannot own destination identity in the evidence projection.',
      { bucketId, sourceId: entry.sourceId }
    );
  }

  return {
    ok: issues.length === 0,
    bucketId,
    sourceId: entry.sourceId || null,
    issues,
  };
}

function buildPolicyEvidenceProjectionAudit(projection = {}) {
  const issues = [];
  const buckets = isNonEmptyObject(projection.buckets) ? projection.buckets : null;
  const summaryResult = validatePolicyEvidenceProjectionSummary(projection);
  const qualityResult = validatePolicyEvidenceProjectionQuality(projection);

  if (!buckets) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_MISSING_BUCKETS,
      'Evidence projection must include a buckets object.'
    );
  }

  if (projection.generatedFromLiveProvider === true) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_USED_LIVE_PROVIDER,
      'Evidence projection must not perform live provider lookups.'
    );
  }

  if (projection.exposesRawProviderPayloads === true) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_EXPOSES_RAW_PAYLOAD,
      'Evidence projection must not expose raw provider payloads.'
    );
  }

  if (projection.exposesUiChipLanguage === true) {
    pushProjectionIssue(
      issues,
      POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_EXPOSES_UI_LANGUAGE,
      'Evidence projection must not expose UI chip language.'
    );
  }

  const entryResults = [];
  if (buckets) {
    Object.keys(buckets)
      .filter(bucketId => !getPolicyEvidenceBucket(bucketId))
      .forEach(bucketId => {
        pushProjectionIssue(
          issues,
          POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_UNKNOWN_BUCKET,
          `Evidence projection contains unknown bucket "${bucketId}".`,
          { bucketId }
        );
      });

    POLICY_EVIDENCE_BUCKETS.forEach(bucket => {
      const entries = buckets[bucket.id];
      if (!Array.isArray(entries)) {
        pushProjectionIssue(
          issues,
          POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_BUCKET_NOT_ARRAY,
          `Evidence projection bucket "${bucket.id}" must be an array.`,
          { bucketId: bucket.id }
        );
        return;
      }

      findPolicyEvidenceEntryDuplicateIndexes(entries).forEach(index => {
        pushProjectionIssue(
          issues,
          POLICY_EVIDENCE_AUDIT_RISK_IDS.PROJECTION_DUPLICATE_ENTRY,
          'Evidence projection buckets must not contain duplicate canonical entries.',
          { bucketId: bucket.id, index }
        );
      });

      entries.forEach(entry => {
        const result = validatePolicyEvidenceProjectionEntry(entry, bucket.id);
        entryResults.push(result);
        result.issues.forEach(issue => issues.push(issue));
      });
    });
  }

  summaryResult.issues.forEach(issue => issues.push(issue));
  qualityResult.issues.forEach(issue => issues.push(issue));

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    checkedEntryCount: entryResults.length,
    issues,
    entryResults,
    summaryResult,
    qualityResult,
  };
}

function buildPolicyEvidenceEngineAudit({
  buckets = POLICY_EVIDENCE_BUCKETS,
  sources = POLICY_EVIDENCE_SOURCES,
} = {}) {
  const bucketResults = buckets.map(bucket =>
    validatePolicyEvidenceBucket(bucket, sources)
  );
  const sourceResults = sources.map(source =>
    validatePolicyEvidenceSource(source, buckets)
  );
  const issueCount = [...bucketResults, ...sourceResults]
    .reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    issueCount,
    checkedBucketCount: bucketResults.length,
    checkedSourceCount: sourceResults.length,
    bucketResults,
    sourceResults,
    nextStep: {
      stepId: 'intent_inference',
      label: 'Intent Engine',
      reason: 'Evidence buckets are now stable enough to convert observed and declared evidence into proposed destination meaning.',
    },
  };
}

export {
  POLICY_EVIDENCE_AUDIT_RISK_IDS,
  POLICY_EVIDENCE_BUCKET_IDS,
  POLICY_EVIDENCE_BUCKET_READINESS_IDS,
  POLICY_EVIDENCE_PROHIBITED_PAYLOAD_IDS,
  POLICY_EVIDENCE_SOURCE_IDS,
  buildPolicyEvidenceEngineAudit,
  buildPolicyEvidenceProjection,
  buildPolicyEvidenceProjectionAudit,
  buildPolicyEvidenceQualityAssessment,
  getPolicyEvidenceBucket,
  getPolicyEvidenceSource,
  isPolicyEvidenceQualityContribution,
  listPolicyEvidenceBuckets,
  listPolicyEvidenceSources,
  summarizePolicyEvidenceProjection,
  validatePolicyEvidenceQualityAssessment,
  validatePolicyEvidenceBucket,
  validatePolicyEvidenceProjectionEntry,
  validatePolicyEvidenceSource,
};
