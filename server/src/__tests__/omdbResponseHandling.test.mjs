/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';

const httpGet = jest.fn();
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({ httpGet }));
jest.unstable_mockModule('node:timers/promises', () => ({ setTimeout: jest.fn() }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ createLogger: () => logger }));
const { getByTitle, getByIMDBId, search, resetRateLimiterState } = await import('../services/omdbLookup.mjs');
const { checkHealth, testConnection } = await import('../services/omdbHealth.mjs');
const valid = { Response: 'True', Title: 'Fixture', imdbID: 'tt0000001', Type: 'movie' };
let deps;
beforeEach(() => {
    jest.clearAllMocks();
    httpGet.mockReset();
    resetRateLimiterState();
    deps = { checkAndIncrementUsage: jest.fn().mockResolvedValue({ apiKey: 'fixture-key' }),
        calculateRetryBackoff: jest.fn(), shouldLogSslWarning: jest.fn(), warnProviderRuntimeFailure: jest.fn(),
        baseUrl: 'https://omdb.invalid' };
});
const lookups = [
    ['title', () => getByTitle('Fixture', 2026, 'movie', null, deps)],
    ['ID', () => getByIMDBId('tt0000001', null, deps)],
    ['search', () => search('Fixture', 'movie', null, deps)],
];

test.each(lookups)('%s distinguishes operational failures from misses without immediate retry', async (_name, run) => {
    for (const [Error, name, code] of [
        ['Invalid API key!', 'OMDbProviderError', 'OMDB_AUTHENTICATION'],
        ['Request limit reached!', 'OMDbLimitReachedError', undefined],
        ['Error getting data.', 'OMDbProviderError', 'OMDB_PROVIDER_ERROR'],
        ['private-fixture-key Movie not found!', 'OMDbProviderError', 'OMDB_PROVIDER_ERROR'],
    ]) {
        httpGet.mockResolvedValue({ status: 200, data: { Response: 'False', Error } });
        await expect(run()).rejects.toMatchObject({ name, ...(code ? { code } : {}) });
    }
    expect(httpGet).toHaveBeenCalledTimes(4);
    expect(deps.checkAndIncrementUsage).toHaveBeenCalledTimes(4);
    expect(deps.calculateRetryBackoff).not.toHaveBeenCalled();
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('private-fixture-key');
});

test.each(lookups)('%s distinguishes HTTP 401 auth from an explicit quota body', async (_name, run) => {
    httpGet.mockRejectedValue({ response: { status: 401, data: { Response: 'False', Error: 'Request limit reached!' } } });
    await expect(run()).rejects.toMatchObject({ name: 'OMDbLimitReachedError' });
    httpGet.mockRejectedValue({ response: { status: 401, data: '<html>private-fixture-key</html>' } });
    await expect(run()).rejects.toMatchObject({ name: 'OMDbProviderError', code: 'OMDB_AUTHENTICATION' });
    expect(httpGet).toHaveBeenCalledTimes(2);
    expect(deps.calculateRetryBackoff).not.toHaveBeenCalled();
});

test.each(lookups)('%s rejects invalid payloads without a formatter exception', async (_name, run) => {
    httpGet.mockResolvedValue({ status: 200, data: { Response: 'True', Title: 'Fixture', Ratings: {} } });
    await expect(run()).rejects.toMatchObject({ code: 'OMDB_INVALID_RESPONSE' });
});

test.each(lookups)('%s does not retry an explicit quota response on HTTP 429', async (_name, run) => {
    httpGet.mockRejectedValue({ response: { status: 429, data: { Response: 'False', Error: 'Request limit reached!' } } });
    await expect(run()).rejects.toMatchObject({ name: 'OMDbLimitReachedError' });
    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(deps.checkAndIncrementUsage).toHaveBeenCalledTimes(1);
});

test('transient HTTP retry diagnostics retain status without upstream bodies or credentials', async () => {
    httpGet.mockRejectedValue({ message: 'private-fixture-key',
        response: { status: 503, data: 'private-fixture-key' }, config: { apikey: 'private-fixture-key' } });
    await expect(getByIMDBId('tt0000001', null, deps)).rejects.toMatchObject({ response: { status: 503 } });
    expect(deps.calculateRetryBackoff).toHaveBeenCalled();
    expect(JSON.stringify([logger.warn.mock.calls, deps.warnProviderRuntimeFailure.mock.calls]))
        .not.toContain('private-fixture-key');
});

test.each(lookups)('%s returns absent evidence only for a confirmed miss', async (name, run) => {
    httpGet.mockResolvedValue({ status: 200, data: { Response: 'False', Error: 'Movie not found!' } });
    expect(await run()).toEqual(name === 'search' ? [] : null);
});

test.each([
    [200, { Response: 'False', Error: 'Invalid API key!' }, 'authentication'],
    [200, { Response: 'False', Error: 'Request limit reached!' }, 'request limit'],
    [401, { Response: 'False', Error: 'Movie not found!' }, 'authentication'],
    [429, {}, 'rate limited'], [503, valid, 'could not complete'],
    [200, { Response: 'False', Error: 'private-fixture-key' }, 'could not complete'],
    [200, null, 'invalid response'], [200, { Response: 'True' }, 'invalid response'],
])('health and connection test reject failed HTTP %i response %#', async (status, data, message) => {
    if (status >= 400) httpGet.mockRejectedValue({ response: { status, data } });
    else httpGet.mockResolvedValue({ status, data });
    const health = await checkHealth(deps.baseUrl, 'fixture-key');
    const connection = await testConnection(deps.baseUrl, 'fixture-key');
    expect(health).toMatchObject({ healthy: false, ssl_error: false, api_reachable: true });
    expect(connection.success).toBe(false);
    expect(health.message).toContain(message);
    expect(connection.error).toContain(message);
    expect(JSON.stringify([health, connection])).not.toContain('fixture-key');
});

test('arbitrary-title health allows a miss but the fixed-title connection test does not', async () => {
    httpGet.mockResolvedValue({ status: 200, data: { Response: 'False', Error: 'Movie not found!' } });
    expect(await checkHealth(deps.baseUrl, 'fixture-key')).toMatchObject({ healthy: true, api_reachable: true });
    expect(await testConnection(deps.baseUrl, 'fixture-key')).toEqual({ success: false, error: 'OMDb not found' });
});

test('valid probes succeed without reserving stored quota', async () => {
    httpGet.mockResolvedValue({ status: 200, data: valid });
    expect(await checkHealth(deps.baseUrl, 'fixture-key')).toMatchObject({ healthy: true });
    expect(await testConnection(deps.baseUrl, 'fixture-key')).toMatchObject({ success: true, data: valid });
    expect(deps.checkAndIncrementUsage).not.toHaveBeenCalled();
    expect(httpGet.mock.calls.every(([, options]) => options.timeout === 10000)).toBe(true);
});

test.each(['CERT_HAS_EXPIRED', 'ETIMEDOUT', 'ECONNABORTED', 'ECONNRESET'])('sanitizes probe %s failures', async code => {
    httpGet.mockRejectedValue(Object.assign(new Error('private-fixture-key'), { code }));
    const health = await checkHealth(deps.baseUrl, 'fixture-key');
    expect(health).toMatchObject({ healthy: false, api_reachable: false, ssl_error: code === 'CERT_HAS_EXPIRED' });
    const connection = await testConnection(deps.baseUrl, 'fixture-key');
    expect(connection.success).toBe(false);
    expect(JSON.stringify([health, connection])).not.toContain('fixture-key');
});
