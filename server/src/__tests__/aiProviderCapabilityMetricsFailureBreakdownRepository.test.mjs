/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
  AI_PROVIDER_CAPABILITY_METRICS_SQLSTATE_CATEGORY_IDS,
} from '../services/aiProviderCapabilityMetricsFailureCategories.mjs';
import {
  LOAD_AI_PROVIDER_CAPABILITY_METRICS_FAILURE_BREAKDOWN_SQL,
  loadAiProviderCapabilityMetricsFailureBreakdown,
} from '../services/aiProviderCapabilityMetricsFailureBreakdownRepository.mjs';
import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from '../services/aiProviderCapabilityMetricsLogging.mjs';

describe('aiProviderCapabilityMetricsFailureBreakdownRepository', () => {
  test('uses fixed parameterized category values and never selects raw diagnostics', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ total_failure_count: '1' }] }),
    };
    const start = new Date('2026-08-31T12:00:00.000Z');
    const end = new Date('2026-09-01T12:00:00.000Z');

    await expect(loadAiProviderCapabilityMetricsFailureBreakdown(database, { start, end }))
      .resolves.toEqual({ total_failure_count: '1' });

    const [sql, params] = database.query.mock.calls[0];
    expect(sql).toBe(LOAD_AI_PROVIDER_CAPABILITY_METRICS_FAILURE_BREAKDOWN_SQL);
    expect(sql).toContain('COUNT(*)::text AS total_failure_count');
    expect(sql).toContain("metadata->>'capabilityMetricsFailureStage' = $6");
    expect(sql).toContain('sqlstate_connection_exception_count');
    expect(sql).not.toContain('provider_id');
    expect(sql).not.toContain('model =');
    expect(sql).not.toContain('stack_trace');
    expect(sql).not.toContain('SELECT metadata');
    expect(params).toEqual([
      start.toISOString(),
      end.toISOString(),
      AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
      AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
      ...AI_PROVIDER_CAPABILITY_METRICS_SQLSTATE_CATEGORY_IDS,
    ]);
  });

  test('rejects malformed windows before querying', async () => {
    const database = { query: jest.fn() };

    await expect(loadAiProviderCapabilityMetricsFailureBreakdown(database, {
      start: new Date('2026-09-01T12:00:00.000Z'),
      end: new Date('2026-08-31T12:00:00.000Z'),
    })).rejects.toThrow('valid capability-metrics failure-breakdown range');

    expect(database.query).not.toHaveBeenCalled();
  });
});
