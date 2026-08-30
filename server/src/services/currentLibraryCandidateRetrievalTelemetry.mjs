/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_CANDIDATES,
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS,
} from './currentLibraryCandidateRetrievalContract.mjs';

export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_TELEMETRY_VERSION =
  'current_library.candidate_retrieval_telemetry.v1';

export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_LATENCY_BANDS = Object.freeze([
  Object.freeze({ id: 'under_25ms', label: 'Under 25 ms', upperExclusiveMs: 25 }),
  Object.freeze({ id: '25_to_99ms', label: '25–99 ms', upperExclusiveMs: 100 }),
  Object.freeze({ id: '100_to_249ms', label: '100–249 ms', upperExclusiveMs: 250 }),
  Object.freeze({ id: '250_to_999ms', label: '250–999 ms', upperExclusiveMs: 1000 }),
  Object.freeze({ id: '1000ms_or_more', label: '1,000 ms or more', upperExclusiveMs: null }),
]);

const OBSERVED_STATUS_IDS = new Set([
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS.AVAILABLE,
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS.UNAVAILABLE,
]);
const LATENCY_BAND_IDS = new Set(
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_LATENCY_BANDS.map((band) => band.id),
);

function boundedInteger(value, maximum) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= maximum
    ? numericValue
    : null;
}

function observedCandidateCount(request) {
  const count = Array.isArray(request?.candidates) ? request.candidates.length : 0;
  return count >= 2 && count <= CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_CANDIDATES
    ? count
    : null;
}

/**
 * Maps an elapsed lookup duration to one of five fixed, low-cardinality bands.
 * Exact durations, item identifiers, titles, prompts, and provider details are
 * deliberately excluded from the persisted observation.
 */
export function resolveCurrentLibraryCandidateRetrievalLatencyBand(elapsedMs) {
  const numericValue = Number(elapsedMs);
  if (!Number.isFinite(numericValue) || numericValue < 0) return null;

  return CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_LATENCY_BANDS.find(
    (band) => band.upperExclusiveMs === null || numericValue < band.upperExclusiveMs,
  )?.id || null;
}

function candidateEvidenceCounts(retrieval, candidateCount) {
  const candidates = Array.isArray(retrieval?.candidates) ? retrieval.candidates : [];
  const matchingCandidateCount = candidates.filter((candidate) => Number(candidate?.matchCount) > 0).length;
  const directMatchCandidateCount = candidates.filter((candidate) => candidate?.directMatch === true).length;

  return {
    matchingCandidateCount: Math.min(candidateCount, matchingCandidateCount),
    directMatchCandidateCount: Math.min(candidateCount, directMatchCandidateCount),
  };
}

/**
 * Produces the only current-library retrieval telemetry fact that may cross
 * into classification history. It is aggregate-friendly and has no media,
 * library, AI, prompt, response, actor, or provider identity.
 */
export function buildCurrentLibraryCandidateRetrievalTelemetry({
  request = null,
  retrieval = null,
  elapsedMs = null,
} = {}) {
  const candidateCount = observedCandidateCount(request);
  const statusId = retrieval?.statusId;
  const latencyBand = resolveCurrentLibraryCandidateRetrievalLatencyBand(elapsedMs);
  if (!candidateCount || !OBSERVED_STATUS_IDS.has(statusId) || !latencyBand) return null;

  const evidenceCounts = statusId === CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS.AVAILABLE
    ? candidateEvidenceCounts(retrieval, candidateCount)
    : { matchingCandidateCount: 0, directMatchCandidateCount: 0 };

  return Object.freeze({
    version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_TELEMETRY_VERSION,
    statusId,
    latencyBand,
    candidateCount,
    matchingCandidateCount: evidenceCounts.matchingCandidateCount,
    directMatchCandidateCount: evidenceCounts.directMatchCandidateCount,
  });
}

/**
 * Re-validates telemetry at the persistence boundary so malformed runtime
 * state cannot create new metric dimensions or store content-bearing fields.
 */
export function buildCurrentLibraryCandidateRetrievalTelemetryProjection(value = {}) {
  if (value?.version !== CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_TELEMETRY_VERSION ||
      !OBSERVED_STATUS_IDS.has(value?.statusId) || !LATENCY_BAND_IDS.has(value?.latencyBand)) {
    return null;
  }

  const candidateCount = boundedInteger(
    value.candidateCount,
    CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_MAXIMUM_CANDIDATES,
  );
  const matchingCandidateCount = boundedInteger(value.matchingCandidateCount, candidateCount ?? 0);
  const directMatchCandidateCount = boundedInteger(value.directMatchCandidateCount, matchingCandidateCount ?? 0);
  if (!candidateCount || matchingCandidateCount === null || directMatchCandidateCount === null) return null;

  return Object.freeze({
    version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_TELEMETRY_VERSION,
    status_id: value.statusId,
    latency_band: value.latencyBand,
    candidate_count: candidateCount,
    matched_candidate_count: matchingCandidateCount,
    direct_match_candidate_count: directMatchCandidateCount,
  });
}
