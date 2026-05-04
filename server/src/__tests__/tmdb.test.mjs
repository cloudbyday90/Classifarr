/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for TMDB service
 */

import { jest } from '@jest/globals';

const mockAxios = {
    get: jest.fn()
};
jest.mock('axios', () => mockAxios);
jest.unstable_mockModule('axios', () => ({
    default: mockAxios,
    ...mockAxios
}));

const mockDb = { query: jest.fn() };
jest.mock('../config/database', () => mockDb);
jest.unstable_mockModule('../config/database', () => ({
    ...mockDb,
    default: mockDb,
}));
jest.unstable_mockModule('../config/database.mjs', () => ({
    ...mockDb,
    default: mockDb,
}));

jest.mock('../utils/logger', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }))
}));
jest.unstable_mockModule('../utils/logger', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }))
}));
jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }))
}));

const mockRateLimiters = {
    tmdb: { execute: jest.fn((fn) => fn()) }
};
jest.mock('../utils/rateLimiter', () => ({ rateLimiters: mockRateLimiters }));
jest.unstable_mockModule('../utils/rateLimiter', () => ({ rateLimiters: mockRateLimiters }));
jest.unstable_mockModule('../utils/rateLimiter.mjs', () => ({ rateLimiters: mockRateLimiters }));

await import('../config/database.mjs');
const { default: tmdbService } = await import('../services/tmdb.mjs');
const { createConsoleSpy } = await import('./setup/consoleHelpers.js');
const db = mockDb;

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
        tmdbService.loadRateLimiters = jest.fn().mockResolvedValue({ rateLimiters });
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

    describe('testConnection', () => {
        it('should return success on valid connection', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ api_key: 'test-key' }]
            });
            mockAxios.get.mockResolvedValueOnce({
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
            mockAxios.get.mockResolvedValueOnce({
                data: {
                    tv_results: [{ id: 12345, name: 'Test Show' }],
                    movie_results: []
                }
            });

            const result = await tmdbService.findByExternalId(456789, 'tvdb_id');

            expect(result.tv_results).toHaveLength(1);
            expect(result.tv_results[0].id).toBe(12345);
            expect(mockAxios.get).toHaveBeenCalledWith(
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
            mockAxios.get.mockResolvedValueOnce({
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
            mockAxios.get.mockRejectedValueOnce(new Error('API timeout'));

            const result = await tmdbService.findByExternalId(123, 'tvdb_id');

            expect(result).toEqual({ movie_results: [], tv_results: [] });
        });
    });

    describe('search', () => {
        it('should search for movies by title', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ api_key: 'test-key' }]
            });
            mockAxios.get.mockResolvedValueOnce({
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
            mockAxios.get.mockResolvedValueOnce({
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
            mockAxios.get.mockResolvedValueOnce({
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
