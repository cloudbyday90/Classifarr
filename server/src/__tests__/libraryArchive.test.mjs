/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { projectLibraryArchive, archiveRequest } from '../services/libraryArchiveContract.mjs';
import { registerLibraryArchiveRoutes } from '../routes/mediaServerRouteArchive.mjs';
import { errorHandler } from '../middleware/errorHandler.mjs';
const snapshot = () => ({ library: { id: 1, name: 'Synthetic', external_id: 'x', media_server_id: 2, is_active: false },
  ownership: null, syncs: [], capture: null, activeOwner: false, itemCount: 3 });
const context = { source: { id: 2, type: 'plex', url: 'http://synthetic.invalid', api_key: 'never-expose-this' }, catalog: [] };

test('review is actor/state bound and does not expose credentials or raw revisions', () => {
  const input = snapshot(), preview = projectLibraryArchive(input, context, 7);
  expect(preview).toMatchObject({ canConfirm: true, operation: 'archive', itemCount: 3 });
  expect(projectLibraryArchive(input, context, 7)).toEqual(preview);
  expect(projectLibraryArchive(input, context, 8).revision).not.toBe(preview.revision);
  expect(JSON.stringify(preview)).not.toContain('never-expose-this');
  input.library.archived_at = '2026-09-27';
  expect(projectLibraryArchive(input, null, 7).operation).toBe('restore');
});
test.each([
  ['active_owner', { activeOwner: true }], ['unfinished_import', { capture: {} }],
  ['unfinished_import', { ownership: { phase: 'running' } }],
])('blocks %s', (reason, changes) => {
  expect(projectLibraryArchive({ ...snapshot(), ...changes }, context, 7)).toMatchObject({ reason, canConfirm: false });
});
test('confirmation rejects weak/missing revisions, wildcards, coercions and excess fields', () => {
  const body = { requestId: randomUUID(), operation: 'archive', workersStopped: true };
  const revision = projectLibraryArchive(snapshot(), context, 7).revision;
  expect(archiveRequest('7', '1', body, revision)).toMatchObject({ actorId: 7, libraryId: 1, revision });
  for (const invalid of [undefined, '*', `W/${revision}`, `${revision},${revision}`, 'bad']) expect(() => archiveRequest(7, 1, body, invalid)).toThrow();
  for (const invalid of [null, [], { ...body, extra: true }, { ...body, workersStopped: 'true' }, { ...body, operation: 'delete' }, { ...body, requestId: 'bad' }]) {
    expect(() => archiveRequest(7, 1, invalid, revision)).toThrow();
  }
});
function appFor(user, apiKey = false) {
  const service = { preview: jest.fn().mockResolvedValue({ revision: '"revision"' }), confirm: jest.fn().mockResolvedValue({ receipt: {} }), receipt: jest.fn().mockResolvedValue({ receipt: null }) };
  const app = express(), router = express.Router();
  app.use(express.json(), (req, _res, next) => { req.user = user; req.apiKey = apiKey; next(); });
  registerLibraryArchiveRoutes(router, { service });
  app.use(router, errorHandler);
  return { app, service };
}
test.each([undefined, { id: 1, role: 'user', type: 'access' }, { id: 1, role: 'admin', type: 'refresh' },
  { id: 1, role: 'admin', type: 'access', token_use: 'diagnostic' }])('rejects non-admin access sessions %#', async user => {
  const { app, service } = appFor(user);
  expect((await request(app).get('/libraries/1/archive')).status).toBe(403);
  expect(service.preview).not.toHaveBeenCalled();
});
test('rejects API keys and query injection; normal admin uses conditional writes and read-only receipts', async () => {
  const actor = { id: 1, role: 'admin', type: 'access' };
  expect((await request(appFor(actor, true).app).get('/libraries/1/archive')).status).toBe(403);
  const { app, service } = appFor(actor);
  expect((await request(app).get('/libraries/1/archive').set('x-api-key', 'synthetic')).status).toBe(403);
  expect((await request(app).get('/libraries/1/archive?url=http://arbitrary')).status).toBe(400);
  const preview = await request(app).get('/libraries/1/archive');
  expect(preview.status).toBe(200);
  expect(preview.headers['cache-control']).toBe('no-store');
  expect(preview.headers.etag).toBe('"revision"');
  expect(service.preview).toHaveBeenCalledWith(1, '1');
  await request(app).post('/libraries/1/archive').set('If-Match', '"revision"').send({ confirmed: true });
  expect(service.confirm).toHaveBeenCalledWith(1, '1', { confirmed: true }, '"revision"');
  await request(app).get('/libraries/1/archive/receipts/synthetic');
  expect(service.receipt).toHaveBeenCalledWith(1, '1', 'synthetic');
});
