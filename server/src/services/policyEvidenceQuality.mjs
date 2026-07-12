const POLICY_EVIDENCE_QUALITY_VERSION = 'policy.evidence.quality.v1';

const POLICY_EVIDENCE_QUALITY_STATUS_IDS = Object.freeze({
  USABLE: 'usable',
  USABLE_WITH_CONSTRAINTS: 'usable_with_constraints',
  NEEDS_REVIEW: 'needs_review',
  INSUFFICIENT: 'insufficient',
});

const POLICY_EVIDENCE_QUALITY_REASON_IDS = Object.freeze({
  NO_EVIDENCE: 'no_evidence',
  MISSING_IDENTITY: 'missing_identity',
  OBSERVED_IDENTITY_PRESENT: 'observed_identity_present',
  DECLARED_IDENTITY_PRESENT: 'declared_identity_present',
  COMPATIBILITY_PRESENT: 'compatibility_present',
  HARD_LIMIT_PRESENT: 'hard_limit_present',
  ROUTING_PRESENT: 'routing_present',
  REVIEW_EVIDENCE_PRESENT: 'review_evidence_present',
  STALE_PROFILE: 'stale_profile',
  FRESHNESS_PRESENT: 'freshness_present',
});

const POLICY_EVIDENCE_QUALITY_NEXT_ACTION_IDS = Object.freeze({
  COLLECT_EVIDENCE: 'collect_evidence',
  CONFIRM_DESTINATION_IDENTITY: 'confirm_destination_identity',
  REFRESH_PROFILE: 'refresh_profile',
  REVIEW_EVIDENCE: 'review_evidence',
  VERIFY_CONSTRAINTS: 'verify_constraints',
  PROCEED_TO_INTENT: 'proceed_to_intent',
});

const POLICY_EVIDENCE_QUALITY_AUDIT_RISK_IDS = Object.freeze({
  MISSING_QUALITY: 'missing_quality',
  QUALITY_MISMATCH: 'quality_mismatch',
  QUALITY_EXPOSES_ENTRY_LABELS: 'quality_exposes_entry_labels',
});

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clampScore(value) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function getTrustedBucketEntries(buckets, bucketId, isTrustedEntry) {
  const entries = Array.isArray(buckets[bucketId]) ? buckets[bucketId] : [];

  return entries.filter(entry => isTrustedEntry(entry, bucketId));
}

function hasAuthorityEntry(entries, authoritySourceId) {
  return Array.isArray(entries) &&
    entries.some(entry => entry?.authoritySourceId === authoritySourceId);
}

function hasReasonEntry(entries, reasonCode) {
  return Array.isArray(entries) &&
    entries.some(entry => entry?.reasonCode === reasonCode);
}

function calculateScore({
  hasIdentityEvidence,
  hasDeclaredIdentityEvidence,
  hasObservedIdentityEvidence,
  compatibilityCount,
  hasRoutingEvidence,
  hasFreshnessEvidence,
  hasReviewEvidence,
  hasInsufficientEvidence,
}) {
  let score = 0;
  if (hasIdentityEvidence) score += 0.45;
  if (hasDeclaredIdentityEvidence) score += 0.20;
  if (hasObservedIdentityEvidence) score += 0.15;
  if (compatibilityCount > 0) score += 0.10;
  if (hasRoutingEvidence) score += 0.05;
  if (hasFreshnessEvidence) score += 0.05;
  if (hasReviewEvidence) score -= 0.15;
  if (hasInsufficientEvidence) score -= 0.20;
  if (!hasIdentityEvidence) score = Math.min(score, 0.35);
  return clampScore(score);
}

function buildPolicyEvidenceQualityAssessment(projection = {}, {
  bucketIds = {},
  authoritySourceIds = {},
  isTrustedEntry = () => false,
} = {}) {
  const buckets = asPlainObject(projection.buckets);
  const identityEntries = getTrustedBucketEntries(buckets, bucketIds.IDENTITY, isTrustedEntry);
  const insufficientEntries = getTrustedBucketEntries(
    buckets,
    bucketIds.INSUFFICIENT,
    isTrustedEntry
  );
  const compatibilityEntries = getTrustedBucketEntries(
    buckets,
    bucketIds.COMPATIBILITY,
    isTrustedEntry
  );
  const hardLimitEntries = getTrustedBucketEntries(
    buckets,
    bucketIds.HARD_LIMIT,
    isTrustedEntry
  );
  const avoidEntries = getTrustedBucketEntries(buckets, bucketIds.AVOID, isTrustedEntry);
  const outlierEntries = getTrustedBucketEntries(buckets, bucketIds.OUTLIER, isTrustedEntry);
  const routingEntries = getTrustedBucketEntries(buckets, bucketIds.ROUTING, isTrustedEntry);
  const freshnessEntries = getTrustedBucketEntries(buckets, bucketIds.FRESHNESS, isTrustedEntry);

  const counts = {
    identity: identityEntries.length,
    compatibility: compatibilityEntries.length,
    hardLimit: hardLimitEntries.length,
    avoid: avoidEntries.length,
    outlier: outlierEntries.length,
    routing: routingEntries.length,
    freshness: freshnessEntries.length,
    insufficient: insufficientEntries.length,
  };

  const hasEvidence = Object.values(counts).some(count => count > 0);
  const hasObservedIdentityEvidence = hasAuthorityEntry(
    identityEntries,
    authoritySourceIds.MEDIA_SERVER_CONTENTS
  );
  const hasDeclaredIdentityEvidence = hasAuthorityEntry(
    identityEntries,
    authoritySourceIds.OPERATOR_DECLARED_INTENT
  );
  const hasIdentityEvidence = hasObservedIdentityEvidence || hasDeclaredIdentityEvidence;
  const hasProjectionWarnings = Array.isArray(projection.warnings) &&
    projection.warnings.length > 0;
  const hasReviewEvidence = counts.outlier > 0 ||
    counts.insufficient > 0 ||
    hasProjectionWarnings;
  const hasInsufficientEvidence = counts.insufficient > 0 || hasProjectionWarnings;
  const hasHardLimitEvidence = counts.hardLimit > 0;
  const hasRoutingEvidence = counts.routing > 0;
  const hasFreshnessEvidence = counts.freshness > 0;
  const hasStaleProfileEvidence = hasReasonEntry(insufficientEntries, 'stale_profile');

  const reasonIds = new Set();
  if (!hasEvidence) reasonIds.add(POLICY_EVIDENCE_QUALITY_REASON_IDS.NO_EVIDENCE);
  if (!hasIdentityEvidence) reasonIds.add(POLICY_EVIDENCE_QUALITY_REASON_IDS.MISSING_IDENTITY);
  if (hasObservedIdentityEvidence) {
    reasonIds.add(POLICY_EVIDENCE_QUALITY_REASON_IDS.OBSERVED_IDENTITY_PRESENT);
  }
  if (hasDeclaredIdentityEvidence) {
    reasonIds.add(POLICY_EVIDENCE_QUALITY_REASON_IDS.DECLARED_IDENTITY_PRESENT);
  }
  if (counts.compatibility > 0) {
    reasonIds.add(POLICY_EVIDENCE_QUALITY_REASON_IDS.COMPATIBILITY_PRESENT);
  }
  if (hasHardLimitEvidence) reasonIds.add(POLICY_EVIDENCE_QUALITY_REASON_IDS.HARD_LIMIT_PRESENT);
  if (hasRoutingEvidence) reasonIds.add(POLICY_EVIDENCE_QUALITY_REASON_IDS.ROUTING_PRESENT);
  if (hasReviewEvidence) reasonIds.add(POLICY_EVIDENCE_QUALITY_REASON_IDS.REVIEW_EVIDENCE_PRESENT);
  if (hasStaleProfileEvidence) reasonIds.add(POLICY_EVIDENCE_QUALITY_REASON_IDS.STALE_PROFILE);
  if (hasFreshnessEvidence) reasonIds.add(POLICY_EVIDENCE_QUALITY_REASON_IDS.FRESHNESS_PRESENT);

  let statusId = POLICY_EVIDENCE_QUALITY_STATUS_IDS.USABLE;
  let nextActionId = POLICY_EVIDENCE_QUALITY_NEXT_ACTION_IDS.PROCEED_TO_INTENT;

  if (!hasEvidence) {
    statusId = POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT;
    nextActionId = POLICY_EVIDENCE_QUALITY_NEXT_ACTION_IDS.COLLECT_EVIDENCE;
  } else if (!hasIdentityEvidence) {
    statusId = POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT;
    nextActionId = POLICY_EVIDENCE_QUALITY_NEXT_ACTION_IDS.CONFIRM_DESTINATION_IDENTITY;
  } else if (hasStaleProfileEvidence) {
    statusId = POLICY_EVIDENCE_QUALITY_STATUS_IDS.NEEDS_REVIEW;
    nextActionId = POLICY_EVIDENCE_QUALITY_NEXT_ACTION_IDS.REFRESH_PROFILE;
  } else if (hasInsufficientEvidence || hasReviewEvidence) {
    statusId = POLICY_EVIDENCE_QUALITY_STATUS_IDS.NEEDS_REVIEW;
    nextActionId = POLICY_EVIDENCE_QUALITY_NEXT_ACTION_IDS.REVIEW_EVIDENCE;
  } else if (hasHardLimitEvidence) {
    statusId = POLICY_EVIDENCE_QUALITY_STATUS_IDS.USABLE_WITH_CONSTRAINTS;
    nextActionId = POLICY_EVIDENCE_QUALITY_NEXT_ACTION_IDS.VERIFY_CONSTRAINTS;
  }

  return {
    version: POLICY_EVIDENCE_QUALITY_VERSION,
    statusId,
    score: calculateScore({
      hasIdentityEvidence,
      hasDeclaredIdentityEvidence,
      hasObservedIdentityEvidence,
      compatibilityCount: counts.compatibility,
      hasRoutingEvidence,
      hasFreshnessEvidence,
      hasReviewEvidence,
      hasInsufficientEvidence,
    }),
    nextActionId,
    reasonIds: [...reasonIds].sort(),
    counts,
    hasIdentityEvidence,
    hasObservedIdentityEvidence,
    hasDeclaredIdentityEvidence,
    hasHardLimitEvidence,
    hasRoutingEvidence,
    hasFreshnessEvidence,
    hasStaleProfileEvidence,
  };
}

function validatePolicyEvidenceQualityAssessment(projection = {}, options = {}) {
  const expectedQuality = buildPolicyEvidenceQualityAssessment(projection, options);
  const quality = asPlainObject(projection.quality);
  const issues = [];

  if (!quality.version) {
    issues.push({
      riskId: POLICY_EVIDENCE_QUALITY_AUDIT_RISK_IDS.MISSING_QUALITY,
      message: 'Evidence projection must include a generated quality assessment.',
    });
    return {
      ok: false,
      issues,
      expectedQuality,
    };
  }

  const comparableQuality = {
    version: quality.version,
    statusId: quality.statusId,
    score: quality.score,
    nextActionId: quality.nextActionId,
    reasonIds: quality.reasonIds,
    counts: quality.counts,
    hasIdentityEvidence: quality.hasIdentityEvidence,
    hasObservedIdentityEvidence: quality.hasObservedIdentityEvidence,
    hasDeclaredIdentityEvidence: quality.hasDeclaredIdentityEvidence,
    hasHardLimitEvidence: quality.hasHardLimitEvidence,
    hasRoutingEvidence: quality.hasRoutingEvidence,
    hasFreshnessEvidence: quality.hasFreshnessEvidence,
    hasStaleProfileEvidence: quality.hasStaleProfileEvidence,
  };

  if (JSON.stringify(comparableQuality) !== JSON.stringify(expectedQuality)) {
    issues.push({
      riskId: POLICY_EVIDENCE_QUALITY_AUDIT_RISK_IDS.QUALITY_MISMATCH,
      message: 'Evidence projection quality must match the generated bucket/source assessment.',
    });
  }

  const serializedQuality = JSON.stringify(quality);
  const allEntryLabels = Object.values(asPlainObject(projection.buckets))
    .flatMap(entries => Array.isArray(entries) ? entries : [])
    .map(entry => entry?.label)
    .filter(label => typeof label === 'string' && label.length > 0);
  if (allEntryLabels.some(label => serializedQuality.includes(label))) {
    issues.push({
      riskId: POLICY_EVIDENCE_QUALITY_AUDIT_RISK_IDS.QUALITY_EXPOSES_ENTRY_LABELS,
      message: 'Evidence quality must not expose raw evidence entry labels.',
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    expectedQuality,
  };
}

export {
  POLICY_EVIDENCE_QUALITY_AUDIT_RISK_IDS,
  POLICY_EVIDENCE_QUALITY_NEXT_ACTION_IDS,
  POLICY_EVIDENCE_QUALITY_REASON_IDS,
  POLICY_EVIDENCE_QUALITY_STATUS_IDS,
  POLICY_EVIDENCE_QUALITY_VERSION,
  buildPolicyEvidenceQualityAssessment,
  validatePolicyEvidenceQualityAssessment,
};
