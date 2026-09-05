/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for TMDB service
 */

import { jest } from '@jest/globals';
import { createConsoleSpy } from './setup/consoleHelpers.mjs';

import { createLoggerModuleMock } from './helpers/mockFactory.mjs';
const mockHttpGet = jest.fn();
const mockHttpPost = jest.fn();
const mockHttpPut = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({
  httpGet: mockHttpGet,
  httpPost: mockHttpPost,
  httpPut: mockHttpPut,
  httpDelete: jest.fn(),
  httpGetBinary: jest.fn(),
  httpStream: jest.fn(),
  createHttpClient: jest.fn(),
  defaultHttpClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));const mockDb = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => ({
    ...mockDb,
    default: mockDb,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const mockMetadataProviderIntegrityService = {
    warnProviderRuntimeFailure: jest.fn(),
};
jest.unstable_mockModule('../services/metadataProviderIntegrityService.mjs', () => ({
    metadataProviderIntegrityService: mockMetadataProviderIntegrityService,
}));

const mockRateLimiters = {
    tmdb: { execute: jest.fn((fn) => fn()) }
};
jest.unstable_mockModule('../utils/rateLimiter.mjs', () => ({ rateLimiters: mockRateLimiters }));

await import('../config/database.mjs');
const { tmdbService } = await import('../services/tmdb.mjs');
const db = mockDb;
const metadataProviderIntegrityService = mockMetadataProviderIntegrityService;

const rateLimiters = {
    tmdb: {
        execute: jest.fn((fn) => fn())
    }
};

describe('TMDBService', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.restoreAllMocks();
        jest.resetAllMocks();
        rateLimiters.tmdb.execute = jest.fn((fn) => fn());
        tmdbService.apiKey = null;
        tmdbService.rateLimiters = rateLimiters;
        metadataProviderIntegrityService.warnProviderRuntimeFailure.mockReset();
        consoleErrorSpy = createConsoleSpy('error', { suppress: true });
    });

    afterEach(() => {
        consoleErrorSpy.restore();
    });

    describe('getApiKey', () => {
        it('should return cached API key if available', async () => {
            tmdbService.apiKey = 'cached-key';
            const key = await tmdbService.getApiKey();
            expect(key).toBe('cached-key');
            expect(db.query).not.toHaveBeenCalled();
        });

        it('should fetch API key from database', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ api_key: 'db-api-key' }]
            });

            const key = await tmdbService.getApiKey();
            expect(key).toBe('db-api-key');
            expect(db.query).toHaveBeenCalledWith(
                'SELECT api_key FROM tmdb_config WHERE is_active = true LIMIT 1'
            );
        });

        it('should fall back to environment variable', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            process.env.TMDB_API_KEY = 'env-api-key';

            const key = await tmdbService.getApiKey();
            expect(key).toBe('env-api-key');

            delete process.env.TMDB_API_KEY;
        });
    });

    describe('searchIdentityCandidates', () => {
        it.each([
            ['movie', { primary_release_year: '2001' }],
            ['tv', { first_air_date_year: 2001 }],
        ])('preserves pagination and every candidate for %s with separate title/year parameters', async (type, yearParams) => {
            tmdbService.apiKey = 'fixture-only';
            const data = { page: 1, total_pages: 2, total_results: 21,
                results: Array.from({ length: 20 }, (_, i) => ({ id: i + 1 })) };
            mockHttpGet.mockResolvedValueOnce({ data });
            expect(await tmdbService.searchIdentityCandidates('  Example  ', type, '2001')).toBe(data);
            expect(mockHttpGet).toHaveBeenCalledWith(`https://api.themoviedb.org/3/search/${type}`, {
                params: { api_key: 'fixture-only', query: 'Example', page: 1, include_adult: false, ...yearParams },
                timeout: 10000,
            });
            expect(rateLimiters.tmdb.execute).toHaveBeenCalledTimes(1);
        });

        it.each([
            ['Example', 'movie', undefined], ['Example', 'person', 2001], ['', 'movie', 2001],
        ])('rejects invalid request %j before credentials or network access', async (title, type, year) => {
            expect(await tmdbService.searchIdentityCandidates(title, type, year)).toBeNull();
            expect(db.query).not.toHaveBeenCalled();
            expect(mockHttpGet).not.toHaveBeenCalled();
            expect(rateLimiters.tmdb.execute).not.toHaveBeenCalled();
        });

        it('rejects missing credentials without making a request', async () => {
            jest.spyOn(tmdbService, 'getApiKey').mockResolvedValueOnce(null);
            await expect(tmdbService.searchIdentityCandidates('Example', 'movie', 2001)).rejects.toThrow('TMDB API key not configured');
            expect(mockHttpGet).not.toHaveBeenCalled();
        });
    });

    describe('testConnection', () => {
        it('should return success on valid connection', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ api_key: 'test-key' }]
            });
            mockHttpGet.mockResolvedValueOnce({
                data: { images: { base_url: 'https://image.tmdb.org' } }
            });

            const result = await tmdbService.testConnection();
            expect(result.success).toBe(true);
        });

        it('should return error when no API key', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const result = await tmdbService.testConnection();
            expect(result.success).toBe(false);
            expect(result.error).toBe('No API key provided');
        });
    });

    describe('findByExternalId', () => {
        it('should find TV show by TVDB ID', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ api_key: 'test-key' }]
            });
            mockHttpGet.mockResolvedValueOnce({
                data: {
                    tv_results: [{ id: 12345, name: 'Test Show' }],
                    movie_results: []
                }
            });

            const result = await tmdbService.findByExternalId(456789, 'tvdb_id');

            expect(result.tv_results).toHaveLength(1);
            expect(result.tv_results[0].id).toBe(12345);
            expect(mockHttpGet).toHaveBeenCalledWith(
                expect.stringContaining('/find/456789'),
                expect.objectContaining({
                    params: expect.objectContaining({
                        external_source: 'tvdb_id'
                    })
                })
            );
        });

        it('should find movie by IMDB ID', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ api_key: 'test-key' }]
            });
            mockHttpGet.mockResolvedValueOnce({
                data: {
                    movie_results: [{ id: 98765, title: 'Test Movie' }],
                    tv_results: []
                }
            });

            const result = await tmdbService.findByExternalId('tt1234567', 'imdb_id');

            expect(result.movie_results).toHaveLength(1);
            expect(result.movie_results[0].id).toBe(98765);
        });

        it('should return empty results when no API key', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const result = await tmdbService.findByExternalId(123, 'tvdb_id');

            expect(result).toEqual({ movie_results: [], tv_results: [] });
        });

        it('should return empty results on API error', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ api_key: 'test-key' }]
            });
            mockHttpGet.mockRejectedValueOnce(new Error('API timeout'));

            const result = await tmdbService.findByExternalId(123, 'tvdb_id');

            expect(result).toEqual({ movie_results: [], tv_results: [] });
            expect(metadataProviderIntegrityService.warnProviderRuntimeFailure).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: 'tmdb',
                    category: 'external_id_lookup_failed',
                })
            );
        });
    });

    describe('findIdentityByExternalId', () => {
        it.each([[123, 'tvdb_id'], ['tt1234', 'imdb_id']])('preserves the raw result for %j with bounded provider access', async (id, source) => {
            tmdbService.apiKey = 'fixture-only';
            const data = { tv_results: [{ id: 11 }, { id: 12 }], movie_results: [] };
            mockHttpGet.mockResolvedValueOnce({ data });
            expect(await tmdbService.findIdentityByExternalId(id, source)).toBe(data);
            expect(mockHttpGet).toHaveBeenCalledWith(`https://api.themoviedb.org/3/find/${id}`, {
                params: { api_key: 'fixture-only', external_source: source }, timeout: 10000,
            });
            expect(rateLimiters.tmdb.execute).toHaveBeenCalledTimes(1);
        });

        it.each([['../123', 'tvdb_id'], ['tt1/../../config', 'imdb_id'], ['tt1', 'untrusted'], [0, 'tvdb_id']])(
            'rejects invalid identifiers %j before credentials or network access', async (id, source) => {
                expect(await tmdbService.findIdentityByExternalId(id, source)).toBeNull();
                expect(db.query).not.toHaveBeenCalled();
                expect(mockHttpGet).not.toHaveBeenCalled();
                expect(rateLimiters.tmdb.execute).not.toHaveBeenCalled();
            });

        it('preserves outages instead of manufacturing an empty result', async () => {
            tmdbService.apiKey = 'fixture-only';
            const failure = new Error('private upstream diagnostic');
            mockHttpGet.mockRejectedValueOnce(failure);
            await expect(tmdbService.findIdentityByExternalId('tt1234', 'imdb_id')).rejects.toBe(failure);
            expect(metadataProviderIntegrityService.warnProviderRuntimeFailure).not.toHaveBeenCalled();
        });

        it('does not present missing credentials as a successful no-match lookup', async () => {
            jest.spyOn(tmdbService, 'getApiKey').mockResolvedValueOnce(null);
            await expect(tmdbService.findIdentityByExternalId('tt1234', 'imdb_id')).rejects.toThrow('TMDB API key not configured');
            expect(mockHttpGet).not.toHaveBeenCalled();
        });
    });

    describe('getExternalIds', () => {
        it('should return empty object and emit a deduped warning on API error', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ api_key: 'test-key' }]
            });
            mockHttpGet.mockRejectedValueOnce(new Error('API timeout'));

            const result = await tmdbService.getExternalIds(123, 'movie');

            expect(result).toEqual({});
            expect(metadataProviderIntegrityService.warnProviderRuntimeFailure).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: 'tmdb',
                    category: 'external_ids_fetch_failed',
                })
            );
        });
    });

    describe('getCertification', () => {
        it('should return NR and emit a deduped warning on API error', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ api_key: 'test-key' }]
            });
            mockHttpGet.mockRejectedValueOnce(new Error('API timeout'));

            const result = await tmdbService.getCertification(123, 'movie');

            expect(result).toBe('NR');
            expect(metadataProviderIntegrityService.warnProviderRuntimeFailure).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: 'tmdb',
                    category: 'certification_fetch_failed',
                })
            );
        });
    });

    describe('search', () => {
        it('should search for movies by title', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ api_key: 'test-key' }]
            });
            mockHttpGet.mockResolvedValueOnce({
                data: {
                    results: [
                        { id: 123, title: 'Test Movie', media_type: 'movie', release_date: '2023-01-01' }
                    ]
                }
            });

            const result = await tmdbService.search('Test Movie', 'movie');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(123);
            expect(result[0].title).toBe('Test Movie');
        });

        it('should throw error when no API key configured', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            await expect(tmdbService.search('Test')).rejects.toThrow('TMDB API key not configured');
        });
    });

    describe('getMovieDetails', () => {
        it('should fetch movie details by TMDB ID', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ api_key: 'test-key' }]
            });
            mockHttpGet.mockResolvedValueOnce({
                data: {
                    id: 123,
                    title: 'Test Movie',
                    overview: 'A test movie',
                    belongs_to_collection: { id: 456, name: 'Test Collection' }
                }
            });

            const result = await tmdbService.getMovieDetails(123);

            expect(result.id).toBe(123);
            expect(result.title).toBe('Test Movie');
        });
    });

    describe('getTVDetails', () => {
        it('should fetch TV show details by TMDB ID', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ api_key: 'test-key' }]
            });
            mockHttpGet.mockResolvedValueOnce({
                data: {
                    id: 789,
                    name: 'Test Show',
                    number_of_seasons: 3
                }
            });

            const result = await tmdbService.getTVDetails(789);

            expect(result.id).toBe(789);
            expect(result.name).toBe('Test Show');
        });
    });
});
