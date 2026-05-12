/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { resolveAiProviderRequest } from '../services/shared/aiSettingsRequestSupport.mjs';

describe('aiSettingsRequestSupport', () => {
  test('resolveAiProviderRequest preserves provider fields and resolves the API key with stored fallback', async () => {
    const resolveRequestApiKey = jest.fn().mockResolvedValue('stored-live-key');

    await expect(resolveAiProviderRequest({
      body: {
        primary_provider: 'openai',
        api_endpoint: 'https://api.openai.com/v1',
        api_key: '••••••••abcd',
      },
      dbOrClient: { query: jest.fn() },
      resolveRequestApiKey,
    })).resolves.toEqual({
      primary_provider: 'openai',
      api_endpoint: 'https://api.openai.com/v1',
      api_key: 'stored-live-key',
    });

    expect(resolveRequestApiKey).toHaveBeenCalledWith({
      dbOrClient: expect.any(Object),
      table: 'ai_provider_config',
      submittedApiKey: '••••••••abcd',
      allowStoredFallback: true,
    });
  });

  test('resolveAiProviderRequest allows the caller to receive an empty resolved API key', async () => {
    const resolveRequestApiKey = jest.fn().mockResolvedValue('');

    await expect(resolveAiProviderRequest({
      body: {
        primary_provider: 'openai',
      },
      dbOrClient: { query: jest.fn() },
      resolveRequestApiKey,
    })).resolves.toEqual({
      primary_provider: 'openai',
      api_endpoint: undefined,
      api_key: '',
    });
  });
});
