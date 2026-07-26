import {
  AUTHORITY_SOURCE_IDS,
  getPolicyAuthoritySource,
  isDurablePolicyAuthority,
} from './policyAuthorityVocabulary.mjs';
import {
  POLICY_EVIDENCE_BUCKET_IDS,
  getPolicyEvidenceBucket,
  getPolicyEvidenceSource,
} from './policyEvidenceEngine.mjs';
import {
  buildBoundedPolicyEvidenceProjection,
} from './policyEvidenceBoundary.mjs';
import {
  validatePolicyEvidenceFingerprint,
} from './policyEvidenceFingerprint.mjs';
import {
  POLICY_EVIDENCE_QUALITY_STATUS_IDS,
} from './policyEvidenceQuality.mjs';
import {
  buildPolicyIntentEntryAudit,
} from './policyIntentEntryNormalizer.mjs';
import {
  buildPolicyStrictConstraintDescriptor,
} from './policyStrictConstraintDescriptor.mjs';
import {
  evaluatePolicyBroadGenreIdentityEligibility,
} from './policyBroadGenreIdentityEligibility.mjs';
import {
  POLICY_PROFILE_INTENT_BROAD_GENRE_LABELS as BROAD_GENRE_LABELS,
  POLICY_PROFILE_INTENT_SUGGESTION_ASSUMPTION_IDS,
  POLICY_PROFILE_INTENT_SUGGESTION_WARNING_IDS,
  buildPolicyProfileIntentSuggestionPlan,
  isPolicyBroadGenreEvidence,
  validatePolicyProfileIntentSuggestionDescriptor,
} from './policyProfileIntentSuggestionRules.mjs';

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

const POLICY_INTENT_WARNING_IDS = POLICY_PROFILE_INTENT_SUGGESTION_WARNING_IDS;
const POLICY_INTENT_ASSUMPTION_IDS = POLICY_PROFILE_INTENT_SUGGESTION_ASSUMPTION_IDS;

const POLICY_INTENT_AUDIT_RISK_IDS = Object.freeze({
  MISSING_FIELD: 'missing_field',
  INVALID_CONFIDENCE_LEVEL: 'invalid_confidence_level',
  MISSING_CONFIDENCE_REASON: 'missing_confidence_reason',
  MISSING_ENTRY_LABEL: 'missing_entry_label',
  MISSING_ENTRY_EVIDENCE_BUCKET: 'missing_entry_evidence_bucket',
  UNKNOWN_ENTRY_EVIDENCE_BUCKET: 'unknown_entry_evidence_bucket',
  MISSING_ENTRY_EVIDENCE_SOURCE: 'missing_entry_evidence_source',
  UNKNOWN_ENTRY_EVIDENCE_SOURCE: 'unknown_entry_evidence_source',
  ENTRY_SOURCE_NOT_ALLOWED_FOR_BUCKET: 'entry_source_not_allowed_for_bucket',
  MISSING_ENTRY_AUTHORITY_SOURCE: 'missing_entry_authority_source',
  UNKNOWN_ENTRY_AUTHORITY_SOURCE: 'unknown_entry_authority_source',
  ENTRY_SOURCE_AUTHORITY_NOT_ALLOWED: 'entry_source_authority_not_allowed',
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
  INTENT_ENTRY_FIELD_CONTRACT: 'intent_entry_field_contract',
  INVALID_STRICT_CONSTRAINT_DESCRIPTOR: 'invalid_strict_constraint_descriptor',
  INVALID_SUGGESTION_DESCRIPTOR: 'invalid_suggestion_descriptor',
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

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function createEmptyPolicyEvidenceProjection() {
  return {
    version: 'policy.evidence.v1',
    buckets: {},
    warnings: [],
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

function buildPolicyIntentDraftFromEvidenceProjection(projection = {}) {
  const intent = createEmptyIntentDraft();
  const suggestionPlan = buildPolicyProfileIntentSuggestionPlan(projection);

  intent.belongs_here = suggestionPlan.entries[POLICY_INTENT_FIELD_IDS.BELONGS_HERE];
  intent.helpful_matches = suggestionPlan.entries[POLICY_INTENT_FIELD_IDS.HELPFUL_MATCHES];
  intent.hard_limits = suggestionPlan.entries[POLICY_INTENT_FIELD_IDS.HARD_LIMITS];
  intent.avoid = suggestionPlan.entries[POLICY_INTENT_FIELD_IDS.AVOID];
  intent.ask_when = suggestionPlan.entries[POLICY_INTENT_FIELD_IDS.ASK_WHEN];
  intent.routing_target = suggestionPlan.entries[POLICY_INTENT_FIELD_IDS.ROUTING_TARGET];
  intent.assumptions = suggestionPlan.assumptions;
  intent.warnings = suggestionPlan.warnings;
  intent.confidence = calculateConfidence(intent);

  return intent;
}

function buildPolicyIntentDraftFromEvidenceInput({
  evidenceInput = {},
  evidenceBoundaryBuilder = buildBoundedPolicyEvidenceProjection,
} = {}) {
  const boundaryBuilder = typeof evidenceBoundaryBuilder === 'function'
    ? evidenceBoundaryBuilder
    : buildBoundedPolicyEvidenceProjection;
  const boundedEvidenceResult = boundaryBuilder({ evidenceInput });

  return buildPolicyIntentDraftFromBoundedEvidence({
    boundedEvidenceResult,
  });
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

  const intent = buildPolicyIntentDraftFromEvidenceProjection(
    boundedEvidenceResult.projection
  );
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
  const entryFieldAudit = buildPolicyIntentEntryAudit(entry);
  const evidenceBucket = getPolicyEvidenceBucket(entry.evidenceBucketId);
  const evidenceSource = getPolicyEvidenceSource(entry.evidenceSourceId);

  if (!entryFieldAudit.ok) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.INTENT_ENTRY_FIELD_CONTRACT,
      fieldId,
      entryRiskIds: entryFieldAudit.issues.map(issue => issue.riskId),
    });
  }

  if (Object.prototype.hasOwnProperty.call(entry, 'suggestion')) {
    const suggestionAudit = validatePolicyProfileIntentSuggestionDescriptor(entry.suggestion, {
      fieldId,
      reasonCode: entry.reasonCode,
    });
    if (!suggestionAudit.ok) {
      issues.push({
        riskId: POLICY_INTENT_AUDIT_RISK_IDS.INVALID_SUGGESTION_DESCRIPTOR,
        fieldId,
        suggestionRiskIds: suggestionAudit.issues.map(issue => issue.riskId),
      });
    }
  }

  if (fieldId === POLICY_INTENT_FIELD_IDS.HARD_LIMITS &&
      Object.prototype.hasOwnProperty.call(entry, 'strictConstraint') &&
      !buildPolicyStrictConstraintDescriptor(entry.strictConstraint).ok) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.INVALID_STRICT_CONSTRAINT_DESCRIPTOR,
      message: 'Hard-limit intent entries with a strict-constraint descriptor must retain an executable native rule.',
    });
  }

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
  } else if (!evidenceBucket) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.UNKNOWN_ENTRY_EVIDENCE_BUCKET,
      message: `${fieldId} entry references an unknown evidence bucket.`,
    });
  }

  if (!normalizeString(entry.evidenceSourceId)) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.MISSING_ENTRY_EVIDENCE_SOURCE,
      message: `${fieldId} entry must reference its evidence source.`,
    });
  } else if (!evidenceSource) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.UNKNOWN_ENTRY_EVIDENCE_SOURCE,
      message: `${fieldId} entry references an unknown evidence source.`,
    });
  } else if (evidenceBucket && !evidenceBucket.allowedSourceIds.includes(entry.evidenceSourceId)) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.ENTRY_SOURCE_NOT_ALLOWED_FOR_BUCKET,
      message: `${fieldId} entry source is not allowed for its evidence bucket.`,
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
  } else if (evidenceSource && !evidenceSource.authoritySourceIds.includes(entry.authoritySourceId)) {
    issues.push({
      riskId: POLICY_INTENT_AUDIT_RISK_IDS.ENTRY_SOURCE_AUTHORITY_NOT_ALLOWED,
      message: `${fieldId} entry authority is not allowed by its evidence source.`,
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

  const broadGenreEligibility = evaluatePolicyBroadGenreIdentityEligibility(
    asArray(intent?.belongs_here).map(entry => ({
      key: entry?.key,
      label: entry?.label,
      sourceId: entry?.evidenceSourceId,
      authoritySourceId: entry?.authoritySourceId,
      count: entry?.evidenceCount,
      confidence: entry?.evidenceConfidence,
      stale: entry?.evidenceStale === true,
      operatorDeclared: entry?.operatorDeclared === true,
    }))
  );

  asArray(intent?.belongs_here).forEach(entry => {
    if (entry.authoritySourceId === AUTHORITY_SOURCE_IDS.METADATA_PROVIDER) {
      issues.push({
        riskId: POLICY_INTENT_AUDIT_RISK_IDS.METADATA_PROMOTED_TO_IDENTITY,
        message: 'Metadata evidence cannot be promoted to destination identity.',
      });
    }
    if (isPolicyBroadGenreEvidence(entry) &&
        entry.operatorDeclared !== true &&
        !broadGenreEligibility.eligible) {
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

function buildPolicyIntentEngineAudit(
  intent = buildPolicyIntentDraftFromEvidenceProjection(createEmptyPolicyEvidenceProjection())
) {
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
  buildPolicyIntentDraftFromEvidenceInput,
  buildPolicyIntentDraftFromEvidenceProjection,
  buildPolicyIntentDraftFromBoundedEvidence,
  buildPolicyIntentEngineAudit,
  getPolicyIntentField,
  listPolicyIntentFields,
  validatePolicyIntentDraft,
};
