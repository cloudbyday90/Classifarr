/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_AUTHORITY_MODE_IDS,
  buildAiProviderAuthorityProfile,
} from '../../services/aiProviderAuthority.mjs';
import {
  attachAiProviderAuthorityToClassificationResult,
} from '../../services/classificationAiAuthorityAttachment.mjs';

describe('classificationAiAuthorityAttachment', () => {
  test('adds the server-owned advisory authority view without exposing a route permission', () => {
    const result = { library: { id: 1 }, confidence: 91 };
    const authority = buildAiProviderAuthorityProfile({
      providerId: 'openai',
      model: 'gpt-4.1',
      requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
    });

    expect(attachAiProviderAuthorityToClassificationResult({ result, authority }))
      .toEqual(expect.objectContaining({
        ai_authority: expect.objectContaining({
          effectiveMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
          sideEffects: expect.objectContaining({
            canRoute: false,
            canLearn: false,
            canMutatePolicy: false,
          }),
        }),
      }));
  });

  test('preserves an absent parse result', () => {
    expect(attachAiProviderAuthorityToClassificationResult({ result: null })).toBeNull();
  });
});
