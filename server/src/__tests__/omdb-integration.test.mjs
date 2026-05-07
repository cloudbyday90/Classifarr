/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Integration tests for OMDb service with rate limiting
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockAxios = {
    get: jest.fn()
};
jest.mock('axios', () => mockAxios);
jest.unstable_mockModule('axios', () => createMockModule(mockAxios));

const mockDb = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

const mockLoggerModule = {
    createLogger: jest.fn(() => mockLogger)
};

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLoggerModule));

const retryUtils = {
    calculateBackoff: jest.fn((attempt, options = {}) => {
        const baseDelay = options.baseDelay || 1000;
        return baseDelay;
    })
};

const db = mockDb;
const runtimeSettingsPath = path.join(os.tmpdir(), 'classifarr-omdb-integration-test-runtime.json');

process.env.RUNTIME_SETTINGS_FILE = runtimeSettingsPath;
fs.writeFileSync(runtimeSettingsPath, JSON.stringify({
    omdb_request_timeout_ms: 15000,
    omdb_retry_timeout_multiplier: 2,
    omdb_max_request_timeout_ms: 30000,
    omdb_max_retries: 2,
    omdb_ssl_warn_throttle_ms: 900000
}), 'utf8');

const REAL_EXAMPLES = [
    { title: 'The Matrix', year: 1999, type: 'movie', imdbID: 'tt0133093', rated: 'R', genre: 'Action, Sci-Fi' },
    { title: 'Inception', year: 2010, type: 'movie', imdbID: 'tt1375666', rated: 'PG-13', genre: 'Action, Adventure, Sci-Fi' },
    { title: 'Breaking Bad', year: 2008, type: 'series', imdbID: 'tt0903747', rated: 'TV-MA', genre: 'Crime, Drama, Thriller' },
    { title: 'The Dark Knight', year: 2008, type: 'movie', imdbID: 'tt0468569', rated: 'PG-13', genre: 'Action, Crime, Drama' },
    { title: 'Game of Thrones', year: 2011, type: 'series', imdbID: 'tt0944947', rated: 'TV-MA', genre: 'Action, Adventure, Drama' },
    { title: 'Pulp Fiction', year: 1994, type: 'movie', imdbID: 'tt0110912', rated: 'R', genre: 'Crime, Drama' },
    { title: 'The Office', year: 2005, type: 'series', imdbID: 'tt0386676', rated: 'TV-14', genre: 'Comedy' },
    { title: 'Interstellar', year: 2014, type: 'movie', imdbID: 'tt0816692', rated: 'PG-13', genre: 'Adventure, Drama, Sci-Fi' },
    { title: 'Stranger Things', year: 2016, type: 'series', imdbID: 'tt4574334', rated: 'TV-14', genre: 'Drama, Fantasy, Horror' },
    { title: 'The Shawshank Redemption', year: 1994, type: 'movie', imdbID: 'tt0111161', rated: 'R', genre: 'Drama' }
];

function makeOmdbResponse(example) {
    return {
        data: {
            Response: 'True',
            Title: example.title,
            Year: example.year.toString(),
            Rated: example.rated,
            Released: `01 Jan ${example.year}`,
            Runtime: example.type === 'series' ? 'N/A' : '120 min',
            Genre: example.genre,
            Director: 'Test Director',
            Writer: 'Test Writer',
            Actors: 'Test Actor',
            Plot: 'Test plot',
            Language: 'English',
            Country: 'USA',
            Awards: 'None',
            Poster: 'N/A',
            Ratings: [],
            Metascore: 'N/A',
            imdbRating: '8.0',
            imdbVotes: '1,000,000',
            imdbID: example.imdbID,
            Type: example.type,
            BoxOffice: 'N/A',
            Production: 'N/A',
            totalSeasons: example.type === 'series' ? '5' : undefined
        }
    };
}

function setupDbMock() {
    const today = new Date().toISOString().split('T')[0];
    db.query.mockResolvedValue({
        rows: [{
            id: 1,
            api_key: 'test-api-key',
            last_reset_date: today,
            requests_today: 0,
            daily_limit: 1000
        }]
    });
}

describe('OMDb Integration Tests', () => {
    let omdbService;

    afterAll(() => {
        try {
            fs.unlinkSync(runtimeSettingsPath);
        } catch {
            // ignore temp file cleanup failures
        }
    });

    beforeAll(() => {
        setupDbMock();
    });

    beforeAll(async () => {
        ({ omdbService } = await import('../services/omdb.mjs'));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockAxios.get.mockReset();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        retryUtils.calculateBackoff.mockClear();
        omdbService.retryUtils = retryUtils;

        setupDbMock();
        omdbService._resetRateLimiter();
    });

    describe('Real Examples - Happy Path', () => {
        it('should successfully fetch 5 examples', async () => {
            for (let i = 0; i < 5; i++) {
                mockAxios.get.mockResolvedValueOnce(makeOmdbResponse(REAL_EXAMPLES[i]));
            }

            const results = [];
            for (let i = 0; i < 5; i++) {
                const example = REAL_EXAMPLES[i];
                const result = await omdbService.getByTitle(example.title, example.year, example.type);
                results.push(result);
            }

            expect(results).toHaveLength(5);
            expect(results.filter(r => r !== null)).toHaveLength(5);
            expect(results[0].title).toBe('The Matrix');
            expect(results[2].title).toBe('Breaking Bad');
            expect(results[2].type).toBe('series');
        }, 15000);

        it('should handle mixed TV and movie types correctly', async () => {
            for (const example of REAL_EXAMPLES.slice(0, 4)) {
                mockAxios.get.mockResolvedValueOnce(makeOmdbResponse(example));
            }

            const tvResults = [];
            const movieResults = [];

            for (const example of REAL_EXAMPLES.slice(0, 4)) {
                const result = await omdbService.getByTitle(example.title, example.year, example.type);
                if (example.type === 'series') {
                    tvResults.push(result);
                } else {
                    movieResults.push(result);
                }
            }

            expect(tvResults.length).toBe(1);
            expect(movieResults.length).toBe(3);
            expect(tvResults[0].type).toBe('series');
        }, 10000);
    });

    describe('Cloudflare Error Handling', () => {
        it('should retry and throw on Cloudflare 520 errors', async () => {
            for (let i = 0; i < 10; i++) {
                mockAxios.get.mockRejectedValueOnce({
                    response: { status: 520 },
                    message: 'Request failed with status code 520',
                    code: undefined
                });
            }

            await expect(
                omdbService.getByTitle('Test Movie', 2020, 'movie')
            ).rejects.toBeDefined();

            // Should retry once before throwing
            expect(mockAxios.get).toHaveBeenCalledTimes(2);
        }, 10000);

        it('should NOT throw on 401 errors (throws OMDbLimitReachedError)', async () => {
            mockAxios.get.mockRejectedValueOnce({
                response: { status: 401 },
                message: 'Unauthorized'
            });

            await expect(
                omdbService.getByTitle('Test 401', 2020, 'movie')
            ).rejects.toThrow('Unauthorized');
        }, 10000);

        it('should return null on not-found responses', async () => {
            mockAxios.get.mockResolvedValueOnce({
                data: { Response: 'False', Error: 'Movie not found!' }
            });

            const result = await omdbService.getByTitle('NonExistent Movie', 2020, 'movie');
            expect(result).toBeNull();
        }, 10000);
    });

    describe('Rate Limiter', () => {
        it('should enforce minimum delay between sequential requests', async () => {
            const timestamps = [];

            mockAxios.get.mockImplementation(async () => {
                timestamps.push(Date.now());
                return makeOmdbResponse(REAL_EXAMPLES[timestamps.length - 1]);
            });

            omdbService._resetRateLimiter();

            for (let i = 0; i < 3; i++) {
                await omdbService.getByTitle(
                    REAL_EXAMPLES[i].title,
                    REAL_EXAMPLES[i].year,
                    REAL_EXAMPLES[i].type
                );
            }

            expect(timestamps).toHaveLength(3);

            for (let i = 1; i < timestamps.length; i++) {
                const delay = timestamps[i] - timestamps[i - 1];
                expect(delay).toBeGreaterThanOrEqual(900);
            }
        }, 10000);

        it('should allow immediate first request after reset', async () => {
            mockAxios.get.mockResolvedValue(makeOmdbResponse(REAL_EXAMPLES[0]));

            omdbService._resetRateLimiter();

            const start = Date.now();
            await omdbService.getByTitle('The Matrix', 1999, 'movie');
            const elapsed = Date.now() - start;

            expect(elapsed).toBeLessThan(500);
        }, 10000);
    });
});
