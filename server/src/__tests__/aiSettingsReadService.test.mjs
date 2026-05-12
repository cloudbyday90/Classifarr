/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../services/shared/aiSettingsDefaults.mjs', () => ({
  getDefaultAiSettingsConfig: jest.fn(() => ({ mocked_default: true })),
}));

const { createAiSettingsReadService } = await import('../services/aiSettingsReadService.mjs');
const { getDefaultAiSettingsConfig } = await import('../services/shared/aiSettingsDefaults.mjs');

describe('aiSettingsReadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getConfig returns the default config when no row exists', async () => {
    const getRagLoopDefaultConfig = jest.fn(() => ({ rag_graph_enabled: false }));
    const aiSettingsReadService = createAiSettingsReadService({
      db: {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      },
      aiRouterService: { getStatus: jest.fn() },
      getRagLoopDefaultConfig,
    });

    await expect(aiSettingsReadService.getConfig()).resolves.toEqual({ mocked_default: true });
    expect(getDefaultAiSettingsConfig).toHaveBeenCalledWith(getRagLoopDefaultConfig);
  });

  test('getConfig finalizes a stored config and strips internal state through the response helper', async () => {
    const config = {
      id: 1,
      primary_provider: 'openai',
    };
    const validateAndNormalizeRagLoopConfig = jest.fn(() => ({
      normalizedConfig: {
        image_embedding_provider_mode: 'disabled',
      },
    }));
    const finalizeAiSettingsResponseConfig = jest.fn((payload) => {
      Object.assign(payload.config, payload.normalizedConfig, { api_key: '***masked***' });
      return payload.config;
    });
    const aiSettingsReadService = createAiSettingsReadService({
      db: {
        query: jest.fn().mockResolvedValue({ rows: [config] }),
      },
      aiRouterService: { getStatus: jest.fn() },
      validateAndNormalizeRagLoopConfig,
      finalizeAiSettingsResponseConfig,
      parseEncryptedValue: jest.fn(),
      decryptValue: jest.fn(),
    });

    await expect(aiSettingsReadService.getConfig()).resolves.toEqual({
      id: 1,
      primary_provider: 'openai',
      image_embedding_provider_mode: 'disabled',
      api_key: '***masked***',
    });
    expect(validateAndNormalizeRagLoopConfig).toHaveBeenCalledWith(config, config);
    expect(finalizeAiSettingsResponseConfig).toHaveBeenCalledWith({
      config,
      normalizedConfig: {
        image_embedding_provider_mode: 'disabled',
      },
      parseEncryptedValue: expect.any(Function),
      decryptValue: expect.any(Function),
      stripInternalState: true,
    });
  });

  test('getConfig returns the table-not-ready fallback when the settings table is missing', async () => {
    const tableMissing = new Error('relation "ai_provider_config" does not exist');
    tableMissing.code = '42P01';
    const getRagLoopDefaultConfig = jest.fn(() => ({ rag_graph_enabled: false }));
    const aiSettingsReadService = createAiSettingsReadService({
      db: {
        query: jest.fn().mockRejectedValue(tableMissing),
      },
      aiRouterService: { getStatus: jest.fn() },
      getRagLoopDefaultConfig,
    });

    await expect(aiSettingsReadService.getConfig()).resolves.toEqual({ mocked_default: true });
    expect(getDefaultAiSettingsConfig).toHaveBeenCalledWith(getRagLoopDefaultConfig, {
      table_not_ready: true,
    });
  });

  test('getUsageSummary parses usage, budget, and recent request rows', async () => {
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            total_requests: '12',
            total_tokens: '3456',
            total_cost: '4.50',
            avg_cost_per_call: '0.375',
            successful_requests: '9',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            total_requests: '8',
            total_tokens: '2222',
            total_cost_usd: '3.25',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            monthly_budget_usd: '10',
            current_month_usage_usd: '4.5',
            budget_alert_threshold: 75,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ provider: 'openai', model: 'gpt-5.2' }],
        }),
    };
    const aiSettingsReadService = createAiSettingsReadService({
      db,
      aiRouterService: { getStatus: jest.fn() },
    });

    await expect(aiSettingsReadService.getUsageSummary()).resolves.toEqual({
      currentMonth: {
        requests: 12,
        tokens: 3456,
        cost: 4.5,
        avgCostPerCall: 0.375,
        successRate: 75,
      },
      lastMonth: {
        requests: 8,
        tokens: 2222,
        cost: 3.25,
      },
      budget: {
        limit: 10,
        used: 4.5,
        alertThreshold: 75,
        percentUsed: 45,
      },
      recentRequests: [{ provider: 'openai', model: 'gpt-5.2' }],
    });
  });

  test('getUsageFallback returns the stable zeroed payload', () => {
    const aiSettingsReadService = createAiSettingsReadService({
      db: { query: jest.fn() },
      aiRouterService: { getStatus: jest.fn() },
    });

    expect(aiSettingsReadService.getUsageFallback()).toEqual({
      currentMonth: { requests: 0, tokens: 0, cost: 0, avgCostPerCall: 0 },
      lastMonth: { requests: 0, tokens: 0, cost: 0 },
      budget: { limit: null, used: 0, alertThreshold: 80 },
      recentRequests: [],
    });
  });

  test('getStatus delegates to aiRouterService', async () => {
    const aiRouterService = {
      getStatus: jest.fn().mockResolvedValue({ activeProvider: 'openai', configured: true }),
    };
    const aiSettingsReadService = createAiSettingsReadService({
      db: { query: jest.fn() },
      aiRouterService,
    });

    await expect(aiSettingsReadService.getStatus()).resolves.toEqual({
      activeProvider: 'openai',
      configured: true,
    });
    expect(aiRouterService.getStatus).toHaveBeenCalledTimes(1);
  });
});
