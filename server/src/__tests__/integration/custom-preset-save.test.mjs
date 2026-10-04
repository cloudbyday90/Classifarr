/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';
import { createPresetsRouter } from '../../routes/presetsRouteShared.mjs';
import { createCustomPresetSaveService } from '../../services/customPresetSaveService.mjs';

const db = createIntegrationDatabaseModuleMock();
const logger = { info: jest.fn() };
const path = '/api/presets/custom/save-requests';
let userId, otherId;
function appFor(actor = userId, database = db, extraMiddleware = []) {
  return createIntegrationTestApp({ basePath: '/api/presets',
    router: createPresetsRouter({ express, db: database, logger, listPresets: async () => [] }),
    middleware: [(req, _res, next) => { req.user = { id: actor }; next(); }, ...extraMiddleware],
  });
}
const begin = async (app = appFor()) => (await request(app).post(path).send({}).expect(201)).body;
const complete = (app, id, body = { name: 'Test receipt', signals: { genres: ['Family'] } }) =>
  request(app).post(`${path}/${id}/complete`).send(body);
const resolve = (app, id) => request(app).post(`${path}/${id}/resolve`).send({});

beforeAll(async () => {
  const { rows } = await db.query(`INSERT INTO users (username, password_hash, role)
    VALUES ('preset_receipt_actor', 'not-a-password', 'admin'),
           ('preset_receipt_other', 'not-a-password', 'admin') RETURNING id`);
  [userId, otherId] = rows.map(row => row.id);
});
beforeEach(async () => {
  await db.query('DELETE FROM custom_preset_save_requests');
  await db.query("DELETE FROM content_presets WHERE is_system = false AND name LIKE 'Test%'");
});

test('fresh status is read-only and one actor cannot inspect or complete another reservation', async () => {
  const app = appFor();
  expect((await request(app).get(path).expect(200)).body).toEqual({ request: null });
  await request(appFor(null)).get(path).expect(401);
  const row = await begin(app);
  expect(row).toEqual({ requestId: expect.any(String), state: 'pending', presetId: null, resolved: false });
  expect((await request(appFor(otherId)).get(path)).body).toEqual({ request: null });
  await complete(appFor(otherId), row.requestId).expect(404);
  await resolve(appFor(otherId), row.requestId).expect(404);
  await complete(app, 'invalid').expect(400);
  await complete(app, randomUUID()).expect(404);
});

test('concurrent admission and completion create exactly one preset for one request', async () => {
  const app = appFor();
  const results = await Promise.all(Array.from({ length: 6 }, () => request(app).post(path).send({})));
  expect(results.filter(result => result.status === 201)).toHaveLength(1);
  expect(results.filter(result => result.status === 409)).toHaveLength(5);
  const { requestId } = results.find(result => result.status === 201).body;
  const saves = await Promise.all(Array.from({ length: 6 }, () => complete(app, requestId)));
  expect(saves.map(result => result.status)).toEqual(Array(6).fill(200));
  expect(new Set(saves.map(result => result.body.presetId)).size).toBe(1);
  expect((await db.query("SELECT id FROM content_presets WHERE name = 'Test receipt'")).rowCount).toBe(1);
  await complete(app, requestId, { name: 'Changed draft' }).expect(409);
  const secondActor = await begin(appFor(otherId));
  await complete(appFor(otherId), secondActor.requestId, { name: 'Test other', created_by: userId }).expect(200);
  expect((await db.query("SELECT user_id FROM content_presets WHERE name = 'Test other'")).rows[0].user_id).toBe(otherId);
});

test('lost acknowledgement is recovered by a new router; deletion never replays creation', async () => {
  const app = appFor();
  const { requestId } = await begin(app);
  // Simulate an intermediary losing a committed response, not rolling back the write.
  const lostResponseDb = { ...db, withTransaction: async fn => {
    const result = await db.withTransaction(fn);
    throw Object.assign(new Error('Simulated lost commit acknowledgement'), { committed: result });
  } };
  const lost = await complete(appFor(userId, lostResponseDb), requestId).expect(503);
  expect(lost.body).toEqual({ error: 'Preset save could not be confirmed', code: 'PRESET_SAVE_UNAVAILABLE' });
  const reloaded = appFor();
  const saved = (await request(reloaded).get(path).expect(200)).body.request;
  expect(saved.state).toBe('saved');
  await db.query('DELETE FROM content_presets WHERE id = $1', [saved.presetId]);
  const confirmed = (await resolve(reloaded, requestId).expect(200)).body;
  expect(confirmed).toMatchObject({ state: 'saved', presetId: null, resolved: true });
  expect((await complete(reloaded, requestId).expect(200)).body).toEqual(confirmed);
  expect((await request(reloaded).get(path)).body.request).toBeNull();
});

test('failure after insertion rolls back both changes and explicit resolution fences a delayed create', async () => {
  const app = appFor();
  const { requestId } = await begin(app);
  const faultyDb = { ...db, withTransaction: fn => db.withTransaction(client => fn({ query: (sql, args) => {
    if (sql.includes("SET state = 'saved'")) throw new Error('Simulated receipt write failure');
    return client.query(sql, args);
  } })) };
  await complete(appFor(userId, faultyDb), requestId).expect(503);
  expect((await db.query("SELECT id FROM content_presets WHERE name = 'Test receipt'")).rowCount).toBe(0);
  expect((await request(app).get(path)).body.request.state).toBe('pending');
  expect((await resolve(app, requestId).expect(200)).body.state).toBe('cancelled');
  await complete(app, requestId).expect(409);
  expect((await resolve(app, requestId)).body.state).toBe('cancelled');
  await begin(app);
});

test('a genuinely dropped HTTP response is recoverable without resending the create', async () => {
  const app = appFor();
  const { requestId } = await begin(app);
  const droppingApp = appFor(userId, db, [(req, res, next) => {
    if (req.path.endsWith('/complete')) res.json = () => { res.destroy(); return res; };
    next();
  }]);
  await expect(complete(droppingApp, requestId)).rejects.toThrow();
  const recovered = (await request(appFor()).get(path).expect(200)).body.request;
  expect(recovered).toMatchObject({ requestId, state: 'saved', resolved: false });
  expect((await resolve(app, requestId).expect(200)).body).toMatchObject({ state: 'saved', resolved: true });
  expect((await db.query("SELECT id FROM content_presets WHERE name = 'Test receipt'")).rowCount).toBe(1);
});

test('lock timeout leaves the request recoverable instead of creating competing work', async () => {
  const service = createCustomPresetSaveService({ db });
  const { requestId } = await service.begin(userId);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM custom_preset_save_requests WHERE id = $1 FOR UPDATE', [requestId]);
    await expect(service.resolve(userId, requestId)).rejects.toMatchObject({ code: '55P03' });
  } finally { await client.query('ROLLBACK'); client.release(); }
  expect(await service.pending(userId)).toMatchObject({ state: 'pending', resolved: false });
  expect(await service.resolve(userId, requestId)).toMatchObject({ state: 'cancelled', resolved: true });
});

test('a real row lock serializes resolve behind an in-flight create transaction', async () => {
  const service = createCustomPresetSaveService({ db });
  const { requestId } = await service.begin(userId);
  const locked = Promise.withResolvers(), release = Promise.withResolvers();
  const pausedDb = { ...db, withTransaction: fn => db.withTransaction(client => fn({ query: async (sql, args) => {
    const result = await client.query(sql, args);
    if (sql.includes('FOR UPDATE') && sql.includes('fingerprint')) { locked.resolve(); await release.promise; }
    return result;
  } })) };
  const saving = createCustomPresetSaveService({ db: pausedDb }).complete(userId, requestId, { name: 'Test locked' });
  await locked.promise;
  const resolving = service.resolve(userId, requestId);
  release.resolve();
  const [saved, resolved] = await Promise.all([saving, resolving]);
  expect(saved.presetId).toBe(resolved.presetId);
  expect(resolved).toMatchObject({ state: 'saved', resolved: true });
});

test('bounds and canonical fingerprints reject malformed drafts without creating a preset', async () => {
  const app = appFor();
  const { requestId } = await begin(app);
  for (const payload of [null, [], {}, { name: 1 }, { name: ' ' }, { name: 'a'.repeat(101) },
    { name: 'Test', signals: null }, { name: 'Test', icon: 'x'.repeat(51) },
    { name: 'Test', description: 5 }, { name: 'Test', signals: { large: 'x'.repeat(66_000) } }]) {
    await complete(app, requestId, payload).expect(400);
  }
  const first = (await complete(app, requestId, { name: 'Test canonical', signals: { a: 1, b: [2] } }).expect(200)).body;
  expect((await complete(app, requestId, { name: ' Test canonical ', signals: { b: [2], a: 1 } }).expect(200)).body).toEqual(first);
});

test('retention removes only bounded resolved records; expired IDs never recreate a preset', async () => {
  const app = appFor();
  const { requestId } = await begin(app);
  await resolve(app, requestId).expect(200);
  await db.query("UPDATE custom_preset_save_requests SET resolved_at = NOW() - INTERVAL '31 days' WHERE id = $1", [requestId]);
  await begin(app);
  await complete(app, requestId).expect(404);
  await db.query("UPDATE custom_preset_save_requests SET created_at = NOW() - INTERVAL '90 days' WHERE resolved_at IS NULL");
  await request(app).post(path).send({}).expect(409);
});

test('retention prunes at most 100 records and never another user’s records', async () => {
  await db.query(`INSERT INTO custom_preset_save_requests (id, user_id, state, resolved_at)
    SELECT gen_random_uuid(), $1, 'cancelled', NOW() - INTERVAL '31 days' FROM generate_series(1, 105)`, [userId]);
  await db.query(`INSERT INTO custom_preset_save_requests (id, user_id, state, resolved_at)
    VALUES ($1, $2, 'cancelled', NOW() - INTERVAL '31 days')`, [randomUUID(), otherId]);
  await begin();
  expect((await db.query('SELECT id FROM custom_preset_save_requests WHERE user_id = $1 AND resolved_at IS NOT NULL', [userId])).rowCount).toBe(5);
  expect((await db.query('SELECT id FROM custom_preset_save_requests WHERE user_id = $1', [otherId])).rowCount).toBe(1);
});
