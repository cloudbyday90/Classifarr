/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createAiProviderCapabilityMetricsFailureBreakdownService,
} from '../services/aiProviderCapabilityMetricsFailureBreakdownService.mjs';

describe('aiProviderCapabilityMetricsFailureBreakdownService', () => {
  test('owns the fixed rolling window and returns the bounded diagnostic report', async () => {
    const database = { query: jest.fn() };
    const loadBreakdown = jest.fn().mockResolvedValue({
      total_failure_count: '1',
      metric_persistence_write_count: '1',
      sqlstate_not_available_count: '1',
    });
    const service = createAiProviderCapabilityMetricsFailureBreakdownService({
      database,
      loadBreakdown,
      now: () => new Date('2026-09-01T12:00:00.000Z'),
    });

    await expect(service.getReport()).resolves.toMatchObject({
      totalFailureCount: '1',
      safeCategoryFailureCount: '1',
      status: { id: 'complete' },
    });
    expect(loadBreakdown).toHaveBeenCalledWith(database, {
      hours: 24,
      start: new Date('2026-08-31T12:00:00.000Z'),
      end: new Date('2026-09-01T12:00:00.000Z'),
    });
  });
});
