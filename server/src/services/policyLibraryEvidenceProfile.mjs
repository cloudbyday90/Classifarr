/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyCandidateEvidenceCard,
} from './policyCandidateEvidenceCard.mjs';

export const POLICY_LIBRARY_EVIDENCE_PROFILE_VERSION =
  'policy.library_evidence_profile.v1';
export const POLICY_LIBRARY_EVIDENCE_PROFILE_MAXIMUM_CANDIDATES = 3;

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

function boundedString(value, maximumLength = 160) {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized && normalized.length <= maximumLength ? normalized : null;
}

function policyScore(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? Math.round(number) : null;
}

function candidateLibraryId(candidate) {
  return positiveInteger(candidate?.library_id ?? candidate?.libraryId);
}

function candidateForLibrary({ policyResult, question, libraryId }) {
  const rankedCandidate = asArray(policyResult?.ranked)
    .find((candidate) => candidateLibraryId(candidate) === libraryId);
  if (rankedCandidate) return rankedCandidate;

  return asArray(question?.meta?.candidates)
    .find((candidate) => candidateLibraryId(candidate) === libraryId) || null;
}

function scoreForCandidate(candidate, destination) {
  return policyScore(candidate?.score ?? candidate?.policyScore ??
    destination?.evidence_score ?? destination?.evidenceScore);
}

function profileCandidate({
  classification,
  sourceMetadata,
  policyResult,
  question,
  destination,
  rank,
  leadingScore,
}) {
  const libraryId = positiveInteger(destination?.library_id);
  const libraryName = boundedString(destination?.library_name);
  if (!libraryId || !libraryName) return null;

  const candidate = candidateForLibrary({ policyResult, question, libraryId });
  const candidateScore = scoreForCandidate(candidate, destination);
  if (candidateScore === null) return null;

  return Object.freeze({
    rank,
    library_id: libraryId,
    library_name: libraryName,
    policy_score: candidateScore,
    score_margin: Math.max(0, leadingScore - candidateScore),
    evidence_card: buildPolicyCandidateEvidenceCard({
      classification,
      candidate,
      sourceMetadata,
    }),
  });
}

/**
 * Builds a compact, deterministic comparison of the policy-eligible
 * destinations already available to the operator. The profile deliberately
 * retains only fixed evidence states and score mechanics: metadata values,
 * catalog titles, descriptions, policy terms, provider data, and model output
 * stay on the server.
 */
export function buildPolicyLibraryEvidenceProfile({
  classification = {},
  question = null,
  candidateDestinations = [],
  sourceMetadata = {},
} = {}) {
  const destinations = asArray(candidateDestinations)
    .slice(0, POLICY_LIBRARY_EVIDENCE_PROFILE_MAXIMUM_CANDIDATES);
  if (destinations.length < 2) return null;

  const policyResult = asObject(sourceMetadata?.policyResult);
  const leadingCandidate = candidateForLibrary({
    policyResult,
    question,
    libraryId: positiveInteger(destinations[0]?.library_id),
  });
  const leadingScore = scoreForCandidate(leadingCandidate, destinations[0]);
  if (leadingScore === null) return null;

  const candidates = destinations
    .map((destination, index) => profileCandidate({
      classification,
      sourceMetadata,
      policyResult,
      question,
      destination,
      rank: index + 1,
      leadingScore,
    }))
    .filter(Boolean);

  return candidates.length >= 2
    ? Object.freeze({
      version: POLICY_LIBRARY_EVIDENCE_PROFILE_VERSION,
      candidates: Object.freeze(candidates),
    })
    : null;
}
