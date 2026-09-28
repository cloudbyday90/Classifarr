/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { libraryDiscoveryFailure, unavailableLibraryCatalog } from '../services/libraryDiscoveryFailure.mjs';
import { presentLibraryDiscovery } from '../services/libraryDiscoveryPresentation.mjs';
import { observeLibraryDiscovery } from '../services/libraryDiscoveryObservation.mjs';
import { registerLibraryDiscoveryRoutes } from '../routes/mediaServerRouteDiscovery.mjs';
import { errorHandler } from '../middleware/errorHandler.mjs';

test.each([[401, 'authentication'], [403, 'forbidden'], [429, 'rate_limited'], [404, 'endpoint_unavailable'],
  [405, 'endpoint_unavailable'], [500, 'provider_unavailable'], [503, 'provider_unavailable'], [400, 'unknown']])
  ('HTTP %i retains safe reason %s, never the provider body or credentials', (status, reason) => {
    const error = unavailableLibraryCatalog({ message: 'secret', response: { status, data: 'secret' }, config: { url: 'secret' } }, 'Jellyfin');
    expect(libraryDiscoveryFailure(error)).toEqual({ reason, httpStatus: status });
    expect(JSON.stringify(error)).not.toContain('secret');
  });

test.each([
  ['ETIMEDOUT', 'timeout'], ['UND_ERR_CONNECT_TIMEOUT', 'timeout'], ['UND_ERR_HEADERS_TIMEOUT', 'timeout'],
  ['UND_ERR_BODY_TIMEOUT', 'timeout'], ['ABORT_ERR', 'cancelled'], ['HTTP_RESPONSE_TOO_LARGE', 'response_too_large'],
  ['ECONNREFUSED', 'unreachable'], ['ENOTFOUND', 'unreachable'], ['ECONNRESET', 'unreachable'], ['EAI_AGAIN', 'unreachable'],
  ['EHOSTUNREACH', 'unreachable'], ['ENETUNREACH', 'unreachable'], ['ERR_NETWORK', 'unreachable'],
  ['library_catalog_invalid', 'invalid_catalog'], ['library_catalog_source_changed', 'configuration_changed'],
])('classifies %s without parsing arbitrary error text', (code, reason) => {
  expect(libraryDiscoveryFailure({ code, message: 'secret' })).toEqual({ reason, httpStatus: null });
});

test.each([undefined, null, {}, { response: { status: '401' } }, { catalogDiagnostic: { reason: 'secret', httpStatus: 401 } }])
  ('unknown or malformed errors remain unknown %#', error => {
    expect(libraryDiscoveryFailure(error)).toEqual({ reason: 'unknown', httpStatus: null });
  });

const statusRow = () => ({ provider: 'jellyfin', current_revision: '2', source_revision: '2', reason: 'complete',
  started_at: '2026-09-27T12:00:00Z', finished_at: '2026-09-27T12:00:01Z', last_success_at: '2026-09-27T12:00:01Z',
  last_success_count: 2, contract: 'jellyfin_virtual_folders', http_status: null });
test('presentation identifies fresh setup, changed configuration, and unrecorded outcomes without inventing success', () => {
  expect(presentLibraryDiscovery(null).reason).toBe('not_configured');
  expect(presentLibraryDiscovery({ provider: 'jellyfin' }).reason).toBe('not_recorded');
  expect(presentLibraryDiscovery({ ...statusRow(), current_revision: '3' })).toMatchObject({
    reason: 'configuration_changed', lastSuccessAt: null, lastSuccessCount: null, attemptedAt: null, contract: 'unknown',
  });
  const interrupted = presentLibraryDiscovery({ ...statusRow(), reason: 'checking', finished_at: null, outcome_unrecorded: true });
  expect(interrupted.reason).toBe('interrupted');
  expect(interrupted.nextStep).toContain('does not prove the worker stopped');
});
test('status retains last good evidence through failure and only exposes whitelisted fields', () => {
  const result = presentLibraryDiscovery({ ...statusRow(), reason: 'forbidden', http_status: 403, api_key: 'secret', url: 'secret' });
  expect(result).toMatchObject({ provider: 'jellyfin', reason: 'forbidden', httpStatus: 403, lastSuccessCount: 2 });
  expect(result.lastSuccessAt).toBe('2026-09-27T12:00:01.000Z');
  expect(JSON.stringify(result)).not.toContain('secret');
  expect(presentLibraryDiscovery({ ...statusRow(), provider: 'secret', reason: 'secret', contract: 'secret',
    http_status: 999, started_at: 'invalid', last_success_count: -1 })).toMatchObject({
    provider: null, reason: 'unknown', contract: 'unknown', httpStatus: null, attemptedAt: null, lastSuccessCount: null,
  });
});

function observationFixture({ persistenceFails = false } = {}) {
  const source = { id: 7, type: 'jellyfin', catalog_revision: '1', url: 'http://synthetic.invalid', api_key: 'secret' };
  const db = { query: jest.fn(async (sql, params) => {
    if (sql.startsWith('SELECT * FROM media_server')) return { rows: [source] };
    if (persistenceFails) throw new Error('secret');
    return { rows: sql.startsWith('INSERT') ? [{ attempt_id: params[2] }] : [] };
  }) };
  const catalog = [{ external_id: 'film', name: 'Music films', media_type: 'movie' }, { external_id: 'audio', name: 'Audio', media_type: null }];
  const provider = { getLibraryCatalog: jest.fn(async (_url, _key, options) => { options.onContract('jellyfin_virtual_folders'); return catalog; }) };
  return { db, provider, consume: jest.fn().mockResolvedValue('committed') };
}
test('records success only after consumption commits and counts supported libraries, not music', async () => {
  const { db, provider, consume } = observationFixture();
  consume.mockImplementation(async () => {
    expect(db.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'))).toHaveLength(0);
    return 'committed';
  });
  expect(await observeLibraryDiscovery(db, () => provider, consume)).toBe('committed');
  expect(consume).toHaveBeenCalledTimes(1);
  expect(db.query.mock.calls.at(-1)[1].slice(2, 6)).toEqual(['complete', 'jellyfin_virtual_folders', null, 1]);
});
test('diagnostic persistence failure never blocks successful discovery', async () => {
  const { db, provider, consume } = observationFixture({ persistenceFails: true });
  expect(await observeLibraryDiscovery(db, () => provider, consume)).toBe('committed');
  expect(consume).toHaveBeenCalledTimes(1);
});
test('a failed completion write cannot turn a committed discovery into an error', async () => {
  const { db, provider, consume } = observationFixture();
  consume.mockImplementation(async () => { db.query.mockRejectedValue(new Error('secret')); return 'committed'; });
  expect(await observeLibraryDiscovery(db, () => provider, consume)).toBe('committed');
  expect(consume).toHaveBeenCalledTimes(1);
});
test.each(['provider', 'merge', 'configuration'])('records %s failure and preserves the original error', async phase => {
  const { db, provider, consume } = observationFixture();
  const error = Object.assign(new Error('secret'), { code: phase === 'configuration' ? 'library_catalog_source_changed' : 'ECONNREFUSED' });
  if (phase === 'provider') provider.getLibraryCatalog.mockRejectedValue(error);
  else consume.mockRejectedValue(error);
  await expect(observeLibraryDiscovery(db, () => provider, consume)).rejects.toBe(error);
  expect(db.query.mock.calls.at(-1)[1][2]).toBe(phase === 'provider' ? 'unreachable' : phase === 'merge' ? 'local_update_failed' : 'configuration_changed');
  expect(JSON.stringify(db.query.mock.calls)).not.toContain('secret');
  if (phase === 'provider') expect(consume).not.toHaveBeenCalled();
});

function appFor(user, apiKey = false) {
  const db = { query: jest.fn().mockResolvedValue({ rows: [statusRow()] }) };
  const app = express(), router = express.Router();
  app.use((req, _res, next) => { req.user = user; req.apiKey = apiKey; next(); });
  registerLibraryDiscoveryRoutes(router, { db });
  app.use(router, errorHandler);
  return { app, db };
}
test.each([undefined, { role: 'user', type: 'access' }, { role: 'admin', type: 'refresh' },
  { role: 'admin', type: 'access', token_use: 'diagnostic' }])('status requires administrator access session %#', async user => {
  const { app, db } = appFor(user);
  const response = await request(app).get('/discovery-status');
  expect(response.status).toBe(403);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(db.query).not.toHaveBeenCalled();
});
test('status is a single bounded read, rejects API keys and arbitrary query parameters', async () => {
  const actor = { role: 'admin', type: 'access' };
  expect((await request(appFor(actor, true).app).get('/discovery-status')).status).toBe(403);
  const { app, db } = appFor(actor);
  expect((await request(app).get('/discovery-status').set('x-api-key', 'synthetic')).status).toBe(403);
  expect((await request(app).get('/discovery-status?url=http://arbitrary')).status).toBe(400);
  expect(db.query).not.toHaveBeenCalled();
  const response = await request(app).get('/discovery-status');
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body).toMatchObject({ provider: 'jellyfin', reason: 'complete' });
  expect(db.query).toHaveBeenCalledTimes(1);
  expect(db.query.mock.calls[0][0]).toMatch(/^SELECT .*LIMIT 1$/s);
});
