/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  WEB_SEARCH_ROUTE_DECISION_OUTCOMES,
  WebSearchProviderRouteHistory,
  normalizeWebSearchRouteDecisionRow,
  serializeWebSearchRouteAttemptForHistory,
  serializeWebSearchRouteCandidateForHistory,
} from '../../services/webSearchProviderRouteHistory.mjs';

function createMockDb(rowsByCall = []) {
  const calls = [];
  return {
    calls,
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      const next = rowsByCall.shift();
      return { rows: Array.isArray(next) ? next : [] };
    },
  };
}

function createDecisionRow(overrides = {}) {
  return {
    id: '42',
    route_id: '29994c13-e52d-4813-8051-0960ed27d495',
    purpose: 'classification',
    operation: 'search',
    outcome: 'success',
    selected_provider_key: 'brave',
    final_provider_key: 'brave',
    candidate_count: 2,
    attempt_count: 1,
    candidates: [{ providerKey: 'brave' }],
    attempts: [{ providerKey: 'brave', outcome: 'success' }],
    correlation_id: 'trace-1',
    classification_id: '13300',
    error_code: null,
    error_http_status: null,
    duration_ms: 25,
    metadata: { cacheHit: false },
    created_at: '2026-06-25T02:00:00.000Z',
    completed_at: '2026-06-25T02:00:00.025Z',
    ...overrides,
  };
}

describe('webSearchProviderRouteHistory', () => {
  test('normalizes route decision rows for UI-safe read models', () => {
    expect(normalizeWebSearchRouteDecisionRow(createDecisionRow())).toEqual(expect.objectContaining({
      id: 42,
      routeId: '29994c13-e52d-4813-8051-0960ed27d495',
      outcome: 'success',
      selectedProviderKey: 'brave',
      finalProviderKey: 'brave',
      classificationId: 13300,
      durationMs: 25,
      metadata: { cacheHit: false },
    }));
  });

  test('serializes candidates without provider credentials or request payloads', () => {
    const candidate = serializeWebSearchRouteCandidateForHistory({
      providerKey: 'tavily',
      displayName: 'Tavily',
      priority: 10,
      status: 'available',
      skipReason: null,
      config: { apiKey: 'secret' },
      quota: {
        dailyLimit: 100,
        monthlyLimit: 1000,
        dailyCostUnits: 2,
        monthlyCostUnits: 10,
      },
    });

    expect(candidate).toEqual({
      providerKey: 'tavily',
      displayName: 'Tavily',
      priority: 10,
      status: 'available',
      skipReason: null,
      quota: {
        dailyLimit: 100,
        monthlyLimit: 1000,
        dailyCostUnits: 2,
        monthlyCostUnits: 10,
        dailyRemaining: null,
        monthlyRemaining: null,
      },
    });
    expect(candidate.config).toBeUndefined();
  });

  test('serializes attempts into bounded taxonomy fields', () => {
    expect(serializeWebSearchRouteAttemptForHistory({
      providerKey: 'brave',
      outcome: 'failed',
      errorCode: 'rate_limited',
      httpStatus: '429',
      retryAfterSeconds: '60',
      response: { secret: true },
    })).toEqual({
      providerKey: 'brave',
      outcome: 'failed',
      errorCode: 'rate_limited',
      httpStatus: 429,
      retryAfterSeconds: 60,
    });
  });

  test('records sanitized route decisions with trace context', async () => {
    const db = createMockDb([[createDecisionRow()]]);
    const routeHistory = new WebSearchProviderRouteHistory({
      db,
      nowFn: () => new Date('2026-06-25T02:00:00.025Z'),
    });

    const decision = await routeHistory.recordDecision({
      routeId: '29994c13-e52d-4813-8051-0960ed27d495',
      request: {
        purpose: 'classification',
        traceContext: {
          correlationId: 'trace-1',
          classificationId: 13300,
        },
      },
      outcome: WEB_SEARCH_ROUTE_DECISION_OUTCOMES.SUCCESS,
      selectedProviderKey: 'brave',
      finalProviderKey: 'brave',
      candidates: [{ providerKey: 'brave', status: 'available' }],
      attempts: [{ providerKey: 'brave', outcome: 'success' }],
      metadata: {
        cacheHit: false,
        query: 'do not persist',
        apiKey: 'do not persist',
        cacheKey: 'do not persist',
      },
      startedAt: new Date('2026-06-25T02:00:00.000Z'),
    });

    expect(decision.outcome).toBe('success');
    expect(db.calls[0].params).toEqual(expect.arrayContaining([
      'classification',
      'search',
      'success',
      'brave',
      'trace-1',
      13300,
      25,
    ]));
    expect(JSON.parse(db.calls[0].params[15])).toEqual({ cacheHit: false });
  });

  test('lists recent decisions with a bounded limit and optional provider filter', async () => {
    const db = createMockDb([[createDecisionRow()]]);
    const routeHistory = new WebSearchProviderRouteHistory({ db });

    const decisions = await routeHistory.listRecentDecisions({
      limit: 1000,
      providerKey: 'brave',
    });

    expect(decisions).toHaveLength(1);
    expect(db.calls[0].params).toEqual([50, 'brave']);
    expect(db.calls[0].sql).toContain('selected_provider_key = $2 OR final_provider_key = $2');
  });
});
