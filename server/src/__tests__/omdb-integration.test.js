/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Integration tests for OMDb service with circuit breaker and rate limiting
 */

const mockAxios = {
    get: jest.fn()
};
jest.mock('axios', () => mockAxios);

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

jest.mock('../utils/logger', () => ({
    createLogger: jest.fn(() => mockLogger)
}));

jest.mock('../utils/retryUtils', () => ({
    calculateBackoff: jest.fn((attempt, options = {}) => {
        const baseDelay = options.baseDelay || 1000;
        return baseDelay;
    })
}));

const db = require('../config/database');

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
    let circuitBreakerModule;

    beforeAll(() => {
        setupDbMock();
        omdbService = require('../services/omdb');
        circuitBreakerModule = require('../utils/omdbCircuitBreaker');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockAxios.get.mockReset();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();

        setupDbMock();
        omdbService._resetRateLimiter();
        circuitBreakerModule.reset();
    });

    describe('Real Examples - Happy Path', () => {
        it('should successfully fetch 5 examples and track state', async () => {
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
            expect(circuitBreakerModule.getStatus().state).toBe('CLOSED');
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

    describe('Circuit Breaker - State Transitions', () => {
        it('should open circuit breaker after 3 consecutive Cloudflare 520 errors', async () => {
            for (let i = 0; i < 10; i++) {
                mockAxios.get.mockRejectedValueOnce({
                    response: { status: 520 },
                    message: 'Request failed with status code 520',
                    code: undefined
                });
            }

            const initialStatus = circuitBreakerModule.getStatus();
            expect(initialStatus.state).toBe('CLOSED');
            expect(initialStatus.failureCount).toBe(0);

            for (let i = 0; i < 3; i++) {
                try {
                    await omdbService.getByTitle(`Test Movie ${i}`, 2020, 'movie');
                } catch (e) {
                    // Expected - Cloudflare error
                }
            }

            const statusAfterFailures = circuitBreakerModule.getStatus();
            expect(statusAfterFailures.state).toBe('OPEN');
            expect(statusAfterFailures.failureCount).toBeGreaterThanOrEqual(3);
        }, 10000);

        it('should reject requests when circuit is OPEN', async () => {
            for (let i = 0; i < 10; i++) {
                mockAxios.get.mockRejectedValueOnce({
                    response: { status: 520 },
                    message: 'Request failed with status code 520'
                });
            }

            for (let i = 0; i < 3; i++) {
                try {
                    await omdbService.getByTitle(`Fail Movie ${i}`, 2020, 'movie');
                } catch (e) {
                    // Expected
                }
            }

            expect(circuitBreakerModule.getStatus().state).toBe('OPEN');

            mockAxios.get.mockResolvedValueOnce(makeOmdbResponse(REAL_EXAMPLES[0]));

            await expect(
                omdbService.getByTitle('The Matrix', 1999, 'movie')
            ).rejects.toThrow('circuit breaker is OPEN');
        }, 10000);

        it('should transition to HALF_OPEN after recovery timeout', async () => {
            const CircuitBreaker = require('../services/circuitBreaker');
            const testBreaker = new CircuitBreaker({
                failureThreshold: 3,
                recoveryTimeout: 100,
                halfOpenMaxAttempts: 2
            });

            for (let i = 0; i < 3; i++) {
                testBreaker.recordFailure(new Error('Test failure'));
            }

            expect(testBreaker.getStatus().state).toBe('OPEN');

            await new Promise(resolve => setTimeout(resolve, 150));

            expect(testBreaker.isAllowed()).toBe(true);
            expect(testBreaker.getStatus().state).toBe('HALF_OPEN');
        });

        it('should close circuit breaker after successful recovery', async () => {
            const CircuitBreaker = require('../services/circuitBreaker');
            const testBreaker = new CircuitBreaker({
                failureThreshold: 3,
                recoveryTimeout: 100,
                halfOpenMaxAttempts: 2
            });

            for (let i = 0; i < 3; i++) {
                testBreaker.recordFailure(new Error('Test failure'));
            }

            expect(testBreaker.getStatus().state).toBe('OPEN');

            await new Promise(resolve => setTimeout(resolve, 150));

            expect(testBreaker.isAllowed()).toBe(true);
            expect(testBreaker.getStatus().state).toBe('HALF_OPEN');

            testBreaker.recordSuccess();
            testBreaker.recordSuccess();

            expect(testBreaker.getStatus().state).toBe('CLOSED');
            expect(testBreaker.getStatus().failureCount).toBe(0);
        });

        it('should reopen circuit if failure occurs during HALF_OPEN', async () => {
            const CircuitBreaker = require('../services/circuitBreaker');
            const testBreaker = new CircuitBreaker({
                failureThreshold: 3,
                recoveryTimeout: 100,
                halfOpenMaxAttempts: 2
            });

            for (let i = 0; i < 3; i++) {
                testBreaker.recordFailure(new Error('Test failure'));
            }

            await new Promise(resolve => setTimeout(resolve, 150));
            testBreaker.isAllowed();

            expect(testBreaker.getStatus().state).toBe('HALF_OPEN');

            testBreaker.recordFailure(new Error('Recovery failed'));

            expect(testBreaker.getStatus().state).toBe('OPEN');
        });
    });

    describe('Cloudflare Error Handling', () => {
        it('should handle 520 error and trip circuit breaker', async () => {
            for (let i = 0; i < 5; i++) {
                mockAxios.get.mockRejectedValueOnce({
                    response: { status: 520 },
                    message: 'Request failed with status code 520'
                });
            }

            for (let i = 0; i < 3; i++) {
                try {
                    await omdbService.getByTitle(`Test 520`, 2020, 'movie');
                } catch (e) {
                    // Expected
                }
            }

            expect(circuitBreakerModule.getStatus().state).toBe('OPEN');
            expect(circuitBreakerModule.getStatus().failureCount).toBeGreaterThanOrEqual(3);
        }, 10000);

        it('should NOT trip circuit breaker on 401 errors', async () => {
            for (let i = 0; i < 5; i++) {
                mockAxios.get.mockRejectedValueOnce({
                    response: { status: 401 },
                    message: 'Unauthorized'
                });
            }

            for (let i = 0; i < 3; i++) {
                try {
                    await omdbService.getByTitle(`Test 401`, 2020, 'movie');
                } catch (e) {
                    // Expected - OMDbLimitReachedError
                }
            }

            const status = circuitBreakerModule.getStatus();
            expect(status.state).toBe('CLOSED');
            expect(status.failureCount).toBe(0);
        }, 10000);

        it('should NOT trip circuit breaker on 404/Not Found responses', async () => {
            for (let i = 0; i < 3; i++) {
                mockAxios.get.mockResolvedValueOnce({
                    data: { Response: 'False', Error: 'Movie not found!' }
                });
            }

            for (let i = 0; i < 3; i++) {
                const result = await omdbService.getByTitle('NonExistent Movie', 2020, 'movie');
                expect(result).toBeNull();
            }

            const status = circuitBreakerModule.getStatus();
            expect(status.state).toBe('CLOSED');
            expect(status.failureCount).toBe(0);
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

    describe('Full Flow Integration', () => {
        it('should handle successes, then failures trip breaker, then block requests', async () => {
            for (let i = 0; i < 3; i++) {
                mockAxios.get.mockResolvedValueOnce(makeOmdbResponse(REAL_EXAMPLES[i]));
            }
            for (let i = 0; i < 5; i++) {
                mockAxios.get.mockRejectedValueOnce({
                    response: { status: 520 },
                    message: 'Request failed with status code 520'
                });
            }

            for (let i = 0; i < 3; i++) {
                const result = await omdbService.getByTitle(
                    REAL_EXAMPLES[i].title,
                    REAL_EXAMPLES[i].year,
                    REAL_EXAMPLES[i].type
                );
                expect(result).not.toBeNull();
            }

            expect(circuitBreakerModule.getStatus().state).toBe('CLOSED');

            for (let i = 0; i < 3; i++) {
                try {
                    await omdbService.getByTitle(`Failing Movie ${i}`, 2020, 'movie');
                } catch (e) {
                    // Expected
                }
            }

            expect(circuitBreakerModule.getStatus().state).toBe('OPEN');

            await expect(
                omdbService.getByTitle('Blocked Movie', 2020, 'movie')
            ).rejects.toThrow('circuit breaker is OPEN');
        }, 15000);

        it('should correctly track success/failure metrics', async () => {
            mockAxios.get.mockResolvedValueOnce(makeOmdbResponse(REAL_EXAMPLES[0]));
            mockAxios.get.mockRejectedValueOnce({
                response: { status: 520 },
                message: 'Request failed with status code 520'
            });
            mockAxios.get.mockResolvedValueOnce(makeOmdbResponse(REAL_EXAMPLES[1]));

            await omdbService.getByTitle('The Matrix', 1999, 'movie');

            try {
                await omdbService.getByTitle('Failing Movie', 2020, 'movie');
            } catch (e) {
                // Expected
            }

            const status = circuitBreakerModule.getStatus();
            expect(status.metrics.successfulRequests).toBeGreaterThanOrEqual(1);
            expect(status.metrics.failedRequests).toBeGreaterThanOrEqual(1);
        }, 10000);
    });

    describe('Circuit Breaker Recovery', () => {
        it('should recover from OPEN to CLOSED after timeout and successful requests', async () => {
            const CircuitBreaker = require('../services/circuitBreaker');
            const testBreaker = new CircuitBreaker({
                failureThreshold: 3,
                recoveryTimeout: 200,
                halfOpenMaxAttempts: 2
            });

            for (let i = 0; i < 3; i++) {
                testBreaker.recordFailure(new Error('Test failure'));
            }

            expect(testBreaker.getStatus().state).toBe('OPEN');

            await new Promise(resolve => setTimeout(resolve, 250));

            expect(testBreaker.isAllowed()).toBe(true);
            expect(testBreaker.getStatus().state).toBe('HALF_OPEN');

            testBreaker.recordSuccess();
            expect(testBreaker.getStatus().state).toBe('HALF_OPEN');

            testBreaker.recordSuccess();
            expect(testBreaker.getStatus().state).toBe('CLOSED');
            expect(testBreaker.getStatus().failureCount).toBe(0);
        });

        it('should track state history through transitions', async () => {
            const CircuitBreaker = require('../services/circuitBreaker');
            const testBreaker = new CircuitBreaker({
                failureThreshold: 2,
                recoveryTimeout: 100,
                halfOpenMaxAttempts: 1
            });

            const history = testBreaker.getStateHistory();
            expect(history.length).toBe(1);
            expect(history[0].state).toBe('CLOSED');

            testBreaker.recordFailure(new Error('Failure 1'));
            testBreaker.recordFailure(new Error('Failure 2'));

            const openHistory = testBreaker.getStateHistory();
            const openEntry = openHistory.find(h => h.to === 'OPEN');
            expect(openEntry).toBeDefined();
            expect(openEntry.reason).toContain('threshold');
        });
    });
});
