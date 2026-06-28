/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import { createPolicyIntentReplayTmdbMetadataFetcher } from '../services/policyIntentReplayTmdbProviderClient.mjs';

describe('policyIntentReplayTmdbProviderClient', () => {
  test('routes movie samples through getMovieDetails', async () => {
    const tmdbService = {
      getMovieDetails: jest.fn().mockResolvedValue({ id: 10674 }),
      getTVDetails: jest.fn(),
    };
    const fetcher = createPolicyIntentReplayTmdbMetadataFetcher({ tmdbService });

    await expect(fetcher({ tmdbId: '10674', mediaType: 'movie' }))
      .resolves.toEqual({ id: 10674 });

    expect(tmdbService.getMovieDetails).toHaveBeenCalledWith(10674);
    expect(tmdbService.getTVDetails).not.toHaveBeenCalled();
  });

  test('routes tv samples through getTVDetails', async () => {
    const tmdbService = {
      getMovieDetails: jest.fn(),
      getTVDetails: jest.fn().mockResolvedValue({ id: 1399 }),
    };
    const fetcher = createPolicyIntentReplayTmdbMetadataFetcher({ tmdbService });

    await expect(fetcher({ tmdbId: 1399, mediaType: 'tv' }))
      .resolves.toEqual({ id: 1399 });

    expect(tmdbService.getTVDetails).toHaveBeenCalledWith(1399);
    expect(tmdbService.getMovieDetails).not.toHaveBeenCalled();
  });

  test('rejects invalid service or invalid tmdb identity', async () => {
    expect(() => createPolicyIntentReplayTmdbMetadataFetcher({ tmdbService: {} }))
      .toThrow('getMovieDetails');

    const fetcher = createPolicyIntentReplayTmdbMetadataFetcher({
      tmdbService: { getMovieDetails: jest.fn() },
    });

    await expect(fetcher({ tmdbId: 0, mediaType: 'movie' }))
      .rejects.toThrow('valid tmdbId');
  });
});
