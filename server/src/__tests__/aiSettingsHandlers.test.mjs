/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const persistAiSettingsConfig = jest.fn();
const finalizeAiSettingsResponseConfig = jest.fn();
const sendAiSettingsConfigErrorResponse = jest.fn();
const createAiSettingsActionService = jest.fn(() => ({
  testConnection: jest.fn(),
  getModels: jest.fn(),
  resetUsage: jest.fn(),
}));
const createAiSettingsReadService = jest.fn(() => ({
  getConfig: jest.fn(),
  getUsageSummary: jest.fn(),
  getUsageFallback: jest.fn(),
  getStatus: jest.fn(),
}));

jest.unstable_mockModule('../routes/helpers/aiSettingsPersistence.mjs', () => ({
  persistAiSettingsConfig,
}));

jest.unstable_mockModule('../routes/helpers/aiSettingsResponseSupport.mjs', () => ({
  finalizeAiSettingsResponseConfig,
  sendAiSettingsConfigErrorResponse,
}));

jest.unstable_mockModule('../services/aiSettingsActionService.mjs', () => ({
  createAiSettingsActionService,
}));

jest.unstable_mockModule('../services/aiSettingsReadService.mjs', () => ({
  createAiSettingsReadService,
}));

const { createAiSettingsHandlers } = await import('../routes/helpers/aiSettingsHandlers.mjs');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function resetAiSettingsHandlerModuleMocks() {
  persistAiSettingsConfig.mockReset();
  finalizeAiSettingsResponseConfig.mockReset();
  sendAiSettingsConfigErrorResponse.mockReset();
  createAiSettingsActionService.mockReset();
  createAiSettingsReadService.mockReset();

  sendAiSettingsConfigErrorResponse.mockReturnValue(undefined);
  createAiSettingsActionService.mockReturnValue({
    testConnection: jest.fn(),
    getModels: jest.fn(),
    resetUsage: jest.fn(),
  });
  createAiSettingsReadService.mockReturnValue({
    getConfig: jest.fn(),
    getUsageSummary: jest.fn(),
    getUsageFallback: jest.fn(),
    getStatus: jest.fn(),
  });
}

describe('aiSettingsHandlers', () => {
  beforeEach(() => {
    resetAiSettingsHandlerModuleMocks();
  });

  test('updateConfig preserves a successful response when runtime refresh fails after persistence', async () => {
    const persistedConfig = { model: 'gpt-5.4' };
    persistAiSettingsConfig.mockResolvedValue(persistedConfig);

    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    const db = {
      withTransaction: jest.fn(async (callback) => callback({ query: jest.fn() })),
    };
    const handlers = createAiSettingsHandlers({
      db,
      logger,
      cloudLLMService: {},
      aiRouterService: {
        clearCache: jest.fn(() => {
          throw new Error('router cache failed');
        }),
      },
      ollamaService: { resetConfig: jest.fn() },
      embeddingProvider: { resetConfig: jest.fn() },
      embeddingRouter: { resetConfig: jest.fn() },
      getRagLoopDefaultConfig: jest.fn(() => ({})),
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
      validateRagLoopConfigPayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] })),
      resolveRequestApiKey: jest.fn(),
      parseEncryptedValue: jest.fn(),
      decryptValue: jest.fn(),
    });
    const res = createResponse();

    await handlers.updateConfig({ body: { model: 'gpt-5.4' } }, res);

    expect(res.json).toHaveBeenCalledWith(persistedConfig);
    expect(finalizeAiSettingsResponseConfig).toHaveBeenCalledWith({
      config: persistedConfig,
      parseEncryptedValue: expect.any(Function),
      decryptValue: expect.any(Function),
    });
    expect(logger.warn).toHaveBeenCalledWith('Settings runtime refresh failed after config update', {
      context: 'ai-settings',
      action: 'ai-router-cache',
      error: 'router cache failed',
    });
  });

  test('updateConfig forwards formula-weight extras to the shared error response', async () => {
    const error = new Error('invalid weights');
    error.currentSum = 1.2;
    persistAiSettingsConfig.mockRejectedValue(error);

    const handlers = createAiSettingsHandlers({
      db: {
        withTransaction: jest.fn(async (callback) => callback({ query: jest.fn() })),
      },
      logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
      cloudLLMService: {},
      aiRouterService: { clearCache: jest.fn() },
      ollamaService: { resetConfig: jest.fn() },
      embeddingProvider: { resetConfig: jest.fn() },
      embeddingRouter: { resetConfig: jest.fn() },
      getRagLoopDefaultConfig: jest.fn(() => ({})),
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
      validateRagLoopConfigPayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] })),
      resolveRequestApiKey: jest.fn(),
    });
    const res = createResponse();

    await handlers.updateConfig({ body: { formula_pattern_weight: 0.5 } }, res);

    expect(sendAiSettingsConfigErrorResponse).toHaveBeenCalledWith(res, error, {
      extras: { currentSum: 1.2 },
    });
  });
});
