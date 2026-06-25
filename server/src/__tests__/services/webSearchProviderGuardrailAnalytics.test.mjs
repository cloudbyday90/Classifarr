/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  buildGuardrailAnalyticsEvent,
  WebSearchProviderGuardrailAnalyticsService,
} from '../../services/webSearchProviderGuardrailAnalytics.mjs';

describe('webSearchProviderGuardrailAnalytics', () => {
  test('builds sanitized events from preview guardrails', () => {
    const event = buildGuardrailAnalyticsEvent({
      purpose: 'Classification',
      guardrail: {
        code: 'selected_provider_low_samples',
        severity: 'warning',
        providerKey: 'Tavily',
        displayName: 'Tavily',
        message: 'This message should not be persisted.',
        details: {
          sampleCount: 1,
          minimumSamples: 3,
          query: 'sensitive query',
          traceId: 'sensitive-trace',
        },
      },
    });

    expect(event).toEqual({
      purpose: 'classification',
      guardrailCode: 'selected_provider_low_samples',
      severity: 'warning',
      providerKey: 'tavily',
      metadata: {
        sampleCount: 1,
        minimumSamples: 3,
      },
    });
    expect(JSON.stringify(event)).not.toContain('message');
    expect(JSON.stringify(event)).not.toContain('sensitive');
  });

  test('records preview guardrails and prunes old events', async () => {
    const db = {
      query: jest.fn(async () => ({ rows: [] })),
    };
    const service = new WebSearchProviderGuardrailAnalyticsService({
      db,
      nowFn: () => new Date('2026-06-25T06:00:00.000Z'),
    });

    const result = await service.recordPreviewGuardrails({
      purpose: 'classification',
      guardrails: [
        {
          code: 'selected_provider_changed',
          severity: 'info',
          providerKey: 'brave',
          message: 'Should not be stored',
        },
        {
          code: 'selected_provider_recent_health_issue',
          severity: 'critical',
          providerKey: 'tavily',
          details: { healthStatus: 'cooldown', eventType: 'cooldown_started' },
        },
      ],
    });

    expect(result).toEqual({ recorded: 2 });
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO web_search_provider_guardrail_events'),
      [expect.any(String)]
    );
    const persistedRows = JSON.parse(db.query.mock.calls[0][1][0]);
    expect(persistedRows).toEqual([
      expect.objectContaining({
        purpose: 'classification',
        guardrail_code: 'selected_provider_changed',
        severity: 'info',
        provider_key: 'brave',
      }),
      expect.objectContaining({
        guardrail_code: 'selected_provider_recent_health_issue',
        severity: 'critical',
        provider_key: 'tavily',
        metadata: {
          healthStatus: 'cooldown',
          eventType: 'cooldown_started',
        },
      }),
    ]);
    expect(JSON.stringify(persistedRows)).not.toContain('Should not be stored');
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DELETE FROM web_search_provider_guardrail_events'),
      [62]
    );
  });

  test('summarizes guardrail analytics with bounded lookback and limit', async () => {
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            total_count: 4,
            critical_count: 1,
            warning_count: 2,
            info_count: 1,
            purpose_count: 2,
            latest_at: '2026-06-25T06:00:00.000Z',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            guardrail_code: 'selected_provider_low_samples',
            total_count: 3,
            critical_count: 1,
            warning_count: 2,
            info_count: 0,
            provider_count: 2,
            latest_at: '2026-06-25T06:00:00.000Z',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            purpose: 'classification',
            total_count: 3,
            latest_at: '2026-06-25T06:00:00.000Z',
          }],
        }),
    };
    const service = new WebSearchProviderGuardrailAnalyticsService({
      db,
      nowFn: () => new Date('2026-06-25T06:05:00.000Z'),
    });

    const summary = await service.summarize({ lookbackDays: 999, limit: 999 });

    expect(summary).toEqual({
      generatedAt: '2026-06-25T06:05:00.000Z',
      lookbackDays: 90,
      totalCount: 4,
      criticalCount: 1,
      warningCount: 2,
      infoCount: 1,
      purposeCount: 2,
      latestAt: '2026-06-25T06:00:00.000Z',
      codes: [
        {
          guardrailCode: 'selected_provider_low_samples',
          totalCount: 3,
          criticalCount: 1,
          warningCount: 2,
          infoCount: 0,
          providerCount: 2,
          latestAt: '2026-06-25T06:00:00.000Z',
        },
      ],
      purposes: [
        {
          purpose: 'classification',
          totalCount: 3,
          latestAt: '2026-06-25T06:00:00.000Z',
        },
      ],
    });
    expect(db.query).toHaveBeenCalledWith(expect.any(String), [90]);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), [90, 50]);
  });

  test('recordPreviewGuardrailsSafely contains analytics failures', async () => {
    const logger = { warn: jest.fn() };
    const service = new WebSearchProviderGuardrailAnalyticsService({
      db: { query: jest.fn(async () => { throw new Error('database unavailable'); }) },
      logger,
    });

    const result = await service.recordPreviewGuardrailsSafely({
      purpose: 'classification',
      guardrails: [{ code: 'selected_provider_changed', severity: 'info' }],
    });

    expect(result).toEqual({ recorded: 0, error: 'record_failed' });
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to record web search provider guardrail analytics',
      { error: 'database unavailable' }
    );
  });
});
