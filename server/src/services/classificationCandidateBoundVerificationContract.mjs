/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_AUTHORITY_MODE_IDS,
  isAiProviderAuthorityModeGranted,
} from './aiProviderAuthority.mjs';

export const CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION =
  'classification.candidate_bound_verification.v1';

export const CANDIDATE_BOUND_VERIFICATION_STATUS_IDS = Object.freeze({
  ADMITTED: 'admitted',
  CONFIRMED: 'confirmed',
  ABSTAINED: 'abstained',
  CONTRACT_VIOLATION: 'contract_violation',
  CANDIDATE_UNAVAILABLE: 'candidate_unavailable',
  CANDIDATE_MISMATCH: 'candidate_mismatch',
  PROVIDER_CAPABILITY_UNAVAILABLE: 'provider_capability_unavailable',
});

const VALID_RESPONSE_DECISIONS = new Set(['CONFIRM', 'ABSTAIN']);
const VALID_PERSISTED_STATUS_IDS = new Set(Object.values(CANDIDATE_BOUND_VERIFICATION_STATUS_IDS));

function normalizeLibraryId(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function getCandidateLibraryId(candidate) {
  return normalizeLibraryId(candidate?.id ?? candidate?.library_id);
}

function findLibrary(libraries, candidate) {
  const candidateLibraryId = getCandidateLibraryId(candidate);
  if (!candidateLibraryId || !Array.isArray(libraries)) return null;

  return libraries.find((library) => normalizeLibraryId(library?.id) === candidateLibraryId) || null;
}

function normalizeReason(value) {
  if (typeof value !== 'string') return null;

  const normalized = value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized && normalized.length <= 280 ? normalized : null;
}

function invalidContract(reasonCode) {
  return Object.freeze({
    version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
    valid: false,
    reasonCode,
    candidate: null,
  });
}

/**
 * Binds verification to the policy path's selected destination. The object is
 * runtime-only: persistence callers must use the projection below.
 */
export function buildCandidateBoundVerificationContract({
  libraries = [],
  signalContext = null,
  verificationCandidate = null,
} = {}) {
  const candidate = findLibrary(libraries, verificationCandidate);
  if (!candidate) {
    return invalidContract(CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CANDIDATE_UNAVAILABLE);
  }

  const suggestedLibrary = findLibrary(libraries, signalContext?.suggestedLibrary);
  if (!suggestedLibrary || normalizeLibraryId(suggestedLibrary.id) !== normalizeLibraryId(candidate.id)) {
    return invalidContract(CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CANDIDATE_MISMATCH);
  }

  const candidateIndex = libraries.findIndex((library) => normalizeLibraryId(library?.id) === normalizeLibraryId(candidate.id));
  if (candidateIndex < 0) {
    return invalidContract(CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CANDIDATE_UNAVAILABLE);
  }

  return Object.freeze({
    version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
    valid: true,
    reasonCode: null,
    candidate: Object.freeze({
      library: candidate,
      libraryId: normalizeLibraryId(candidate.id),
      libraryNumber: candidateIndex + 1,
      libraryName: String(candidate.name || '').slice(0, 160),
    }),
  });
}

/**
 * Only a provider with server-enforced structured output and an effective
 * verification authority can receive the candidate-bound prompt.
 */
export function resolveCandidateBoundVerificationAdmission({
  contract = null,
  authority = null,
} = {}) {
  if (contract?.valid !== true) {
    return Object.freeze({
      version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
      admitted: false,
      statusId: contract?.reasonCode || CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CANDIDATE_UNAVAILABLE,
    });
  }

  const admitted = isAiProviderAuthorityModeGranted(
    authority,
    AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
  ) && authority?.capabilities?.providerEnforcedStructuredOutput === true;

  return Object.freeze({
    version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
    admitted,
    statusId: admitted
      ? CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.ADMITTED
      : CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.PROVIDER_CAPABILITY_UNAVAILABLE,
  });
}

/**
 * Parses only the narrow response object accepted by the verification
 * contract. It intentionally does not normalize prose, markdown, or legacy
 * pipe-delimited responses.
 */
export function parseCandidateBoundVerificationResponse(response) {
  if (typeof response !== 'string') {
    return { valid: false, statusId: CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CONTRACT_VIOLATION };
  }

  let value;
  try {
    value = JSON.parse(response.trim());
  } catch {
    return { valid: false, statusId: CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CONTRACT_VIOLATION };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, statusId: CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CONTRACT_VIOLATION };
  }

  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== 'decision' || keys[1] !== 'reason') {
    return { valid: false, statusId: CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CONTRACT_VIOLATION };
  }

  const decision = String(value.decision || '').trim().toUpperCase();
  const reason = normalizeReason(value.reason);
  if (!VALID_RESPONSE_DECISIONS.has(decision) || !reason) {
    return { valid: false, statusId: CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CONTRACT_VIOLATION };
  }

  return Object.freeze({
    valid: true,
    decision,
    // This is kept transiently for validation only. Callers deliberately do
    // not include it in user-facing or persisted classification state.
    reason,
  });
}

/**
 * Produces the only candidate-bound verification data permitted in history:
 * status and admission facts. It excludes candidate identity and model text.
 */
export function buildCandidateBoundVerificationProjection(value = {}) {
  if (value?.version !== CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION) return null;

  const statusId = value?.statusId ?? value?.status_id;
  if (!VALID_PERSISTED_STATUS_IDS.has(statusId)) return null;

  return Object.freeze({
    version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
    status_id: statusId,
  });
}
