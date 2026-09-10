/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CANDIDATE_BOUND_VERIFICATION_STATUS_IDS,
} from './classificationCandidateBoundVerificationContract.mjs';
import {
  CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS,
} from './classificationDeterministicAiMode.mjs';

export const CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_VERSION =
  'classification.candidate_adjudication_fallback.v1';

export const CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_REASON_IDS = Object.freeze({
  ADJUDICATION_CONTRACT_UNAVAILABLE: 'adjudication_contract_unavailable',
  NOT_VERIFICATION_MODE: 'not_verification_mode',
  PROVIDER_CAPABILITY_UNAVAILABLE: 'provider_capability_unavailable',
  VERIFICATION_ABSTAINED: 'verification_abstained',
  VERIFICATION_RETAINED: 'verification_retained',
});

const FALLBACK_VERIFICATION_STATUS_IDS = new Set([
  CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.ABSTAINED,
  CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.PROVIDER_CAPABILITY_UNAVAILABLE,
]);

function buildDecision({ shouldInvoke, reasonCode }) {
  return Object.freeze({
    version: CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_VERSION,
    shouldInvoke,
    reasonCode,
  });
}

/**
 * A strict verifier can only confirm or abstain from the policy-selected
 * destination. If it abstains, this resolver permits one existing bounded
 * comparison of the same server-owned alternatives. The comparison remains
 * advisory and cannot route or expand the candidate set.
 */
export function resolveCandidateAdjudicationFallback({
  aiModeDecision = null,
  candidateAdjudication = null,
  verificationResult = null,
} = {}) {
  if (aiModeDecision?.mode !== CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.VERIFY) {
    return buildDecision({
      shouldInvoke: false,
      reasonCode: CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_REASON_IDS.NOT_VERIFICATION_MODE,
    });
  }

  if (candidateAdjudication?.valid !== true) {
    return buildDecision({
      shouldInvoke: false,
      reasonCode: CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_REASON_IDS
        .ADJUDICATION_CONTRACT_UNAVAILABLE,
    });
  }

  const verificationStatusId = verificationResult?.candidate_bound_verification?.status_id;
  if (!FALLBACK_VERIFICATION_STATUS_IDS.has(verificationStatusId)) {
    return buildDecision({
      shouldInvoke: false,
      reasonCode: CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_REASON_IDS.VERIFICATION_RETAINED,
    });
  }

  return buildDecision({
    shouldInvoke: true,
    reasonCode: verificationStatusId === CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.ABSTAINED
      ? CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_REASON_IDS.VERIFICATION_ABSTAINED
      : CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_REASON_IDS
        .PROVIDER_CAPABILITY_UNAVAILABLE,
  });
}
