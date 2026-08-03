/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_AUTHORITY_MODE_IDS,
  buildAiProviderAuthorityProfile,
  buildAiProviderAuthorityView,
  isAiProviderAuthorityModeAvailable,
  isAiProviderAuthorityModeGranted,
} from '../../services/aiProviderAuthority.mjs';

describe('aiProviderAuthority', () => {
  test('grants contract modes only to supported, non-reasoning cloud adapters', () => {
    const profile = buildAiProviderAuthorityProfile({
      providerId: 'openai',
      model: 'gpt-4.1',
      requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.STRUCTURED_CONTRACT,
    });

    expect(profile.effectiveMode).toBe(AI_PROVIDER_AUTHORITY_MODE_IDS.STRUCTURED_CONTRACT);
    expect(profile.capabilities.providerEnforcedStructuredOutput).toBe(true);
    expect(isAiProviderAuthorityModeAvailable(profile, AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION)).toBe(true);
    expect(isAiProviderAuthorityModeGranted(profile, AI_PROVIDER_AUTHORITY_MODE_IDS.STRUCTURED_CONTRACT)).toBe(true);
  });

  test('downgrades local and reasoning models out of contract authority', () => {
    const localProfile = buildAiProviderAuthorityProfile({
      providerId: 'ollama',
      model: 'qwen3:8b',
      requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.STRUCTURED_CONTRACT,
    });
    const reasoningProfile = buildAiProviderAuthorityProfile({
      providerId: 'openai',
      model: 'gpt-5',
      requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.STRUCTURED_CONTRACT,
    });

    expect(localProfile.effectiveMode).toBe(AI_PROVIDER_AUTHORITY_MODE_IDS.PROPOSAL);
    expect(localProfile.downgraded).toBe(true);
    expect(localProfile.capabilities.providerEnforcedStructuredOutput).toBe(false);
    expect(reasoningProfile.effectiveMode).toBe(AI_PROVIDER_AUTHORITY_MODE_IDS.PROPOSAL);
    expect(reasoningProfile.supportedModeIds).not.toContain(AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION);
  });

  test('honors a disabled request without treating the provider as unavailable', () => {
    const profile = buildAiProviderAuthorityProfile({
      providerId: 'openai',
      model: 'gpt-4.1',
      requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.DISABLED,
    });

    expect(profile.effectiveMode).toBe(AI_PROVIDER_AUTHORITY_MODE_IDS.DISABLED);
    expect(profile.downgraded).toBe(false);
  });

  test('makes every fallback advisory and disabled provider inert', () => {
    const fallbackProfile = buildAiProviderAuthorityProfile({
      providerId: 'ollama',
      model: 'llama3.2',
      requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.PROPOSAL,
      isFallback: true,
    });
    const disabledProfile = buildAiProviderAuthorityProfile({ providerId: 'none' });

    expect(fallbackProfile.effectiveMode).toBe(AI_PROVIDER_AUTHORITY_MODE_IDS.FALLBACK_ADVISORY);
    expect(disabledProfile.effectiveMode).toBe(AI_PROVIDER_AUTHORITY_MODE_IDS.DISABLED);
    expect(disabledProfile.supportedModeIds).toEqual([AI_PROVIDER_AUTHORITY_MODE_IDS.DISABLED]);

    const view = buildAiProviderAuthorityView(fallbackProfile);
    expect(view.sideEffects).toEqual({
      canRoute: false,
      canLearn: false,
      canMutatePolicy: false,
      canNotify: false,
      canCallProviders: false,
      canWriteDomainData: false,
    });
  });
});
