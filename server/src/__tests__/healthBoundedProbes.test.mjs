/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
const httpGet = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({ httpGet }));
const { probeRadarrConnection, probeSonarrConnection } = await import('../services/healthArrProbe.mjs');
const { probeTmdbConnection, probeOmdbConnection } = await import('../services/healthMetadataProbe.mjs');
const { readHealthProbeJson } = await import('../services/healthProbeRequest.mjs');
beforeEach(() => { httpGet.mockReset().mockResolvedValue({ status: 200, data: {} }); });

test.each([undefined, 0, -1, NaN, Infinity, 30, 999999])('Arr invalid or long timeout %s stays bounded', async timeout => {
    await probeRadarrConnection({ url: 'http://fixture', api_key: 'synthetic', timeout });
    expect(httpGet).toHaveBeenCalledWith('http://fixture/api/v3/system/status', expect.objectContaining({ timeout: 10000, maxResponseBytes: 1048576, redirect: 'error', rejectUnauthorized: true }));
});
test.each([false, true, undefined, 'false', 0])('Arr preserves explicit TLS preference only: %s', async verify_ssl => {
    await probeSonarrConnection({ url: 'https://fixture', api_key: 'synthetic', verify_ssl, timeout: 2 });
    expect(httpGet.mock.calls[0][1]).toMatchObject({ rejectUnauthorized: verify_ssl !== false, timeout: 2000 });
});
test.each([[probeRadarrConnection, 7878], [probeSonarrConnection, 8989]])('legacy defaults remain supported', async (probe, port) => {
    await probe({ api_key: 'synthetic' });
    expect(httpGet.mock.calls[0][0]).toBe(`http://localhost:${port}/api/v3/system/status`);
});
test.each([probeTmdbConnection, probeOmdbConnection])('missing metadata key admits no traffic', async probe => {
    expect(await probe(' ')).toEqual({ success: false, code: 'configuration_invalid' });
    expect(httpGet).not.toHaveBeenCalled();
});
test('metadata uses fixed HTTPS endpoints, original keys and strict transport', async () => {
    await probeTmdbConnection('synthetic'); await probeOmdbConnection('synthetic');
    expect(httpGet.mock.calls[0][0]).toBe('https://api.themoviedb.org/3/configuration');
    expect(httpGet.mock.calls[1][0]).toBe('https://www.omdbapi.com/');
    expect(httpGet.mock.calls[0][1]).toMatchObject({ params: { api_key: 'synthetic' }, timeout: 5000 });
    expect(httpGet.mock.calls[1][1]).toMatchObject({ params: { apikey: 'synthetic', t: 'The Matrix', y: 1999 }, timeout: 10000 });
    for (const [, options] of httpGet.mock.calls) expect(options).toMatchObject({ maxResponseBytes: 1048576, redirect: 'error', rejectUnauthorized: true });
});
test('shared transport preserves existing AI/media defaults', async () => {
    await readHealthProbeJson('https://fixture', { 'X-Fixture': 'synthetic' });
    expect(httpGet.mock.calls[0][1]).toMatchObject({ timeout: 10000, maxResponseBytes: 1048576, redirect: 'error', rejectUnauthorized: true });
});
