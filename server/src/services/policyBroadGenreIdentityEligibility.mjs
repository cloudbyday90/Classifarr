import {
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';
import {
  POLICY_EVIDENCE_SOURCE_IDS,
} from './policyEvidenceEngine.mjs';

const POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_VERSION =
  'policy.broad_genre_identity_eligibility.v1';

const POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_ITEM_COUNT = 2;
const POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_CONFIDENCE = 0.7;

const POLICY_BROAD_GENRE_IDENTITY_SUPPORT_TYPE_IDS = Object.freeze({
  NONE: 'none',
  OBSERVED_SPECIFIC_IDENTITY: 'observed_specific_identity',
  OPERATOR_DECLARED_SPECIFIC_IDENTITY: 'operator_declared_specific_identity',
});

const POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS = Object.freeze({
  NO_SPECIFIC_IDENTITY_SUPPORT: 'no_specific_identity_support',
  OBSERVED_SPECIFIC_IDENTITY_STALE: 'observed_specific_identity_stale',
  OBSERVED_SPECIFIC_IDENTITY_COUNT_BELOW_MINIMUM:
    'observed_specific_identity_count_below_minimum',
  OBSERVED_SPECIFIC_IDENTITY_CONFIDENCE_BELOW_MINIMUM:
    'observed_specific_identity_confidence_below_minimum',
  OBSERVED_SPECIFIC_IDENTITY_ELIGIBLE: 'observed_specific_identity_eligible',
  OPERATOR_DECLARED_SPECIFIC_IDENTITY:
    'operator_declared_specific_identity',
});

const POLICY_BROAD_GENRE_LABELS = Object.freeze([
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

const BROAD_GENRE_LABEL_SET = new Set(POLICY_BROAD_GENRE_LABELS);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKey(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
  return Math.max(0, Math.min(1, numeric));
}

function normalizeObservedItemCount(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function isPolicyBroadGenreEvidence(entry = {}) {
  const key = normalizeKey(entry.key);
  const label = normalizeKey(entry.label);

  return key.startsWith('genre:') || key.startsWith('genres:') ||
    BROAD_GENRE_LABEL_SET.has(label);
}

function isOperatorDeclaredSpecificIdentity(entry = {}) {
  return entry?.sourceId === POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT &&
    entry?.authoritySourceId === AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT &&
    entry?.operatorDeclared === true &&
    Boolean(normalizeString(entry?.key) || normalizeString(entry?.label)) &&
    !isPolicyBroadGenreEvidence(entry);
}

function hasObservedSpecificIdentityProvenance(entry = {}) {
  return entry?.sourceId === POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE &&
    entry?.authoritySourceId === AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS &&
    Boolean(normalizeString(entry?.key) || normalizeString(entry?.label)) &&
    !isPolicyBroadGenreEvidence(entry);
}

function isObservedSpecificIdentity(entry = {}) {
  return hasObservedSpecificIdentityProvenance(entry) && entry?.stale !== true;
}

function isEligibleObservedSpecificIdentity(entry = {}) {
  const itemCount = normalizeObservedItemCount(entry.count);
  const confidence = normalizeConfidence(entry.confidence);

  return isObservedSpecificIdentity(entry) &&
    itemCount !== null &&
    itemCount >= POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_ITEM_COUNT &&
    confidence !== null &&
    confidence >= POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_CONFIDENCE;
}

function evaluatePolicyBroadGenreIdentityEligibility(entries = []) {
  const candidates = asArray(entries).filter(entry => entry && typeof entry === 'object');

  if (candidates.some(isOperatorDeclaredSpecificIdentity)) {
    return {
      version: POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_VERSION,
      eligible: true,
      supportTypeId:
        POLICY_BROAD_GENRE_IDENTITY_SUPPORT_TYPE_IDS.OPERATOR_DECLARED_SPECIFIC_IDENTITY,
      qualifiedObservedSpecificIdentityCount: 0,
      minimumObservedItemCount: POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_ITEM_COUNT,
      minimumObservedConfidence: POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_CONFIDENCE,
      reasonIds: [
        POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS
          .OPERATOR_DECLARED_SPECIFIC_IDENTITY,
      ],
    };
  }

  const observedSpecificEntries = candidates.filter(isObservedSpecificIdentity);
  const eligibleObservedEntries = observedSpecificEntries.filter(
    isEligibleObservedSpecificIdentity
  );

  if (eligibleObservedEntries.length > 0) {
    return {
      version: POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_VERSION,
      eligible: true,
      supportTypeId:
        POLICY_BROAD_GENRE_IDENTITY_SUPPORT_TYPE_IDS.OBSERVED_SPECIFIC_IDENTITY,
      qualifiedObservedSpecificIdentityCount: eligibleObservedEntries.length,
      minimumObservedItemCount: POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_ITEM_COUNT,
      minimumObservedConfidence: POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_CONFIDENCE,
      reasonIds: [
        POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS
          .OBSERVED_SPECIFIC_IDENTITY_ELIGIBLE,
      ],
    };
  }

  const reasonIds = new Set();
  if (observedSpecificEntries.length === 0) {
    reasonIds.add(
      POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS.NO_SPECIFIC_IDENTITY_SUPPORT
    );
  }
  if (candidates.some(entry =>
    hasObservedSpecificIdentityProvenance(entry) && entry?.stale === true
  )) {
    reasonIds.add(
      POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS.OBSERVED_SPECIFIC_IDENTITY_STALE
    );
  }
  if (observedSpecificEntries.some(entry => {
    const itemCount = normalizeObservedItemCount(entry.count);
    return itemCount === null ||
      itemCount < POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_ITEM_COUNT;
  })) {
    reasonIds.add(
      POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS
        .OBSERVED_SPECIFIC_IDENTITY_COUNT_BELOW_MINIMUM
    );
  }
  if (observedSpecificEntries.some(entry => {
    const confidence = normalizeConfidence(entry.confidence);
    return confidence === null ||
      confidence < POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_CONFIDENCE;
  })) {
    reasonIds.add(
      POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS
        .OBSERVED_SPECIFIC_IDENTITY_CONFIDENCE_BELOW_MINIMUM
    );
  }

  return {
    version: POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_VERSION,
    eligible: false,
    supportTypeId: POLICY_BROAD_GENRE_IDENTITY_SUPPORT_TYPE_IDS.NONE,
    qualifiedObservedSpecificIdentityCount: 0,
    minimumObservedItemCount: POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_ITEM_COUNT,
    minimumObservedConfidence: POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_CONFIDENCE,
    reasonIds: [...reasonIds].sort(),
  };
}

export {
  POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_REASON_IDS,
  POLICY_BROAD_GENRE_IDENTITY_ELIGIBILITY_VERSION,
  POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_CONFIDENCE,
  POLICY_BROAD_GENRE_IDENTITY_MIN_OBSERVED_ITEM_COUNT,
  POLICY_BROAD_GENRE_IDENTITY_SUPPORT_TYPE_IDS,
  POLICY_BROAD_GENRE_LABELS,
  evaluatePolicyBroadGenreIdentityEligibility,
  isEligibleObservedSpecificIdentity,
  isPolicyBroadGenreEvidence,
};
