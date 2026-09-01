/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from '../services/aiProviderCapabilityMetricsLogging.mjs';
import {
  LOAD_AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_SQL,
  loadAiProviderCapabilityMetricsHealthTrend,
} from '../services/aiProviderCapabilityMetricsHealthTrendRepository.mjs';

function buildWindow() {
  return {
    periods: [
      { id: 'baseline', start: new Date('2026-08-29T00:00:00.000Z'), end: new Date('2026-08-30T00:00:00.000Z') },
      { id: 'previous', start: new Date('2026-08-30T00:00:00.000Z'), end: new Date('2026-08-31T00:00:00.000Z') },
      { id: 'current', start: new Date('2026-08-31T00:00:00.000Z'), end: new Date('2026-09-01T00:00:00.000Z') },
    ],
  };
}

describe('aiProviderCapabilityMetricsHealthTrendRepository', () => {
  test('reads only fixed, parameterized three-period aggregates with no provider dimensions', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ period_id: 'current' }] }),
    };

    await expect(loadAiProviderCapabilityMetricsHealthTrend(database, buildWindow()))
      .resolves.toEqual([{ period_id: 'current' }]);

    const [sql, params] = database.query.mock.calls[0];
    expect(sql).toBe(LOAD_AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_SQL);
    expect(sql).toContain("('baseline'::text, $1::timestamptz, $2::timestamptz)");
    expect(sql).toContain('COUNT(metrics.last_observed_at)::text AS active_metric_stream_count');
    expect(sql).toContain('COUNT(error_log.created_at)::text AS persistence_failure_count');
    expect(sql).toContain('error_log.module = $7');
    expect(sql).toContain("error_log.metadata->>'reasonCode' = $9");
    expect(sql).not.toContain('provider_id =');
    expect(sql).not.toContain('model =');
    expect(sql).not.toContain('prompt');
    expect(sql).not.toContain('response');
    expect(params).toEqual([
      '2026-08-29T00:00:00.000Z',
      '2026-08-30T00:00:00.000Z',
      '2026-08-30T00:00:00.000Z',
      '2026-08-31T00:00:00.000Z',
      '2026-08-31T00:00:00.000Z',
      '2026-09-01T00:00:00.000Z',
      AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
    ]);
  });

  test('rejects malformed, duplicate, or non-adjacent periods before querying', async () => {
    const database = { query: jest.fn() };
    const malformed = buildWindow();
    malformed.periods[2] = { ...malformed.periods[2], id: 'previous' };

    await expect(loadAiProviderCapabilityMetricsHealthTrend(database, malformed))
      .rejects.toThrow('fixed three-window capability-metrics health trend range');

    const nonAdjacent = buildWindow();
    nonAdjacent.periods[2] = {
      ...nonAdjacent.periods[2],
      start: new Date('2026-09-02T00:00:00.000Z'),
      end: new Date('2026-09-03T00:00:00.000Z'),
    };
    await expect(loadAiProviderCapabilityMetricsHealthTrend(database, nonAdjacent))
      .rejects.toThrow('fixed three-window capability-metrics health trend range');

    expect(database.query).not.toHaveBeenCalled();
  });
});
