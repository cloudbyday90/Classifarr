/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for classification retry payload helpers.
 */

import {
  buildMetadataEnrichmentPayload,
  buildRetryIdentity,
  buildRetryPayload,
} from '../utils/classificationRetryPayloads.mjs';

describe('classificationRetryPayloads', () => {
  test('buildRetryIdentity normalizes tmdb, title, and year values', () => {
    expect(buildRetryIdentity({
      tmdb_id: '991',
      media_type: 'movie',
      title: '  Example Title  ',
      year: 2026
    }, {})).toEqual({
      tmdbId: 991,
      mediaType: 'movie',
      title: 'example title',
      year: '2026'
    });
  });

  test('buildRetryPayload preserves retry lineage and derived metadata', () => {
    const payload = buildRetryPayload({
      title: 'Retry Item',
      year: 2025,
      tmdb_id: '555',
      media_type: 'movie',
      retry_count: '2',
      max_retries: '4'
    }, {
      overview: 'Plot summary',
      genres: ['Action'],
      keywords: ['hero'],
      content_rating: 'PG-13',
      original_language: 'en',
      requested_seasons: [1, 2],
      include_specials: true,
      source_library_id: '77',
      source_library_name: 'Movies',
      retry_lineage: {
        original_classification_id: 12,
        media_request_ids: [41],
        webhook_log_ids: [88]
      }
    }, 9001);

    expect(payload).toMatchObject({
      title: 'Retry Item',
      year: 2025,
      tmdb_id: 555,
      media_type: 'movie',
      overview: 'Plot summary',
      genres: ['Action'],
      keywords: ['hero'],
      content_rating: 'PG-13',
      original_language: 'en',
      requested_seasons: [1, 2],
      include_specials: true,
      retry_count: 2,
      max_retries: 4,
      source_library_id: 77,
      source_library_name: 'Movies',
      itemId: 9001,
      retry_lineage: {
        original_classification_id: 12,
        media_request_ids: [41],
        webhook_log_ids: [88]
      },
      media: {
        media_type: 'movie',
        tmdbId: 555,
        tvdbId: null,
        title: 'Retry Item',
        year: 2025
      }
    });
  });

  test('buildMetadataEnrichmentPayload returns null without a linked media item', () => {
    expect(buildMetadataEnrichmentPayload({ title: 'x' }, {}, null)).toBeNull();
  });

  test('buildMetadataEnrichmentPayload mirrors retry payload fields for follow-up work', () => {
    const payload = buildMetadataEnrichmentPayload({
      title: 'Retry Item',
      year: 2025,
      overview: 'Plot summary',
      genres: ['Action'],
      keywords: ['hero'],
      content_rating: 'PG-13',
      original_language: 'en',
      tmdb_id: 555,
      source_library_id: 77,
      source_library_name: 'Movies',
      media: { tvdbId: 111, media_type: 'movie' }
    }, {
      imdb_id: 'tt1234567',
      posterPath: '/poster.jpg'
    }, 9001);

    expect(payload).toEqual({
      title: 'Retry Item',
      year: 2025,
      overview: 'Plot summary',
      genres: ['Action'],
      keywords: ['hero'],
      content_rating: 'PG-13',
      original_language: 'en',
      tmdb_id: 555,
      tvdb_id: 111,
      imdb_id: 'tt1234567',
      posterPath: '/poster.jpg',
      itemId: 9001,
      source_library_id: 77,
      source_library_name: 'Movies',
      media: {
        media_type: 'movie'
      }
    });
  });
});
