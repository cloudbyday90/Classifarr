/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

function normalizeIdentifier(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return null;
}

export function policyDecisionLibraryIdentifier(library = null) {
  if (library && typeof library === 'object' && !Array.isArray(library)) {
    return normalizeIdentifier(library.library_id ?? library.id);
  }

  return normalizeIdentifier(library);
}

export function policyDecisionAction(policyResult = null) {
  if (!policyResult || typeof policyResult !== 'object') {
    return null;
  }

  const action = policyResult.action;
  return typeof action === 'string' && action.trim() ? action.trim().toLowerCase() : null;
}

export function isPolicyDecisionReviewRequired(policyResult = null) {
  const action = policyDecisionAction(policyResult);
  return action === 'prompt_confirm' || action === 'prompt_select';
}

export function getPolicyDecisionCandidate(policyResult = null, library = null) {
  const libraryIdentifier = policyDecisionLibraryIdentifier(library);
  if (!libraryIdentifier || !Array.isArray(policyResult?.ranked)) {
    return null;
  }

  return policyResult.ranked.find((candidate) => {
    return policyDecisionLibraryIdentifier(candidate) === libraryIdentifier;
  }) || null;
}

export function getPolicyDecisionCandidateScore(policyResult = null, library = null) {
  const candidate = getPolicyDecisionCandidate(policyResult, library);
  const candidateScore = Number(candidate?.score);

  return Number.isFinite(candidateScore) && candidateScore >= 0 && candidateScore <= 100
    ? candidateScore
    : null;
}
