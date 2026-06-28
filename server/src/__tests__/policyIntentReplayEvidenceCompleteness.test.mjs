/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyIntentReplayEvidenceCompleteness,
  POLICY_INTENT_REPLAY_EVIDENCE_COMPLETENESS_MODE,
} from '../services/policyIntentReplayEvidenceCompleteness.mjs';

describe('policyIntentReplayEvidenceCompleteness', () => {
  test('summarizes strong evidence availability without raw values', () => {
    const completeness = buildPolicyIntentReplayEvidenceCompleteness({
      samples: [{
        title: 'Mulan',
        year: 1998,
        media_type: 'movie',
        genre_names: ['Animation', 'Family'],
        primary_studio_name: 'Walt Disney Animation Studios',
        metadata: {
          rating: 'G',
          keywords: ['dragon', 'female protagonist'],
          original_language: 'en',
          overview: 'A young woman disguises herself as a soldier.',
          runtime: 88,
          vote_average: 7.9,
        },
      }],
    });

    expect(completeness).toEqual(expect.objectContaining({
      schema_version: 1,
      mode: POLICY_INTENT_REPLAY_EVIDENCE_COMPLETENESS_MODE,
      enabled: true,
      sample_count: 1,
      strong_count: 1,
      partial_count: 0,
      sparse_count: 0,
    }));
    expect(completeness.items[0]).toEqual(expect.objectContaining({
      sample_id: 1,
      completeness: 'strong',
      available_fields: expect.arrayContaining([
        'rating',
        'genres',
        'keywords',
        'studio',
        'language',
        'overview',
        'runtime',
        'vote_average',
      ]),
      missing_fields: [],
      field_counts: {
        genres: 2,
        keywords: 2,
        studios: 1,
      },
      reason_codes: expect.arrayContaining([
        'status:strong',
        'evidence:rating_available',
        'evidence:genres_available',
        'evidence:keywords_available',
        'evidence:overview_available',
      ]),
    }));
    expect(completeness.items[0]).not.toHaveProperty('metadata');
    expect(completeness.items[0]).not.toHaveProperty('title');
    expect(completeness.items[0]).not.toHaveProperty('rating');
    expect(completeness.items[0].available_fields).not.toContain('G');
  });

  test('marks sparse samples when core evidence is absent', () => {
    const completeness = buildPolicyIntentReplayEvidenceCompleteness({
      samples: [{
        title: 'Unknown',
        metadata: {},
      }],
    });

    expect(completeness).toEqual(expect.objectContaining({
      sample_count: 1,
      strong_count: 0,
      partial_count: 0,
      sparse_count: 1,
    }));
    expect(completeness.items[0]).toEqual(expect.objectContaining({
      sample_id: 1,
      completeness: 'sparse',
      available_fields: [],
      missing_fields: expect.arrayContaining(['rating', 'genres', 'language']),
      reason_codes: expect.arrayContaining([
        'status:sparse',
        'missing:rating',
        'missing:genres',
        'missing:language',
      ]),
    }));
  });
});
