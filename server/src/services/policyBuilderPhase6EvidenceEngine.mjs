import {
  AUTHORITY_SOURCE_IDS,
  getPolicyAuthoritySource,
} from './policyAuthorityVocabulary.mjs';
import {
  POLICY_UX_TERM_IDS,
} from './policyUserMentalModel.mjs';

const PHASE6R_EVIDENCE_BUCKET_IDS = Object.freeze({
  IDENTITY: 'identity_evidence',
  COMPATIBILITY: 'compatibility_evidence',
  HARD_LIMIT: 'hard_limit_evidence',
  AVOID: 'avoid_evidence',
  OUTLIER: 'outlier_evidence',
  ROUTING: 'routing_evidence',
  FRESHNESS: 'freshness_evidence',
  INSUFFICIENT: 'insufficient_evidence',
});

const PHASE6R_EVIDENCE_SOURCE_IDS = Object.freeze({
  MEDIA_SERVER_LIBRARY_PROFILE: 'media_server_library_profile',
  OPERATOR_DECLARED_INTENT: 'operator_declared_intent',
  CLASSIFICATION_FINAL_OUTCOMES: 'classification_final_outcomes',
  MANUAL_CORRECTIONS: 'manual_corrections',
  PENDING_ITEM_ANSWERS: 'pending_item_answers',
  ARR_ROUTING_OUTCOMES: 'arr_routing_outcomes',
  METADATA_ENRICHMENT: 'metadata_enrichment',
  PROFILE_FRESHNESS: 'profile_freshness',
});

const PHASE6R_EVIDENCE_PROHIBITED_PAYLOAD_IDS = Object.freeze({
  RAW_PROVIDER_PAYLOAD: 'raw_provider_payload',
  LIVE_PROVIDER_LOOKUP: 'live_provider_lookup',
  PROVIDER_QUOTA_STATE: 'provider_quota_state',
  UI_CHIP_LANGUAGE: 'ui_chip_language',
  REPLAY_PREVIEW_PAYLOAD: 'replay_preview_payload',
  IMPACT_PREVIEW_PAYLOAD: 'impact_preview_payload',
});

const PHASE6R_EVIDENCE_AUDIT_RISK_IDS = Object.freeze({
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
  Object.values(PHASE6R_EVIDENCE_PROHIBITED_PAYLOAD_IDS)
);

const PHASE6R_EVIDENCE_BUCKETS = deepFreeze([
  {
    id: PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
    label: 'Identity Evidence',
    phase0TermIds: [POLICY_UX_TERM_IDS.BELONGS_HERE],
    productMeaning: 'Signals that help define what clearly belongs in a destination after observed examples or declared intent support them.',
    allowedSourceIds: [
      PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    traceAttribute: 'classifarr.policy.evidence.identity',
    canBlockAutomation: false,
  },
  {
    id: PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
    label: 'Compatibility Evidence',
    phase0TermIds: [POLICY_UX_TERM_IDS.HELPFUL_MATCHES],
    productMeaning: 'Signals that can support a match after destination identity is plausible.',
    allowedSourceIds: [
      PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      PHASE6R_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
      PHASE6R_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
      PHASE6R_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
      PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
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
    id: PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
    label: 'Hard-Limit Evidence',
    phase0TermIds: [POLICY_UX_TERM_IDS.HARD_LIMITS],
    productMeaning: 'Explicit operator constraints that can block classification or routing.',
    allowedSourceIds: [
      PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    traceAttribute: 'classifarr.policy.evidence.hard_limit',
    canBlockAutomation: true,
  },
  {
    id: PHASE6R_EVIDENCE_BUCKET_IDS.AVOID,
    label: 'Avoid Evidence',
    phase0TermIds: [POLICY_UX_TERM_IDS.AVOID],
    productMeaning: 'Explicit operator negative evidence that lowers confidence without becoming a hard block by default.',
    allowedSourceIds: [
      PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    traceAttribute: 'classifarr.policy.evidence.avoid',
    canBlockAutomation: false,
  },
  {
    id: PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
    label: 'Outlier Evidence',
    phase0TermIds: [POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE],
    productMeaning: 'Evidence that a candidate does not cleanly match the observed or declared destination shape.',
    allowedSourceIds: [
      PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      PHASE6R_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
      PHASE6R_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
      PHASE6R_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
      PHASE6R_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
      PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      PHASE6R_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
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
    id: PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING,
    label: 'Routing Evidence',
    phase0TermIds: [POLICY_UX_TERM_IDS.ROUTING_TARGET],
    productMeaning: 'Evidence about whether confirmed matches can be sent to the destination target.',
    allowedSourceIds: [
      PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      PHASE6R_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    ],
    traceAttribute: 'classifarr.policy.evidence.routing',
    canBlockAutomation: false,
  },
  {
    id: PHASE6R_EVIDENCE_BUCKET_IDS.FRESHNESS,
    label: 'Freshness Evidence',
    phase0TermIds: [POLICY_UX_TERM_IDS.READINESS],
    productMeaning: 'Evidence about whether observed profile or enrichment data is current enough to trust.',
    allowedSourceIds: [
      PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      PHASE6R_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    traceAttribute: 'classifarr.policy.evidence.freshness',
    canBlockAutomation: false,
  },
  {
    id: PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    label: 'Insufficient Evidence',
    phase0TermIds: [POLICY_UX_TERM_IDS.READINESS],
    productMeaning: 'Missing, stale, or conflicting evidence that should stop confident automation until resolved.',
    allowedSourceIds: [
      PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
      PHASE6R_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
      PHASE6R_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
      PHASE6R_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
      PHASE6R_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
      PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
      PHASE6R_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
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

const PHASE6R_EVIDENCE_SOURCES = deepFreeze([
  {
    id: PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
    label: 'Media-server library profile',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS],
    allowedBucketIds: [
      PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
      PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
      PHASE6R_EVIDENCE_BUCKET_IDS.FRESHNESS,
      PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    label: 'Operator-declared intent',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT],
    allowedBucketIds: [
      PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
      PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
      PHASE6R_EVIDENCE_BUCKET_IDS.AVOID,
      PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: PHASE6R_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
    label: 'Classification final outcomes',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME],
    allowedBucketIds: [
      PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
      PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: PHASE6R_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
    label: 'Manual corrections',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME],
    allowedBucketIds: [
      PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
      PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: PHASE6R_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
    label: 'Pending-item answers',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME],
    allowedBucketIds: [
      PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
      PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: PHASE6R_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
    label: 'Arr routing outcomes',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME],
    allowedBucketIds: [
      PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING,
      PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
      PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
    label: 'Metadata enrichment',
    authoritySourceIds: [AUTHORITY_SOURCE_IDS.METADATA_PROVIDER],
    allowedBucketIds: [
      PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
      PHASE6R_EVIDENCE_BUCKET_IDS.FRESHNESS,
      PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
  {
    id: PHASE6R_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
    label: 'Profile freshness',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    allowedBucketIds: [
      PHASE6R_EVIDENCE_BUCKET_IDS.FRESHNESS,
      PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
      PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    liveLookupAllowed: false,
    exposesRawPayload: false,
    exposesUiLanguage: false,
    transientStateAllowed: false,
    directLearningAllowed: false,
    prohibitedPayloadIds: ALL_PROHIBITED_PAYLOAD_IDS,
  },
]);

function listPolicyBuilderPhase6EvidenceBuckets() {
  return PHASE6R_EVIDENCE_BUCKETS;
}

function listPolicyBuilderPhase6EvidenceSources() {
  return PHASE6R_EVIDENCE_SOURCES;
}

function getPolicyBuilderPhase6EvidenceBucket(bucketId) {
  return PHASE6R_EVIDENCE_BUCKETS.find(bucket => bucket.id === bucketId) || null;
}

function getPolicyBuilderPhase6EvidenceSource(sourceId) {
  return PHASE6R_EVIDENCE_SOURCES.find(source => source.id === sourceId) || null;
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

function normalizeEvidenceScore(value) {
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
  observedAt = null,
  stale = null,
}) {
  const bucket = getPolicyBuilderPhase6EvidenceBucket(bucketId);
  const source = getPolicyBuilderPhase6EvidenceSource(sourceId);

  if (!bucket || !source || !bucket.allowedSourceIds.includes(sourceId)) {
    return null;
  }

  const normalizedLabel = normalizeNullableString(label ?? key ?? value);
  if (!normalizedLabel) {
    return null;
  }

  const fallbackAuthoritySourceId = source.authoritySourceIds[0] || null;
  const normalizedAuthoritySourceId = authoritySourceId || fallbackAuthoritySourceId;
  if (!normalizedAuthoritySourceId || !bucket.authoritySourceIds.includes(normalizedAuthoritySourceId)) {
    return null;
  }

  return {
    bucketId,
    sourceId,
    authoritySourceId: normalizedAuthoritySourceId,
    key: normalizeNullableString(key) || normalizedLabel.toLowerCase(),
    label: normalizedLabel,
    value: normalizeNullableString(value),
    count: normalizeCount(count),
    confidence: normalizeEvidenceScore(confidence),
    reasonCode: normalizeNullableString(reasonCode),
    observedAt: normalizeNullableString(observedAt),
    stale: typeof stale === 'boolean' ? stale : null,
    includesRawPayload: false,
    liveLookupPerformed: false,
  };
}

function addEntries(projection, entries) {
  entries.forEach(entry => {
    if (!entry) return;
    projection.buckets[entry.bucketId].push(entry);
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
      reasonCode: value.reasonCode ?? reasonCode,
      observedAt: value.observedAt ?? value.updatedAt,
      stale: value.stale,
    });
  });
}

function createEmptyEvidenceProjection() {
  const buckets = Object.fromEntries(
    PHASE6R_EVIDENCE_BUCKETS.map(bucket => [bucket.id, []])
  );

  return {
    version: 'phase6r.evidence.v1',
    generatedFromLiveProvider: false,
    exposesRawProviderPayloads: false,
    exposesUiChipLanguage: false,
    buckets,
    warnings: [],
  };
}

function buildPolicyBuilderPhase6EvidenceProjection(input = {}) {
  const projection = createEmptyEvidenceProjection();
  const libraryProfile = isNonEmptyObject(input.libraryProfile) ? input.libraryProfile : {};
  const operatorIntent = isNonEmptyObject(input.operatorIntent) ? input.operatorIntent : {};

  addEntries(projection, mapSignalEntries(libraryProfile.identityCandidates, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    reasonCode: 'observed_library_profile',
  }));
  addEntries(projection, mapSignalEntries(libraryProfile.compatibilityCandidates, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    reasonCode: 'observed_library_profile',
  }));
  addEntries(projection, mapSignalEntries(libraryProfile.outliers, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    reasonCode: 'observed_outlier',
  }));

  addEntries(projection, mapSignalEntries(operatorIntent.belongsHere, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    reasonCode: 'operator_declared_belongs_here',
  }));
  addEntries(projection, mapSignalEntries(operatorIntent.helpfulMatches, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    reasonCode: 'operator_declared_helpful_match',
  }));
  addEntries(projection, mapSignalEntries(operatorIntent.hardLimits, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    reasonCode: 'operator_declared_hard_limit',
  }));
  addEntries(projection, mapSignalEntries(operatorIntent.avoid, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.AVOID,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    reasonCode: 'operator_declared_avoid',
  }));
  addEntries(projection, mapSignalEntries(operatorIntent.routingTargets, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    reasonCode: 'operator_declared_routing_target',
  }));

  addEntries(projection, mapSignalEntries(input.classificationFinalOutcomes, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    reasonCode: 'final_outcome_observed',
  }));
  addEntries(projection, mapSignalEntries(input.manualCorrections, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.OUTLIER,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    reasonCode: 'manual_correction_observed',
  }));
  addEntries(projection, mapSignalEntries(input.pendingItemAnswers, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    reasonCode: 'pending_answer_requires_learning_guard',
  }));
  addEntries(projection, mapSignalEntries(input.routingOutcomes, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.ROUTING,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    reasonCode: 'arr_routing_outcome',
  }));
  addEntries(projection, mapSignalEntries(input.metadataEvidence, {
    bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    reasonCode: 'metadata_enrichment',
  }));

  const profileFreshness = isNonEmptyObject(input.profileFreshness) ? input.profileFreshness : null;
  if (profileFreshness) {
    addEntries(projection, [
      createEvidenceEntry({
        bucketId: profileFreshness.stale === true
          ? PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT
          : PHASE6R_EVIDENCE_BUCKET_IDS.FRESHNESS,
        sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
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
      bucketId: PHASE6R_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
      reasonCode: 'no_evidence_inputs',
      message: 'No Phase 6R evidence inputs were provided.',
    });
  }

  return projection;
}

function validatePolicyBuilderPhase6EvidenceBucket(candidate, sources = PHASE6R_EVIDENCE_SOURCES) {
  const issues = [];
  const knownSourceIds = new Set(sources.map(source => source.id));
  const knownAuthoritySourceIds = new Set(Object.values(AUTHORITY_SOURCE_IDS));

  if (!getPolicyBuilderPhase6EvidenceBucket(candidate?.id)) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_BUCKET,
      message: 'Evidence bucket must be part of the Phase 6R evidence vocabulary.',
    });
  }

  if (!normalizeString(candidate?.label)) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.MISSING_LABEL,
      message: 'Evidence bucket must have a label.',
    });
  }

  if (!normalizeString(candidate?.productMeaning)) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.MISSING_PRODUCT_MEANING,
      message: 'Evidence bucket must explain its destination-meaning role.',
    });
  }

  if (!normalizeString(candidate?.traceAttribute)) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.MISSING_TRACE_ATTRIBUTE,
      message: 'Evidence bucket must define a stable trace attribute name.',
    });
  }

  const allowedSourceIds = Array.isArray(candidate?.allowedSourceIds) ? candidate.allowedSourceIds : [];
  if (allowedSourceIds.length === 0) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.MISSING_ALLOWED_SOURCE,
      message: 'Evidence bucket must define which sources can populate it.',
    });
  }
  allowedSourceIds
    .filter(sourceId => !knownSourceIds.has(sourceId))
    .forEach(sourceId => {
      issues.push({
        riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_SOURCE,
        message: `Evidence bucket allows unknown source "${sourceId}".`,
      });
    });

  const authoritySourceIds = Array.isArray(candidate?.authoritySourceIds) ? candidate.authoritySourceIds : [];
  if (authoritySourceIds.length === 0) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.MISSING_AUTHORITY_SOURCE,
      message: 'Evidence bucket must define authority sources.',
    });
  }
  authoritySourceIds
    .filter(sourceId => !knownAuthoritySourceIds.has(sourceId) || !getPolicyAuthoritySource(sourceId))
    .forEach(sourceId => {
      issues.push({
        riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_AUTHORITY_SOURCE,
        message: `Evidence bucket references unknown authority source "${sourceId}".`,
      });
    });

  if (candidate?.id === PHASE6R_EVIDENCE_BUCKET_IDS.HARD_LIMIT &&
      authoritySourceIds.some(sourceId => sourceId !== AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.HARD_LIMIT_WITHOUT_OPERATOR_AUTHORITY,
      message: 'Hard-limit evidence must come only from operator-declared intent.',
    });
  }

  if (candidate?.id === PHASE6R_EVIDENCE_BUCKET_IDS.AVOID &&
      authoritySourceIds.some(sourceId => sourceId !== AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.AVOID_WITHOUT_OPERATOR_AUTHORITY,
      message: 'Avoid evidence must come only from operator-declared intent.',
    });
  }

  return {
    ok: issues.length === 0,
    bucketId: candidate?.id || null,
    issues,
  };
}

function validatePolicyBuilderPhase6EvidenceSource(candidate, buckets = PHASE6R_EVIDENCE_BUCKETS) {
  const issues = [];
  const knownBucketIds = new Set(buckets.map(bucket => bucket.id));
  const knownAuthoritySourceIds = new Set(Object.values(AUTHORITY_SOURCE_IDS));

  if (!getPolicyBuilderPhase6EvidenceSource(candidate?.id)) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_SOURCE,
      message: 'Evidence source must be part of the Phase 6R evidence vocabulary.',
    });
  }

  if (!normalizeString(candidate?.label)) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.MISSING_LABEL,
      message: 'Evidence source must have a label.',
    });
  }

  const authoritySourceIds = Array.isArray(candidate?.authoritySourceIds) ? candidate.authoritySourceIds : [];
  if (authoritySourceIds.length === 0) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.MISSING_AUTHORITY_SOURCE,
      message: 'Evidence source must define authority sources.',
    });
  }
  authoritySourceIds
    .filter(sourceId => !knownAuthoritySourceIds.has(sourceId) || !getPolicyAuthoritySource(sourceId))
    .forEach(sourceId => {
      issues.push({
        riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.UNKNOWN_AUTHORITY_SOURCE,
        message: `Evidence source references unknown authority source "${sourceId}".`,
      });
    });

  const allowedBucketIds = Array.isArray(candidate?.allowedBucketIds) ? candidate.allowedBucketIds : [];
  allowedBucketIds
    .filter(bucketId => !knownBucketIds.has(bucketId))
    .forEach(bucketId => {
      issues.push({
        riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.SOURCE_ALLOWS_UNKNOWN_BUCKET,
        message: `Evidence source allows unknown bucket "${bucketId}".`,
      });
    });

  if (candidate?.liveLookupAllowed === true) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.SOURCE_ALLOWS_LIVE_LOOKUP,
      message: 'Evidence sources must not perform live provider lookups in Phase 6R.1.',
    });
  }

  if (candidate?.exposesRawPayload === true) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.SOURCE_EXPOSES_RAW_PAYLOAD,
      message: 'Evidence sources must not expose raw provider, replay, or impact payloads.',
    });
  }

  if (candidate?.exposesUiLanguage === true) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.SOURCE_EXPOSES_UI_LANGUAGE,
      message: 'Evidence sources must not expose UI chip language as contract fields.',
    });
  }

  if (candidate?.transientStateAllowed === true) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.SOURCE_ALLOWS_TRANSIENT_STATE,
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
        riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.SOURCE_MISSING_PROHIBITED_PAYLOAD,
        message: `Evidence source must explicitly prohibit "${payloadId}".`,
      });
    });

  if (candidate?.id === PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT &&
      allowedBucketIds.includes(PHASE6R_EVIDENCE_BUCKET_IDS.IDENTITY)) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.METADATA_OWNS_POLICY_MEANING,
      message: 'Metadata evidence cannot own destination identity in Phase 6R.1.',
    });
  }

  if (authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME) &&
      candidate?.directLearningAllowed === true) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_AUDIT_RISK_IDS.FINAL_OUTCOME_LEARNS_DIRECTLY,
      message: 'Final outcomes can describe evidence but cannot learn directly before the learning guard.',
    });
  }

  return {
    ok: issues.length === 0,
    sourceId: candidate?.id || null,
    issues,
  };
}

function buildPolicyBuilderPhase6EvidenceEngineAudit({
  buckets = PHASE6R_EVIDENCE_BUCKETS,
  sources = PHASE6R_EVIDENCE_SOURCES,
} = {}) {
  const bucketResults = buckets.map(bucket =>
    validatePolicyBuilderPhase6EvidenceBucket(bucket, sources)
  );
  const sourceResults = sources.map(source =>
    validatePolicyBuilderPhase6EvidenceSource(source, buckets)
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
    nextPhase: {
      phaseId: '6r_2',
      label: 'Intent Engine',
      reason: 'Evidence buckets are now stable enough to convert observed and declared evidence into proposed destination meaning.',
    },
  };
}

export {
  PHASE6R_EVIDENCE_AUDIT_RISK_IDS,
  PHASE6R_EVIDENCE_BUCKET_IDS,
  PHASE6R_EVIDENCE_PROHIBITED_PAYLOAD_IDS,
  PHASE6R_EVIDENCE_SOURCE_IDS,
  buildPolicyBuilderPhase6EvidenceEngineAudit,
  buildPolicyBuilderPhase6EvidenceProjection,
  getPolicyBuilderPhase6EvidenceBucket,
  getPolicyBuilderPhase6EvidenceSource,
  listPolicyBuilderPhase6EvidenceBuckets,
  listPolicyBuilderPhase6EvidenceSources,
  validatePolicyBuilderPhase6EvidenceBucket,
  validatePolicyBuilderPhase6EvidenceSource,
};
