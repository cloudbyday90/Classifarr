/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_VERSION =
  'policy.candidate_contrastive_retrieval_contract.v1';
export const POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_MAXIMUM_CANDIDATES = 3;

export const POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS = Object.freeze({
  READY: 'ready',
  NOT_PENDING_POLICY_DECISION: 'not_pending_policy_decision',
  INSUFFICIENT_CANDIDATES: 'insufficient_candidates',
  IDENTITY_UNVERIFIED: 'identity_unverified',
});

const PENDING_POLICY_ACTIONS = new Set(['prompt_confirm', 'prompt_select']);
const SUPPORTED_MEDIA_TYPES = new Set(['movie', 'tv']);

function positiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizedMediaType(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SUPPORTED_MEDIA_TYPES.has(normalized) ? normalized : null;
}

function libraryId(value) {
  return positiveInteger(value?.id ?? value?.library_id);
}

function invalidContract(statusId) {
  return Object.freeze({
    version: POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_VERSION,
    valid: false,
    statusId,
    candidates: Object.freeze([]),
  });
}

/**
 * Defines the only libraries an identity comparison may query. The policy
 * ranking owns both order and membership; metadata supplies only a canonical
 * TMDb identity and media type. Title and semantic fallbacks are excluded.
 */
export function buildPolicyCandidateContrastiveRetrievalContract({
  policyResult = null,
  libraries = [],
  metadata = null,
} = {}) {
  if (!PENDING_POLICY_ACTIONS.has(policyResult?.action)) {
    return invalidContract(
      POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS.NOT_PENDING_POLICY_DECISION,
    );
  }

  const mediaType = normalizedMediaType(metadata?.media_type ?? metadata?.mediaType);
  const tmdbId = positiveInteger(metadata?.tmdb_id ?? metadata?.tmdbId);
  if (!mediaType || !tmdbId) {
    return invalidContract(
      POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS.IDENTITY_UNVERIFIED,
    );
  }

  const librariesById = new Map(
    (Array.isArray(libraries) ? libraries : [])
      .map((library) => [libraryId(library), library])
      .filter(([id]) => id),
  );
  const seenLibraryIds = new Set();
  const candidates = (Array.isArray(policyResult?.ranked) ? policyResult.ranked : [])
    .map((rankedCandidate) => {
      const id = libraryId(rankedCandidate);
      const library = librariesById.get(id);
      if (
        !id ||
        !library ||
        library.is_active === false ||
        normalizedMediaType(library.media_type ?? library.mediaType) !== mediaType ||
        seenLibraryIds.has(id)
      ) {
        return null;
      }

      seenLibraryIds.add(id);
      return Object.freeze({ libraryId: id, mediaType });
    })
    .filter(Boolean)
    .slice(0, POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_MAXIMUM_CANDIDATES);

  if (candidates.length < 2) {
    return invalidContract(
      POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS.INSUFFICIENT_CANDIDATES,
    );
  }

  return Object.freeze({
    version: POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_VERSION,
    valid: true,
    statusId: POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS.READY,
    mediaType,
    tmdbId,
    candidates: Object.freeze(candidates),
  });
}
