/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createAiProviderCapabilityMetricsHealthService,
} from '../services/aiProviderCapabilityMetricsHealthService.mjs';

describe('aiProviderCapabilityMetricsHealthService', () => {
  test('owns the fixed rolling window and returns a status-only report', async () => {
    const database = { query: jest.fn() };
    const loadHealth = jest.fn().mockResolvedValue({
      active_metric_stream_count: '1',
      persistence_failure_count: '0',
    });
    const service = createAiProviderCapabilityMetricsHealthService({
      database,
      loadHealth,
      now: () => new Date('2026-08-31T13:00:00.000Z'),
    });

    await expect(service.getReport()).resolves.toMatchObject({
      activeMetricStreamCount: '1',
      persistenceFailureCount: '0',
      status: { id: 'operational' },
    });
    expect(loadHealth).toHaveBeenCalledWith(database, {
      hours: 24,
      start: new Date('2026-08-30T13:00:00.000Z'),
      end: new Date('2026-08-31T13:00:00.000Z'),
    });
  });
});
