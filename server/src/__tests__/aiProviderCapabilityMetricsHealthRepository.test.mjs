/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
  loadAiProviderCapabilityMetricsHealth,
} from '../services/aiProviderCapabilityMetricsHealthRepository.mjs';

describe('aiProviderCapabilityMetricsHealthRepository', () => {
  test('reads a fixed, dimension-free aggregate with parameterized service identifiers', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [{
          active_metric_stream_count: '2',
          persistence_failure_count: '1',
        }],
      }),
    };
    const start = new Date('2026-08-30T13:00:00.000Z');
    const end = new Date('2026-08-31T13:00:00.000Z');

    await expect(loadAiProviderCapabilityMetricsHealth(database, { start, end }))
      .resolves.toEqual({ active_metric_stream_count: '2', persistence_failure_count: '1' });

    const [sql, params] = database.query.mock.calls[0];
    expect(sql).toContain('COUNT(*)::text AS active_metric_stream_count');
    expect(sql).toContain('COUNT(*)::text AS persistence_failure_count');
    expect(sql).toContain('module = $3');
    expect(sql).toContain('message = $4');
    expect(sql).toContain("metadata->>'reasonCode' = $5");
    expect(sql).not.toContain('provider_id =');
    expect(sql).not.toContain('model =');
    expect(sql).not.toContain('prompt');
    expect(sql).not.toContain('response');
    expect(params).toEqual([
      start.toISOString(),
      end.toISOString(),
      AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
    ]);
  });

  test('rejects malformed ranges before querying the database', async () => {
    const database = { query: jest.fn() };

    await expect(loadAiProviderCapabilityMetricsHealth(database, {
      start: new Date('2026-08-31T13:00:00.000Z'),
      end: new Date('2026-08-30T13:00:00.000Z'),
    })).rejects.toThrow('valid capability-metrics health observation range');

    expect(database.query).not.toHaveBeenCalled();
  });
});
