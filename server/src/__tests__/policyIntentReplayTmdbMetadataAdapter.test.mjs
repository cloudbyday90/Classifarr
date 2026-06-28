/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  buildPolicyIntentReplayTmdbMetadataAdapterPreview,
  POLICY_INTENT_REPLAY_TMDB_METADATA_ADAPTER_MODE,
} from '../services/policyIntentReplayTmdbMetadataAdapter.mjs';
import { createPolicyIntentReplayEnrichmentAdapterContext } from '../services/policyIntentReplayEnrichmentAdapterContract.mjs';

const READY_CONTRACT = {
  sources: [{
    source: 'tmdb_metadata',
    status: 'ready',
    eligible_sample_count: 1,
    quota_safe: true,
    cooldown_active: false,
  }],
};

describe('policyIntentReplayTmdbMetadataAdapter', () => {
  test('stays blocked by default and does not call the provider fetcher', async () => {
    const fetchMovieDetails = jest.fn();

    const preview = await buildPolicyIntentReplayTmdbMetadataAdapterPreview({
      samples: [{
        sample_id: 1,
        tmdb_id: 10674,
        media_type: 'movie',
      }],
      adapterContract: READY_CONTRACT,
      fetchMovieDetails,
    });

    expect(fetchMovieDetails).not.toHaveBeenCalled();
    expect(preview).toEqual(expect.objectContaining({
      schema_version: 1,
      mode: POLICY_INTENT_REPLAY_TMDB_METADATA_ADAPTER_MODE,
      source: 'tmdb_metadata',
      status: 'blocked',
      provider_payload_exposed: false,
      live_provider_calls_enabled: false,
      persistence_enabled: false,
      arr_writes_enabled: false,
      cache_mutation_enabled: false,
      previewed_count: 0,
      improved_field_count: 0,
      execution_switch: expect.objectContaining({
        status: 'blocked',
        enabled: false,
      }),
    }));
    expect(JSON.stringify(preview)).not.toContain('10674');
  });

  test('runs only when explicitly enabled and returns sanitized field availability', async () => {
    const fetchMovieDetails = jest.fn().mockResolvedValue({
      id: 10674,
      title: 'Mulan',
      overview: 'raw overview should not leak',
      original_language: 'en',
      runtime: 88,
      vote_average: 7.9,
      genres: [{ id: 16, name: 'Animation' }, { id: 10751, name: 'Family' }],
      keywords: {
        keywords: [{ id: 1, name: 'princess' }, { id: 2, name: 'dragon' }],
      },
      production_companies: [{ id: 2, name: 'Disney' }],
      release_dates: {
        results: [{
          iso_3166_1: 'US',
          release_dates: [{ certification: 'G' }],
        }],
      },
    });
    const context = createPolicyIntentReplayEnrichmentAdapterContext({
      enabledSources: ['tmdb_metadata'],
      liveProviderCallsEnabled: true,
    });
    const executionSwitch = {
      enabled: true,
      status: 'enabled',
      requested: true,
      server_enabled: true,
      provider_ready: true,
      quota_safe: true,
      cooldown_active: false,
      selected_provider_key: 'tmdb',
      reason_codes: ['request:tmdb_metadata_opted_in'],
    };

    const preview = await buildPolicyIntentReplayTmdbMetadataAdapterPreview({
      samples: [{
        sample_id: 1,
        tmdb_id: 10674,
        title: 'Mulan',
        media_type: 'movie',
        metadata: {
          genres: [],
        },
      }],
      adapterContract: READY_CONTRACT,
      context,
      fetchMovieDetails,
      executionSwitch,
    });

    expect(fetchMovieDetails).toHaveBeenCalledWith({
      tmdbId: 10674,
      mediaType: 'movie',
      appendToResponse: 'keywords,release_dates',
    });
    expect(preview).toEqual(expect.objectContaining({
      status: 'ready',
      live_provider_calls_enabled: true,
      provider_payload_exposed: false,
      execution_switch: expect.objectContaining({
        status: 'enabled',
        selected_provider_key: 'tmdb',
      }),
      previewed_count: 1,
      improved_sample_count: 1,
      improved_field_count: 8,
    }));
    expect(preview.items[0]).toEqual(expect.objectContaining({
      sample_id: 1,
      status: 'ready',
      available_fields: [
        'rating',
        'genres',
        'keywords',
        'studio',
        'language',
        'overview',
        'runtime',
        'vote_average',
      ],
      improved_fields: [
        'rating',
        'genres',
        'keywords',
        'studio',
        'language',
        'overview',
        'runtime',
        'vote_average',
      ],
      field_counts: {
        genres: 2,
        keywords: 2,
        studios: 1,
      },
    }));
    const serialized = JSON.stringify(preview);
    expect(serialized).not.toContain('10674');
    expect(serialized).not.toContain('Mulan');
    expect(serialized).not.toContain('raw overview');
    expect(serialized).not.toContain('Disney');
    expect(serialized).not.toContain('princess');
  });

  test('honors quota and cooldown state before attempting a provider call', async () => {
    const fetchMovieDetails = jest.fn();
    const context = createPolicyIntentReplayEnrichmentAdapterContext({
      enabledSources: ['tmdb_metadata'],
      liveProviderCallsEnabled: true,
    });

    const preview = await buildPolicyIntentReplayTmdbMetadataAdapterPreview({
      samples: [{
        sample_id: 1,
        tmdb_id: 10674,
        media_type: 'movie',
      }],
      adapterContract: {
        sources: [{
          source: 'tmdb_metadata',
          status: 'ready',
          eligible_sample_count: 1,
          quota_safe: false,
          cooldown_active: true,
        }],
      },
      context,
      fetchMovieDetails,
    });

    expect(fetchMovieDetails).not.toHaveBeenCalled();
    expect(preview.status).toBe('unavailable');
    expect(preview.reason_codes).toContain('provider:cooldown_active');
  });

  test('recognizes existing TMDB service movie and tv certification payload shapes', async () => {
    const fetchMovieDetails = jest.fn()
      .mockResolvedValueOnce({
        original_language: 'en',
        releases: {
          countries: [{ iso_3166_1: 'US', certification: 'PG' }],
        },
      })
      .mockResolvedValueOnce({
        original_language: 'en',
        content_ratings: {
          results: [{ iso_3166_1: 'US', rating: 'TV-PG' }],
        },
      });
    const context = createPolicyIntentReplayEnrichmentAdapterContext({
      enabledSources: ['tmdb_metadata'],
      liveProviderCallsEnabled: true,
    });

    const preview = await buildPolicyIntentReplayTmdbMetadataAdapterPreview({
      samples: [
        { sample_id: 1, tmdb_id: 10674, media_type: 'movie' },
        { sample_id: 2, tmdb_id: 1399, media_type: 'tv' },
      ],
      adapterContract: {
        sources: [{
          source: 'tmdb_metadata',
          status: 'ready',
          eligible_sample_count: 2,
          quota_safe: true,
          cooldown_active: false,
        }],
      },
      context,
      fetchMovieDetails,
    });

    expect(preview.items[0].available_fields).toContain('rating');
    expect(preview.items[1].available_fields).toContain('rating');
  });
});
