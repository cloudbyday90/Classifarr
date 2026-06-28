/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPolicyIntentReplayItemFromHistoryRow,
  buildPolicyIntentReplayItemsFromHistoryRows,
} from '../services/policyIntentReplayItemAdapter.mjs';

describe('policyIntentReplayItemAdapter', () => {
  test('converts classification history rows into deterministic policy-engine item shape', () => {
    const item = buildPolicyIntentReplayItemFromHistoryRow({
      id: 101,
      tmdb_id: 10674,
      title: 'Mulan',
      year: 1998,
      media_type: 'movie',
      genre_names: ['Animation', 'Family', 'Animation'],
      primary_studio_name: 'Walt Disney Animation Studios',
      metadata: {
        rating: 'G',
        overview: 'A young woman disguises herself as a soldier.',
        original_language: 'en',
        runtime: 88,
        vote_average: 7.9,
        keywords: [
          { name: 'dragon' },
          'female protagonist',
          'dragon',
        ],
        production_companies: [
          { name: 'Walt Disney Pictures' },
        ],
      },
    });

    expect(item).toEqual(expect.objectContaining({
      schema_version: 1,
      source: 'classification_history',
      title: 'Mulan',
      year: 1998,
      media_type: 'movie',
      certification: 'G',
      overview: 'A young woman disguises herself as a soldier.',
      original_language: 'en',
      runtime: 88,
      vote_average: 7.9,
      rating: 7.9,
      genres: ['Animation', 'Family'],
      keywords: ['dragon', 'female protagonist'],
      studios: ['Walt Disney Animation Studios', 'Walt Disney Pictures'],
      primary_studio_name: 'Walt Disney Animation Studios',
      evidence: expect.objectContaining({
        available: true,
        fields: expect.arrayContaining([
          'title',
          'year',
          'media_type',
          'certification',
          'genres',
          'keywords',
          'studios',
          'original_language',
          'overview',
          'runtime',
          'vote_average',
        ]),
      }),
    }));
    expect(item).not.toHaveProperty('id');
    expect(item).not.toHaveProperty('tmdb_id');
    expect(item).not.toHaveProperty('metadata');
  });

  test('handles malformed metadata and bounds unsupported values', () => {
    const item = buildPolicyIntentReplayItemFromHistoryRow({
      title: '',
      year: 'not-year',
      media_type: 'invalid',
      metadata: '{bad json',
    });

    expect(item).toEqual(expect.objectContaining({
      title: 'Unknown title',
      year: null,
      media_type: null,
      certification: null,
      genres: [],
      keywords: [],
      studios: [],
      original_language: null,
      overview: '',
      runtime: null,
      vote_average: null,
      evidence: {
        available: true,
        fields: ['title'],
      },
    }));
  });

  test('converts arrays of history rows', () => {
    const items = buildPolicyIntentReplayItemsFromHistoryRows([
      { title: 'One', media_type: 'movie' },
      { title: 'Two', media_type: 'tv' },
    ]);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.title)).toEqual(['One', 'Two']);
  });
});
