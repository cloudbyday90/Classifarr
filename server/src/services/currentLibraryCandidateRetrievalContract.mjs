/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_VERSION = 'current_library.candidate_retrieval.v1';
export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_CANDIDATES = 3;
export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE = 3;
export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_SEARCH_TERMS = 48;

export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS = Object.freeze({
  READY: 'ready',
  NOT_APPLICABLE: 'not_applicable',
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
});

const SUPPORTED_MEDIA_TYPES = new Set(['movie', 'tv']);

function positiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function boundedTitle(value) {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized && normalized.length <= 220 ? normalized : null;
}

function supportedMediaType(value) {
  return typeof value === 'string' && SUPPORTED_MEDIA_TYPES.has(value) ? value : null;
}

function metadataTmdbId(metadata) {
  return positiveInteger(metadata?.tmdb_id ?? metadata?.tmdbId);
}

function metadataYear(metadata) {
  return positiveInteger(metadata?.year);
}

function searchTerms(value) {
  if (typeof value !== 'string') return [];

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function metadataSearchTerms(metadata, title) {
  const genres = Array.isArray(metadata?.genres)
    ? metadata.genres.filter((genre) => typeof genre === 'string').slice(0, 8)
    : typeof metadata?.genres === 'string'
      ? [metadata.genres]
      : [];
  const inputs = [
    title,
    ...genres,
    metadata?.overview,
    metadata?.summary,
    metadata?.description,
  ];

  return inputs
    .flatMap(searchTerms)
    .slice(0, CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_SEARCH_TERMS)
    .join(' ');
}

/**
 * Creates a small, server-owned retrieval request from the already-bounded
 * policy contract. Caller metadata can contribute search terms only; it
 * cannot choose a library, expand the candidate set, or increase limits.
 */
export function buildCurrentLibraryCandidateRetrievalRequest({
  contract = null,
  metadata = null,
} = {}) {
  if (contract?.valid !== true || !Array.isArray(contract.candidates)) {
    return Object.freeze({
      version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_VERSION,
      statusId: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS.NOT_APPLICABLE,
      candidates: Object.freeze([]),
    });
  }

  const seenLibraryIds = new Set();
  const candidates = contract.candidates
    .map((candidate) => {
      const libraryId = positiveInteger(candidate?.libraryId);
      const mediaType = supportedMediaType(candidate?.mediaType);
      if (!libraryId || !mediaType || seenLibraryIds.has(libraryId)) return null;

      seenLibraryIds.add(libraryId);
      return Object.freeze({ libraryId, mediaType });
    })
    .filter(Boolean)
    .slice(0, CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_CANDIDATES);

  const title = boundedTitle(metadata?.title);
  const searchText = metadataSearchTerms(metadata, title);
  const mediaType = candidates[0]?.mediaType || null;
  if (
    candidates.length < 2
    || !title
    || !searchText
    || !mediaType
    || candidates.some((candidate) => candidate.mediaType !== mediaType)
  ) {
    return Object.freeze({
      version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_VERSION,
      statusId: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS.NOT_APPLICABLE,
      candidates: Object.freeze([]),
    });
  }

  return Object.freeze({
    version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_VERSION,
    statusId: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS.READY,
    candidates: Object.freeze(candidates),
    mediaType,
    title,
    searchText,
    tmdbId: metadataTmdbId(metadata),
    year: metadataYear(metadata),
    maximumItemsPerCandidate: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_ITEMS_PER_CANDIDATE,
  });
}
