/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_HEALTH_VERSION,
  buildAiProviderCapabilityMetricsHealthReport,
  buildAiProviderCapabilityMetricsHealthWindow,
} from '../services/aiProviderCapabilityMetricsHealth.mjs';

describe('aiProviderCapabilityMetricsHealth', () => {
  test('returns only fixed aggregate health fields when persistence failures are present', () => {
    const report = buildAiProviderCapabilityMetricsHealthReport({
      row: {
        active_metric_stream_count: '2',
        persistence_failure_count: '1',
        last_persisted_at: '2026-08-31T12:05:00.000Z',
        last_failure_at: '2026-08-31T12:06:00.000Z',
        provider_id: 'ollama',
        model: 'private-model',
        message: 'database endpoint=private must not render',
      },
      window: buildAiProviderCapabilityMetricsHealthWindow({
        now: new Date('2026-08-31T13:00:00.000Z'),
      }),
    });

    expect(report).toEqual(expect.objectContaining({
      version: AI_PROVIDER_CAPABILITY_METRICS_HEALTH_VERSION,
      activeMetricStreamCount: '2',
      persistenceFailureCount: '1',
      lastPersistedAt: '2026-08-31T12:05:00.000Z',
      lastFailureAt: '2026-08-31T12:06:00.000Z',
      status: expect.objectContaining({ id: 'persistence_failures_detected' }),
    }));
    expect(JSON.stringify(report)).not.toContain('private-model');
    expect(JSON.stringify(report)).not.toContain('endpoint=private');
  });

  test('distinguishes successful recording from a quiet health window', () => {
    const window = buildAiProviderCapabilityMetricsHealthWindow({
      now: new Date('2026-08-31T13:00:00.000Z'),
    });

    expect(buildAiProviderCapabilityMetricsHealthReport({
      row: { active_metric_stream_count: '3', persistence_failure_count: '0' },
      window,
    }).status.id).toBe('operational');
    expect(buildAiProviderCapabilityMetricsHealthReport({
      row: { active_metric_stream_count: '0', persistence_failure_count: '0' },
      window,
    }).status.id).toBe('no_recent_activity');
  });

  test('rejects an invalid health observation time before an aggregate can run', () => {
    expect(() => buildAiProviderCapabilityMetricsHealthWindow({ now: 'not-a-date' }))
      .toThrow('valid capability-metrics health observation time');
  });
});
