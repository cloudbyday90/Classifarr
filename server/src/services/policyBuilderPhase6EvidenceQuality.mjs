const PHASE6R_EVIDENCE_QUALITY_VERSION = 'phase6r.evidence.quality.v1';

const PHASE6R_EVIDENCE_QUALITY_STATUS_IDS = Object.freeze({
  USABLE: 'usable',
  USABLE_WITH_CONSTRAINTS: 'usable_with_constraints',
  NEEDS_REVIEW: 'needs_review',
  INSUFFICIENT: 'insufficient',
});

const PHASE6R_EVIDENCE_QUALITY_REASON_IDS = Object.freeze({
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

const PHASE6R_EVIDENCE_QUALITY_NEXT_ACTION_IDS = Object.freeze({
  COLLECT_EVIDENCE: 'collect_evidence',
  CONFIRM_DESTINATION_IDENTITY: 'confirm_destination_identity',
  REFRESH_PROFILE: 'refresh_profile',
  REVIEW_EVIDENCE: 'review_evidence',
  VERIFY_CONSTRAINTS: 'verify_constraints',
  PROCEED_TO_INTENT: 'proceed_to_intent',
});

const PHASE6R_EVIDENCE_QUALITY_AUDIT_RISK_IDS = Object.freeze({
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

function getBucketEntryCount(summary, bucketId) {
  const bucket = Array.isArray(summary.bucketSummaries)
    ? summary.bucketSummaries.find(item => item.bucketId === bucketId)
    : null;
  return Number.isFinite(bucket?.entryCount) ? bucket.entryCount : 0;
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

function buildPolicyBuilderPhase6EvidenceQualityAssessment(projection = {}, {
  bucketIds = {},
  authoritySourceIds = {},
} = {}) {
  const summary = asPlainObject(projection.summary);
  const buckets = asPlainObject(projection.buckets);
  const identityEntries = Array.isArray(buckets[bucketIds.IDENTITY])
    ? buckets[bucketIds.IDENTITY]
    : [];
  const insufficientEntries = Array.isArray(buckets[bucketIds.INSUFFICIENT])
    ? buckets[bucketIds.INSUFFICIENT]
    : [];

  const counts = {
    identity: getBucketEntryCount(summary, bucketIds.IDENTITY),
    compatibility: getBucketEntryCount(summary, bucketIds.COMPATIBILITY),
    hardLimit: getBucketEntryCount(summary, bucketIds.HARD_LIMIT),
    avoid: getBucketEntryCount(summary, bucketIds.AVOID),
    outlier: getBucketEntryCount(summary, bucketIds.OUTLIER),
    routing: getBucketEntryCount(summary, bucketIds.ROUTING),
    freshness: getBucketEntryCount(summary, bucketIds.FRESHNESS),
    insufficient: getBucketEntryCount(summary, bucketIds.INSUFFICIENT),
  };

  const hasEvidence = Number(summary.totalEntryCount || 0) > 0;
  const hasIdentityEvidence = counts.identity > 0;
  const hasObservedIdentityEvidence = hasAuthorityEntry(
    identityEntries,
    authoritySourceIds.MEDIA_SERVER_CONTENTS
  );
  const hasDeclaredIdentityEvidence = hasAuthorityEntry(
    identityEntries,
    authoritySourceIds.OPERATOR_DECLARED_INTENT
  );
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
  if (!hasEvidence) reasonIds.add(PHASE6R_EVIDENCE_QUALITY_REASON_IDS.NO_EVIDENCE);
  if (!hasIdentityEvidence) reasonIds.add(PHASE6R_EVIDENCE_QUALITY_REASON_IDS.MISSING_IDENTITY);
  if (hasObservedIdentityEvidence) {
    reasonIds.add(PHASE6R_EVIDENCE_QUALITY_REASON_IDS.OBSERVED_IDENTITY_PRESENT);
  }
  if (hasDeclaredIdentityEvidence) {
    reasonIds.add(PHASE6R_EVIDENCE_QUALITY_REASON_IDS.DECLARED_IDENTITY_PRESENT);
  }
  if (counts.compatibility > 0) {
    reasonIds.add(PHASE6R_EVIDENCE_QUALITY_REASON_IDS.COMPATIBILITY_PRESENT);
  }
  if (hasHardLimitEvidence) reasonIds.add(PHASE6R_EVIDENCE_QUALITY_REASON_IDS.HARD_LIMIT_PRESENT);
  if (hasRoutingEvidence) reasonIds.add(PHASE6R_EVIDENCE_QUALITY_REASON_IDS.ROUTING_PRESENT);
  if (hasReviewEvidence) reasonIds.add(PHASE6R_EVIDENCE_QUALITY_REASON_IDS.REVIEW_EVIDENCE_PRESENT);
  if (hasStaleProfileEvidence) reasonIds.add(PHASE6R_EVIDENCE_QUALITY_REASON_IDS.STALE_PROFILE);
  if (hasFreshnessEvidence) reasonIds.add(PHASE6R_EVIDENCE_QUALITY_REASON_IDS.FRESHNESS_PRESENT);

  let statusId = PHASE6R_EVIDENCE_QUALITY_STATUS_IDS.USABLE;
  let nextActionId = PHASE6R_EVIDENCE_QUALITY_NEXT_ACTION_IDS.PROCEED_TO_INTENT;

  if (!hasEvidence) {
    statusId = PHASE6R_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT;
    nextActionId = PHASE6R_EVIDENCE_QUALITY_NEXT_ACTION_IDS.COLLECT_EVIDENCE;
  } else if (!hasIdentityEvidence) {
    statusId = PHASE6R_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT;
    nextActionId = PHASE6R_EVIDENCE_QUALITY_NEXT_ACTION_IDS.CONFIRM_DESTINATION_IDENTITY;
  } else if (hasStaleProfileEvidence) {
    statusId = PHASE6R_EVIDENCE_QUALITY_STATUS_IDS.NEEDS_REVIEW;
    nextActionId = PHASE6R_EVIDENCE_QUALITY_NEXT_ACTION_IDS.REFRESH_PROFILE;
  } else if (hasInsufficientEvidence || hasReviewEvidence) {
    statusId = PHASE6R_EVIDENCE_QUALITY_STATUS_IDS.NEEDS_REVIEW;
    nextActionId = PHASE6R_EVIDENCE_QUALITY_NEXT_ACTION_IDS.REVIEW_EVIDENCE;
  } else if (hasHardLimitEvidence) {
    statusId = PHASE6R_EVIDENCE_QUALITY_STATUS_IDS.USABLE_WITH_CONSTRAINTS;
    nextActionId = PHASE6R_EVIDENCE_QUALITY_NEXT_ACTION_IDS.VERIFY_CONSTRAINTS;
  }

  return {
    version: PHASE6R_EVIDENCE_QUALITY_VERSION,
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

function validatePolicyBuilderPhase6EvidenceQualityAssessment(projection = {}, options = {}) {
  const expectedQuality = buildPolicyBuilderPhase6EvidenceQualityAssessment(projection, options);
  const quality = asPlainObject(projection.quality);
  const issues = [];

  if (!quality.version) {
    issues.push({
      riskId: PHASE6R_EVIDENCE_QUALITY_AUDIT_RISK_IDS.MISSING_QUALITY,
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
      riskId: PHASE6R_EVIDENCE_QUALITY_AUDIT_RISK_IDS.QUALITY_MISMATCH,
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
      riskId: PHASE6R_EVIDENCE_QUALITY_AUDIT_RISK_IDS.QUALITY_EXPOSES_ENTRY_LABELS,
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
  PHASE6R_EVIDENCE_QUALITY_AUDIT_RISK_IDS,
  PHASE6R_EVIDENCE_QUALITY_NEXT_ACTION_IDS,
  PHASE6R_EVIDENCE_QUALITY_REASON_IDS,
  PHASE6R_EVIDENCE_QUALITY_STATUS_IDS,
  PHASE6R_EVIDENCE_QUALITY_VERSION,
  buildPolicyBuilderPhase6EvidenceQualityAssessment,
  validatePolicyBuilderPhase6EvidenceQualityAssessment,
};
