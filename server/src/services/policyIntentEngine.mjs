import {
  AUTHORITY_SOURCE_IDS,
  getPolicyAuthoritySource,
  isDurablePolicyAuthority,
} from './policyAuthorityVocabulary.mjs';
import {
  POLICY_EVIDENCE_BUCKET_IDS,
  POLICY_EVIDENCE_SOURCE_IDS,
  buildPolicyEvidenceProjection,
  getPolicyEvidenceBucket,
} from './policyEvidenceEngine.mjs';
import {
  validatePolicyEvidenceFingerprint,
} from './policyEvidenceFingerprint.mjs';
import {
  POLICY_EVIDENCE_QUALITY_STATUS_IDS,
} from './policyEvidenceQuality.mjs';

const POLICY_INTENT_BOUNDARY_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_EVIDENCE_BOUNDARY: 'blocked_by_evidence_boundary',
  BLOCKED_BY_EVIDENCE_QUALITY: 'blocked_by_evidence_quality',
  BLOCKED_BY_INTENT_AUDIT: 'blocked_by_intent_audit',
});

const POLICY_INTENT_FIELD_IDS = Object.freeze({
  BELONGS_HERE: 'belongs_here',
  HELPFUL_MATCHES: 'helpful_matches',
  HARD_LIMITS: 'hard_limits',
  AVOID: 'avoid',
  ASK_WHEN: 'ask_when',
  ROUTING_TARGET: 'routing_target',
  CONFIDENCE: 'confidence',
  ASSUMPTIONS: 'assumptions',
  WARNINGS: 'warnings',
});

const POLICY_INTENT_CONFIDENCE_LEVEL_IDS = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  BLOCKED: 'blocked',
});

const POLICY_INTENT_WARNING_IDS = Object.freeze({
  BROAD_GENRE_IDENTITY_NEEDS_SUPPORT: 'broad_genre_identity_needs_support',
  OBSERVED_ABSENCE_NOT_EXCLUSION: 'observed_absence_not_exclusion',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
  STALE_PROFILE: 'stale_profile',
  METADATA_NOT_IDENTITY_AUTHORITY: 'metadata_not_identity_authority',
  LEGACY_TEMPLATE_BRIDGE_ONLY: 'legacy_template_bridge_only',
});

const POLICY_INTENT_ASSUMPTION_IDS = Object.freeze({
  OBSERVED_IDENTITY_ACCEPTANCE_REQUIRED: 'observed_identity_acceptance_required',
  DECLARED_CONSTRAINTS_ARE_OPERATOR_AUTHORITY: 'declared_constraints_are_operator_authority',
  FINAL_OUTCOMES_REQUIRE_LEARNING_GUARD: 'final_outcomes_require_learning_guard',
  METADATA_SUPPORTS_COMPATIBILITY_ONLY: 'metadata_supports_compatibility_only',
  LEGACY_TEMPLATE_IS_DRAFT_SEED_ONLY: 'legacy_template_is_draft_seed_only',
});

const POLICY_INTENT_AUDIT_RISK_IDS = Object.freeze({
  MISSING_FIELD: 'missing_field',
  INVALID_CONFIDENCE_LEVEL: 'invalid_confidence_level',
  MISSING_CONFIDENCE_REASON: 'missing_confidence_reason',
  MISSING_ENTRY_LABEL: 'missing_entry_label',
  MISSING_ENTRY_EVIDENCE_BUCKET: 'missing_entry_evidence_bucket',
  UNKNOWN_ENTRY_EVIDENCE_BUCKET: 'unknown_entry_evidence_bucket',
  MISSING_ENTRY_AUTHORITY_SOURCE: 'missing_entry_authority_source',
  UNKNOWN_ENTRY_AUTHORITY_SOURCE: 'unknown_entry_authority_source',
  HARD_LIMIT_WITHOUT_DURABLE_AUTHORITY: 'hard_limit_without_durable_authority',
  AVOID_WITHOUT_DURABLE_AUTHORITY: 'avoid_without_durable_authority',
  METADATA_PROMOTED_TO_IDENTITY: 'metadata_promoted_to_identity',
  BROAD_GENRE_IDENTITY_WITHOUT_SUPPORT: 'broad_genre_identity_without_support',
  OBSERVED_ABSENCE_PROMOTED_TO_EXCLUSION: 'observed_absence_promoted_to_exclusion',
  LEGACY_TEMPLATE_AS_AUTHORITY: 'legacy_template_as_authority',
  DIRECT_LEARNING_FROM_INTENT: 'direct_learning_from_intent',
  MISSING_EVIDENCE_BOUNDARY: 'missing_evidence_boundary',
  MISSING_EVIDENCE_FINGERPRINT: 'missing_evidence_fingerprint',
  EVIDENCE_FINGERPRINT_MISMATCH: 'evidence_fingerprint_mismatch',
  INSUFFICIENT_EVIDENCE_QUALITY: 'insufficient_evidence_quality',
  MISSING_EVIDENCE_QUALITY: 'missing_evidence_quality',
});

const BROAD_GENRE_LABELS = Object.freeze([
  'action',
  'adventure',
  'animation',
  'comedy',
  'crime',
  'documentary',
  'drama',
  'family',
  'fantasy',
  'history',
  'horror',
  'music',
  'mystery',
  'reality',
  'romance',
  'science fiction',
  'sci-fi',
  'sport',
  'sports',
  'thriller',
  'war',
  'western',
]);

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

const POLICY_INTENT_FIELD_CONTRACTS = deepFreeze([
  {
    id: POLICY_INTENT_FIELD_IDS.BELONGS_HERE,
    label: 'Belongs Here',
    evidenceBucketIds: [POLICY_EVIDENCE_BUCKET_IDS.IDENTITY],
    durableAuthorityRequired: false,
    productMeaning: 'Destination identity that is either declared by the operator or strongly supported by specific observed evidence.',
  },
  {
    id: POLICY_INTENT_FIELD_IDS.HELPFUL_MATCHES,
    label: 'Helpful Matches',
    evidenceBucketIds: [POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY],
    durableAuthorityRequired: false,
    productMeaning: 'Compatibility evidence that can support a destination after identity is plausible.',
  },
  {
    id: POLICY_INTENT_FIELD_IDS.HARD_LIMITS,
    label: 'Hard Limits',
    evidenceBucketIds: [POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT],
    durableAuthorityRequired: true,
    productMeaning: 'Operator-declared constraints that can block automation.',
  },
  {
    id: POLICY_INTENT_FIELD_IDS.AVOID,
    label: 'Avoid',
    evidenceBucketIds: [POLICY_EVIDENCE_BUCKET_IDS.AVOID],
    durableAuthorityRequired: true,
    productMeaning: 'Operator-declared poor-fit evidence that lowers confidence without becoming a hard block by default.',
  },
  {
    id: POLICY_INTENT_FIELD_IDS.ASK_WHEN,
    label: 'Ask When',
    evidenceBucketIds: [
      POLICY_EVIDENCE_BUCKET_IDS.OUTLIER,
      POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT,
    ],
    durableAuthorityRequired: false,
    productMeaning: 'Review triggers produced from missing, stale, conflicting, or outlier evidence.',
  },
  {
    id: POLICY_INTENT_FIELD_IDS.ROUTING_TARGET,
    label: 'Routing Target',
    evidenceBucketIds: [POLICY_EVIDENCE_BUCKET_IDS.ROUTING],
    durableAuthorityRequired: false,
    productMeaning: 'Destination routing evidence kept separate from classification identity.',
  },
]);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKey(value) {
  return normalizeString(value).toLowerCase();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getEvidenceEntries(projection, bucketId) {
  return asArray(projection?.buckets?.[bucketId]);
}

function isMetadataEvidence(entry = {}) {
  return entry.sourceId === POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT ||
    entry.authoritySourceId === AUTHORITY_SOURCE_IDS.METADATA_PROVIDER;
}

function isOperatorDeclared(entry = {}) {
  return entry.sourceId === POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT ||
    entry.authoritySourceId === AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT;
}

function isBroadGenreEvidence(entry = {}) {
  const key = normalizeKey(entry.key);
  const label = normalizeKey(entry.label);

  if (key.startsWith('genre:') || key.startsWith('genres:')) {
    return true;
  }

  return BROAD_GENRE_LABELS.includes(label);
}

function hasSpecificIdentitySupport(identityEntries) {
  return identityEntries.some(entry => !isBroadGenreEvidence(entry) || isOperatorDeclared(entry));
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
  return Math.max(0, Math.min(1, numeric));
}

function buildIntentEntry(entry = {}, {
  fieldId,
  reasonCode,
  inferred = true,
  operatorDeclared = false,
} = {}) {
  const label = normalizeString(entry.label ?? entry.value ?? entry.key);
  if (!label) return null;

  return {
    fieldId,
    key: normalizeString(entry.key) || label.toLowerCase(),
    label,
    value: entry.value ?? null,
    evidenceBucketId: entry.bucketId,
    evidenceSourceId: entry.sourceId,
    authoritySourceId: entry.authoritySourceId,
    reasonCode: reasonCode || entry.reasonCode || 'policy_evidence',
    evidenceCount: Number.isFinite(Number(entry.count)) ? Number(entry.count) : null,
    evidenceConfidence: normalizeConfidence(entry.confidence),
    inferred: Boolean(inferred),
    operatorDeclared: Boolean(operatorDeclared),
  };
}

function uniqueByKey(entries) {
  const seen = new Set();
  return entries.filter(entry => {
    if (!entry) return false;
    const key = `${entry.fieldId}:${entry.key}:${entry.authoritySourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildWarning(reasonCode, summary, details = {}) {
  return {
    reasonCode,
    severity: details.severity || 'warning',
    summary,
    evidenceBucketId: details.evidenceBucketId || null,
    evidenceSourceId: details.evidenceSourceId || null,
  };
}

function buildAssumption(reasonCode, summary) {
  return {
    reasonCode,
    summary,
  };
}

function countEntries(intent) {
  return [
    POLICY_INTENT_FIELD_IDS.BELONGS_HERE,
    POLICY_INTENT_FIELD_IDS.HELPFUL_MATCHES,
    POLICY_INTENT_FIELD_IDS.HARD_LIMITS,
    POLICY_INTENT_FIELD_IDS.AVOID,
    POLICY_INTENT_FIELD_IDS.ASK_WHEN,
    POLICY_INTENT_FIELD_IDS.ROUTING_TARGET,
  ].reduce((count, fieldId) => count + asArray(intent[fieldId]).length, 0);
}

function calculateConfidence(intent) {
  const identityCount = intent.belongs_here.length;
  const helpfulCount = intent.helpful_matches.length;
  const hardLimitCount = intent.hard_limits.length;
  const askWhenCount = intent.ask_when.length;
  const warningCount = intent.warnings.length;

  if (intent.hard_limits.some(entry => entry.operatorDeclared === false)) {
    return {
      level: POLICY_INTENT_CONFIDENCE_LEVEL_IDS.BLOCKED,
      score: 0,
      reasonCodes: ['invalid_hard_limit_authority'],
    };
  }

  let score = 0.2;
  if (identityCount > 0) score += 0.35;
  if (helpfulCount > 0) score += 0.15;
  if (hardLimitCount > 0) score += 0.1;
  if (askWhenCount > 0) score -= 0.1;
  if (warningCount > 0) score -= Math.min(0.25, warningCount * 0.05);

  score = Math.max(0, Math.min(1, Number(score.toFixed(2))));

  let level = POLICY_INTENT_CONFIDENCE_LEVEL_IDS.LOW;
  if (score >= 0.75) level = POLICY_INTENT_CONFIDENCE_LEVEL_IDS.HIGH;
  else if (score >= 0.5) level = POLICY_INTENT_CONFIDENCE_LEVEL_IDS.MEDIUM;

  return {
    level,
    score,
    reasonCodes: [
      identityCount > 0 ? 'has_identity_evidence' : 'missing_identity_evidence',
      helpfulCount > 0 ? 'has_compatibility_evidence' : 'missing_compatibility_evidence',
      warningCount > 0 ? 'has_warnings' : 'no_warnings',
    ],
  };
}

function createEmptyIntentDraft() {
  return {
    version: 'policy.intent.v1',
    source: 'policy_evidence_engine',
    evidenceBoundary: null,
    belongs_here: [],
    helpful_matches: [],
    hard_limits: [],
    avoid: [],
    ask_when: [],
    routing_target: [],
    confidence: {
      level: POLICY_INTENT_CONFIDENCE_LEVEL_IDS.LOW,
      score: 0,
      reasonCodes: [],
    },
    assumptions: [],
    warnings: [],
    learningSideEffects: [],
    bridgeCompatibility: {
      legacyTemplatesAllowedAs: 'draft_seed_only',
      customSignalsAllowedAs: 'compatibility_bridge_only',
      nativeStorageReady: false,
    },
  };
}

function buildEvidenceBoundarySnapshot(boundedEvidenceResult = {}) {
  if (!boundedEvidenceResult || typeof boundedEvidenceResult !== 'object') {
    return null;
  }

  const projectionFingerprint = boundedEvidenceResult.projectionFingerprint;
  if (!projectionFingerprint || typeof projectionFingerprint !== 'object') {
    return null;
  }

  return {
    boundaryVersion: boundedEvidenceResult.version || null,
    statusId: boundedEvidenceResult.statusId || null,
    quality: boundedEvidenceResult.projection?.quality
      ? {
          version: boundedEvidenceResult.projection.quality.version || null,
          statusId: boundedEvidenceResult.projection.quality.statusId || null,
          score: boundedEvidenceResult.projection.quality.score ?? null,
          nextActionId: boundedEvidenceResult.projection.quality.nextActionId || null,
          reasonIds: Array.isArray(boundedEvidenceResult.projection.quality.reasonIds)
            ? [...boundedEvidenceResult.projection.quality.reasonIds]
            : [],
          counts: boundedEvidenceResult.projection.quality.counts || {},
          hasIdentityEvidence: boundedEvidenceResult.projection.quality.hasIdentityEvidence === true,
          hasDeclaredIdentityEvidence:
            boundedEvidenceResult.projection.quality.hasDeclaredIdentityEvidence === true,
          hasObservedIdentityEvidence:
            boundedEvidenceResult.projection.quality.hasObservedIdentityEvidence === true,
          hasStaleProfileEvidence:
            boundedEvidenceResult.projection.quality.hasStaleProfileEvidence === true,
        }
      : null,
    projectionFingerprint: {
      version: projectionFingerprint.version || null,
      algorithm: projectionFingerprint.algorithm || null,
      fingerprint: projectionFingerprint.fingerprint || null,
      provenance: projectionFingerprint.provenance || null,
      traceAttributes: projectionFingerprint.traceAttributes || null,
    },
  };
}

function buildEvidenceQualityIssues(quality = null) {
  if (!quality || typeof quality !== 'object' || Array.isArray(quality)) {
    return [{
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.MISSING_EVIDENCE_QUALITY,
      message: 'Intent inference requires a generated evidence quality assessment.',
    }];
  }

  if (quality.statusId === POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT) {
    return [{
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.INSUFFICIENT_EVIDENCE_QUALITY,
      message: 'Intent inference is blocked until evidence quality is no longer insufficient.',
      qualityStatusId: quality.statusId,
      nextActionId: quality.nextActionId || null,
      reasonIds: Array.isArray(quality.reasonIds) ? [...quality.reasonIds] : [],
    }];
  }

  return [];
}

function buildPolicyIntentDraft(input = {}) {
  const projection = input?.version === 'policy.evidence.v1'
    ? input
    : buildPolicyEvidenceProjection(input);
  const intent = createEmptyIntentDraft();
  const identityEntries = getEvidenceEntries(projection, POLICY_EVIDENCE_BUCKET_IDS.IDENTITY);
  const hasSpecificSupport = hasSpecificIdentitySupport(identityEntries);

  const belongsHere = [];
  const helpfulMatches = [];

  identityEntries.forEach(entry => {
    if (isMetadataEvidence(entry)) {
      intent.warnings.push(buildWarning(
        POLICY_INTENT_WARNING_IDS.METADATA_NOT_IDENTITY_AUTHORITY,
        'Metadata evidence can support compatibility, but cannot define destination identity.',
        { evidenceBucketId: entry.bucketId, evidenceSourceId: entry.sourceId }
      ));
      helpfulMatches.push(buildIntentEntry({
        ...entry,
        bucketId: POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      }, {
        fieldId: POLICY_INTENT_FIELD_IDS.HELPFUL_MATCHES,
        reasonCode: 'metadata_identity_demoted_to_compatibility',
        inferred: true,
        operatorDeclared: false,
      }));
      return;
    }

    if (isBroadGenreEvidence(entry) && !isOperatorDeclared(entry) && !hasSpecificSupport) {
      intent.warnings.push(buildWarning(
        POLICY_INTENT_WARNING_IDS.BROAD_GENRE_IDENTITY_NEEDS_SUPPORT,
        'Broad genre evidence was kept as helpful evidence until specific support or operator intent confirms destination identity.',
        { evidenceBucketId: entry.bucketId, evidenceSourceId: entry.sourceId }
      ));
      helpfulMatches.push(buildIntentEntry({
        ...entry,
        bucketId: POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
      }, {
        fieldId: POLICY_INTENT_FIELD_IDS.HELPFUL_MATCHES,
        reasonCode: 'broad_genre_identity_demoted_to_compatibility',
        inferred: true,
        operatorDeclared: false,
      }));
      return;
    }

    belongsHere.push(buildIntentEntry(entry, {
      fieldId: POLICY_INTENT_FIELD_IDS.BELONGS_HERE,
      reasonCode: isOperatorDeclared(entry)
        ? 'operator_declared_destination_identity'
        : 'observed_destination_identity',
      inferred: !isOperatorDeclared(entry),
      operatorDeclared: isOperatorDeclared(entry),
    }));
  });

  helpfulMatches.push(...getEvidenceEntries(projection, POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY)
    .map(entry => buildIntentEntry(entry, {
      fieldId: POLICY_INTENT_FIELD_IDS.HELPFUL_MATCHES,
      reasonCode: isOperatorDeclared(entry)
        ? 'operator_declared_helpful_match'
        : 'evidence_supported_helpful_match',
      inferred: !isOperatorDeclared(entry),
      operatorDeclared: isOperatorDeclared(entry),
    })));

  intent.belongs_here = uniqueByKey(belongsHere);
  intent.helpful_matches = uniqueByKey(helpfulMatches);
  intent.hard_limits = uniqueByKey(getEvidenceEntries(projection, POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT)
    .filter(isOperatorDeclared)
    .map(entry => buildIntentEntry(entry, {
      fieldId: POLICY_INTENT_FIELD_IDS.HARD_LIMITS,
      reasonCode: 'operator_declared_hard_limit',
      inferred: false,
      operatorDeclared: true,
    })));
  intent.avoid = uniqueByKey(getEvidenceEntries(projection, POLICY_EVIDENCE_BUCKET_IDS.AVOID)
    .filter(isOperatorDeclared)
    .map(entry => buildIntentEntry(entry, {
      fieldId: POLICY_INTENT_FIELD_IDS.AVOID,
      reasonCode: 'operator_declared_avoid',
      inferred: false,
      operatorDeclared: true,
    })));
  intent.ask_when = uniqueByKey([
    ...getEvidenceEntries(projection, POLICY_EVIDENCE_BUCKET_IDS.OUTLIER)
      .map(entry => buildIntentEntry(entry, {
        fieldId: POLICY_INTENT_FIELD_IDS.ASK_WHEN,
        reasonCode: 'outlier_needs_review',
      })),
    ...getEvidenceEntries(projection, POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT)
      .map(entry => buildIntentEntry(entry, {
        fieldId: POLICY_INTENT_FIELD_IDS.ASK_WHEN,
        reasonCode: entry.reasonCode === 'stale_profile'
          ? 'stale_profile_needs_review'
          : 'insufficient_evidence_needs_review',
      })),
  ]);
  intent.routing_target = uniqueByKey(getEvidenceEntries(projection, POLICY_EVIDENCE_BUCKET_IDS.ROUTING)
    .map(entry => buildIntentEntry(entry, {
      fieldId: POLICY_INTENT_FIELD_IDS.ROUTING_TARGET,
      reasonCode: isOperatorDeclared(entry)
        ? 'operator_declared_routing_target'
        : 'routing_outcome_observed',
      inferred: !isOperatorDeclared(entry),
      operatorDeclared: isOperatorDeclared(entry),
    })));

  if (intent.ask_when.length > 0) {
    intent.warnings.push(buildWarning(
      POLICY_INTENT_WARNING_IDS.OBSERVED_ABSENCE_NOT_EXCLUSION,
      'Missing, stale, or conflicting evidence created review triggers, not exclusions.',
      { evidenceBucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT }
    ));
  }

  if (getEvidenceEntries(projection, POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT).length > 0 ||
      projection.warnings?.length > 0) {
    intent.warnings.push(buildWarning(
      POLICY_INTENT_WARNING_IDS.INSUFFICIENT_EVIDENCE,
      'Some evidence is insufficient for confident automation.',
      { evidenceBucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT }
    ));
  }

  if (projection.quality?.statusId === POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT) {
    intent.warnings.push(buildWarning(
      POLICY_INTENT_WARNING_IDS.INSUFFICIENT_EVIDENCE,
      'Evidence quality is insufficient; intent inference must wait for more evidence or operator confirmation.',
      { evidenceBucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT }
    ));
  }

  if (intent.ask_when.some(entry => entry.reasonCode === 'stale_profile_needs_review')) {
    intent.warnings.push(buildWarning(
      POLICY_INTENT_WARNING_IDS.STALE_PROFILE,
      'The destination profile should be refreshed before treating this intent as current.',
      { evidenceBucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT }
    ));
  }

  intent.assumptions = [
    buildAssumption(
      POLICY_INTENT_ASSUMPTION_IDS.OBSERVED_IDENTITY_ACCEPTANCE_REQUIRED,
      'Observed identity evidence remains a suggestion until operator intent or later automation gates accept it.'
    ),
    buildAssumption(
      POLICY_INTENT_ASSUMPTION_IDS.DECLARED_CONSTRAINTS_ARE_OPERATOR_AUTHORITY,
      'Hard limits and avoid values are accepted only from operator-declared intent.'
    ),
    buildAssumption(
      POLICY_INTENT_ASSUMPTION_IDS.FINAL_OUTCOMES_REQUIRE_LEARNING_GUARD,
      'Manual outcomes can inform evidence, but durable learning waits for the learning eligibility guard.'
    ),
    buildAssumption(
      POLICY_INTENT_ASSUMPTION_IDS.METADATA_SUPPORTS_COMPATIBILITY_ONLY,
      'Metadata evidence supports compatibility and freshness, not policy identity by itself.'
    ),
    buildAssumption(
      POLICY_INTENT_ASSUMPTION_IDS.LEGACY_TEMPLATE_IS_DRAFT_SEED_ONLY,
      'Starter templates remain draft seeds and bridge inputs, not the durable intent authority.'
    ),
  ];

  intent.warnings.push(buildWarning(
    POLICY_INTENT_WARNING_IDS.LEGACY_TEMPLATE_BRIDGE_ONLY,
    'Legacy presets and custom signals remain compatibility bridges until native intent storage is ready.',
    { severity: 'info' }
  ));
  intent.confidence = calculateConfidence(intent);

  return intent;
}

function buildPolicyIntentDraftFromBoundedEvidence({
  boundedEvidenceResult,
} = {}) {
  const evidenceIssues = [];

  if (boundedEvidenceResult?.ok !== true || !boundedEvidenceResult?.projection) {
    evidenceIssues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.MISSING_EVIDENCE_BOUNDARY,
      message: 'Intent inference requires a successful bounded evidence result.',
    });
  }

  const evidenceBoundary = buildEvidenceBoundarySnapshot(boundedEvidenceResult);
  if (!evidenceBoundary?.projectionFingerprint?.fingerprint) {
    evidenceIssues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.MISSING_EVIDENCE_FINGERPRINT,
      message: 'Intent inference requires a bounded evidence projection fingerprint.',
    });
  }

  const evidenceFingerprintAudit = boundedEvidenceResult?.projection &&
    boundedEvidenceResult?.projectionFingerprint
    ? validatePolicyEvidenceFingerprint({
        projection: boundedEvidenceResult.projection,
        projectionFingerprint: boundedEvidenceResult.projectionFingerprint,
      })
    : null;

  if (evidenceFingerprintAudit && evidenceFingerprintAudit.ok !== true) {
    evidenceIssues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.EVIDENCE_FINGERPRINT_MISMATCH,
      message: 'Intent inference requires the evidence fingerprint to match the bounded evidence projection.',
      fingerprintIssues: evidenceFingerprintAudit.issues,
    });
  }

  if (boundedEvidenceResult?.ok === true && boundedEvidenceResult?.projection) {
    evidenceIssues.push(...buildEvidenceQualityIssues(boundedEvidenceResult.projection.quality));
  }

  if (evidenceIssues.length > 0) {
    return {
      ok: false,
      statusId: evidenceIssues.some(issue =>
        issue.riskId === POLICY_INTENT_AUDIT_RISK_IDS.INSUFFICIENT_EVIDENCE_QUALITY ||
        issue.riskId === POLICY_INTENT_AUDIT_RISK_IDS.MISSING_EVIDENCE_QUALITY
      )
        ? POLICY_INTENT_BOUNDARY_STATUS_IDS.BLOCKED_BY_EVIDENCE_QUALITY
        : POLICY_INTENT_BOUNDARY_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY,
      evidenceBoundary,
      evidenceFingerprintAudit,
      intent: null,
      intentAudit: null,
      issueCount: evidenceIssues.length,
      issues: evidenceIssues,
      nextStep: null,
    };
  }

  const intent = buildPolicyIntentDraft(boundedEvidenceResult.projection);
  intent.source = 'policy_bounded_evidence_boundary';
  intent.evidenceBoundary = evidenceBoundary;
  const intentAudit = buildPolicyIntentEngineAudit(intent);
  const ok = intentAudit.ok === true;

  return {
    ok,
    statusId: ok
      ? POLICY_INTENT_BOUNDARY_STATUS_IDS.READY
      : POLICY_INTENT_BOUNDARY_STATUS_IDS.BLOCKED_BY_INTENT_AUDIT,
    evidenceBoundary,
    evidenceFingerprintAudit,
    intent,
    intentAudit,
    issueCount: intentAudit.issueCount,
    issues: intentAudit.validation.issues,
    nextStep: ok ? intentAudit.nextStep : null,
  };
}

function getPolicyIntentField(fieldId) {
  return POLICY_INTENT_FIELD_CONTRACTS.find(field => field.id === fieldId) || null;
}

function listPolicyIntentFields() {
  return POLICY_INTENT_FIELD_CONTRACTS;
}

function validateIntentEntry(entry = {}, fieldId) {
  const issues = [];
  const label = normalizeString(entry.label);

  if (!label) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.MISSING_ENTRY_LABEL,
      message: `${fieldId} entry must have a label.`,
    });
  }

  if (!normalizeString(entry.evidenceBucketId)) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.MISSING_ENTRY_EVIDENCE_BUCKET,
      message: `${fieldId} entry must reference its evidence bucket.`,
    });
  } else if (!getPolicyEvidenceBucket(entry.evidenceBucketId)) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.UNKNOWN_ENTRY_EVIDENCE_BUCKET,
      message: `${fieldId} entry references an unknown evidence bucket.`,
    });
  }

  if (!normalizeString(entry.authoritySourceId)) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.MISSING_ENTRY_AUTHORITY_SOURCE,
      message: `${fieldId} entry must reference its authority source.`,
    });
  } else if (!getPolicyAuthoritySource(entry.authoritySourceId)) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.UNKNOWN_ENTRY_AUTHORITY_SOURCE,
      message: `${fieldId} entry references an unknown authority source.`,
    });
  }

  return issues;
}

function validatePolicyIntentDraft(intent = {}) {
  const issues = [];
  const requiredArrayFields = [
    POLICY_INTENT_FIELD_IDS.BELONGS_HERE,
    POLICY_INTENT_FIELD_IDS.HELPFUL_MATCHES,
    POLICY_INTENT_FIELD_IDS.HARD_LIMITS,
    POLICY_INTENT_FIELD_IDS.AVOID,
    POLICY_INTENT_FIELD_IDS.ASK_WHEN,
    POLICY_INTENT_FIELD_IDS.ROUTING_TARGET,
    POLICY_INTENT_FIELD_IDS.ASSUMPTIONS,
    POLICY_INTENT_FIELD_IDS.WARNINGS,
  ];

  requiredArrayFields.forEach(fieldId => {
    if (!Array.isArray(intent?.[fieldId])) {
      issues.push({
        riskId: POLICY_INTENT_AUDIT_RISK_IDS.MISSING_FIELD,
        message: `Intent draft must include array field "${fieldId}".`,
      });
    }
  });

  const confidenceLevel = intent?.confidence?.level;
  if (!Object.values(POLICY_INTENT_CONFIDENCE_LEVEL_IDS).includes(confidenceLevel)) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.INVALID_CONFIDENCE_LEVEL,
      message: 'Intent draft must include a supported confidence level.',
    });
  }
  if (!Array.isArray(intent?.confidence?.reasonCodes) ||
      intent.confidence.reasonCodes.length === 0) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.MISSING_CONFIDENCE_REASON,
      message: 'Intent draft confidence must explain its reason codes.',
    });
  }

  [
    POLICY_INTENT_FIELD_IDS.BELONGS_HERE,
    POLICY_INTENT_FIELD_IDS.HELPFUL_MATCHES,
    POLICY_INTENT_FIELD_IDS.HARD_LIMITS,
    POLICY_INTENT_FIELD_IDS.AVOID,
    POLICY_INTENT_FIELD_IDS.ASK_WHEN,
    POLICY_INTENT_FIELD_IDS.ROUTING_TARGET,
  ].forEach(fieldId => {
    asArray(intent?.[fieldId]).forEach(entry => {
      issues.push(...validateIntentEntry(entry, fieldId));
    });
  });

  asArray(intent?.hard_limits).forEach(entry => {
    if (!isDurablePolicyAuthority(entry.authoritySourceId) || entry.operatorDeclared !== true) {
      issues.push({
        riskId: POLICY_INTENT_AUDIT_RISK_IDS.HARD_LIMIT_WITHOUT_DURABLE_AUTHORITY,
        message: 'Hard-limit intent entries must come from operator-declared durable authority.',
      });
    }
  });

  asArray(intent?.avoid).forEach(entry => {
    if (!isDurablePolicyAuthority(entry.authoritySourceId) || entry.operatorDeclared !== true) {
      issues.push({
        riskId: POLICY_INTENT_AUDIT_RISK_IDS.AVOID_WITHOUT_DURABLE_AUTHORITY,
        message: 'Avoid intent entries must come from operator-declared durable authority.',
      });
    }
  });

  asArray(intent?.belongs_here).forEach(entry => {
    if (entry.authoritySourceId === AUTHORITY_SOURCE_IDS.METADATA_PROVIDER) {
      issues.push({
        riskId: POLICY_INTENT_AUDIT_RISK_IDS.METADATA_PROMOTED_TO_IDENTITY,
        message: 'Metadata evidence cannot be promoted to destination identity.',
      });
    }
    if (isBroadGenreEvidence(entry) &&
        entry.operatorDeclared !== true &&
        !asArray(intent.belongs_here).some(candidate => !isBroadGenreEvidence(candidate))) {
      issues.push({
        riskId: POLICY_INTENT_AUDIT_RISK_IDS.BROAD_GENRE_IDENTITY_WITHOUT_SUPPORT,
        message: 'Broad genre identity requires specific supporting evidence or operator-declared intent.',
      });
    }
  });

  asArray(intent?.avoid).forEach(entry => {
    if (entry.evidenceBucketId === POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT ||
        entry.reasonCode === 'observed_absence') {
      issues.push({
        riskId: POLICY_INTENT_AUDIT_RISK_IDS.OBSERVED_ABSENCE_PROMOTED_TO_EXCLUSION,
        message: 'Observed absence or insufficient evidence must become review warnings, not exclusions.',
      });
    }
  });

  if (intent?.bridgeCompatibility?.legacyTemplatesAllowedAs !== 'draft_seed_only') {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.LEGACY_TEMPLATE_AS_AUTHORITY,
      message: 'Legacy templates must remain draft seeds only.',
    });
  }

  if (asArray(intent?.learningSideEffects).length > 0) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.DIRECT_LEARNING_FROM_INTENT,
      message: 'The intent engine cannot create durable learning side effects.',
    });
  }

  if (intent?.source === 'policy_bounded_evidence_boundary') {
    if (!intent.evidenceBoundary || typeof intent.evidenceBoundary !== 'object') {
      issues.push({
        riskId: POLICY_INTENT_AUDIT_RISK_IDS.MISSING_EVIDENCE_BOUNDARY,
        message: 'Bounded intent drafts must retain the evidence boundary snapshot.',
      });
    }

    if (!normalizeString(intent?.evidenceBoundary?.projectionFingerprint?.fingerprint)) {
      issues.push({
        riskId: POLICY_INTENT_AUDIT_RISK_IDS.MISSING_EVIDENCE_FINGERPRINT,
        message: 'Bounded intent drafts must retain the evidence projection fingerprint.',
      });
    }

    issues.push(...buildEvidenceQualityIssues(intent?.evidenceBoundary?.quality));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    entryCount: countEntries(intent),
    issues,
  };
}

function buildPolicyIntentEngineAudit(intent = buildPolicyIntentDraft()) {
  const validation = validatePolicyIntentDraft(intent);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedFieldCount: POLICY_INTENT_FIELD_CONTRACTS.length,
    checkedEntryCount: validation.entryCount,
    validation,
    nextStep: {
      stepId: 'learning_eligibility',
      label: 'Learning Guard',
      reason: 'Intent proposals now separate inferred evidence from declared constraints, so the next boundary is deciding which outcomes can become durable learning.',
    },
  };
}

export {
  BROAD_GENRE_LABELS,
  POLICY_INTENT_BOUNDARY_STATUS_IDS,
  POLICY_INTENT_ASSUMPTION_IDS,
  POLICY_INTENT_AUDIT_RISK_IDS,
  POLICY_INTENT_CONFIDENCE_LEVEL_IDS,
  POLICY_INTENT_FIELD_IDS,
  POLICY_INTENT_WARNING_IDS,
  buildPolicyIntentDraft,
  buildPolicyIntentDraftFromBoundedEvidence,
  buildPolicyIntentEngineAudit,
  getPolicyIntentField,
  listPolicyIntentFields,
  validatePolicyIntentDraft,
};
