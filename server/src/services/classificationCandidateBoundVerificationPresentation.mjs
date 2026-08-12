/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CANDIDATE_BOUND_VERIFICATION_STATUS_IDS,
  buildCandidateBoundVerificationProjection,
} from './classificationCandidateBoundVerificationContract.mjs';

export const CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_PRESENTATION_VERSION =
  'classification.candidate_bound_verification_presentation.v1';

const STATUS_PRESENTATIONS = Object.freeze({
  [CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.ADMITTED]: Object.freeze({
    label: 'Candidate verification admitted',
    message: 'The configured provider satisfied the candidate-bound verification requirements. No verification outcome was retained for this item.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CONFIRMED]: Object.freeze({
    label: 'Candidate verification confirmed',
    message: 'An admitted AI provider confirmed the policy-selected destination. It did not select the destination or determine whether this item can route.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.ABSTAINED]: Object.freeze({
    label: 'Candidate verification abstained',
    message: 'An admitted AI provider did not confirm the policy-selected destination. No model explanation was retained; review the deterministic evidence before confirming.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CONTRACT_VIOLATION]: Object.freeze({
    label: 'Candidate verification response rejected',
    message: 'The AI response did not meet the required verification contract. It was not used to select a destination; review the deterministic evidence before confirming.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CANDIDATE_UNAVAILABLE]: Object.freeze({
    label: 'Candidate verification unavailable',
    message: 'No verification request was sent because the selected policy candidate was unavailable. Review the current deterministic evidence before confirming.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.CANDIDATE_MISMATCH]: Object.freeze({
    label: 'Candidate verification unavailable',
    message: 'No verification request was sent because the policy path and deterministic signal did not select the same candidate. Review the current deterministic evidence before confirming.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.PROVIDER_CAPABILITY_UNAVAILABLE]: Object.freeze({
    label: 'Candidate verification unavailable',
    message: 'No verification request was sent because the configured provider is not admitted for candidate-bound verification. The policy candidate remains available for your review.',
  }),
});

/**
 * Converts the status-only persistence projection into fixed, operator-safe
 * language. Model text, provider identity, candidate identifiers, prompts,
 * and response content are deliberately not accepted as input.
 */
export function buildCandidateBoundVerificationPresentation(value = {}) {
  const projection = buildCandidateBoundVerificationProjection(value);
  const definition = projection
    ? STATUS_PRESENTATIONS[projection.status_id]
    : null;

  if (!definition) return null;

  return Object.freeze({
    version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_PRESENTATION_VERSION,
    status_id: projection.status_id,
    label: definition.label,
    message: definition.message,
  });
}
