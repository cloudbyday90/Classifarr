/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyIntentReplayEnrichmentEligibility,
  POLICY_INTENT_REPLAY_ENRICHMENT_ELIGIBILITY_MODE,
} from '../services/policyIntentReplayEnrichmentEligibility.mjs';

describe('policyIntentReplayEnrichmentEligibility', () => {
  test('marks sparse samples eligible when safe identity is available', () => {
    const eligibility = buildPolicyIntentReplayEnrichmentEligibility({
      samples: [{
        title: 'Mulan',
        tmdb_id: 10674,
        year: 1998,
        media_type: 'movie',
        metadata: {
          imdb_id: 'tt0120762',
        },
      }],
    });

    expect(eligibility).toEqual(expect.objectContaining({
      schema_version: 1,
      mode: POLICY_INTENT_REPLAY_ENRICHMENT_ELIGIBILITY_MODE,
      enabled: true,
      provider_calls_enabled: false,
      ai_calls_enabled: false,
      persistence_enabled: false,
      arr_writes_enabled: false,
      sample_count: 1,
      eligible_count: 1,
      not_needed_count: 0,
      insufficient_identity_count: 0,
    }));
    expect(eligibility.items[0]).toEqual(expect.objectContaining({
      sample_id: 1,
      status: 'eligible',
      missing_fields: expect.arrayContaining(['rating', 'genres', 'keywords', 'studio', 'language', 'overview']),
      eligible_sources: expect.arrayContaining([
        'tmdb_metadata',
        'omdb_rating',
        'web_search_metadata',
      ]),
      provider_calls_enabled: false,
      ai_calls_enabled: false,
      persistence_enabled: false,
      arr_writes_enabled: false,
      reason_codes: expect.arrayContaining([
        'status:eligible',
        'identity:tmdb_available',
        'identity:imdb_available',
        'identity:title_available',
      ]),
    }));
    expect(eligibility.items[0]).not.toHaveProperty('tmdb_id');
    expect(eligibility.items[0]).not.toHaveProperty('imdb_id');
    expect(eligibility.items[0]).not.toHaveProperty('title');
    expect(eligibility.items[0]).not.toHaveProperty('metadata');
  });

  test('marks complete samples as not needed', () => {
    const eligibility = buildPolicyIntentReplayEnrichmentEligibility({
      samples: [{
        title: 'Mulan',
        tmdb_id: 10674,
        media_type: 'movie',
        genre_names: ['Animation', 'Family'],
        primary_studio_name: 'Walt Disney Animation Studios',
        metadata: {
          rating: 'G',
          keywords: ['dragon'],
          original_language: 'en',
          overview: 'A young woman disguises herself as a soldier.',
        },
      }],
    });

    expect(eligibility).toEqual(expect.objectContaining({
      eligible_count: 0,
      not_needed_count: 1,
    }));
    expect(eligibility.items[0]).toEqual(expect.objectContaining({
      status: 'not_needed',
      missing_fields: [],
      eligible_sources: [],
      reason_codes: expect.arrayContaining([
        'status:not_needed',
        'identity:tmdb_available',
        'identity:title_available',
      ]),
    }));
  });

  test('marks sparse rows without identity as insufficient identity', () => {
    const eligibility = buildPolicyIntentReplayEnrichmentEligibility({
      samples: [{
        media_type: 'movie',
        metadata: {},
      }],
    });

    expect(eligibility).toEqual(expect.objectContaining({
      eligible_count: 0,
      insufficient_identity_count: 1,
    }));
    expect(eligibility.items[0]).toEqual(expect.objectContaining({
      status: 'insufficient_identity',
      eligible_sources: [],
      reason_codes: expect.arrayContaining([
        'status:insufficient_identity',
        'missing:rating',
        'missing:genres',
      ]),
    }));
  });
});
