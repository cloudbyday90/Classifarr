/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { createAiSettingsReadService } from '../services/aiSettingsReadService.mjs';

describe('aiSettingsReadService', () => {
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
