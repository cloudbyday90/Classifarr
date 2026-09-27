/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { once } from 'node:events';
import { beforeAll, afterAll, test, expect } from '@jest/globals';
import { httpGet } from '../utils/httpClient.mjs';
import { verifyInventoryCredential } from '../services/inventoryCredentialProbe.mjs';

let server, origin;
beforeAll(async () => {
    server = createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.url.startsWith('/throttled')) {
            res.writeHead(429, { 'Retry-After': '3600' }); res.end('{"private":"provider text"}'); return;
        }
        if (req.url.startsWith('/oversized')) {
            res.setHeader('Content-Encoding', 'gzip');
            res.end(gzipSync(JSON.stringify({ padding: 'x'.repeat(70000) }))); return;
        }
        res.end(req.url.startsWith('/valid') ? JSON.stringify({ change_keys: ['title'],
            images: { secure_base_url: 'https://image.tmdb.org/t/p/', poster_sizes: ['original'] } }) : '<html>OK</html>');
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    origin = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); });
test.each([
    ['/valid', { verified: true }], ['/malformed', { verified: false, category: 'invalid_response' }],
    ['/throttled', { verified: false, category: 'rate_limited', retryAfterMs: 3600000 }],
    ['/oversized', { verified: false, category: 'response_too_large' }],
])('real HTTP boundary handles %s without carrying private response data', async (path, expected) => {
    const result = await verifyInventoryCredential('synthetic-only', {
        execute: fn => fn(), request: (_fixedProviderUrl, options) => httpGet(`${origin}${path}`, options),
    });
    expect(result).toEqual(expected); expect(JSON.stringify(result)).not.toMatch(/synthetic|private|padding/);
});
