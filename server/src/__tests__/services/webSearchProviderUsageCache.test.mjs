/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  WebSearchProviderUsageCache,
  normalizeWebSearchProviderCacheRow,
} from '../../services/webSearchProviderUsageCache.mjs';

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

function createResponse(overrides = {}) {
  return {
    provider: 'tavily',
    providerRequestId: 'req-1',
    query: 'Mulan 1998',
    answer: 'Mulan is a 1998 animated family adventure film.',
    results: [
      {
        title: 'Mulan',
        url: 'https://example.com/mulan',
        snippet: 'Animated family film.',
        rank: 1,
        score: 0.92,
        publishedAt: null,
        sourceDomain: 'example.com',
        providerMetadata: {},
      },
    ],
    usage: {
      costUnits: 1,
      quotaBucket: null,
    },
    warnings: [],
    ...overrides,
  };
}

function createCacheRow(overrides = {}) {
  return {
    cache_key: 'a'.repeat(64),
    provider_key: 'tavily',
    purpose: 'classification',
    query_hash: 'b'.repeat(64),
    request_fingerprint: 'c'.repeat(64),
    query_preview: 'Mulan 1998',
    response: createResponse(),
    result_count: 1,
    expires_at: '2026-06-19T00:00:00.000Z',
    created_at: '2026-06-18T00:00:00.000Z',
    updated_at: '2026-06-18T00:00:00.000Z',
    last_hit_at: null,
    hit_count: 0,
    source_request_id: 'req-1',
    metadata: { cacheHit: false },
    ...overrides,
  };
}

describe('webSearchProviderUsageCache', () => {
  test('normalizes cache rows and validates cached response shape', () => {
    const row = normalizeWebSearchProviderCacheRow(createCacheRow({
      response: JSON.stringify(createResponse()),
      metadata: JSON.stringify({ cacheHit: true }),
      hit_count: '2',
    }));

    expect(row).toEqual(expect.objectContaining({
      cacheKey: 'a'.repeat(64),
      providerKey: 'tavily',
      hitCount: 2,
      metadata: { cacheHit: true },
    }));
    expect(row.response.results[0].title).toBe('Mulan');
  });

  test('fetches only fresh cache entries by key', async () => {
    const db = createMockDb([[createCacheRow()]]);
    const cache = new WebSearchProviderUsageCache({ db });

    const row = await cache.getFreshResponse('a'.repeat(64), {
      now: new Date('2026-06-18T12:00:00.000Z'),
    });

    expect(row.response.provider).toBe('tavily');
    expect(db.calls[0].sql).toContain('expires_at > $2');
    expect(db.calls[0].params[0]).toBe('a'.repeat(64));
  });

  test('returns null when no fresh cache entry exists', async () => {
    const db = createMockDb([[]]);
    const cache = new WebSearchProviderUsageCache({ db });

    await expect(cache.getFreshResponse('a'.repeat(64))).resolves.toBeNull();
  });

  test('stores normalized provider responses with bounded expiry', async () => {
    const db = createMockDb([[createCacheRow()]]);
    const cache = new WebSearchProviderUsageCache({ db });

    const row = await cache.storeResponse({
      cacheKey: 'a'.repeat(64),
      providerKey: 'tavily',
      purpose: 'classification',
      queryHash: 'b'.repeat(64),
      requestFingerprint: 'c'.repeat(64),
      queryPreview: 'Mulan 1998',
      response: createResponse(),
      ttlMs: 60_000,
      metadata: { route: 'test' },
    }, {
      now: new Date('2026-06-18T00:00:00.000Z'),
    });

    expect(row.cacheKey).toBe('a'.repeat(64));
    expect(db.calls[0].params[6]).toBe(JSON.stringify(createResponse()));
    expect(db.calls[0].params[8]).toEqual(new Date('2026-06-18T00:01:00.000Z'));
    expect(db.calls[0].params[9]).toBe('req-1');
  });

  test('records cache hits without changing the cached response', async () => {
    const db = createMockDb([[createCacheRow({ hit_count: 3, last_hit_at: '2026-06-18T00:02:00.000Z' })]]);
    const cache = new WebSearchProviderUsageCache({ db });

    const row = await cache.recordHit('a'.repeat(64), {
      now: new Date('2026-06-18T00:02:00.000Z'),
    });

    expect(row.hitCount).toBe(3);
    expect(db.calls[0].sql).toContain('hit_count = hit_count + 1');
  });

  test('deletes expired cache entries with a bounded batch size', async () => {
    const db = createMockDb([[{ cache_key: 'a'.repeat(64) }]]);
    const cache = new WebSearchProviderUsageCache({ db });

    const deleted = await cache.deleteExpired({
      now: new Date('2026-06-20T00:00:00.000Z'),
      limit: 20_000,
    });

    expect(deleted).toEqual(['a'.repeat(64)]);
    expect(db.calls[0].params[1]).toBe(5000);
  });
});
