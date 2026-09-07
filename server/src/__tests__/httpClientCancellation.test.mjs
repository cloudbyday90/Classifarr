/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createServer } from 'node:http';
import { Agent, fetch as packageFetch } from 'undici';

let onResponse;
async function observeResponse(promise) {
  const response = await promise;
  onResponse?.(response);
  return response;
}
jest.unstable_mockModule('undici', () => ({
  Agent, fetch: (...args) => observeResponse(packageFetch(...args)),
}));
const { httpGet, httpPost, httpPut, httpDelete, httpGetBinary } = await import('../utils/httpClient.mjs');

let server;
let base;
let onRequest;
let requests = 0;
beforeAll(async () => {
  server = createServer((req, res) => {
    requests++;
    req.resume();
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path !== '/before-headers') {
      res.writeHead(path === '/error' ? 503 : 200, {
        Connection: 'close',
        'Content-Type': path === '/text' ? 'text/plain' : 'application/json',
      });
      if (path === '/complete') res.end('{"ok":true}');
      else res.write('{');
    }
    onRequest?.(res);
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => { onRequest = undefined; onResponse = undefined; jest.restoreAllMocks(); });
afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve => { server.close(resolve); });
});

const methods = [
  ['GET', (url, options) => httpGet(url, options)],
  ['POST', (url, options) => httpPost(url, { input: 'fixture' }, options)],
  ['PUT', (url, options) => httpPut(url, { input: 'fixture' }, options)],
  ['DELETE', (url, options) => httpDelete(url, options)],
  ['binary', (url, options) => httpGetBinary(url, options)],
];
const aborted = { name: 'AbortError', code: 'ABORT_ERR', message: 'Request cancelled' };

test.each(methods)('%s rejects pre-aborted calls before dispatch', async (_name, run) => {
  const fetch = jest.spyOn(globalThis, 'fetch');
  const previous = requests;
  await expect(run(`${base}/complete`, { signal: AbortSignal.abort('private reason') }))
    .rejects.toMatchObject(aborted);
  expect(fetch).not.toHaveBeenCalled();
  expect(requests).toBe(previous);
});

test('does not serialize a pre-aborted request body', async () => {
  const toJSON = jest.fn(() => { throw new Error('should never serialize'); });
  await expect(httpPost(base, { toJSON }, { signal: AbortSignal.abort() })).rejects.toMatchObject(aborted);
  expect(toJSON).not.toHaveBeenCalled();
});

test('rechecks cancellation after serialization before dispatch', async () => {
  const caller = new AbortController();
  const fetch = jest.spyOn(globalThis, 'fetch');
  await expect(httpPost(base, { toJSON() { caller.abort(); return {}; } }, { signal: caller.signal }))
    .rejects.toMatchObject(aborted);
  expect(fetch).not.toHaveBeenCalled();
});

test.each([httpGet, httpGetBinary])('invalid signals fail before HTTP', async run => {
  const fetch = jest.spyOn(globalThis, 'fetch');
  await expect(run(base, { signal: {} })).rejects.toMatchObject({ name: 'TypeError' });
  expect(fetch).not.toHaveBeenCalled();
});

test.each(methods)('%s aborts before headers and closes the connection', async (_name, run) => {
  const caller = new AbortController();
  const closed = Promise.withResolvers();
  onRequest = res => {
    res.once('close', closed.resolve);
    caller.abort({ secret: 'private reason' });
  };
  await expect(run(`${base}/before-headers`, { signal: caller.signal, timeout: 5000 }))
    .rejects.toMatchObject(aborted);
  await closed.promise;
});

test.each([
  ['native bounded JSON', '/json', httpGet, { maxResponseBytes: 1024 }],
  ['native unbounded JSON', '/json', httpGet, {}],
  ['native text', '/text', httpGet, {}],
  ['native HTTP error', '/error', httpGet, { maxResponseBytes: 1024 }],
  ['Undici bounded JSON', '/json', httpGet, { rejectUnauthorized: false, maxResponseBytes: 1024 }],
  ['Undici unbounded JSON', '/json', httpGet, { rejectUnauthorized: false }],
  ['bounded binary', '/json', httpGetBinary, { maxBytes: 1024 }],
  ['unbounded binary', '/json', httpGetBinary, {}],
])('%s aborts a stalled body without returning partial data', async (_name, path, run, options) => {
  const caller = new AbortController();
  const reading = Promise.withResolvers();
  const closed = Promise.withResolvers();
  onRequest = res => { res.once('close', closed.resolve); };
  let received;
  onResponse = response => {
    received = response;
    const method = options.maxBytes !== undefined || options.maxResponseBytes !== undefined
      ? 'getReader' : run === httpGetBinary ? 'arrayBuffer' : 'text';
    const target = method === 'getReader' ? response.body : response;
    const original = target[method].bind(target);
    jest.spyOn(target, method).mockImplementation(() => {
      const result = original();
      reading.resolve();
      return result;
    });
  };
  const nativeFetch = globalThis.fetch;
  jest.spyOn(globalThis, 'fetch').mockImplementation((...args) => observeResponse(nativeFetch(...args)));
  const result = run(base + path, { ...options, signal: caller.signal, timeout: 5000 });
  const assertion = expect(result).rejects.toMatchObject(aborted);
  await reading.promise;
  caller.abort(new DOMException('private timeout reason', 'TimeoutError'));
  await assertion;
  const error = await result.catch(value => value);
  expect(error.cause).toBeUndefined();
  expect(error.response).toBeUndefined();
  if (options.maxBytes !== undefined || options.maxResponseBytes !== undefined) {
    expect(received.body.locked).toBe(false);
  }
  await closed.promise;
});

test.each([{}, { rejectUnauthorized: false }])('retains deadlines when the caller stays active: %p', options => {
  return expect(httpGet(`${base}/json`, { ...options, signal: new AbortController().signal, timeout: 100 }))
    .rejects.toMatchObject({ code: 'ETIMEDOUT' });
});

test.each([undefined, null, new AbortController().signal])('preserves successful responses with signal %p', async signal => {
  await expect(httpGet(`${base}/complete`, { signal })).resolves.toMatchObject({ data: { ok: true }, status: 200 });
});
