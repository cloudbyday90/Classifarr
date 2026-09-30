/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { assertStudyProviderEnvironment } from './resourceStudyProviderFixture.mjs';

/** Fixed loopback transport. No external URL, payload, key or listener address is accepted. */
export async function createStudyProviderHttp() {
  assertStudyProviderEnvironment();
  const receipt = { httpAttempts: 0, authentication: 0, throttled: 0, unavailable: 0, successes: 0,
    unexpected: 0, transientMinWaitMs: null };
  let lastTransientAt, closed = false;
  const server = createServer({ requestTimeout: 5000, headersTimeout: 5000, maxHeaderSize: 4096 }, (req, res) => {
    receipt.httpAttempts++;
    let query;
    try { if (req.url.length <= 2048) query = new URL(req.url, 'http://127.0.0.1').searchParams; } catch { /* Reject. */ }
    const title = query?.get('t'), type = query?.get('type'), key = query?.get('apikey');
    const valid = req.method === 'GET' && req.url.startsWith('/?') &&
      /^Synthetic study-[0-3]-(movie|tv) \d+$/.test(title ?? '') && ['movie', 'series'].includes(type) &&
      ['synthetic-fault-before', 'synthetic-fault-after'].includes(key) && receipt.httpAttempts <= 32;
    if (!valid) { receipt.unexpected++; res.writeHead(400, { Connection: 'close' }); res.end(); return; }
    const at = performance.now();
    if (lastTransientAt !== undefined) {
      receipt.transientMinWaitMs = Math.min(receipt.transientMinWaitMs ?? Infinity, at - lastTransientAt);
      lastTransientAt = undefined;
    }
    let status = 200, body;
    if (receipt.httpAttempts === 1) {
      receipt.authentication++; status = 401; body = { Response: 'False', Error: 'Invalid API key!' };
    } else if (receipt.httpAttempts === 2) {
      receipt.throttled++; status = 429; body = {}; res.setHeader('Retry-After', '2'); lastTransientAt = at;
    } else if (receipt.httpAttempts === 3) {
      receipt.unavailable++; status = 503; body = {}; lastTransientAt = at;
    } else {
      receipt.successes++; body = { Response: 'True', Title: title, Type: type, imdbID: 'tt0000001', Rated: 'PG', Ratings: [] };
    }
    res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
    res.end(JSON.stringify(body));
  });
  server.maxConnections = 2;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
  const address = server.address();
  assert.equal(address.address, '127.0.0.1');
  return { url: `http://127.0.0.1:${address.port}`, receipt,
    async close() {
      if (closed) return;
      closed = true;
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve()); server.closeAllConnections();
      });
    } };
}
