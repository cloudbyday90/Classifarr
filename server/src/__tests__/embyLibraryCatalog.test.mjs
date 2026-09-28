/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import { legacyEmbyCatalog, jellyfinCatalog, embyQueryPages, plexCatalog, expectedCatalog } from './fixtures/libraryCatalogCompatibility.mjs';
const httpGet = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({ httpGet }));
const { embyService } = await import('../services/mediaServers/emby.mjs');
const { jellyfinService } = await import('../services/mediaServers/jellyfin.mjs');
const { plexService } = await import('../services/mediaServers/plex.mjs');
const { EMBY_CATALOG_PAGE_SIZE, EMBY_CATALOG_MAX_PAGES, EMBY_CATALOG_DEADLINE_MS } = await import('../services/mediaServers/embyLibraryCatalog.mjs');
const base = 'http://synthetic.invalid/emby/', secret = 'synthetic-private-token';
const read = (options = {}) => embyService.getLibraryCatalog(base, secret, options);
const failure = status => Object.assign(new Error(`secret ${secret}`), { response: { status, data: { token: secret } } });
const entry = id => ({ Id: String(id), Name: `Library ${id}`, CollectionType: 'movies' });
beforeEach(() => httpGet.mockReset());
afterEach(() => jest.restoreAllMocks());

test('current Emby combines short pages, identity aliases and unsupported entries without retaining sensitive fields', async () => {
  for (const data of embyQueryPages) httpGet.mockResolvedValueOnce({ data });
  expect(await read()).toEqual(expectedCatalog);
  expect(httpGet.mock.calls.map(([url, options]) => [url, options.params])).toEqual([
    [`${base}Library/VirtualFolders/Query`, { StartIndex: 0, Limit: EMBY_CATALOG_PAGE_SIZE }],
    [`${base}Library/VirtualFolders/Query`, { StartIndex: 1, Limit: EMBY_CATALOG_PAGE_SIZE }],
  ]);
  const options = httpGet.mock.calls[0][1];
  expect(options).toMatchObject({ timeout: 10000, maxResponseBytes: 4194304,
    headers: { 'X-Emby-Token': secret, Accept: 'application/json' } });
  expect(httpGet.mock.calls[1][1].signal).toBe(options.signal);
});

test.each([404, 405])('initial HTTP %i permits only the independently validated legacy array', async status => {
  httpGet.mockRejectedValueOnce(failure(status)).mockResolvedValueOnce({ data: legacyEmbyCatalog });
  expect(await read()).toEqual(expectedCatalog);
  expect(httpGet.mock.calls[1][0]).toBe(`${base}Library/VirtualFolders`);
  expect(httpGet.mock.calls[1][1].params).toBeUndefined();
  expect(httpGet.mock.calls[1][1].signal).toBe(httpGet.mock.calls[0][1].signal);
  httpGet.mockResolvedValueOnce({ data: { Items: [], TotalRecordCount: 0 } });
  expect(await read()).toEqual([]);
  expect(httpGet.mock.calls[2][0]).toBe(`${base}Library/VirtualFolders/Query`);
});

test('Jellyfin and Plex retain their independent contracts; only normalized movie/TV items are ingested', async () => {
  httpGet.mockResolvedValueOnce({ data: jellyfinCatalog });
  expect(await jellyfinService.getLibraryCatalog(base, secret)).toEqual(expectedCatalog);
  expect(httpGet.mock.calls[0][0]).toBe(`${base}Library/VirtualFolders`);
  httpGet.mockResolvedValueOnce({ data: plexCatalog });
  expect(await plexService.getLibraryCatalog(base.slice(0, -1), secret)).toEqual(expectedCatalog);
  for (const data of embyQueryPages) httpGet.mockResolvedValueOnce({ data });
  expect(await embyService.getLibraries(base, secret)).toEqual(expectedCatalog.slice(0, 2));
});

test.each([['ETIMEDOUT', 'timeout'], ['ECONNREFUSED', 'unreachable'], ['ABORT_ERR', 'cancelled']])
  ('Jellyfin preserves %s classification and recovers on a later scan without fallback', async (code, reason) => {
    const onContract = jest.fn();
    httpGet.mockRejectedValueOnce(Object.assign(new Error(secret), { code }));
    const error = await jellyfinService.getLibraryCatalog(base, secret, { onContract }).catch(error => error);
    expect(error).toMatchObject({ catalogDiagnostic: { reason, httpStatus: null } });
    expect(JSON.stringify(error)).not.toContain(secret);
    expect(onContract).toHaveBeenCalledWith('jellyfin_virtual_folders');
    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(httpGet.mock.calls[0][1]).toMatchObject({ timeout: 10000, maxResponseBytes: 4194304 });
    httpGet.mockResolvedValueOnce({ data: jellyfinCatalog });
    expect(await jellyfinService.getLibraryCatalog(base, secret)).toEqual(expectedCatalog);
    expect(httpGet.mock.calls.map(([url]) => url)).toEqual([`${base}Library/VirtualFolders`, `${base}Library/VirtualFolders`]);
  });

test('an unsupported-only page advances by received entries before filtering', async () => {
  httpGet.mockResolvedValueOnce({ data: { Items: [legacyEmbyCatalog[2]], TotalRecordCount: 3 } })
    .mockResolvedValueOnce({ data: { Items: legacyEmbyCatalog.slice(0, 2), TotalRecordCount: 3 } });
  expect(await embyService.getLibraries(base, secret)).toEqual(expectedCatalog.slice(0, 2));
  expect(httpGet.mock.calls[1][1].params.StartIndex).toBe(1);
  expect(httpGet).toHaveBeenCalledTimes(2);
});

test.each([401, 403, 429, 500, 501, 502, '404', undefined])('HTTP %s never negotiates a legacy endpoint or exposes the response', async status => {
  httpGet.mockRejectedValue(failure(status));
  const error = await read().catch(error => error);
  expect(error).toMatchObject({ code: 'library_catalog_unavailable', status: 503 });
  expect(JSON.stringify(error)).not.toContain(secret);
  expect(httpGet).toHaveBeenCalledTimes(1);
});

test.each([
  null, [], legacyEmbyCatalog, {}, { Items: [] }, { Items: [], TotalRecordCount: '0' },
  { Items: [], TotalRecordCount: -1 }, { Items: [], TotalRecordCount: 0.5 },
  { Items: [], TotalRecordCount: 1001 }, { Items: [], TotalRecordCount: 1 },
  { Items: [entry(1)], TotalRecordCount: 0 }, { Items: [entry(1)], TotalRecordCount: 1, StartIndex: 1 },
  { Items: [null], TotalRecordCount: 1 }, { Items: [{ ...entry(1), ItemId: 'other' }], TotalRecordCount: 1 },
  { Items: [{ ...entry(1), ItemId: '' }], TotalRecordCount: 1 },
  { Items: Array.from({ length: 101 }, (_, i) => entry(i)), TotalRecordCount: 101 },
])('malformed/ambiguous current response %# never falls back or returns partial success', async data => {
  httpGet.mockResolvedValue({ data });
  await expect(read()).rejects.toMatchObject({ code: 'library_catalog_invalid' });
  expect(httpGet).toHaveBeenCalledTimes(1);
});

test.each([
  { Items: [], TotalRecordCount: 2 },
  { Items: [entry(1)], TotalRecordCount: 2 },
  { Items: [entry(2)], TotalRecordCount: 3 },
  { Items: [entry(2)], TotalRecordCount: 2, StartIndex: 0 },
])('invalid later page %# discards the earlier page', async data => {
  httpGet.mockResolvedValueOnce({ data: { Items: [entry(1)], TotalRecordCount: 2 } }).mockResolvedValueOnce({ data });
  await expect(read()).rejects.toMatchObject({ code: 'library_catalog_invalid' });
  expect(httpGet).toHaveBeenCalledTimes(2);
});

test.each([404, 405, 401, 503])('later HTTP %i cannot switch catalog endpoints mid-enumeration', async status => {
  httpGet.mockResolvedValueOnce({ data: { Items: [entry(1)], TotalRecordCount: 2 } }).mockRejectedValueOnce(failure(status));
  await expect(read()).rejects.toMatchObject({ code: 'library_catalog_unavailable' });
  expect(httpGet).toHaveBeenCalledTimes(2);
});

test('legacy fallback also rejects a malformed response without further attempts', async () => {
  httpGet.mockRejectedValueOnce(failure(404)).mockResolvedValueOnce({ data: { Items: [], TotalRecordCount: 0 } });
  await expect(read()).rejects.toMatchObject({ code: 'library_catalog_invalid' });
  expect(httpGet).toHaveBeenCalledTimes(2);
});

test('supports the 1,000-entry limit and stops immediately at an exact full final page', async () => {
  httpGet.mockImplementation(async (_url, { params }) => ({ data: { TotalRecordCount: 1000,
    Items: Array.from({ length: 100 }, (_, i) => entry(params.StartIndex + i)) } }));
  expect(await read()).toHaveLength(1000);
  expect(httpGet).toHaveBeenCalledTimes(10);
});

test('tiny capped pages cannot exceed the request budget', async () => {
  httpGet.mockImplementation(async (_url, { params }) => ({ data: { TotalRecordCount: 21, Items: [entry(params.StartIndex)] } }));
  await expect(read()).rejects.toMatchObject({ code: 'library_catalog_invalid' });
  expect(httpGet).toHaveBeenCalledTimes(EMBY_CATALOG_MAX_PAGES);
});

test('caller cancellation before IO and after an HTTP error never triggers fallback', async () => {
  const controller = new AbortController(); controller.abort(new Error(secret));
  await expect(read({ signal: controller.signal })).rejects.toMatchObject({ code: 'library_catalog_unavailable' });
  expect(httpGet).not.toHaveBeenCalled();
  const during = new AbortController();
  httpGet.mockImplementation(async () => { during.abort(new Error(secret)); throw failure(404); });
  await expect(read({ signal: during.signal })).rejects.toMatchObject({ code: 'library_catalog_unavailable' });
  expect(httpGet).toHaveBeenCalledTimes(1);
});

test('one total deadline bounds all pages and is not reset by progress', async () => {
  const deadline = new AbortController();
  const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  httpGet.mockResolvedValueOnce({ data: { Items: [entry(1)], TotalRecordCount: 2 } })
    .mockImplementationOnce(async () => { deadline.abort(new Error(secret)); return { data: { Items: [entry(2)], TotalRecordCount: 2 } }; });
  await expect(read()).rejects.toMatchObject({ code: 'library_catalog_unavailable' });
  expect(timeout).toHaveBeenCalledTimes(1);
  expect(timeout).toHaveBeenCalledWith(EMBY_CATALOG_DEADLINE_MS);
  expect(httpGet).toHaveBeenCalledTimes(2);
});

test('legacy fallback shares the original deadline and cannot return success after expiry', async () => {
  const deadline = new AbortController();
  const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  httpGet.mockRejectedValueOnce(failure(404)).mockImplementationOnce(async () => {
    deadline.abort(new Error(secret));
    return { data: legacyEmbyCatalog };
  });
  await expect(read()).rejects.toMatchObject({ code: 'library_catalog_unavailable' });
  expect(timeout).toHaveBeenCalledTimes(1);
  expect(httpGet).toHaveBeenCalledTimes(2);
  expect(httpGet.mock.calls[1][1].signal).toBe(httpGet.mock.calls[0][1].signal);
});
