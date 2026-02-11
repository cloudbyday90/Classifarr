/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for OMDb service
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
    createLogger: jest.fn(() => ({
        info: mockLogger.info,
        warn: mockLogger.warn,
        error: mockLogger.error,
        debug: mockLogger.debug
    }))
}));

// Mock circuit breaker
const mockCircuitBreaker = {
    execute: jest.fn(async (fn) => {
        // Execute the function and let any errors propagate
        return await fn();
    }),
    getStatus: jest.fn(() => ({
        state: 'CLOSED',
        failureCount: 0
    })),
    reset: jest.fn(),
    shouldTripBreaker: jest.fn(() => true)
};

jest.mock('../utils/omdbCircuitBreaker', () => mockCircuitBreaker);

jest.mock('../utils/retryUtils', () => ({
    calculateBackoff: jest.fn((attempt) => 1000 * Math.pow(2, attempt))
}));

const db = require('../config/database');
const omdbService = require('../services/omdb');

describe('OMDbService', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
    });

    describe('Cloudflare Error Handling', () => {
        it('should retry and throw on Cloudflare 523 errors', async () => {
            const today = new Date().toISOString().split('T')[0];
            db.query.mockResolvedValue({
                rows: [{
                    id: 1,
                    api_key: 'test-key',
                    last_reset_date: today,
                    requests_today: 0,
                    daily_limit: 1000
                }]
            });

            mockAxios.get.mockRejectedValue({
                response: { status: 523 },
                message: 'Request failed with status code 523',
                code: undefined  // Explicitly no error code
            });

            const incrementSpy = jest.spyOn(omdbService, 'incrementUsageCounter');

            // Should now throw instead of returning null to trigger Tavily fallback
            try {
                const result = await omdbService.getByTitle('The Goldbergs', 2013, 'series');
                // If we get here, test fails
                fail(`Expected error to be thrown, but got result: ${JSON.stringify(result)}`);
            } catch (error) {
                // Error was thrown as expected
                expect(error).toBeDefined();
            }
            
            // Should retry once before throwing
            expect(mockAxios.get).toHaveBeenCalledTimes(2);
            expect(incrementSpy).not.toHaveBeenCalled();
        });

        it('should retry and throw on other Cloudflare errors (520, 521, 522)', async () => {
            const today = new Date().toISOString().split('T')[0];
            const cloudflareErrors = [520, 521, 522];

            for (const statusCode of cloudflareErrors) {
                jest.clearAllMocks();
                
                db.query.mockResolvedValue({
                    rows: [{
                        id: 1,
                        api_key: 'test-key',
                        last_reset_date: today,
                        requests_today: 0,
                        daily_limit: 1000
                    }]
                });

                mockAxios.get.mockRejectedValue({
                    response: { status: statusCode },
                    message: `Request failed with status code ${statusCode}`,
                    code: undefined  // Explicitly no error code
                });

                const incrementSpy = jest.spyOn(omdbService, 'incrementUsageCounter');

                // Should now throw instead of returning null to trigger Tavily fallback
                try {
                    const result = await omdbService.getByTitle('Test Movie', 2020, 'movie');
                    // If we get here, test fails
                    fail(`Expected error to be thrown for status ${statusCode}, but got result: ${JSON.stringify(result)}`);
                } catch (error) {
                    // Error was thrown as expected
                    expect(error).toBeDefined();
                }
                
                // Should retry once before throwing
                expect(mockAxios.get).toHaveBeenCalledTimes(2);
                expect(incrementSpy).not.toHaveBeenCalled();
            }
        });
    });

    describe('Transient Network Error Handling', () => {
        it('should retry once on ECONNRESET/socket hang up and then throw to trigger fallback', async () => {
            const today = new Date().toISOString().split('T')[0];
            db.query.mockResolvedValue({
                rows: [{
                    id: 1,
                    api_key: 'test-key',
                    last_reset_date: today,
                    requests_today: 0,
                    daily_limit: 1000
                }]
            });

            mockAxios.get.mockRejectedValue({
                message: 'socket hang up',
                code: 'ECONNRESET'
            });

            // Should now throw (after retry) to trigger Tavily fallback path
            await expect(
                omdbService.getByTitle('Cinderella II: Dreams Come True', 2002, 'movie')
            ).rejects.toBeDefined();

            expect(mockAxios.get).toHaveBeenCalledTimes(2);
        });
    });

    describe('IMDB ID transient retries', () => {
        it('should retry once on transient network error for getByIMDBId', async () => {
            const today = new Date().toISOString().split('T')[0];
            db.query.mockResolvedValue({
                rows: [{
                    id: 1,
                    api_key: 'test-key',
                    last_reset_date: today,
                    requests_today: 0,
                    daily_limit: 1000
                }]
            });

            mockAxios.get.mockRejectedValue({
                message: 'socket hang up',
                code: 'ECONNRESET'
            });

            await expect(
                omdbService.getByIMDBId('tt0133093')
            ).rejects.toBeDefined();

            expect(mockAxios.get).toHaveBeenCalledTimes(2);
        });
    });

    describe('Circuit Breaker Logging', () => {
        it('should not emit warn from OMDbService for HALF_OPEN throttling', async () => {
            const breakerError = new Error('OMDb circuit breaker is HALF_OPEN and maximum concurrent attempts have been reached');
            breakerError.code = 'CIRCUIT_BREAKER_HALF_OPEN_THROTTLED';
            breakerError.nextAttempt = null;

            mockCircuitBreaker.execute.mockRejectedValueOnce(breakerError);

            await expect(
                omdbService.getByTitle('The Office (AU)', 2023, 'series')
            ).rejects.toThrow('HALF_OPEN');

            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'OMDb circuit breaker blocked request',
                expect.objectContaining({
                    title: 'The Office (AU)',
                    code: 'CIRCUIT_BREAKER_HALF_OPEN_THROTTLED'
                })
            );
        });
    });
});
