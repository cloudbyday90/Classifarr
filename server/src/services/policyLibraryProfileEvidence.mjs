const POLICY_LIBRARY_PROFILE_EVIDENCE_VERSION = 'policy.library_profile_evidence.v1';

const POLICY_LIBRARY_PROFILE_EVIDENCE_SIGNAL_IDS = Object.freeze({
  GENRE: 'genre',
  RATING: 'rating',
  STUDIO: 'studio',
  KEYWORD: 'keyword',
});

const POLICY_LIBRARY_PROFILE_EVIDENCE_REASON_IDS = Object.freeze({
  OBSERVED_DISTRIBUTION: 'observed_library_distribution',
  OBSERVED_ABSENCE_REQUIRES_REVIEW: 'observed_absence_requires_review',
  MISSING_PROFILE_DISTRIBUTIONS: 'missing_profile_distributions',
});

const POLICY_LIBRARY_PROFILE_EVIDENCE_AUDIT_RISK_IDS = Object.freeze({
  MISSING_LIBRARY_PROFILE: 'missing_library_profile',
  IDENTITY_FROM_DISTRIBUTION: 'identity_from_distribution',
  INVALID_COMPATIBILITY_CANDIDATE: 'invalid_compatibility_candidate',
  INVALID_OUTLIER_CANDIDATE: 'invalid_outlier_candidate',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
});

const MAX_CANDIDATES_PER_SIGNAL = 5;
const MAX_SIGNAL_LABEL_LENGTH = 120;

const DISTRIBUTION_DEFINITIONS = Object.freeze([
  {
    signalId: POLICY_LIBRARY_PROFILE_EVIDENCE_SIGNAL_IDS.GENRE,
    fields: Object.freeze(['genre_distribution', 'genreDistribution', 'genres']),
  },
  {
    signalId: POLICY_LIBRARY_PROFILE_EVIDENCE_SIGNAL_IDS.RATING,
    fields: Object.freeze(['rating_distribution', 'ratingDistribution', 'ratings']),
  },
  {
    signalId: POLICY_LIBRARY_PROFILE_EVIDENCE_SIGNAL_IDS.STUDIO,
    fields: Object.freeze(['studio_distribution', 'studioDistribution', 'studios']),
  },
  {
    signalId: POLICY_LIBRARY_PROFILE_EVIDENCE_SIGNAL_IDS.KEYWORD,
    fields: Object.freeze(['keyword_distribution', 'keywordDistribution', 'keywords']),
  },
]);

const OBSERVED_ABSENCE_DEFINITIONS = Object.freeze([
  {
    signalId: POLICY_LIBRARY_PROFILE_EVIDENCE_SIGNAL_IDS.RATING,
    fields: Object.freeze(['exclusion_ratings', 'exclusionRatings']),
  },
  {
    signalId: POLICY_LIBRARY_PROFILE_EVIDENCE_SIGNAL_IDS.GENRE,
    fields: Object.freeze(['exclusion_genres', 'exclusionGenres']),
  },
  {
    signalId: POLICY_LIBRARY_PROFILE_EVIDENCE_SIGNAL_IDS.KEYWORD,
    fields: Object.freeze(['exclusion_keywords', 'exclusionKeywords']),
  },
]);

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeLabel(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const normalized = String(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized ? normalized.slice(0, MAX_SIGNAL_LABEL_LENGTH) : null;
}

function normalizePercentage(value) {
  const percentage = Number(value);
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) return null;

  return Math.round(percentage * 100) / 100;
}

function normalizeItemCount(value) {
  const itemCount = Number(value);
  if (!Number.isInteger(itemCount) || itemCount < 0) return null;

  return itemCount;
}

function getFirstDefinedValue(record, fields) {
  return fields.find(field => record[field] !== undefined && record[field] !== null)
    ? record[fields.find(field => record[field] !== undefined && record[field] !== null)]
    : null;
}

function parseDistribution(value) {
  if (typeof value === 'string') {
    try {
      return asPlainObject(JSON.parse(value));
    } catch {
      return {};
    }
  }

  return asPlainObject(value);
}

function compareDistributionEntries(left, right) {
  if (left.percentage !== right.percentage) {
    return right.percentage - left.percentage;
  }

  if (left.label < right.label) return -1;
  if (left.label > right.label) return 1;
  return 0;
}

function listDistributionEntries(profile, definition) {
  const distribution = parseDistribution(getFirstDefinedValue(profile, definition.fields));

  return Object.entries(distribution)
    .map(([label, percentage]) => ({
      label: normalizeLabel(label),
      percentage: normalizePercentage(percentage),
    }))
    .filter(entry => entry.label && entry.percentage !== null)
    .sort(compareDistributionEntries)
    .slice(0, MAX_CANDIDATES_PER_SIGNAL);
}

function buildCompatibilityCandidate({ signalId, label, percentage, itemCount }) {
  return {
    key: `${signalId}:${label.toLowerCase()}`,
    label,
    value: `${percentage}%`,
    count: itemCount === null ? null : Math.round((itemCount * percentage) / 100),
    confidence: percentage / 100,
    reasonCode: POLICY_LIBRARY_PROFILE_EVIDENCE_REASON_IDS.OBSERVED_DISTRIBUTION,
  };
}

function listObservedAbsenceCandidates(profile) {
  return OBSERVED_ABSENCE_DEFINITIONS.flatMap(definition =>
    asArray(getFirstDefinedValue(profile, definition.fields))
      .map(normalizeLabel)
      .filter(Boolean)
      .sort()
      .slice(0, MAX_CANDIDATES_PER_SIGNAL)
      .map(label => ({
        key: `${definition.signalId}:${label.toLowerCase()}`,
        label: `No observed ${label} ${definition.signalId} entries`,
        value: label,
        count: 0,
        confidence: null,
        reasonCode: POLICY_LIBRARY_PROFILE_EVIDENCE_REASON_IDS.OBSERVED_ABSENCE_REQUIRES_REVIEW,
      }))
  );
}

function hasAnyDistribution(profile) {
  return DISTRIBUTION_DEFINITIONS.some(definition =>
    listDistributionEntries(profile, definition).length > 0
  );
}

function buildPolicyLibraryProfileEvidence(profile = {}) {
  const normalizedProfile = asPlainObject(profile);
  const itemCount = normalizeItemCount(
    normalizedProfile.item_count ?? normalizedProfile.itemCount
  );
  const distributionEntries = DISTRIBUTION_DEFINITIONS.map(definition => ({
    signalId: definition.signalId,
    entries: listDistributionEntries(normalizedProfile, definition),
  }));
  const compatibilityCandidates = distributionEntries.flatMap(({ signalId, entries }) =>
    entries.map(entry => buildCompatibilityCandidate({
      signalId,
      ...entry,
      itemCount,
    }))
  );
  const outliers = listObservedAbsenceCandidates(normalizedProfile);
  const hasDistributions = hasAnyDistribution(normalizedProfile);

  return {
    version: POLICY_LIBRARY_PROFILE_EVIDENCE_VERSION,
    libraryProfile: {
      // A distribution can support compatibility, but cannot establish destination identity by itself.
      identityCandidates: [],
      compatibilityCandidates,
      outliers,
    },
    summary: {
      itemCount,
      distributionSignalCount: distributionEntries.filter(({ entries }) => entries.length > 0).length,
      compatibilityCandidateCount: compatibilityCandidates.length,
      observedAbsenceCount: outliers.length,
    },
    warnings: hasDistributions
      ? []
      : [{
        reasonCode: POLICY_LIBRARY_PROFILE_EVIDENCE_REASON_IDS.MISSING_PROFILE_DISTRIBUTIONS,
      }],
    sideEffects: {
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
      policyStorageMutated: false,
    },
  };
}

function isCompatibilityCandidate(candidate) {
  return candidate &&
    typeof candidate === 'object' &&
    normalizeLabel(candidate.key) &&
    normalizeLabel(candidate.label) &&
    normalizePercentage(Number(candidate.confidence) * 100) !== null &&
    candidate.reasonCode === POLICY_LIBRARY_PROFILE_EVIDENCE_REASON_IDS.OBSERVED_DISTRIBUTION;
}

function isObservedAbsenceCandidate(candidate) {
  return candidate &&
    typeof candidate === 'object' &&
    normalizeLabel(candidate.key) &&
    normalizeLabel(candidate.label) &&
    candidate.count === 0 &&
    candidate.reasonCode === POLICY_LIBRARY_PROFILE_EVIDENCE_REASON_IDS.OBSERVED_ABSENCE_REQUIRES_REVIEW;
}

function buildPolicyLibraryProfileEvidenceAudit(evidence = {}) {
  const libraryProfile = asPlainObject(evidence.libraryProfile);
  const issues = [];

  if (!evidence || typeof evidence !== 'object') {
    issues.push({
      riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_AUDIT_RISK_IDS.MISSING_LIBRARY_PROFILE,
      message: 'Library profile evidence must be an object with a bounded library-profile section.',
    });
  }

  if (asArray(libraryProfile.identityCandidates).length > 0) {
    issues.push({
      riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_AUDIT_RISK_IDS.IDENTITY_FROM_DISTRIBUTION,
      message: 'Observed library distributions cannot create identity evidence without a separate authority source.',
    });
  }

  if (!asArray(libraryProfile.compatibilityCandidates).every(isCompatibilityCandidate)) {
    issues.push({
      riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_AUDIT_RISK_IDS.INVALID_COMPATIBILITY_CANDIDATE,
      message: 'Library distribution evidence must use bounded observed-distribution compatibility candidates.',
    });
  }

  if (!asArray(libraryProfile.outliers).every(isObservedAbsenceCandidate)) {
    issues.push({
      riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_AUDIT_RISK_IDS.INVALID_OUTLIER_CANDIDATE,
      message: 'Observed absences must remain review-only outlier candidates.',
    });
  }

  const sideEffects = asPlainObject(evidence.sideEffects);
  if (sideEffects.liveProviderLookupPerformed !== false ||
      sideEffects.providerQuotaRead !== false ||
      sideEffects.policyStorageMutated !== false) {
    issues.push({
      riskId: POLICY_LIBRARY_PROFILE_EVIDENCE_AUDIT_RISK_IDS.UNSAFE_SIDE_EFFECT,
      message: 'Library profile evidence adaptation must not perform provider lookups, quota reads, or storage writes.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_LIBRARY_PROFILE_EVIDENCE_AUDIT_RISK_IDS,
  POLICY_LIBRARY_PROFILE_EVIDENCE_REASON_IDS,
  POLICY_LIBRARY_PROFILE_EVIDENCE_SIGNAL_IDS,
  POLICY_LIBRARY_PROFILE_EVIDENCE_VERSION,
  buildPolicyLibraryProfileEvidence,
  buildPolicyLibraryProfileEvidenceAudit,
};
