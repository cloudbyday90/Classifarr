/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { httpGet } from '../utils/httpClient.mjs';
import { getTmdbIdentityDetails, findTmdbIdentityByExternalId } from '../services/tmdbIdentitySearch.mjs';
import { revalidateInventoryIdentity } from '../services/inventoryIdentityRevalidation.mjs';

let server, deps, mode, requests;
const source = { media_type: 'movie', title: 'Synthetic', year: 2001, imdb_id: 'tt123' };
beforeAll(async () => {
    server = createServer((req, res) => {
        requests++;
        const isFind = new URL(req.url, 'http://localhost').pathname.startsWith('/find/');
        let body = JSON.stringify(isFind ? { movie_results: [{ id: 8 }] }
            : { id: 8, title: 'Synthetic', release_date: '2001-01-01' });
        const oversized = mode === 'oversized_find' || (mode === 'oversized_details' && !isFind);
        if (oversized) body = JSON.stringify({ private: 'secret'.repeat(200000) });
        if (mode === 'malformed_find' && isFind) body = '{invalid JSON';
        const compressed = gzipSync(body);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Content-Length': compressed.length });
        res.end(compressed);
    });
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    deps = { getApiKey: async () => 'synthetic-only', executeRateLimited: fn => fn(), httpGet,
        baseUrl: `http://127.0.0.1:${server.address().port}` };
});
afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
});

test.each([['valid', 'candidate_for_review', 2], ['oversized_find', 'provider_unavailable', 1],
    ['oversized_details', 'provider_unavailable', 2], ['malformed_find', 'invalid_provider_response', 1]])
('real buffered HTTP enforces diagnostic boundaries: %s', async (scenario, outcome, count) => {
    mode = scenario; requests = 0;
    const result = await revalidateInventoryIdentity(source, 7, {
        findIdentityByExternalId: (id, type) => findTmdbIdentityByExternalId(id, type, deps),
        getIdentityDetails: (id, type) => getTmdbIdentityDetails(id, type, deps),
    });
    expect(result.check.outcome).toBe(outcome);
    expect(result.check.candidate_tmdb_id).toBe(outcome === 'candidate_for_review' ? 8 : null);
    expect(requests).toBe(count);
    expect(JSON.stringify(result)).not.toMatch(/private|secret|synthetic-only/);
});
