/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { once } from 'node:events';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import { httpGet } from '../utils/httpClient.mjs';
import { verifyProviderRecovery } from '../services/providerRecoveryProbeTransport.mjs';

let server, origin, redirected = 0;
beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url.startsWith('/redirect')) { response.writeHead(302, { Location: `${origin}/target` }); response.end(); return; }
    if (request.url.startsWith('/target')) redirected++;
    if (request.url.startsWith('/slow')) { response.write('{'); return; }
    if (request.url.startsWith('/large')) {
      response.setHeader('Content-Encoding', 'gzip'); response.end(gzipSync(JSON.stringify({ private: 'x'.repeat(70000) }))); return;
    }
    if (request.url.startsWith('/throttled')) { response.writeHead(429, { 'X-RateLimit-Limit': '1, 15000',
      'X-RateLimit-Remaining': '0, 0', 'X-RateLimit-Reset': '1, 200000' }); response.end('{}'); return; }
    response.end(request.url.startsWith('/valid') ? JSON.stringify({ type:'search',
      query:{ original:'Classifarr provider connectivity test' },web:{ results:[] } }) : '<html>private</html>');
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening'); origin=`http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); });
test.each([['/valid','verified'],['/malformed','invalid_response'],['/large','unavailable'],
  ['/slow','unavailable'],['/redirect','unavailable'],['/throttled','rate_limited']])(
  'bounded real HTTP handles %s safely', async (path,category) => {
    const result = await verifyProviderRecovery({ provider_key:'brave',config:{ api_key:'fixture-only' } }, {
      get:(_url, options) => httpGet(`${origin}${path}`,{ ...options,timeout:100 }),
    });
    expect(result.category).toBe(category); expect(JSON.stringify(result)).not.toMatch(/fixture|private/);
    if (path === '/throttled') expect(result.retryAfterMs).toBe(200000000);
    if (path === '/redirect') expect(redirected).toBe(0);
  });
