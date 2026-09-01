/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_VERSION,
  buildAiProviderCapabilityMetricsHealthTrendReport,
  buildAiProviderCapabilityMetricsHealthTrendWindow,
} from '../services/aiProviderCapabilityMetricsHealthTrend.mjs';

function buildWindow() {
  return buildAiProviderCapabilityMetricsHealthTrendWindow({
    now: new Date('2026-09-01T12:00:00.000Z'),
  });
}

function rows(counts = {}) {
  return [
    { period_id: 'baseline', ...counts.baseline },
    { period_id: 'previous', ...counts.previous },
    { period_id: 'current', ...counts.current },
  ];
}

describe('aiProviderCapabilityMetricsHealthTrend', () => {
  test('builds three non-overlapping completed UTC days and exposes only fixed aggregate values', () => {
    const window = buildWindow();
    const report = buildAiProviderCapabilityMetricsHealthTrendReport({
      window,
      rows: rows({
        baseline: { active_metric_stream_count: '1', persistence_failure_count: '0' },
        previous: { active_metric_stream_count: '2', persistence_failure_count: '1' },
        current: {
          active_metric_stream_count: '3',
          persistence_failure_count: '1',
          provider_id: 'ollama',
          model: 'private-model',
          message: 'database endpoint=private must not render',
        },
      }),
    });

    expect(window.periods.map(period => ({
      id: period.id,
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    }))).toEqual([
      { id: 'baseline', start: '2026-08-29T00:00:00.000Z', end: '2026-08-30T00:00:00.000Z' },
      { id: 'previous', start: '2026-08-30T00:00:00.000Z', end: '2026-08-31T00:00:00.000Z' },
      { id: 'current', start: '2026-08-31T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z' },
    ]);
    expect(report).toMatchObject({
      version: AI_PROVIDER_CAPABILITY_METRICS_HEALTH_TREND_VERSION,
      window: { days: 1, periodCount: 3 },
      status: { id: 'persistent_persistence_failures' },
      periods: [
        { id: 'baseline', activeMetricStreamCount: '1', persistenceFailureCount: '0' },
        { id: 'previous', activeMetricStreamCount: '2', persistenceFailureCount: '1' },
        { id: 'current', activeMetricStreamCount: '3', persistenceFailureCount: '1' },
      ],
    });
    expect(JSON.stringify(report)).not.toContain('private-model');
    expect(JSON.stringify(report)).not.toContain('endpoint=private');
  });

  test.each([
    ['newly observed', rows({
      baseline: { active_metric_stream_count: '1', persistence_failure_count: '0' },
      previous: { active_metric_stream_count: '1', persistence_failure_count: '0' },
      current: { active_metric_stream_count: '1', persistence_failure_count: '1' },
    }), 'newly_observed_persistence_failures'],
    ['cleared', rows({
      baseline: { active_metric_stream_count: '1', persistence_failure_count: '1' },
      previous: { active_metric_stream_count: '1', persistence_failure_count: '1' },
      current: { active_metric_stream_count: '1', persistence_failure_count: '0' },
    }), 'persistence_failures_cleared'],
    ['no data', rows({
      baseline: { active_metric_stream_count: '0', persistence_failure_count: '0' },
      previous: { active_metric_stream_count: '0', persistence_failure_count: '0' },
      current: { active_metric_stream_count: '0', persistence_failure_count: '0' },
    }), 'no_data'],
    ['recurring', rows({
      baseline: { active_metric_stream_count: '1', persistence_failure_count: '1' },
      previous: { active_metric_stream_count: '1', persistence_failure_count: '0' },
      current: { active_metric_stream_count: '1', persistence_failure_count: '1' },
    }), 'recurring_persistence_failures'],
  ])('classifies %s without changing any authority', (_name, aggregateRows, expectedStatusId) => {
    const report = buildAiProviderCapabilityMetricsHealthTrendReport({
      window: buildWindow(),
      rows: aggregateRows,
    });

    expect(report.status.id).toBe(expectedStatusId);
  });

  test('uses zero-valued fixed periods when query rows are malformed or absent', () => {
    const report = buildAiProviderCapabilityMetricsHealthTrendReport({
      window: buildWindow(),
      rows: [{ period_id: 'unexpected', active_metric_stream_count: '999' }],
    });

    expect(report.status.id).toBe('no_data');
    expect(report.periods).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'baseline', activeMetricStreamCount: '0' }),
      expect.objectContaining({ id: 'previous', activeMetricStreamCount: '0' }),
      expect.objectContaining({ id: 'current', activeMetricStreamCount: '0' }),
    ]));
  });
});
