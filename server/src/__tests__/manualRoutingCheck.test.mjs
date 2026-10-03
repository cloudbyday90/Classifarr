/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { buildManualRoutingIntent, manualRoutingLibraryFingerprint, validManualRoutingIntent } from '../services/manualRoutingIntent.mjs';
import { captureManualRoutingIntent } from '../services/manualRoutingIntentPersistence.mjs';
import { eligibleManualRoutingCheck } from '../services/manualRoutingCheckRepository.mjs';
import { createManualRoutingCheckService } from '../services/manualRoutingCheckService.mjs';
import { registerManualRoutingCheckRoute } from '../routes/queueRouteManualRoutingCheck.mjs';
import { requireAdmin } from '../middleware/apiKeyAuth.mjs';
import { routingProviderRevision } from '../services/manualRoutingProviderGuard.mjs';
import { ArrLookupFailure } from '../services/arrLookupFailure.mjs';

const library = { id: 7, media_type: 'movie', arr_type: 'radarr', arr_id: 2, root_folder: '/movies' };
const input = { arrType: 'radarr', configId: 2, baseUrl: 'http://private-provider',
  libraryFingerprint: manualRoutingLibraryFingerprint(library),
  expected: { identityKey: 'tmdbId', identity: 42, rootFolderPath: '/movies' } };
const intent = { ...buildManualRoutingIntent(input), libraryId: 7, mediaType: 'movie', tmdbId: 42 };
const row = { id: 1, library_id: 7, media_type: 'movie', tmdb_id: 42, method: 'manual_classification', status: 'completed',
  metadata: { classification_details: { routing: 'manual_routing_pending', manual_routing_intent: intent,
    manual_routing_attempt_id: 'c98f1028-cbfc-49c6-9e1b-a137c060dd07' } } };

test('intent excludes credentials/endpoints and rejects malformed identity/destination/version', () => {
  expect(JSON.stringify(buildManualRoutingIntent({ ...input, api_key: 'secret' }))).not.toMatch(/secret|private-provider/);
  for (const override of [{ version: 2 }, { identity: 0 }, { rootFolderPath: '../other' }, { arrType: 'music' }, { identityKey: 'tvdbId' }]) {
    expect(validManualRoutingIntent({ ...intent, ...override })).toBe(false);
  }
  expect(() => buildManualRoutingIntent({ ...input, baseUrl: '' })).toThrow('unavailable');
  expect(manualRoutingLibraryFingerprint({ ...library, name: 'renamed' })).toBe(input.libraryFingerprint);
  expect(manualRoutingLibraryFingerprint({ ...library, root_folder: '/other' })).not.toBe(input.libraryFingerprint);
});

test('legacy, changed decisions and non-manual records cannot become probe authority', () => {
  expect(eligibleManualRoutingCheck(row)).toBe(true);
  for (const override of [{ library_id: 8 }, { tmdb_id: 43 }, { media_type: 'tv' }, { status: 'routed' },
    { method: 'policy_auto' }, { metadata: {} }]) expect(eligibleManualRoutingCheck({ ...row, ...override })).toBe(false);
});

test('intent capture is guarded, parameterized and must succeed before reconciliation', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
  const selection = { classificationId: 1, library, attemptId: 'attempt' };
  await captureManualRoutingIntent(db, selection, input);
  expect(db.query.mock.calls[0][0]).toContain("NOT (metadata->'classification_details' ? 'manual_routing_intent')");
  expect(db.query.mock.calls[0][1].slice(1)).toEqual([1, 7, 'attempt', 'manual_routing_pending']);
  db.query.mockResolvedValueOnce({ rowCount: 0 });
  await expect(captureManualRoutingIntent(db, selection, input)).rejects.toThrow('could not be saved');
});

function fixture(item = { id: 9, tmdbId: 42, path: '/movies/Title' }) {
  const read = jest.fn().mockResolvedValue(item);
  const repository = { load: jest.fn().mockResolvedValue({ row, intent, baseUrl: 'private', apiKey: 'secret' }),
    save: jest.fn().mockResolvedValue(true) };
  const logger = { info: jest.fn(), warn: jest.fn() };
  const service = createManualRoutingCheckService({ repository, providers: { radarr: { getMovieByTmdbId: read } }, logger,
    now: () => '2026-10-03T12:00:00Z' });
  return { service, repository, read, logger };
}

test.each([[null, 'not_present'], [undefined, 'mismatch'], [{ id: 9, tmdbId: 42, path: '/other/T' }, 'mismatch'],
  [{ id: 9, tmdbId: 42, path: '/movies/T' }, 'verified_present']])('single read reports %s without any writer dependency', async (item, reason) => {
  const f = fixture(); f.read.mockResolvedValue(item);
  expect(await f.service.check(1)).toEqual({ reason, recorded: true, checkedAt: '2026-10-03T12:00:00Z', message: expect.any(String) });
  expect(f.read).toHaveBeenCalledTimes(1);
  expect(f.repository.save.mock.calls[0][1]).toEqual({ version: 1, reason, checkedAt: '2026-10-03T12:00:00Z' });
  expect(JSON.stringify(f.logger.info.mock.calls)).not.toMatch(/private|secret|movies/);
});

test('failed reads, save conflicts and failures never return verified success or raw errors', async () => {
  const f = fixture(); f.read.mockRejectedValueOnce(new Error('private secret'));
  expect(await f.service.check(1)).toMatchObject({ reason: 'unavailable', recorded: true });
  f.repository.save.mockResolvedValueOnce(false);
  expect(await f.service.check(1)).toMatchObject({ reason: 'changed', recorded: false });
  f.repository.save.mockRejectedValueOnce(new Error('private'));
  expect(await f.service.check(1)).toMatchObject({ reason: 'unavailable', recorded: false });
  expect((await f.service.check(1)).reason).toBe('verified_present');
});

test('credential drift between admission and the read refuses the request', async () => {
  const f = fixture();
  const revision = routingProviderRevision({ intent, baseUrl: 'private', apiKey: 'old-key' });
  expect((await f.service.check(1, { expectedProviderRevision: revision })).reason).toBe('changed');
  expect(f.read).not.toHaveBeenCalled(); expect(f.repository.save).not.toHaveBeenCalled();
});

test.each([[401, 'provider_auth_required'], [404, 'provider_configuration_required'], [503, 'unavailable']])(
  'safe HTTP %s outcome reaches provider completion even when item observation conflicts', async (status, reason) => {
    const f = fixture(), completed = jest.fn();
    f.read.mockRejectedValue(new ArrLookupFailure('safe', { response: { status } }));
    f.repository.save.mockResolvedValue(false);
    expect((await f.service.check(1, { onProviderResult: completed })).reason).toBe('changed');
    expect(completed).toHaveBeenCalledTimes(1);
    expect(f.repository.save.mock.calls[0][1].reason).toBe(reason);
  });

test('two concurrent checks, duplicate suppression and finally cleanup bound work', async () => {
  const f = fixture(); let release;
  const hold = new Promise(resolve => { release = resolve; });
  f.read.mockImplementation(() => hold);
  const first = f.service.check(1), second = f.service.check(2);
  try {
    expect((await f.service.check(1)).reason).toBe('busy');
    expect((await f.service.check(3)).reason).toBe('busy');
  } finally { release(null); await Promise.all([first, second]); }
  expect((await f.service.check(3)).reason).toBe('not_present');
});

test('invalid IDs and ineligible history issue no provider calls', async () => {
  const f = fixture(); expect((await f.service.check(-1)).reason).toBe('not_found');
  f.repository.load.mockResolvedValue({ reason: 'not_eligible' });
  expect((await f.service.check(1)).reason).toBe('not_eligible');
  expect(f.read).not.toHaveBeenCalled(); expect(f.repository.save).not.toHaveBeenCalled();
});

test('Sonarr probes use the frozen TVDB identity and the existing read method only', async () => {
  const getSeriesByTvdbId = jest.fn().mockResolvedValue({ id: 9, tvdbId: 123, path: '/tv/Series' });
  const tvIntent = { ...intent, arrType: 'sonarr', identityKey: 'tvdbId', identity: 123, rootFolderPath: '/tv' };
  const repository = { load: async () => ({ intent: tvIntent, baseUrl: 'http://fixture', apiKey: 'synthetic' }), save: async () => true };
  const service = createManualRoutingCheckService({ repository, providers: { sonarr: { getSeriesByTvdbId } } });
  expect((await service.check(1)).reason).toBe('verified_present');
  expect(getSeriesByTvdbId).toHaveBeenCalledWith('http://fixture', 'synthetic', 123);
});

test('route requires a current admin principal, validates IDs and never accepts caller targets', async () => {
  const app = express(), router = express.Router(), check = jest.fn().mockResolvedValue({ reason: 'not_eligible' });
  app.use((req, _res, next) => { if (req.headers.authorization) req.user = { role: req.headers.authorization }; next(); });
  registerManualRoutingCheckRoute(router, { requireAdmin, limiter: (_req, _res, next) => next(), service: { check } });
  app.use(router);
  app.use((err, _req, res, _next) => res.status(err.statusCode || 400).json({ error: 'Invalid request' }));
  await request(app).post('/manual-routing/1/check').expect(401);
  await request(app).post('/manual-routing/1/check').set('Authorization', 'viewer').expect(403);
  expect(check).not.toHaveBeenCalled();
  await request(app).post('/manual-routing/no/check').set('Authorization', 'admin').expect(400);
  const result = await request(app).post('/manual-routing/1/check').set('Authorization', 'admin').send({ url: 'http://attacker' }).expect(200);
  expect(check).toHaveBeenCalledWith(1); expect(result.headers['cache-control']).toBe('no-store');
  check.mockResolvedValueOnce({ reason: 'busy' });
  await request(app).post('/manual-routing/1/check').set('Authorization', 'admin').expect(429);
});
