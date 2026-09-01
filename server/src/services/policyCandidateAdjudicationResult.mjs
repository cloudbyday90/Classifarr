/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS,
  POLICY_CANDIDATE_ADJUDICATION_VERSION,
} from './policyCandidateAdjudicationContract.mjs';

function policyConfidence(policyResult, fallback = 0) {
  const value = Number(policyResult?.confidence ?? fallback);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : 0;
}

function projection(contract, statusId, library = null, semanticRetrievalStatusId = null) {
  return {
    version: POLICY_CANDIDATE_ADJUDICATION_VERSION,
    statusId,
    candidateCount: contract.candidates.length,
    proposedDestination: library
      ? { library_id: library.id, library_name: library.name }
      : null,
    ...(semanticRetrievalStatusId ? { semanticRetrievalStatusId } : {}),
  };
}

/**
 * Reduces a provider response to a server-validated advisory. The model's
 * text and confidence are discarded; it cannot change policy action or route.
 */
export function finalizePolicyCandidateAdjudication({
  contract = null,
  aiMatch = null,
  policyResult = null,
  libraries = [],
  semanticRetrievalStatusId = null,
} = {}) {
  if (contract?.valid !== true) return null;

  const fallback = contract.candidates[0]?.library || null;
  const selectedId = Number(aiMatch?.library?.id);
  const selectedCandidate = contract.candidates.find((candidate) => candidate.libraryId === selectedId) || null;
  const validProposal = selectedCandidate && aiMatch?.needs_clarification !== true &&
    aiMatch?.format === 'confident';
  const responseRejected = aiMatch?.format === 'contract_violation' || aiMatch?.format === 'fallback';
  const statusId = validProposal
    ? POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.PROPOSED
    : (responseRejected
      ? POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.RESPONSE_REJECTED
      : POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.ABSTAINED);
  const selectedLibrary = selectedCandidate?.library || fallback || libraries[0] || null;

  return {
    library: selectedLibrary,
    confidence: policyConfidence(policyResult, contract.candidates[0]?.policyScore),
    method: 'policy_candidate_adjudication',
    reason: 'AI compared only the policy-eligible destinations. An operator decision is still required.',
    needs_clarification: true,
    format: 'candidate_adjudication',
    candidate_adjudication: projection(
      contract,
      statusId,
      validProposal ? selectedCandidate.library : null,
      semanticRetrievalStatusId,
    ),
  };
}
