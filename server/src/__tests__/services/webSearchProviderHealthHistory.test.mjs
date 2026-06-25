/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import { WEB_SEARCH_PROVIDER_ERROR_CODES, WebSearchProviderError } from '../../services/webSearchProviderErrorTaxonomy.mjs';
import {
  WEB_SEARCH_PROVIDER_HEALTH_EVENT_TYPES,
  WEB_SEARCH_PROVIDER_HEALTH_STATUSES,
  WebSearchProviderHealthHistory,
  buildWebSearchProviderHealthEventFromUsage,
} from '../../services/webSearchProviderHealthHistory.mjs';

function createMockDb(rowsByCall = []) {
  const calls = [];
  return {
    calls,
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      const next = rowsByCall.shift();
      const rows = Array.isArray(next) ? next : (Array.isArray(next?.rows) ? next.rows : []);
      return {
        rows,
        rowCount: Number.isFinite(next?.rowCount) ? next.rowCount : rows.length,
      };
    },
  };
}

function createEventRow(overrides = {}) {
  return {
    id: 1,
    provider_key: 'tavily',
    event_type: 'cooldown_started',
    health_status: 'cooldown',
    purpose: 'classification',
    operation: 'search',
    error_code: 'rate_limited',
    error_http_status: 429,
    retry_after_seconds: 60,
    cooldown_until: '2026-06-25T12:01:00.000Z',
    correlation_id: 'trace-1',
    classification_id: 13300,
    metadata: { cacheHit: false, routedProvider: 'tavily', query: 'redacted' },
    created_at: '2026-06-25T12:00:00.000Z',
    ...overrides,
  };
}

describe('webSearchProviderHealthHistory', () => {
  test('builds success health events from usage updates', () => {
    expect(buildWebSearchProviderHealthEventFromUsage('tavily', {
      status: 'success',
      purpose: 'classification',
      operation: 'search',
      correlationId: 'trace-1',
      classificationId: 13300,
    })).toEqual(expect.objectContaining({
      providerKey: 'tavily',
      eventType: WEB_SEARCH_PROVIDER_HEALTH_EVENT_TYPES.SUCCESS,
      healthStatus: WEB_SEARCH_PROVIDER_HEALTH_STATUSES.AVAILABLE,
      correlationId: 'trace-1',
      classificationId: 13300,
    }));
  });

  test('builds cooldown events from retry-after taxonomy errors', () => {
    const error = new WebSearchProviderError({
      provider: 'tavily',
      operation: 'search',
      errorCode: WEB_SEARCH_PROVIDER_ERROR_CODES.RATE_LIMITED,
      httpStatus: 429,
      retryable: true,
      cooldownEligible: true,
      retryAfterSeconds: 60,
      causeCode: null,
      safeMessage: 'Too many requests',
    });

    expect(buildWebSearchProviderHealthEventFromUsage('tavily', {
      error,
      purpose: 'classification',
      operation: 'search',
    }, {
      cooldownUntil: '2026-06-25T12:01:00.000Z',
    })).toEqual(expect.objectContaining({
      eventType: WEB_SEARCH_PROVIDER_HEALTH_EVENT_TYPES.COOLDOWN_STARTED,
      healthStatus: WEB_SEARCH_PROVIDER_HEALTH_STATUSES.COOLDOWN,
      errorCode: WEB_SEARCH_PROVIDER_ERROR_CODES.RATE_LIMITED,
      retryAfterSeconds: 60,
      cooldownUntil: '2026-06-25T12:01:00.000Z',
    }));
  });

  test('marks retry-after errors as cooldown events without a returned config row', () => {
    const error = new WebSearchProviderError({
      provider: 'tavily',
      operation: 'search',
      errorCode: WEB_SEARCH_PROVIDER_ERROR_CODES.RATE_LIMITED,
      httpStatus: 429,
      retryable: true,
      cooldownEligible: true,
      retryAfterSeconds: 60,
      causeCode: null,
      safeMessage: 'Too many requests',
    });

    expect(buildWebSearchProviderHealthEventFromUsage('tavily', {
      error,
      purpose: 'classification',
      operation: 'search',
    })).toEqual(expect.objectContaining({
      eventType: WEB_SEARCH_PROVIDER_HEALTH_EVENT_TYPES.COOLDOWN_STARTED,
      healthStatus: WEB_SEARCH_PROVIDER_HEALTH_STATUSES.COOLDOWN,
      retryAfterSeconds: 60,
    }));
  });

  test('records sanitized health events without sensitive metadata', async () => {
    const db = createMockDb([[createEventRow()]]);
    const history = new WebSearchProviderHealthHistory({ db });

    const event = await history.recordEvent({
      providerKey: 'tavily',
      eventType: 'cooldown_started',
      healthStatus: 'cooldown',
      purpose: 'classification',
      operation: 'search',
      errorCode: 'rate_limited',
      errorHttpStatus: 429,
      retryAfterSeconds: 60,
      cooldownUntil: '2026-06-25T12:01:00.000Z',
      correlationId: 'trace-1',
      classificationId: 13300,
      metadata: {
        cacheHit: false,
        routedProvider: 'tavily',
        query: 'Mulan',
        apiKey: 'secret',
      },
    });

    expect(event).toEqual(expect.objectContaining({
      providerKey: 'tavily',
      eventType: 'cooldown_started',
      healthStatus: 'cooldown',
      errorCode: 'rate_limited',
    }));
    expect(db.calls[0].params[11]).toBe(JSON.stringify({
      cacheHit: false,
      routedProvider: 'tavily',
    }));
  });

  test('lists recent events with optional provider filtering', async () => {
    const db = createMockDb([[createEventRow()]]);
    const history = new WebSearchProviderHealthHistory({ db });

    const events = await history.listRecentEvents({
      providerKey: 'tavily',
      limit: 1000,
    });

    expect(events).toHaveLength(1);
    expect(db.calls[0].params).toEqual([50, 'tavily']);
    expect(JSON.stringify(events[0])).not.toContain('query');
  });

  test('safe recording returns null on database failure', async () => {
    const history = new WebSearchProviderHealthHistory({
      db: { query: jest.fn().mockRejectedValue(new Error('database unavailable')) },
    });

    await expect(history.recordEventSafely({ providerKey: 'tavily' })).resolves.toBeNull();
  });
});
