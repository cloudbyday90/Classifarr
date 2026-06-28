/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPolicyIntentReplayProviderReadiness,
  POLICY_INTENT_REPLAY_PROVIDER_READINESS_MODE,
} from '../services/policyIntentReplayProviderReadiness.mjs';

describe('policyIntentReplayProviderReadiness', () => {
  test('projects demanded provider sources without live calls', async () => {
    const responses = [
      { rows: [{ api_key: 'tmdb-secret', is_active: true }] },
      {
        rows: [{
          api_key: 'omdb-secret',
          is_active: true,
          daily_limit: 100,
          requests_today: 12,
          last_reset_date: '2026-06-28',
        }],
      },
    ];
    const db = {
      query: async () => responses.shift(),
    };
    const routeCalls = [];
    const router = {
      getRouteCandidates: async args => {
        routeCalls.push(args);
        return [
          {
            providerKey: 'tavily',
            status: 'available',
            config: { configured: true },
          },
        ];
      },
    };

    const readiness = await buildPolicyIntentReplayProviderReadiness({
      db,
      router,
      now: new Date('2026-06-28T12:00:00.000Z'),
      enrichmentEligibility: {
        items: [
          { eligible_sources: ['tmdb_metadata', 'omdb_rating', 'web_search_metadata'] },
          { eligible_sources: ['web_search_metadata'] },
        ],
      },
    });

    expect(readiness).toEqual(expect.objectContaining({
      schema_version: 1,
      mode: POLICY_INTENT_REPLAY_PROVIDER_READINESS_MODE,
      enabled: true,
      live_provider_calls_enabled: false,
      ai_calls_enabled: false,
      persistence_enabled: false,
      arr_writes_enabled: false,
      source_count: 3,
      ready_source_count: 3,
      unavailable_source_count: 0,
      demanded_source_count: 3,
      readiness: 'ready',
    }));
    expect(routeCalls).toEqual([{ purpose: 'metadata_enrichment' }]);
    expect(readiness.sources).toEqual([
      expect.objectContaining({
        source: 'tmdb_metadata',
        status: 'ready',
        configured: true,
        quota_safe: true,
        eligible_sample_count: 1,
        selected_provider_key: 'tmdb',
      }),
      expect.objectContaining({
        source: 'omdb_rating',
        status: 'ready',
        configured: true,
        quota_safe: true,
        eligible_sample_count: 1,
        selected_provider_key: 'omdb',
      }),
      expect.objectContaining({
        source: 'web_search_metadata',
        status: 'ready',
        configured: true,
        quota_safe: true,
        eligible_sample_count: 2,
        selected_provider_key: 'tavily',
        available_provider_count: 1,
      }),
    ]);
    expect(JSON.stringify(readiness)).not.toContain('tmdb-secret');
    expect(JSON.stringify(readiness)).not.toContain('omdb-secret');
  });

  test('marks demanded sources unavailable when configuration or quota blocks them', async () => {
    const responses = [
      { rows: [] },
      {
        rows: [{
          api_key: 'omdb-secret',
          is_active: true,
          daily_limit: 10,
          requests_today: 10,
          last_reset_date: '2026-06-28',
        }],
      },
    ];
    const db = {
      query: async () => responses.shift(),
    };
    const router = {
      getRouteCandidates: async () => [
        {
          providerKey: 'tavily',
          status: 'skipped',
          skipReason: 'daily_quota_exhausted',
          config: { configured: true },
        },
      ],
    };

    const readiness = await buildPolicyIntentReplayProviderReadiness({
      db,
      router,
      now: new Date('2026-06-28T12:00:00.000Z'),
      enrichmentEligibility: {
        items: [
          { eligible_sources: ['tmdb_metadata', 'omdb_rating', 'web_search_metadata'] },
        ],
      },
    });

    expect(readiness).toEqual(expect.objectContaining({
      ready_source_count: 0,
      unavailable_source_count: 3,
      demanded_source_count: 3,
      readiness: 'unavailable',
    }));
    expect(readiness.sources[0]).toEqual(expect.objectContaining({
      source: 'tmdb_metadata',
      status: 'unavailable',
      reason_codes: ['provider:tmdb_unconfigured'],
    }));
    expect(readiness.sources[1]).toEqual(expect.objectContaining({
      source: 'omdb_rating',
      status: 'unavailable',
      configured: true,
      quota_safe: false,
      reason_codes: expect.arrayContaining(['quota:omdb_unavailable']),
    }));
    expect(readiness.sources[2]).toEqual(expect.objectContaining({
      source: 'web_search_metadata',
      status: 'unavailable',
      configured: true,
      quota_safe: false,
      reason_codes: expect.arrayContaining(['quota:web_search_exhausted']),
    }));
    expect(JSON.stringify(readiness)).not.toContain('omdb-secret');
  });
});
