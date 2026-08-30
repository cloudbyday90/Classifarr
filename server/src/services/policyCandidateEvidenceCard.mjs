/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_EVIDENCE_CARD_VERSION =
  'policy.candidate_evidence_card.v1';

export const POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS = Object.freeze({
  CORROBORATED: 'corroborated',
  COUNTER_EVIDENCE_RECOMMENDED: 'counter_evidence_recommended',
  EVIDENCE_CONFLICT: 'evidence_conflict',
  IDENTITY_ANCHOR_INCOMPLETE: 'identity_anchor_incomplete',
  EVIDENCE_UNAVAILABLE: 'evidence_unavailable',
});

export const POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS = Object.freeze({
  ITEM_IDENTITY: 'item_identity',
  DECLARED_POLICY: 'declared_policy',
  OBSERVED_LIBRARY_PROFILE: 'observed_library_profile',
  SIMILAR_ITEM_RETRIEVAL: 'similar_item_retrieval',
  CONFIRMED_OUTCOMES: 'confirmed_outcomes',
});

export const POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS = Object.freeze({
  ANCHORED: 'anchored',
  SUPPORTING: 'supporting',
  CONTEXTUAL: 'contextual',
  CONFLICTING: 'conflicting',
  UNAVAILABLE: 'unavailable',
});

const VALID_MEDIA_TYPES = new Set(['movie', 'tv']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function imdbIdentifier(value) {
  return typeof value === 'string' && /^tt\d{4,12}$/i.test(value.trim());
}

function normalizeMediaType(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return VALID_MEDIA_TYPES.has(normalized) ? normalized : null;
}

function hasStableMetadataIdentifier(classification, sourceMetadata) {
  return Boolean(
    positiveInteger(classification?.tmdb_id ?? sourceMetadata.tmdb_id ?? sourceMetadata.tmdbId) ||
    positiveInteger(sourceMetadata.tvdb_id ?? sourceMetadata.tvdbId) ||
    imdbIdentifier(sourceMetadata.imdb_id ?? sourceMetadata.imdbId),
  );
}

function itemIdentityState(classification, sourceMetadata) {
  const mediaType = normalizeMediaType(classification?.media_type ?? sourceMetadata.media_type);
  return mediaType && hasStableMetadataIdentifier(classification, sourceMetadata)
    ? POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.ANCHORED
    : POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.UNAVAILABLE;
}

function declaredPolicyState(diagnostics) {
  const identityEvidence = asObject(
    diagnostics.identity_evidence || diagnostics.identityEvidence,
  );
  const nativeIntent = asObject(
    diagnostics.native_intent_runtime || diagnostics.nativeIntentRuntime,
  );

  if (identityEvidence.status_id === 'positive_specialized_evidence') {
    return POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.SUPPORTING;
  }
  if (
    identityEvidence.status_id === 'broad_compatibility_overlap' ||
    identityEvidence.status_id === 'insufficient_specialized_evidence'
  ) {
    return POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.CONTEXTUAL;
  }
  if (nativeIntent.eligible === true && Number(nativeIntent?.rule_counts?.purpose || 0) > 0) {
    return POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.SUPPORTING;
  }

  return POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.UNAVAILABLE;
}

function hasRagSupport(diagnostics) {
  const positiveSources = asObject(diagnostics.positive_sources || diagnostics.positiveSources);
  const ragEvidence = asObject(diagnostics.rag_evidence_quality || diagnostics.ragEvidenceQuality);
  return positiveSources.rag === true || asArray(ragEvidence.matches).length > 0;
}

function hasConfirmedOutcomeSupport(diagnostics) {
  const positiveSources = asObject(diagnostics.positive_sources || diagnostics.positiveSources);
  return positiveSources.pattern === true || positiveSources.history === true;
}

function hasDeterministicConflict(diagnostics) {
  const suppressionReasons = asArray(
    diagnostics.suppression_reasons || diagnostics.suppressionReasons,
  );
  const calibration = asObject(diagnostics.score_calibration || diagnostics.scoreCalibration);

  return diagnostics.profile_observed_absence_advisory === true ||
    diagnostics.profile_hard_excluded === true ||
    suppressionReasons.includes('policy_constraint_conflict') ||
    suppressionReasons.includes('profile_hard_exclusion') ||
    calibration.reason_code === 'negative_conflict' ||
    calibration.reasonCode === 'negative_conflict';
}

function source(id, stateId) {
  return Object.freeze({ source_id: id, state_id: stateId });
}

function statusId({
  identityState,
  declaredState,
  profileState,
  retrievalState,
  outcomesState,
  conflict,
}) {
  if (conflict) {
    return POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS.EVIDENCE_CONFLICT;
  }
  if (identityState !== POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.ANCHORED) {
    return POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS.IDENTITY_ANCHOR_INCOMPLETE;
  }

  const hasRetainedEvidence = [declaredState, profileState, retrievalState, outcomesState]
    .some((state) => (
      state === POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.SUPPORTING ||
      state === POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.CONTEXTUAL
    ));
  if (!hasRetainedEvidence) {
    return POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS.EVIDENCE_UNAVAILABLE;
  }

  const lacksCrossCheck =
    retrievalState !== POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.SUPPORTING &&
    outcomesState !== POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.SUPPORTING;
  if (lacksCrossCheck && (
    declaredState === POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.SUPPORTING ||
    profileState === POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.CONTEXTUAL
  )) {
    return POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS.COUNTER_EVIDENCE_RECOMMENDED;
  }

  return POLICY_CANDIDATE_EVIDENCE_CARD_STATUS_IDS.CORROBORATED;
}

/**
 * Projects fixed evidence mechanics for a pending policy decision. It never
 * returns titles, policy terms, metadata values, raw retrieval content, model
 * output, identities, or routing controls. A current-library profile is
 * deliberately modeled as contextual support, not semantic proof.
 */
export function buildPolicyCandidateEvidenceCard({
  classification = {},
  candidate = null,
  sourceMetadata = {},
} = {}) {
  const diagnostics = asObject(candidate?.candidate_diagnostics || candidate?.candidateDiagnostics);
  const positiveSources = asObject(diagnostics.positive_sources || diagnostics.positiveSources);
  const conflict = hasDeterministicConflict(diagnostics);
  const identityState = itemIdentityState(classification, sourceMetadata);
  const declaredState = declaredPolicyState(diagnostics);
  const profileState = conflict && (
    diagnostics.profile_observed_absence_advisory === true ||
    diagnostics.profile_hard_excluded === true ||
    asArray(diagnostics.suppression_reasons || diagnostics.suppressionReasons)
      .includes('profile_hard_exclusion')
  )
    ? POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.CONFLICTING
    : positiveSources.profile === true
      ? POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.CONTEXTUAL
      : POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.UNAVAILABLE;
  const retrievalState = hasRagSupport(diagnostics)
    ? POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.SUPPORTING
    : POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.UNAVAILABLE;
  const outcomesState = hasConfirmedOutcomeSupport(diagnostics)
    ? POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.SUPPORTING
    : POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.UNAVAILABLE;
  const normalizedDeclaredState = conflict && declaredState ===
    POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.SUPPORTING &&
    asArray(diagnostics.suppression_reasons || diagnostics.suppressionReasons)
      .includes('policy_constraint_conflict')
    ? POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_STATE_IDS.CONFLICTING
    : declaredState;

  return Object.freeze({
    version: POLICY_CANDIDATE_EVIDENCE_CARD_VERSION,
    status_id: statusId({
      identityState,
      declaredState: normalizedDeclaredState,
      profileState,
      retrievalState,
      outcomesState,
      conflict,
    }),
    sources: Object.freeze([
      source(POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.ITEM_IDENTITY, identityState),
      source(POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.DECLARED_POLICY, normalizedDeclaredState),
      source(POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.OBSERVED_LIBRARY_PROFILE, profileState),
      source(POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.SIMILAR_ITEM_RETRIEVAL, retrievalState),
      source(POLICY_CANDIDATE_EVIDENCE_CARD_SOURCE_IDS.CONFIRMED_OUTCOMES, outcomesState),
    ]),
  });
}
