/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, afterEach, beforeAll, expect, jest, test } from '@jest/globals';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { httpGet, httpPost, httpPut, httpDelete, httpGetBinary, httpStream } from '../utils/httpClient.mjs';

let server;
let base;
let requests = 0;
let closed;
const json = JSON.stringify({ title: 'Fixture 雪' });
const large = 'x'.repeat(2 * 1024 * 1024);
beforeAll(async () => {
  server = createServer((req, res) => {
    requests++;
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/slow') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{');
      return;
    }
    if (path === '/endless') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('x'.repeat(1024));
      const timer = setInterval(() => res.write('x'.repeat(1024)), 10);
      res.on('close', () => { clearInterval(timer); closed?.(); });
      return;
    }
    if (path === '/gzip' || path === '/gzip-small') {
      const compressed = gzipSync(path === '/gzip' ? large : json);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip',
        'Content-Length': compressed.length });
      res.end(compressed);
      return;
    }
    if (path === '/empty') { res.writeHead(204); res.end(); return; }
    const body = path === '/large' || path === '/error-large' ? large
      : path === '/text' ? 'plain text' : path === '/error' ? '{"Error":"fixture"}' : json;
    res.writeHead(path.startsWith('/error') ? 401 : 200, {
      'Content-Type': path === '/text' ? 'text/plain' : 'application/json',
    });
    // Explicit writes give real chunked bodies without a Content-Length shortcut.
    res.write(body.slice(0, Math.floor(body.length / 2)));
    res.end(body.slice(Math.floor(body.length / 2)));
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => { jest.restoreAllMocks(); });
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
});

test.each([
  ['GET', options => httpGet(`${base}/json`, options)],
  ['POST', options => httpPost(`${base}/json`, { input: 'fixture' }, options)],
  ['PUT', options => httpPut(`${base}/json`, { input: 'fixture' }, options)],
  ['DELETE', options => httpDelete(`${base}/json`, options)],
])('%s preserves response shape and enforces the same decoded-byte boundary', async (_method, run) => {
  expect(await run({ maxResponseBytes: Buffer.byteLength(json) })).toMatchObject({
    status: 200, data: { title: 'Fixture 雪' }, headers: { 'content-type': 'application/json' },
  });
  await expect(run({ maxResponseBytes: Buffer.byteLength(json) - 1 })).rejects.toMatchObject({ code: 'HTTP_RESPONSE_TOO_LARGE' });
});

test.each(['/large', '/error-large', '/gzip'])('rejects oversized chunked/error/compressed response %s', async path => {
  if (path === '/gzip') expect(gzipSync(large).length).toBeLessThan(4096);
  await expect(httpGet(base + path, { maxResponseBytes: 4096 })).rejects.toMatchObject({
    name: 'HttpResponseTooLargeError', code: 'HTTP_RESPONSE_TOO_LARGE', maxBytes: 4096,
  });
});

test('retains the normal error envelope for an in-budget HTTP error', async () => {
  await expect(httpGet(`${base}/error`, { maxResponseBytes: 100 })).rejects.toMatchObject({
    response: { status: 401, data: { Error: 'fixture' } },
  });
});

test('accepts compressed content whose encoded length exceeds its decoded-byte budget', async () => {
  expect(gzipSync(json).length).toBeGreaterThan(Buffer.byteLength(json));
  expect((await httpGet(`${base}/gzip-small`, { maxResponseBytes: Buffer.byteLength(json) })).data)
    .toEqual({ title: 'Fixture 雪' });
});

test('cancels a continuing response when its decoded budget is exceeded', async () => {
  const connectionClosed = new Promise(resolve => { closed = resolve; });
  await expect(httpGet(`${base}/endless`, { maxResponseBytes: 1024 })).rejects.toMatchObject({ code: 'HTTP_RESPONSE_TOO_LARGE' });
  await connectionClosed;
});

test.each([undefined, 4096])('keeps the request deadline active after headers with budget %s', async maxResponseBytes => {
  await expect(httpGet(`${base}/slow`, { maxResponseBytes, timeout: 300 })).rejects.toMatchObject({ code: 'ETIMEDOUT' });
});

test('preserves text, empty, unbudgeted large-body and successful streaming behavior', async () => {
  expect((await httpGet(`${base}/text`, { maxResponseBytes: 10 })).data).toBe('plain text');
  expect((await httpGet(`${base}/empty`, { maxResponseBytes: 0 })).data).toBe('');
  // Invalid but completely received JSON still returns null, including without a budget.
  expect((await httpGet(`${base}/large`)).data).toBeNull();
  const response = await httpStream(`${base}/json`, {});
  expect(await response.json()).toEqual({ title: 'Fixture 雪' });
});

test('enforces the existing binary limit while consuming the stream', async () => {
  expect(await httpGetBinary(`${base}/text`, { maxBytes: 10 })).toEqual(Buffer.from('plain text'));
  await expect(httpGetBinary(`${base}/large`, { maxBytes: 1024 })).rejects.toMatchObject({ code: 'HTTP_RESPONSE_TOO_LARGE' });
  await expect(httpGetBinary(`${base}/slow`, { maxBytes: 1024, timeout: 300 })).rejects.toMatchObject({ code: 'ETIMEDOUT' });
  await expect(httpGetBinary(`${base}/error-large`, { maxBytes: 1024 })).rejects.toMatchObject({ response: { status: 401, data: null } });
});

test.each([null, -1, 1.5, Infinity, '1'])('invalid explicit limits %# fail before HTTP', async value => {
  const before = requests;
  await expect(httpGet(`${base}/json`, { maxResponseBytes: value })).rejects.toThrow('nonnegative safe integer');
  await expect(httpGetBinary(`${base}/json`, { maxBytes: value })).rejects.toThrow('nonnegative safe integer');
  expect(requests).toBe(before);
});
