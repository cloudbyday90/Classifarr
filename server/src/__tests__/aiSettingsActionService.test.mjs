/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { createAiSettingsActionService } from '../services/aiSettingsActionService.mjs';

describe('aiSettingsActionService', () => {
  test('testConnection resolves the request config and delegates to cloudLLMService', async () => {
    const requestConfig = { primary_provider: 'openai', api_key: 'live-key' };
    const cloudLLMService = {
      testConnection: jest.fn().mockResolvedValue({ success: true, provider: 'openai' }),
    };
    const resolveAiProviderRequest = jest.fn().mockResolvedValue(requestConfig);
    const aiSettingsActionService = createAiSettingsActionService({
      cloudLLMService,
      resolveAiProviderRequest,
    });

    await expect(aiSettingsActionService.testConnection({
      body: { primary_provider: 'openai' },
      dbOrClient: { query: jest.fn() },
      resolveRequestApiKey: jest.fn(),
    })).resolves.toEqual({ success: true, provider: 'openai' });
    expect(resolveAiProviderRequest).toHaveBeenCalledWith({
      body: { primary_provider: 'openai' },
      dbOrClient: expect.any(Object),
      resolveRequestApiKey: expect.any(Function),
    });
    expect(cloudLLMService.testConnection).toHaveBeenCalledWith(requestConfig);
  });

  test('testConnection rejects with httpStatus 400 when no API key is available', async () => {
    const aiSettingsActionService = createAiSettingsActionService({
      cloudLLMService: {
        testConnection: jest.fn(),
      },
      resolveAiProviderRequest: jest.fn().mockResolvedValue({ primary_provider: 'openai', api_key: '' }),
    });

    await expect(aiSettingsActionService.testConnection({
      body: {},
      dbOrClient: { query: jest.fn() },
      resolveRequestApiKey: jest.fn(),
    })).rejects.toMatchObject({
      message: 'API key is required',
      httpStatus: 400,
    });
  });

  test('getModels resolves the request config and returns the stable success payload', async () => {
    const requestConfig = { primary_provider: 'openai', api_key: 'live-key' };
    const cloudLLMService = {
      getModels: jest.fn().mockResolvedValue(['gpt-5.2']),
    };
    const aiSettingsActionService = createAiSettingsActionService({
      cloudLLMService,
      resolveAiProviderRequest: jest.fn().mockResolvedValue(requestConfig),
    });

    await expect(aiSettingsActionService.getModels({
      body: { primary_provider: 'openai' },
      dbOrClient: { query: jest.fn() },
      resolveRequestApiKey: jest.fn(),
    })).resolves.toEqual({
      success: true,
      models: ['gpt-5.2'],
    });
    expect(cloudLLMService.getModels).toHaveBeenCalledWith(requestConfig);
  });

  test('getModels rejects with httpStatus 400 when no API key is available', async () => {
    const aiSettingsActionService = createAiSettingsActionService({
      cloudLLMService: {
        getModels: jest.fn(),
      },
      resolveAiProviderRequest: jest.fn().mockResolvedValue({ primary_provider: 'openai', api_key: '' }),
    });

    await expect(aiSettingsActionService.getModels({
      body: {},
      dbOrClient: { query: jest.fn() },
      resolveRequestApiKey: jest.fn(),
    })).rejects.toMatchObject({
      message: 'API key is required',
      httpStatus: 400,
    });
  });

  test('resetUsage delegates to cloudLLMService and returns the stable success payload', async () => {
    const cloudLLMService = {
      resetMonthlyUsage: jest.fn().mockResolvedValue(undefined),
    };
    const aiSettingsActionService = createAiSettingsActionService({ cloudLLMService });

    await expect(aiSettingsActionService.resetUsage()).resolves.toEqual({
      success: true,
      message: 'Monthly usage reset successfully',
    });
    expect(cloudLLMService.resetMonthlyUsage).toHaveBeenCalledTimes(1);
  });

  test('resetUsage propagates resetMonthlyUsage failures', async () => {
    const cloudLLMService = {
      resetMonthlyUsage: jest.fn().mockRejectedValue(new Error('reset failed')),
    };
    const aiSettingsActionService = createAiSettingsActionService({ cloudLLMService });

    await expect(aiSettingsActionService.resetUsage()).rejects.toThrow('reset failed');
  });
});
