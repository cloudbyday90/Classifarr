/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for OMDb service
 */

import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

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
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

const mockLoggerModule = {
    createLogger: jest.fn(() => ({
        info: mockLogger.info,
        warn: mockLogger.warn,
        error: mockLogger.error,
        debug: mockLogger.debug
    }))
};

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLoggerModule));

const retryUtils = {
    calculateBackoff: jest.fn((attempt) => 1000 * Math.pow(2, attempt))
};

const runtimeSettingsPath = path.join(os.tmpdir(), 'classifarr-omdb-test-runtime.json');
process.env.RUNTIME_SETTINGS_FILE = runtimeSettingsPath;
process.env.OMDB_REQUEST_TIMEOUT_MS = '15000';
process.env.OMDB_MAX_RETRIES = '2';
process.env.OMDB_RETRY_TIMEOUT_MULTIPLIER = '2';
process.env.OMDB_MAX_REQUEST_TIMEOUT_MS = '30000';

fs.writeFileSync(runtimeSettingsPath, JSON.stringify({
    omdb_request_timeout_ms: 15000,
    omdb_retry_timeout_multiplier: 2,
    omdb_max_request_timeout_ms: 30000,
    omdb_max_retries: 2,
    omdb_ssl_warn_throttle_ms: 900000
}), 'utf8');

const db = mockDb;
const { omdbService } = await import('../services/omdb.mjs');

describe('OMDbService', () => {
    let metadataProviderIntegrityService;

    afterAll(() => {
        try {
            fs.unlinkSync(runtimeSettingsPath);
        } catch {
            // ignore temp file cleanup failures
        }
    });

    beforeEach(() => {
        jest.restoreAllMocks();
        jest.resetAllMocks();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        retryUtils.calculateBackoff.mockClear();
        omdbService.retryUtils = retryUtils;
        metadataProviderIntegrityService = {
            warnProviderRuntimeFailure: jest.fn()
        };
        omdbService.metadataProviderIntegrityService = metadataProviderIntegrityService;
        omdbService._resetRateLimiter();
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

            mockHttpGet.mockRejectedValue({
                response: { status: 523 },
                message: 'Request failed with status code 523',
                code: undefined  // Explicitly no error code
            });

            const incrementSpy = jest.spyOn(omdbService, 'incrementUsageCounter');

            // Should now throw instead of returning null to trigger Tavily fallback
            await expect(omdbService.getByTitle('The Goldbergs', 2013, 'series')).rejects.toBeDefined();

            // Should retry once before throwing
            expect(mockHttpGet).toHaveBeenCalledTimes(2);
            expect(incrementSpy).not.toHaveBeenCalled();
        });

        it('should retry and throw on other Cloudflare errors (520, 521, 522)', async () => {
            const today = new Date().toISOString().split('T')[0];
            const cloudflareErrors = [520, 521];

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

                mockHttpGet.mockRejectedValue({
                    response: { status: statusCode },
                    message: `Request failed with status code ${statusCode}`,
                    code: undefined  // Explicitly no error code
                });

                const incrementSpy = jest.spyOn(omdbService, 'incrementUsageCounter');

                // Should now throw instead of returning null to trigger Tavily fallback
                await expect(omdbService.getByTitle('Test Movie', 2020, 'movie')).rejects.toBeDefined();

                // Should retry once before throwing
                expect(mockHttpGet).toHaveBeenCalledTimes(2);
                expect(incrementSpy).not.toHaveBeenCalled();
            }
        });

        it('should retry and throw on Cloudflare 522 error specifically', async () => {
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

            mockHttpGet.mockRejectedValue({
                response: { status: 522 },
                message: 'Request failed with status code 522',
                code: undefined
            });

            await expect(
                omdbService.getByTitle('Test Movie 522', 2020, 'movie')
            ).rejects.toBeDefined();

            expect(mockHttpGet).toHaveBeenCalledTimes(2);
        });

        it.each([504, 525, 526, 527, 530])(
            'should retry and throw on Cloudflare/gateway status %i',
            async (statusCode) => {
                const today = new Date().toISOString().split('T')[0];
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

                mockHttpGet.mockRejectedValue({
                    response: { status: statusCode },
                    message: `Request failed with status code ${statusCode}`,
                    code: undefined
                });

                await expect(
                    omdbService.getByTitle('Test Movie', 2020, 'movie')
                ).rejects.toBeDefined();

                // Should retry before throwing
                expect(mockHttpGet).toHaveBeenCalledTimes(2);
            }
        );

        it('should retry and throw on 429 rate-limit response', async () => {
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

            mockHttpGet.mockRejectedValue({
                response: { status: 429 },
                message: 'Request failed with status code 429',
                code: undefined
            });

            await expect(
                omdbService.getByTitle('Test Movie', 2020, 'movie')
            ).rejects.toBeDefined();

            expect(mockHttpGet).toHaveBeenCalledTimes(2);
        });
    });

    describe('Rate Limiter', () => {
        const mockOmdbResponse = {
            Response: 'True',
            Title: 'Test',
            Year: '2020',
            Rated: 'PG-13',
            Released: '01 Jan 2020',
            Runtime: '120 min',
            Genre: 'Drama',
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
            imdbRating: '7.0',
            imdbVotes: '1,000',
            imdbID: 'tt0000000',
            Type: 'movie',
            BoxOffice: 'N/A',
            Production: 'N/A'
        };

        it('should enforce minimum delay between requests', async () => {
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

            mockHttpGet.mockResolvedValue({ data: mockOmdbResponse });

            omdbService._resetRateLimiter();
            const start1 = Date.now();
            await omdbService.getByTitle('Movie 1', 2020, 'movie');
            const elapsed1 = Date.now() - start1;

            const start2 = Date.now();
            await omdbService.getByTitle('Movie 2', 2020, 'movie');
            const elapsed2 = Date.now() - start2;

            expect(elapsed1).toBeLessThan(100);
            expect(elapsed2).toBeGreaterThanOrEqual(900);
            expect(mockHttpGet).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ timeout: 15000 })
            );
        });

        it('should not delay when enough time has passed', async () => {
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

            mockHttpGet.mockResolvedValue({ data: mockOmdbResponse });

            omdbService._resetRateLimiter();
            await omdbService.getByTitle('Movie 1', 2020, 'movie');

            await new Promise(resolve => setTimeout(resolve, 1100));

            const start = Date.now();
            await omdbService.getByTitle('Movie 2', 2020, 'movie');
            const elapsed = Date.now() - start;

            expect(elapsed).toBeLessThan(100);
        });

        it('should reset rate limiter state', () => {
            omdbService._resetRateLimiter();
            expect(omdbService._resetRateLimiter).toBeDefined();
        });

        it('should serialize concurrent requests to honor minimum interval', async () => {
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

            mockHttpGet.mockResolvedValue({ data: mockOmdbResponse });

            omdbService._resetRateLimiter();
            const start = Date.now();
            await Promise.all([
                omdbService.getByTitle('Concurrent Movie 1', 2020, 'movie'),
                omdbService.getByTitle('Concurrent Movie 2', 2021, 'movie')
            ]);
            const elapsed = Date.now() - start;

            expect(elapsed).toBeGreaterThanOrEqual(900);
            expect(mockHttpGet).toHaveBeenCalledTimes(2);
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

            mockHttpGet.mockRejectedValue({
                message: 'socket hang up',
                code: 'ECONNRESET'
            });

            // Should now throw (after retry) to trigger Tavily fallback path
            await expect(
                omdbService.getByTitle('Cinderella II: Dreams Come True', 2002, 'movie')
            ).rejects.toBeDefined();

            expect(mockHttpGet).toHaveBeenCalledTimes(2);
        });

        it('should increase request timeout on retry attempt', async () => {
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

            mockHttpGet.mockRejectedValue({
                message: 'socket hang up',
                code: 'ECONNRESET'
            });

            await expect(
                omdbService.getByTitle('Retry Timeout Test', 2024, 'movie')
            ).rejects.toBeDefined();

            expect(mockHttpGet).toHaveBeenCalledTimes(2);
            expect(mockHttpGet.mock.calls[0][1].timeout).toBe(15000);
            expect(mockHttpGet.mock.calls[1][1].timeout).toBe(30000);
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

            mockHttpGet.mockRejectedValue({
                message: 'socket hang up',
                code: 'ECONNRESET'
            });

            await expect(
                omdbService.getByIMDBId('tt0133093')
            ).rejects.toBeDefined();

            expect(mockHttpGet).toHaveBeenCalledTimes(2);
        });
    });

    describe('SSL certificate warning suppression', () => {
        it('should log OMDb SSL warning once and suppress repeated warnings during throttle window', async () => {
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

            const certError = new Error('certificate has expired');
            certError.code = 'CERT_HAS_EXPIRED';
            mockHttpGet.mockRejectedValue(certError);

            await expect(omdbService.getByTitle('Kill Bill', 2004, 'movie')).rejects.toBeDefined();
            const secondError = await omdbService.getByTitle('The Matrix', 1999, 'movie').catch(error => error);

            expect(secondError.isOmdbSslCertError).toBe(true);

            const sslWarnCalls = mockLogger.warn.mock.calls.filter(([message]) => message === 'OMDb SSL certificate issue');
            expect(sslWarnCalls).toHaveLength(1);

            const suppressedDebugCalls = mockLogger.debug.mock.calls.filter(([message]) => message === 'OMDb SSL certificate warning suppressed');
            expect(suppressedDebugCalls).toHaveLength(1);
        });

        it('should reset SSL warning suppression state with _resetRateLimiter', async () => {
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

            const certError = new Error('certificate has expired');
            certError.code = 'CERT_HAS_EXPIRED';
            mockHttpGet.mockRejectedValue(certError);

            await expect(omdbService.getByTitle('Movie A', 2020, 'movie')).rejects.toBeDefined();
            omdbService._resetRateLimiter();
            await expect(omdbService.getByTitle('Movie B', 2021, 'movie')).rejects.toBeDefined();

            const sslWarnCalls = mockLogger.warn.mock.calls.filter(([message]) => message === 'OMDb SSL certificate issue');
            expect(sslWarnCalls).toHaveLength(2);
        });
    });

    describe('hasRemainingQuota', () => {
        it('should return available when under limit', async () => {
            const today = new Date().toLocaleDateString('en-CA');
            db.query.mockResolvedValue({
                rows: [{
                    id: 1,
                    api_key: 'test-key',
                    last_reset_date: today,
                    requests_today: 50,
                    daily_limit: 1000
                }]
            });

            const result = await omdbService.hasRemainingQuota();

            expect(result.available).toBe(true);
            expect(result.used).toBe(50);
            expect(result.limit).toBe(1000);
        });

        it('should return unavailable when at limit', async () => {
            const today = new Date().toLocaleDateString('en-CA');
            db.query.mockResolvedValue({
                rows: [{
                    id: 1,
                    api_key: 'test-key',
                    last_reset_date: today,
                    requests_today: 1000,
                    daily_limit: 1000
                }]
            });

            const result = await omdbService.hasRemainingQuota();

            expect(result.available).toBe(false);
            expect(result.used).toBe(1000);
            expect(result.limit).toBe(1000);
        });

        it('should return unavailable when over limit', async () => {
            const today = new Date().toLocaleDateString('en-CA');
            db.query.mockResolvedValue({
                rows: [{
                    id: 1,
                    api_key: 'test-key',
                    last_reset_date: today,
                    requests_today: 1005,
                    daily_limit: 1000
                }]
            });

            const result = await omdbService.hasRemainingQuota();

            expect(result.available).toBe(false);
            expect(result.used).toBe(1005);
        });

        it('should reset counter if new day', async () => {
            const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
            db.query.mockResolvedValue({
                rows: [{
                    id: 1,
                    api_key: 'test-key',
                    last_reset_date: yesterday,
                    requests_today: 1000,
                    daily_limit: 1000
                }]
            });

            const result = await omdbService.hasRemainingQuota();

            expect(result.available).toBe(true);
            expect(result.used).toBe(0);
        });

        it('should return unavailable if no API key configured', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const result = await omdbService.hasRemainingQuota();

            expect(result.available).toBe(false);
            expect(result.reason).toBe('OMDb API key not configured');
        });

        it('should return unavailable on database error', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const result = await omdbService.hasRemainingQuota();

            expect(result.available).toBe(false);
            expect(result.reason).toBe('Database error');
        });

        it('dedupes daily limit warnings through metadata provider integrity service', async () => {
            const today = new Date().toLocaleDateString('en-CA');
            db.query.mockResolvedValue({
                rows: [{
                    id: 1,
                    api_key: 'test-key',
                    last_reset_date: today,
                    requests_today: 1000,
                    daily_limit: 1000
                }]
            });

            await expect(omdbService.checkAndIncrementUsage()).rejects.toThrow('OMDb daily limit');

            expect(metadataProviderIntegrityService.warnProviderRuntimeFailure).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: 'omdb',
                    category: 'daily_limit',
                    message: 'OMDb daily limit reached'
                })
            );
        });
    });

    describe('provider unavailability warning dedupe', () => {
        it('routes repeated provider-unavailable warnings through metadata provider integrity service after retries', async () => {
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

            mockHttpGet.mockRejectedValue({
                message: 'socket hang up',
                code: 'ECONNRESET'
            });

            await expect(omdbService.getByTitle('Retry Movie', 2024, 'movie')).rejects.toBeDefined();

            expect(metadataProviderIntegrityService.warnProviderRuntimeFailure).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: 'omdb',
                    category: 'unavailable_after_retries',
                    message: 'OMDb API unavailable after retries'
                })
            );
        });
    });
});
