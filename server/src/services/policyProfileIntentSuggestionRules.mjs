import {
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';
import {
  POLICY_EVIDENCE_BUCKET_IDS,
  POLICY_EVIDENCE_SOURCE_IDS,
} from './policyEvidenceEngine.mjs';
import {
  normalizePolicyIntentEntry,
} from './policyIntentEntryNormalizer.mjs';
import {
  buildPolicyStrictConstraintDescriptor,
} from './policyStrictConstraintDescriptor.mjs';

const POLICY_PROFILE_INTENT_SUGGESTION_PLAN_VERSION =
  'policy.profile_intent_suggestion_plan.v1';
const POLICY_PROFILE_INTENT_SUGGESTION_DESCRIPTOR_VERSION =
  'policy.profile_intent_suggestion.v1';

const POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS = Object.freeze({
  BELONGS_HERE: 'belongs_here',
  HELPFUL_MATCHES: 'helpful_matches',
  HARD_LIMITS: 'hard_limits',
  AVOID: 'avoid',
  ASK_WHEN: 'ask_when',
  ROUTING_TARGET: 'routing_target',
});

const POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS = Object.freeze({
  OBSERVED_IDENTITY: 'observed_identity',
  OPERATOR_DECLARED_IDENTITY: 'operator_declared_identity',
  METADATA_IDENTITY_DEMOTED: 'metadata_identity_demoted',
  BROAD_GENRE_IDENTITY_DEMOTED: 'broad_genre_identity_demoted',
  EVIDENCE_SUPPORTED_HELPFUL_MATCH: 'evidence_supported_helpful_match',
  OPERATOR_DECLARED_HELPFUL_MATCH: 'operator_declared_helpful_match',
  OPERATOR_DECLARED_HARD_LIMIT: 'operator_declared_hard_limit',
  OPERATOR_DECLARED_AVOID: 'operator_declared_avoid',
  OUTLIER_REQUIRES_REVIEW: 'outlier_requires_review',
  STALE_PROFILE_REQUIRES_REVIEW: 'stale_profile_requires_review',
  INSUFFICIENT_EVIDENCE_REQUIRES_REVIEW: 'insufficient_evidence_requires_review',
  OPERATOR_DECLARED_ROUTING_TARGET: 'operator_declared_routing_target',
  OBSERVED_ROUTING_OUTCOME: 'observed_routing_outcome',
});

const POLICY_PROFILE_INTENT_SUGGESTION_WARNING_IDS = Object.freeze({
  BROAD_GENRE_IDENTITY_NEEDS_SUPPORT: 'broad_genre_identity_needs_support',
  OBSERVED_ABSENCE_NOT_EXCLUSION: 'observed_absence_not_exclusion',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
  STALE_PROFILE: 'stale_profile',
  METADATA_NOT_IDENTITY_AUTHORITY: 'metadata_not_identity_authority',
  LEGACY_TEMPLATE_BRIDGE_ONLY: 'legacy_template_bridge_only',
});

const POLICY_PROFILE_INTENT_SUGGESTION_ASSUMPTION_IDS = Object.freeze({
  OBSERVED_IDENTITY_ACCEPTANCE_REQUIRED: 'observed_identity_acceptance_required',
  DECLARED_CONSTRAINTS_ARE_OPERATOR_AUTHORITY: 'declared_constraints_are_operator_authority',
  FINAL_OUTCOMES_REQUIRE_LEARNING_GUARD: 'final_outcomes_require_learning_guard',
  METADATA_SUPPORTS_COMPATIBILITY_ONLY: 'metadata_supports_compatibility_only',
  LEGACY_TEMPLATE_IS_DRAFT_SEED_ONLY: 'legacy_template_is_draft_seed_only',
});

const POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS = Object.freeze({
  INVALID_EVIDENCE_PROJECTION: 'invalid_evidence_projection',
  INVALID_SUGGESTION_DESCRIPTOR: 'invalid_suggestion_descriptor',
  UNKNOWN_SUGGESTION_RULE: 'unknown_suggestion_rule',
  SUGGESTION_RULE_FIELD_MISMATCH: 'suggestion_rule_field_mismatch',
  SUGGESTION_RULE_REASON_MISMATCH: 'suggestion_rule_reason_mismatch',
  SUGGESTION_EXPLANATION_MISMATCH: 'suggestion_explanation_mismatch',
  SUGGESTION_PLAN_MISMATCH: 'suggestion_plan_mismatch',
});

const POLICY_PROFILE_INTENT_BROAD_GENRE_LABELS = Object.freeze([
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

const BROAD_GENRE_LABELS = new Set(POLICY_PROFILE_INTENT_BROAD_GENRE_LABELS);

const RULES = Object.freeze({
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OBSERVED_IDENTITY]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.BELONGS_HERE,
    reasonCode: 'observed_destination_identity',
    explanation: 'Observed library evidence suggests this destination identity and remains inferred until accepted.',
    inferred: true,
    operatorDeclared: false,
  },
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_IDENTITY]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.BELONGS_HERE,
    reasonCode: 'operator_declared_destination_identity',
    explanation: 'An operator declared this value as destination identity.',
    inferred: false,
    operatorDeclared: true,
  },
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.METADATA_IDENTITY_DEMOTED]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.HELPFUL_MATCHES,
    reasonCode: 'metadata_identity_demoted_to_compatibility',
    explanation: 'Metadata can support a match but cannot define destination identity.',
    inferred: true,
    operatorDeclared: false,
    effectiveEvidenceBucketId: POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
  },
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.BROAD_GENRE_IDENTITY_DEMOTED]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.HELPFUL_MATCHES,
    reasonCode: 'broad_genre_identity_demoted_to_compatibility',
    explanation: 'A broad genre lacks specific identity support, so it is helpful evidence only.',
    inferred: true,
    operatorDeclared: false,
    effectiveEvidenceBucketId: POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY,
  },
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.EVIDENCE_SUPPORTED_HELPFUL_MATCH]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.HELPFUL_MATCHES,
    reasonCode: 'evidence_supported_helpful_match',
    explanation: 'Observed evidence can support this match after destination identity is plausible.',
    inferred: true,
    operatorDeclared: false,
  },
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_HELPFUL_MATCH]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.HELPFUL_MATCHES,
    reasonCode: 'operator_declared_helpful_match',
    explanation: 'An operator declared this value as supporting destination evidence.',
    inferred: false,
    operatorDeclared: true,
  },
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_HARD_LIMIT]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.HARD_LIMITS,
    reasonCode: 'operator_declared_hard_limit',
    explanation: 'An operator declared this durable hard limit.',
    inferred: false,
    operatorDeclared: true,
  },
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_AVOID]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.AVOID,
    reasonCode: 'operator_declared_avoid',
    explanation: 'An operator declared this value as evidence to avoid.',
    inferred: false,
    operatorDeclared: true,
  },
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OUTLIER_REQUIRES_REVIEW]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.ASK_WHEN,
    reasonCode: 'outlier_needs_review',
    explanation: 'Conflicting or outlier evidence requires review before automation.',
    inferred: true,
    operatorDeclared: false,
  },
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.STALE_PROFILE_REQUIRES_REVIEW]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.ASK_WHEN,
    reasonCode: 'stale_profile_needs_review',
    explanation: 'The observed library profile is stale and should be refreshed before automation.',
    inferred: true,
    operatorDeclared: false,
  },
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.INSUFFICIENT_EVIDENCE_REQUIRES_REVIEW]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.ASK_WHEN,
    reasonCode: 'insufficient_evidence_needs_review',
    explanation: 'Evidence is insufficient to automate this destination safely.',
    inferred: true,
    operatorDeclared: false,
  },
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_ROUTING_TARGET]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.ROUTING_TARGET,
    reasonCode: 'operator_declared_routing_target',
    explanation: 'An operator declared this routing target.',
    inferred: false,
    operatorDeclared: true,
  },
  [POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OBSERVED_ROUTING_OUTCOME]: {
    fieldId: POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.ROUTING_TARGET,
    reasonCode: 'routing_outcome_observed',
    explanation: 'A recorded routing outcome supports this target as an observed suggestion.',
    inferred: true,
    operatorDeclared: false,
  },
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKey(value) {
  return normalizeString(value).toLowerCase();
}

function getEvidenceEntries(projection, bucketId) {
  return asArray(projection?.buckets?.[bucketId]);
}

function requirePolicyEvidenceProjection(projection = {}) {
  if (projection?.version !== 'policy.evidence.v1') {
    throw new TypeError(
      'Intent inference requires a policy.evidence.v1 projection; pass raw evidence through buildPolicyIntentDraftFromEvidenceInput.'
    );
  }

  return projection;
}

function isPlainDataRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function isMetadataEvidence(entry = {}) {
  return entry.sourceId === POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT ||
    entry.authoritySourceId === AUTHORITY_SOURCE_IDS.METADATA_PROVIDER;
}

function isOperatorDeclared(entry = {}) {
  return entry.sourceId === POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT &&
    entry.authoritySourceId === AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT;
}

function isPolicyBroadGenreEvidence(entry = {}) {
  const key = normalizeKey(entry.key);
  const label = normalizeKey(entry.label);

  return key.startsWith('genre:') || key.startsWith('genres:') || BROAD_GENRE_LABELS.has(label);
}

function hasSpecificIdentitySupport(identityEntries) {
  return identityEntries.some(entry => (
    isOperatorDeclared(entry) ||
    (!isPolicyBroadGenreEvidence(entry) && !isMetadataEvidence(entry))
  ));
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
  return Math.max(0, Math.min(1, numeric));
}

function getPolicyProfileIntentSuggestionRule(ruleId) {
  return RULES[ruleId] || null;
}

function buildPolicyProfileIntentSuggestionDescriptor(ruleId) {
  const rule = getPolicyProfileIntentSuggestionRule(ruleId);
  if (!rule) return null;

  return {
    version: POLICY_PROFILE_INTENT_SUGGESTION_DESCRIPTOR_VERSION,
    ruleId,
    explanation: rule.explanation,
  };
}

function buildSuggestedIntentEntry(entry = {}, ruleId) {
  const rule = getPolicyProfileIntentSuggestionRule(ruleId);
  if (!rule) return null;

  const normalizedEntry = normalizePolicyIntentEntry({
    key: entry.key,
    label: entry.label,
    value: entry.value,
    reasonCode: rule.reasonCode,
  });
  if (!normalizedEntry) return null;

  const strictConstraintResult = entry.strictConstraint === undefined
    ? null
    : buildPolicyStrictConstraintDescriptor(entry.strictConstraint);
  if (strictConstraintResult && !strictConstraintResult.ok) return null;

  const suggestion = buildPolicyProfileIntentSuggestionDescriptor(ruleId);
  const result = {
    fieldId: rule.fieldId,
    ...normalizedEntry,
    evidenceBucketId: rule.effectiveEvidenceBucketId || entry.bucketId,
    evidenceSourceId: entry.sourceId,
    authoritySourceId: entry.authoritySourceId,
    reasonCode: rule.reasonCode,
    evidenceCount: Number.isFinite(Number(entry.count)) ? Number(entry.count) : null,
    evidenceConfidence: normalizeConfidence(entry.confidence),
    inferred: rule.inferred,
    operatorDeclared: rule.operatorDeclared,
    suggestion,
  };

  if (strictConstraintResult?.descriptor) {
    result.strictConstraint = strictConstraintResult.descriptor;
  }

  return result;
}

function uniqueAndSortEntries(entries) {
  const uniqueEntries = new Map();

  entries.filter(Boolean).forEach(entry => {
    const key = [
      entry.fieldId,
      entry.key,
      entry.authoritySourceId,
      JSON.stringify(entry.strictConstraint || null),
    ].join(':');
    if (!uniqueEntries.has(key)) uniqueEntries.set(key, entry);
  });

  return [...uniqueEntries.values()].sort((left, right) => {
    const leftKey = `${left.fieldId}:${left.key}:${left.authoritySourceId}`;
    const rightKey = `${right.fieldId}:${right.key}:${right.authoritySourceId}`;
    return leftKey.localeCompare(rightKey);
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

function uniqueAndSortWarnings(warnings) {
  const uniqueWarnings = new Map();

  warnings.filter(Boolean).forEach(warning => {
    const key = [
      warning.reasonCode,
      warning.severity,
      warning.summary,
      warning.evidenceBucketId,
      warning.evidenceSourceId,
    ].join(':');
    if (!uniqueWarnings.has(key)) uniqueWarnings.set(key, warning);
  });

  return [...uniqueWarnings.values()].sort((left, right) => {
    const leftKey = `${left.reasonCode}:${left.evidenceBucketId || ''}:${left.evidenceSourceId || ''}`;
    const rightKey = `${right.reasonCode}:${right.evidenceBucketId || ''}:${right.evidenceSourceId || ''}`;
    return leftKey.localeCompare(rightKey);
  });
}

function buildAssumptions() {
  return [
    {
      reasonCode: POLICY_PROFILE_INTENT_SUGGESTION_ASSUMPTION_IDS.OBSERVED_IDENTITY_ACCEPTANCE_REQUIRED,
      summary: 'Observed identity evidence remains a suggestion until operator intent or later automation gates accept it.',
    },
    {
      reasonCode: POLICY_PROFILE_INTENT_SUGGESTION_ASSUMPTION_IDS.DECLARED_CONSTRAINTS_ARE_OPERATOR_AUTHORITY,
      summary: 'Hard limits and avoid values are accepted only from operator-declared intent.',
    },
    {
      reasonCode: POLICY_PROFILE_INTENT_SUGGESTION_ASSUMPTION_IDS.FINAL_OUTCOMES_REQUIRE_LEARNING_GUARD,
      summary: 'Manual outcomes can inform evidence, but durable learning waits for the learning eligibility guard.',
    },
    {
      reasonCode: POLICY_PROFILE_INTENT_SUGGESTION_ASSUMPTION_IDS.METADATA_SUPPORTS_COMPATIBILITY_ONLY,
      summary: 'Metadata evidence supports compatibility and freshness, not policy identity by itself.',
    },
    {
      reasonCode: POLICY_PROFILE_INTENT_SUGGESTION_ASSUMPTION_IDS.LEGACY_TEMPLATE_IS_DRAFT_SEED_ONLY,
      summary: 'Starter templates remain draft seeds and bridge inputs, not the durable intent authority.',
    },
  ];
}

function validatePolicyProfileIntentSuggestionDescriptor(descriptor, {
  fieldId = null,
  reasonCode = null,
} = {}) {
  const issues = [];
  if (!isPlainDataRecord(descriptor)) {
    return {
      ok: false,
      issueCount: 1,
      issues: [{
        riskId: POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS.INVALID_SUGGESTION_DESCRIPTOR,
        message: 'Intent suggestion descriptors must be plain data records.',
      }],
    };
  }

  const allowedKeys = new Set(['version', 'ruleId', 'explanation']);
  Object.keys(descriptor).forEach(key => {
    if (!allowedKeys.has(key)) {
      issues.push({
        riskId: POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS.INVALID_SUGGESTION_DESCRIPTOR,
        message: 'Intent suggestion descriptors may only contain the versioned rule fields.',
        field: key,
      });
    }
  });

  const rule = getPolicyProfileIntentSuggestionRule(descriptor.ruleId);
  if (descriptor.version !== POLICY_PROFILE_INTENT_SUGGESTION_DESCRIPTOR_VERSION) {
    issues.push({
      riskId: POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS.INVALID_SUGGESTION_DESCRIPTOR,
      message: 'Intent suggestion descriptor version is not supported.',
    });
  }
  if (!rule) {
    issues.push({
      riskId: POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS.UNKNOWN_SUGGESTION_RULE,
      message: 'Intent suggestion descriptor references an unknown rule.',
    });
  } else {
    if (fieldId && rule.fieldId !== fieldId) {
      issues.push({
        riskId: POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS.SUGGESTION_RULE_FIELD_MISMATCH,
        message: 'Intent suggestion rule does not support this destination field.',
      });
    }
    if (reasonCode && rule.reasonCode !== reasonCode) {
      issues.push({
        riskId: POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS.SUGGESTION_RULE_REASON_MISMATCH,
        message: 'Intent suggestion rule does not match the entry reason code.',
      });
    }
    if (descriptor.explanation !== rule.explanation) {
      issues.push({
        riskId: POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS.SUGGESTION_EXPLANATION_MISMATCH,
        message: 'Intent suggestion descriptor explanation must be the server-owned rule explanation.',
      });
    }
  }

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

function buildPolicyProfileIntentSuggestionPlan(projection = {}) {
  const evidenceProjection = requirePolicyEvidenceProjection(projection);
  const identityEntries = getEvidenceEntries(
    evidenceProjection,
    POLICY_EVIDENCE_BUCKET_IDS.IDENTITY
  );
  const hasSpecificSupport = hasSpecificIdentitySupport(identityEntries);
  const entries = {
    [POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.BELONGS_HERE]: [],
    [POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.HELPFUL_MATCHES]: [],
    [POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.HARD_LIMITS]: [],
    [POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.AVOID]: [],
    [POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.ASK_WHEN]: [],
    [POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS.ROUTING_TARGET]: [],
  };
  const warnings = [];

  identityEntries.forEach(entry => {
    if (isMetadataEvidence(entry)) {
      warnings.push(buildWarning(
        POLICY_PROFILE_INTENT_SUGGESTION_WARNING_IDS.METADATA_NOT_IDENTITY_AUTHORITY,
        'Metadata evidence can support compatibility, but cannot define destination identity.',
        { evidenceBucketId: entry.bucketId, evidenceSourceId: entry.sourceId }
      ));
      entries.helpful_matches.push(buildSuggestedIntentEntry(
        entry,
        POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.METADATA_IDENTITY_DEMOTED
      ));
      return;
    }

    if (isPolicyBroadGenreEvidence(entry) && !isOperatorDeclared(entry) && !hasSpecificSupport) {
      warnings.push(buildWarning(
        POLICY_PROFILE_INTENT_SUGGESTION_WARNING_IDS.BROAD_GENRE_IDENTITY_NEEDS_SUPPORT,
        'Broad genre evidence was kept as helpful evidence until specific support or operator intent confirms destination identity.',
        { evidenceBucketId: entry.bucketId, evidenceSourceId: entry.sourceId }
      ));
      entries.helpful_matches.push(buildSuggestedIntentEntry(
        entry,
        POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.BROAD_GENRE_IDENTITY_DEMOTED
      ));
      return;
    }

    entries.belongs_here.push(buildSuggestedIntentEntry(
      entry,
      isOperatorDeclared(entry)
        ? POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_IDENTITY
        : POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OBSERVED_IDENTITY
    ));
  });

  getEvidenceEntries(evidenceProjection, POLICY_EVIDENCE_BUCKET_IDS.COMPATIBILITY)
    .forEach(entry => entries.helpful_matches.push(buildSuggestedIntentEntry(
      entry,
      isOperatorDeclared(entry)
        ? POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_HELPFUL_MATCH
        : POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.EVIDENCE_SUPPORTED_HELPFUL_MATCH
    )));

  getEvidenceEntries(evidenceProjection, POLICY_EVIDENCE_BUCKET_IDS.HARD_LIMIT)
    .filter(isOperatorDeclared)
    .forEach(entry => entries.hard_limits.push(buildSuggestedIntentEntry(
      entry,
      POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_HARD_LIMIT
    )));

  getEvidenceEntries(evidenceProjection, POLICY_EVIDENCE_BUCKET_IDS.AVOID)
    .filter(isOperatorDeclared)
    .forEach(entry => entries.avoid.push(buildSuggestedIntentEntry(
      entry,
      POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_AVOID
    )));

  getEvidenceEntries(evidenceProjection, POLICY_EVIDENCE_BUCKET_IDS.OUTLIER)
    .forEach(entry => entries.ask_when.push(buildSuggestedIntentEntry(
      entry,
      POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OUTLIER_REQUIRES_REVIEW
    )));

  getEvidenceEntries(evidenceProjection, POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT)
    .forEach(entry => entries.ask_when.push(buildSuggestedIntentEntry(
      entry,
      entry.reasonCode === 'stale_profile'
        ? POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.STALE_PROFILE_REQUIRES_REVIEW
        : POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.INSUFFICIENT_EVIDENCE_REQUIRES_REVIEW
    )));

  getEvidenceEntries(evidenceProjection, POLICY_EVIDENCE_BUCKET_IDS.ROUTING)
    .forEach(entry => entries.routing_target.push(buildSuggestedIntentEntry(
      entry,
      isOperatorDeclared(entry)
        ? POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OPERATOR_DECLARED_ROUTING_TARGET
        : POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.OBSERVED_ROUTING_OUTCOME
    )));

  Object.keys(entries).forEach(fieldId => {
    entries[fieldId] = uniqueAndSortEntries(entries[fieldId]);
  });

  if (entries.ask_when.length > 0) {
    warnings.push(buildWarning(
      POLICY_PROFILE_INTENT_SUGGESTION_WARNING_IDS.OBSERVED_ABSENCE_NOT_EXCLUSION,
      'Missing, stale, or conflicting evidence created review triggers, not exclusions.',
      { evidenceBucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT }
    ));
  }

  if (getEvidenceEntries(evidenceProjection, POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT).length > 0 ||
      evidenceProjection.warnings?.length > 0) {
    warnings.push(buildWarning(
      POLICY_PROFILE_INTENT_SUGGESTION_WARNING_IDS.INSUFFICIENT_EVIDENCE,
      'Some evidence is insufficient for confident automation.',
      { evidenceBucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT }
    ));
  }

  if (evidenceProjection.quality?.statusId === 'insufficient') {
    warnings.push(buildWarning(
      POLICY_PROFILE_INTENT_SUGGESTION_WARNING_IDS.INSUFFICIENT_EVIDENCE,
      'Evidence quality is insufficient; intent inference must wait for more evidence or operator confirmation.',
      { evidenceBucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT }
    ));
  }

  if (entries.ask_when.some(entry => (
    entry.suggestion?.ruleId === POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS.STALE_PROFILE_REQUIRES_REVIEW
  ))) {
    warnings.push(buildWarning(
      POLICY_PROFILE_INTENT_SUGGESTION_WARNING_IDS.STALE_PROFILE,
      'The destination profile should be refreshed before treating this intent as current.',
      { evidenceBucketId: POLICY_EVIDENCE_BUCKET_IDS.INSUFFICIENT }
    ));
  }

  warnings.push(buildWarning(
    POLICY_PROFILE_INTENT_SUGGESTION_WARNING_IDS.LEGACY_TEMPLATE_BRIDGE_ONLY,
    'Legacy presets and custom signals remain compatibility bridges until native intent storage is ready.',
    { severity: 'info' }
  ));

  const appliedRuleIds = Object.values(entries)
    .flatMap(fieldEntries => fieldEntries.map(entry => entry.suggestion.ruleId))
    .filter((ruleId, index, allRuleIds) => allRuleIds.indexOf(ruleId) === index)
    .sort();

  return {
    version: POLICY_PROFILE_INTENT_SUGGESTION_PLAN_VERSION,
    source: 'policy_evidence_projection',
    entries,
    warnings: uniqueAndSortWarnings(warnings),
    assumptions: buildAssumptions(),
    appliedRuleIds,
  };
}

function buildPolicyProfileIntentSuggestionPlanAudit(
  projection = {},
  plan = null
) {
  let expectedPlan;
  try {
    expectedPlan = buildPolicyProfileIntentSuggestionPlan(projection);
  } catch (error) {
    return {
      ok: false,
      issueCount: 1,
      issues: [{
        riskId: POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS.INVALID_EVIDENCE_PROJECTION,
        message: error.message,
      }],
    };
  }

  const actualPlan = plan || expectedPlan;
  const matchesExpectedPlan = JSON.stringify(actualPlan) === JSON.stringify(expectedPlan);
  return {
    ok: matchesExpectedPlan,
    issueCount: matchesExpectedPlan ? 0 : 1,
    issues: matchesExpectedPlan
      ? []
      : [{
        riskId: POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS.SUGGESTION_PLAN_MISMATCH,
        message: 'Profile-to-intent suggestions must match the deterministic server-owned rule plan.',
      }],
    appliedRuleIds: expectedPlan.appliedRuleIds,
  };
}

export {
  POLICY_PROFILE_INTENT_BROAD_GENRE_LABELS,
  POLICY_PROFILE_INTENT_SUGGESTION_ASSUMPTION_IDS,
  POLICY_PROFILE_INTENT_SUGGESTION_AUDIT_RISK_IDS,
  POLICY_PROFILE_INTENT_SUGGESTION_DESCRIPTOR_VERSION,
  POLICY_PROFILE_INTENT_SUGGESTION_FIELD_IDS,
  POLICY_PROFILE_INTENT_SUGGESTION_PLAN_VERSION,
  POLICY_PROFILE_INTENT_SUGGESTION_RULE_IDS,
  POLICY_PROFILE_INTENT_SUGGESTION_WARNING_IDS,
  buildPolicyProfileIntentSuggestionDescriptor,
  buildPolicyProfileIntentSuggestionPlan,
  buildPolicyProfileIntentSuggestionPlanAudit,
  getPolicyProfileIntentSuggestionRule,
  isPolicyBroadGenreEvidence,
  validatePolicyProfileIntentSuggestionDescriptor,
};
