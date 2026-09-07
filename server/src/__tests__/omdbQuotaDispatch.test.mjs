/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';

const httpGet = jest.fn();
const sleep = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({ httpGet }));
jest.unstable_mockModule('node:timers/promises', () => ({ setTimeout: sleep }));
jest.unstable_mockModule('../config/runtimeSettings.mjs', () => ({ getOmdbRuntimeConfig: () => ({
    maxRetries: 3, requestTimeoutMs: 1000, maxRequestTimeoutMs: 3000, retryTimeoutMultiplier: 2,
}) }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ createLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}) }));
const { getByTitle, getByIMDBId, search, resetRateLimiterState } = await import('../services/omdbLookup.mjs');
const { OMDbLimitReachedError } = await import('../services/omdbQuota.mjs');
let deps;
beforeEach(() => {
    jest.resetAllMocks();
    resetRateLimiterState();
    sleep.mockResolvedValue();
    deps = { checkAndIncrementUsage: jest.fn().mockResolvedValue({ apiKey: 'reserved-fixture', configId: 1 }),
        calculateRetryBackoff: jest.fn().mockResolvedValue(1), shouldLogSslWarning: jest.fn().mockReturnValue(false),
        warnProviderRuntimeFailure: jest.fn(), baseUrl: 'https://omdb.invalid' };
});
const lookups = [
    ['title', () => getByTitle('Fixture', 2026, 'movie', 'untrusted-override', deps)],
    ['IMDb ID', () => getByIMDBId('tt0000001', 'untrusted-override', deps)],
    ['search', () => search('Fixture', 'movie', 'untrusted-override', deps)],
];

test.each(lookups)('%s reserves once before successful dispatch and uses the reserved key', async (_name, run) => {
    httpGet.mockImplementation(async (_url, options) => {
        expect(deps.checkAndIncrementUsage).toHaveBeenCalledTimes(1);
        expect(options.params.apikey).toBe('reserved-fixture');
        return { data: { Response: 'True', Title: 'Fixture', imdbID: 'tt0000001', Type: 'movie', imdbVotes: 'N/A', Ratings: [], Search: [] } };
    });
    await run();
    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(deps.checkAndIncrementUsage).toHaveBeenCalledTimes(1);
});

test.each(lookups)('%s keeps its reservation for a not-found response', async (_name, run) => {
    httpGet.mockResolvedValue({ data: { Response: 'False', Error: 'Movie not found!' } });
    await run();
    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(deps.checkAndIncrementUsage).toHaveBeenCalledTimes(1);
});

test.each(lookups)('%s fails closed on a quota database error without HTTP or provider retry', async (_name, run) => {
    deps.checkAndIncrementUsage.mockRejectedValue(Object.assign(new Error('quota unavailable'), { code: 'ECONNRESET' }));
    await expect(run()).rejects.toThrow('quota unavailable');
    expect(httpGet).not.toHaveBeenCalled();
    expect(deps.checkAndIncrementUsage).toHaveBeenCalledTimes(1);
    expect(deps.calculateRetryBackoff).not.toHaveBeenCalled();
});

test.each(lookups.slice(0, 2))('%s reserves separately for each transient attempt', async (_name, run) => {
    httpGet.mockRejectedValue(Object.assign(new Error('network failure'), { code: 'ECONNRESET' }));
    await expect(run()).rejects.toThrow('network failure');
    expect(httpGet).toHaveBeenCalledTimes(3);
    expect(deps.checkAndIncrementUsage).toHaveBeenCalledTimes(3);
});

test.each(lookups.slice(0, 2))('%s stops retries when the next reservation is denied', async (_name, run) => {
    deps.checkAndIncrementUsage.mockResolvedValueOnce({ apiKey: 'reserved-fixture', configId: 1 })
        .mockRejectedValue(new OMDbLimitReachedError('quota exhausted'));
    httpGet.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));
    await expect(run()).rejects.toThrow('quota exhausted');
    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(deps.checkAndIncrementUsage).toHaveBeenCalledTimes(2);
});

test('pacing completes before quota reservation', async () => {
    httpGet.mockResolvedValue({ data: { Response: 'False', Error: 'Movie not found!' } });
    await getByIMDBId('tt0000001', null, deps);
    const firstReservations = deps.checkAndIncrementUsage.mock.calls.length;
    sleep.mockImplementation(async () => {
        expect(deps.checkAndIncrementUsage).toHaveBeenCalledTimes(firstReservations);
    });
    await getByIMDBId('tt0000002', null, deps);
    expect(sleep).toHaveBeenCalled();
    expect(deps.checkAndIncrementUsage).toHaveBeenCalledTimes(2);
});
