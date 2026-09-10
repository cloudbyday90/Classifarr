/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_REASON_IDS,
  CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_VERSION,
  resolveCandidateAdjudicationFallback,
} from '../../services/classificationCandidateAdjudicationFallback.mjs';

const verificationMode = {
  mode: 'verify',
  shouldInvoke: true,
};

const adjudicationContract = {
  valid: true,
  candidates: [{ libraryId: 1 }, { libraryId: 2 }],
};

function verificationResult(statusId) {
  return {
    candidate_bound_verification: {
      version: 'classification.candidate_bound_verification.v1',
      status_id: statusId,
    },
  };
}

describe('resolveCandidateAdjudicationFallback', () => {
  test.each([
    ['abstained', 'verification_abstained'],
    ['provider_capability_unavailable', 'provider_capability_unavailable'],
  ])('permits one bounded advisory comparison after verification is %s', (statusId, reasonCode) => {
    expect(resolveCandidateAdjudicationFallback({
      aiModeDecision: verificationMode,
      candidateAdjudication: adjudicationContract,
      verificationResult: verificationResult(statusId),
    })).toEqual({
      version: CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_VERSION,
      shouldInvoke: true,
      reasonCode,
    });
  });

  test.each([
    ['confirmed', 'verification_retained'],
    ['contract_violation', 'verification_retained'],
    ['candidate_mismatch', 'verification_retained'],
  ])('does not use adjudication to mask a verification %s result', (statusId, reasonCode) => {
    expect(resolveCandidateAdjudicationFallback({
      aiModeDecision: verificationMode,
      candidateAdjudication: adjudicationContract,
      verificationResult: verificationResult(statusId),
    })).toMatchObject({ shouldInvoke: false, reasonCode });
  });

  test('requires both verification mode and a valid server-owned candidate contract', () => {
    expect(resolveCandidateAdjudicationFallback({
      aiModeDecision: { mode: 'adjudicate' },
      candidateAdjudication: adjudicationContract,
      verificationResult: verificationResult('abstained'),
    })).toMatchObject({
      shouldInvoke: false,
      reasonCode: CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_REASON_IDS.NOT_VERIFICATION_MODE,
    });

    expect(resolveCandidateAdjudicationFallback({
      aiModeDecision: verificationMode,
      candidateAdjudication: { valid: false },
      verificationResult: verificationResult('abstained'),
    })).toMatchObject({
      shouldInvoke: false,
      reasonCode: CLASSIFICATION_CANDIDATE_ADJUDICATION_FALLBACK_REASON_IDS
        .ADJUDICATION_CONTRACT_UNAVAILABLE,
    });
  });
});
