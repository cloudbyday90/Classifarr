/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildCandidateBoundVerificationContract,
  buildCandidateBoundVerificationProjection,
  parseCandidateBoundVerificationResponse,
  resolveCandidateBoundVerificationAdmission,
} from '../services/classificationCandidateBoundVerificationContract.mjs';
import { buildAiProviderAuthorityProfile } from '../services/aiProviderAuthority.mjs';

const libraries = [
  { id: 1, name: 'Movies', media_type: 'movie' },
  { id: 2, name: 'TV Shows', media_type: 'tv' },
];

function validContract() {
  return buildCandidateBoundVerificationContract({
    libraries,
    verificationCandidate: { library_id: 1 },
    signalContext: { suggestedLibrary: { id: 1, name: 'Movies' } },
  });
}

describe('classificationCandidateBoundVerificationContract', () => {
  test('binds only the policy and deterministic candidates that resolve to the same active library', () => {
    expect(validContract()).toMatchObject({
      valid: true,
      candidate: {
        libraryId: 1,
        libraryNumber: 1,
        libraryName: 'Movies',
      },
    });

    expect(buildCandidateBoundVerificationContract({
      libraries,
      verificationCandidate: { library_id: 1 },
      signalContext: { suggestedLibrary: { id: 2, name: 'TV Shows' } },
    })).toMatchObject({ valid: false, reasonCode: 'candidate_mismatch' });
  });

  test('admits only contract-grade verification providers', () => {
    const contract = validContract();
    const openAiAuthority = buildAiProviderAuthorityProfile({
      providerId: 'openai',
      model: 'gpt-4o',
      requestedMode: 'verification',
    });
    const localAuthority = buildAiProviderAuthorityProfile({
      providerId: 'ollama',
      model: 'qwen3',
      requestedMode: 'verification',
    });

    expect(resolveCandidateBoundVerificationAdmission({ contract, authority: openAiAuthority }))
      .toMatchObject({ admitted: true, statusId: 'admitted' });
    expect(resolveCandidateBoundVerificationAdmission({ contract, authority: localAuthority }))
      .toMatchObject({ admitted: false, statusId: 'provider_capability_unavailable' });
  });

  test('accepts only the strict response object and drops all model prose from the projection', () => {
    expect(parseCandidateBoundVerificationResponse('{"decision":"CONFIRM","reason":"Signals align"}'))
      .toMatchObject({ valid: true, decision: 'CONFIRM' });
    expect(parseCandidateBoundVerificationResponse('CONFIRM|1|Signals align'))
      .toMatchObject({ valid: false, statusId: 'contract_violation' });
    expect(parseCandidateBoundVerificationResponse('{"decision":"CONFIRM","reason":"Signals align","library_number":1}'))
      .toMatchObject({ valid: false, statusId: 'contract_violation' });
    expect(buildCandidateBoundVerificationProjection({
      version: 'classification.candidate_bound_verification.v1',
      status_id: 'confirmed',
      raw_reason: 'Signals align',
    }))
      .toEqual({
        version: 'classification.candidate_bound_verification.v1',
        status_id: 'confirmed',
      });
  });
});
