/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { brotliCompressSync, deflateSync, gzipSync, zstdCompressSync } from 'node:zlib';
import { createRestoreApp } from '../bootstrap/createRestoreApp.mjs';
import { createBackupRouter } from '../routes/backupRouteShared.mjs';
import { parserRequest, withParserServer } from './helpers/parserHttpFixture.mjs';

function setup() {
  const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const route = express.Router().use((req, res) => res.json({ allowed: req.path }));
  return { database, app: createRestoreApp({ database, authRouter: route, backupRouter: route }) };
}

test.each([['identity', Buffer.from], ['gzip', gzipSync], ['deflate', deflateSync], ['br', brotliCompressSync], ['zstd', zstdCompressSync]])(
  'restore retains JSON, CSRF and maintenance boundaries with %s encoding', async (encoding, compress) => {
    const route = express.Router().use((req, res) => res.json({ parsed: req.body ?? null }));
    const app = createRestoreApp({ database: { query: jest.fn() }, authRouter: route, backupRouter: route });
    await withParserServer(app, async server => {
      const expected = { nested: { label: 'café' }, values: ['one', 'two'] };
      const body = compress(Buffer.from(JSON.stringify(expected)));
      expect(await parserRequest(server, { path: '/api/auth/login', body, encoding })).toEqual({ status: 200, body: { parsed: expected } });
      expect((await parserRequest(server, { path: '/api/backup/import', body, encoding,
        headers: { Cookie: 'access_token=synthetic; classifarr_csrf_token=synthetic' } })).status).toBe(403);
      expect((await parserRequest(server, { path: '/api/unknown', body, encoding })).status).toBe(503);
      const oversized = compress(Buffer.from(JSON.stringify({ value: 'x'.repeat(101 * 1024) })));
      expect((await parserRequest(server, { path: '/api/auth/login', body: oversized, encoding })).status).toBe(413);
    });
  });

test('restore keeps form bodies unparsed and rejects malformed or unsupported JSON encodings', async () => {
  const route = express.Router().use((req, res) => res.json({ parsed: req.body ?? null }));
  const app = createRestoreApp({ database: { query: jest.fn() }, authRouter: route, backupRouter: route });
  await withParserServer(app, async server => {
    expect(await parserRequest(server, { path: '/api/auth/login', body: Buffer.from('key=value'),
      contentType: 'application/x-www-form-urlencoded' })).toEqual({ status: 200, body: { parsed: null } });
    const malformed = await parserRequest(server, { path: '/api/auth/login', body: Buffer.from('{') });
    expect(malformed).toEqual({ status: 400, body: {
      error: 'Bad Request', message: 'Invalid JSON payload. Ensure the request body is valid JSON.',
    } });
    for (const [body, encoding, status] of [[Buffer.from('{}'), 'unknown', 415], [Buffer.from('broken'), 'gzip', 400]]) {
      expect((await parserRequest(server, { path: '/api/auth/login', body, encoding })).status).toBe(status);
    }
  });
});

test.each([
  ['get', '/api/queue/status'], ['post', '/api/webhook'], ['put', '/api/settings'],
  ['post', '/api/auth/register'], ['post', '/api/auth/change-password'], ['post', '/api/setup/create-admin'],
  ['post', '/api/backup/export'], ['get', '/api/backup/download/a.json'], ['delete', '/api/backup/a.json'],
  ['post', '/api/backup/import/extra'], ['post', '/api/backup/IMPORT'],
])('maintenance denies %s %s before ordinary handlers', async (method, url) => {
  const { app, database } = setup();
  const response = await request(app)[method](url);
  expect(response.status).toBe(503);
  expect(response.body.code).toBe('RESTORE_MAINTENANCE_ACTIVE');
  expect(response.headers['cache-control']).toBe('no-store');
  expect(database.query).not.toHaveBeenCalled();
});

test.each([
  ['post', '/api/auth/login'], ['post', '/api/auth/refresh'], ['post', '/api/auth/logout'], ['get', '/api/auth/me'],
  ['get', '/api/backup/runtime'], ['get', '/api/backup/list'], ['post', '/api/backup/preview'], ['post', '/api/backup/import'],
])('maintenance delegates only allowlisted %s %s', async (method, url) => {
  const { app } = setup();
  const response = await request(app)[method](url);
  expect(response.status).toBe(200);
  expect(response.body.allowed).toBeDefined();
  expect(response.headers['cache-control']).toBe('no-store');
});

test('cookie-authenticated restore still requires matching CSRF header', async () => {
  const { app } = setup();
  const cookie = 'access_token=session; classifarr_csrf_token=csrf-test';
  expect((await request(app).post('/api/backup/import').set('Cookie', cookie)).status).toBe(403);
  expect((await request(app).post('/api/backup/import').set('Cookie', cookie).set('x-csrf-token', 'wrong')).status).toBe(403);
  expect((await request(app).post('/api/backup/import').set('Cookie', cookie).set('x-csrf-token', 'csrf-test')).status).toBe(200);
});

test('read-only setup compatibility and health distinguish maintenance from active workers', async () => {
  const { app, database } = setup();
  expect((await request(app).get('/api/setup/status')).body).toEqual({ setupRequired: false, operatingMode: 'restore' });
  const health = await request(app).get('/health');
  expect(health.status).toBe(200);
  expect(health.body).toEqual({ status: 'maintenance', operatingMode: 'restore', workersActive: false });
  database.query.mockRejectedValueOnce(new Error('sensitive database detail'));
  const failed = await request(app).get('/health');
  expect(failed.status).toBe(503);
  expect(JSON.stringify(failed.body)).not.toContain('sensitive');
  const root = await request(app).get('/');
  expect(root.headers.location).toBe('/restore');
  expect(root.headers['content-security-policy']).toBeDefined();
});

function backupApp({ mode = 'normal', authenticated = true, admin = true, getRuntimeStatus } = {}) {
  const service = { restoreBackup: jest.fn().mockResolvedValue({ stats: {} }), logAudit: jest.fn() };
  const app = express();
  app.use(express.json());
  app.use(createBackupRouter({ express, pathModule: {}, backupService: service,
    authenticateToken: (_req, res, next) => authenticated ? next() : res.sendStatus(401),
    requireAdmin: (_req, res, next) => admin ? next() : res.sendStatus(403),
    logger: { info: jest.fn() },
    getRuntimeStatus: getRuntimeStatus || (() => ({ mode, restoreAllowed: mode === 'restore', restartRequired: mode === 'restore' })),
  }));
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json(error.toJSON()));
  return { app, service };
}

test('normal API rejects import even with a request-side mode override', async () => {
  const { app, service } = backupApp();
  const response = await request(app).post('/import?mode=restore').send({ filename: 'config.json', mode: 'restore' });
  expect(response.status).toBe(503);
  expect(response.body.code).toBe('RESTORE_MODE_REQUIRED');
  expect(service.restoreBackup).not.toHaveBeenCalled();
  expect(service.logAudit).not.toHaveBeenCalled();
  const status = await request(app).get('/runtime');
  expect(status.body.restoreAllowed).toBe(false);
  expect(status.headers['cache-control']).toBe('no-store');
});

test('runtime capabilities cannot hot-switch after the router is initialized', async () => {
  const status = { mode: 'normal', restoreAllowed: false };
  const readStatus = jest.fn(() => status);
  const { app, service } = backupApp({ getRuntimeStatus: readStatus });
  status.mode = 'restore';
  status.restoreAllowed = true;
  expect((await request(app).get('/runtime')).body).toEqual({ mode: 'normal', restoreAllowed: false });
  expect((await request(app).post('/import').send({ filename: 'config.json' })).status).toBe(503);
  expect(readStatus).toHaveBeenCalledTimes(1);
  expect(service.restoreBackup).not.toHaveBeenCalled();
});

test.each([{ authenticated: false }, { admin: false }])('mode status requires administrator authentication: %j', async options => {
  const { app } = backupApp(options);
  expect((await request(app).get('/runtime')).status).toBe(options.authenticated === false ? 401 : 403);
});

test('maintenance API keeps existing restore validation and audit', async () => {
  const { app, service } = backupApp({ mode: 'restore' });
  expect((await request(app).post('/import').send({ filename: '../bad.json' })).status).toBe(400);
  expect(service.restoreBackup).not.toHaveBeenCalled();
  expect((await request(app).post('/import').send({ filename: 'config.json' })).status).toBe(200);
  expect(service.restoreBackup).toHaveBeenCalledWith('config.json', { mode: 'replace', userId: undefined, password: undefined });
  expect(service.logAudit).toHaveBeenCalledTimes(1);
});
