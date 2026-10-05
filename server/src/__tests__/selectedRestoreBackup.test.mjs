/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createSelectedRestoreBackupService } from '../services/selectedRestoreBackupService.mjs';
import { createSelectedRestoreBackupFiles, isSelectedBackupName } from '../services/selectedRestoreBackupFiles.mjs';
import { createBackupRouter } from '../routes/backupRouteShared.mjs';
import { createRestoreApp } from '../bootstrap/createRestoreApp.mjs';
import { encryptBackupPayload } from '../services/backupCipher.mjs';

const filename = 'classifarr_config_fixture.json';
const backup = () => ({ version: '2.0', data: { settings: [{ key: 'fixture', value: 'private-value' }] } });
function fixture({ authenticated = true, admin = true } = {}) {
  const files = { read: jest.fn(async () => backup()), list: jest.fn(async () => []) };
  const handoff = { request: jest.fn(async () => ({ status: 'complete' })) }, audit = jest.fn();
  const service = createSelectedRestoreBackupService({ files, handoff, audit });
  const router = createBackupRouter({ express, backupService: service,
    authenticateToken: (_req, res, next) => authenticated ? next() : res.sendStatus(401),
    requireAdmin: (_req, res, next) => admin ? next() : res.sendStatus(403), logger: { info() {} },
    getRuntimeStatus: () => ({ mode: 'restore', restoreAllowed: true, restartRequired: true }) });
  const app = createRestoreApp({ database: { query: jest.fn() }, authRouter: express.Router(), backupRouter: router });
  return { files, handoff, audit, service, app };
}

test.each([{ authenticated: false }, { admin: false }])('HTTP auth rejects before file access: %j', async options => {
  const f = fixture(options);
  const response = await request(f.app).post('/api/backup/import').send({ filename });
  expect(response.status).toBe(options.authenticated === false ? 401 : 403);
  expect(f.files.read).not.toHaveBeenCalled(); expect(f.handoff.request).not.toHaveBeenCalled();
});

test('HTTP preserves CSRF, allowlist, response shape, one-use and zeroed handoff memory', async () => {
  const f = fixture(), cookie = 'access_token=synthetic; classifarr_csrf_token=synthetic';
  expect((await request(f.app).post('/api/backup/import').set('Cookie', cookie).send({ filename })).status).toBe(403);
  expect((await request(f.app).post('/api/backup/export').send({})).status).toBe(503);
  const response = await request(f.app).post('/api/backup/import').set('Cookie', cookie)
    .set('x-csrf-token', 'synthetic').send({ filename, mode: 'merge' });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ success: true, newApiKey: null,
    stats: { librariesRestored: 0, policiesRestored: 0, rulesRestored: 0, patternsRestored: 0 } });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(f.handoff.request.mock.calls[0][0].every(byte => byte === 0)).toBe(true);
  expect(f.audit).toHaveBeenCalledTimes(1);
  expect((await request(f.app).post('/api/backup/import').send({ filename })).status).toBe(503);
  expect(f.handoff.request).toHaveBeenCalledTimes(1);
});

test.each(['wrong-mode', 'bad-json', 'bad-reference', 'wrong-password'])('invalid input does not consume capability: %s', async failure => {
  const f = fixture();
  if (failure === 'bad-json') f.files.read.mockRejectedValueOnce(new Error('private'));
  if (failure === 'bad-reference') f.files.read.mockResolvedValueOnce({ version: '2', data: { libraries: [{ media_server_id: 999 }] } });
  if (failure === 'wrong-password') f.files.read.mockResolvedValueOnce({ encrypted: true, data: encryptBackupPayload(backup(), 'secret') });
  await expect(f.service.restoreBackup(filename, { mode: failure === 'wrong-mode' ? 'sql' : 'merge', password: 'wrong' })).rejects.toMatchObject({ statusCode: 400 });
  expect(f.handoff.request).not.toHaveBeenCalled();
  expect(await f.service.listBackups()).toEqual([]);
});

test.each(['deferred', 'unavailable', 'rejected', 'throws'])('outcome %s never retries and clears bytes', async status => {
  const f = fixture();
  if (status === 'throws') f.handoff.request.mockRejectedValue(new Error('private'));
  else f.handoff.request.mockResolvedValue({ status });
  await expect(f.service.restoreBackup(filename)).rejects.toMatchObject({ statusCode: status === 'rejected' ? 400 : 503 });
  await expect(f.service.restoreBackup(filename)).rejects.toMatchObject({ statusCode: 503 });
  expect(f.handoff.request).toHaveBeenCalledTimes(1);
  expect(f.handoff.request.mock.calls[0][0].every(byte => byte === 0)).toBe(true);
});

test('preparation slot rejects concurrent list, preview and import before allocating files', async () => {
  const f = fixture(); let finish;
  f.files.read.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const preview = f.service.readBackup(filename);
  for (const work of [() => f.service.readBackup(filename), () => f.service.restoreBackup(filename), () => f.service.listBackups()]) {
    await expect(work()).rejects.toMatchObject({ statusCode: 503 });
  }
  finish(backup()); expect(await preview).toEqual(backup());
  expect(f.files.read).toHaveBeenCalledTimes(1);
});

function fileFixture(change = {}) {
  const contents = Buffer.from(JSON.stringify(backup()));
  const stat = { uid: 1000, mode: 0o100600, nlink: 1, size: contents.length,
    dev: 1, ino: 1, mtimeMs: 1, ctimeMs: 1, isFile: () => true, ...change };
  const handle = { stat: jest.fn(async () => stat), close: jest.fn(), read: jest.fn(async (buffer, offset, length, position) =>
    ({ bytesRead: contents.copy(buffer, offset, position, position + length) })) };
  const io = { lstat: jest.fn(async () => ({ uid: 1000, mode: 0o40700, isDirectory: () => true })), open: jest.fn(async () => handle) };
  return { handle, io, files: createSelectedRestoreBackupFiles({ directory: '/app/data/backups', uid: 1000, io }) };
}

test('regular backup reader closes the handle and never writes files', async () => {
  const f = fileFixture(); expect(await f.files.read(filename)).toEqual(backup());
  expect(f.handle.close).toHaveBeenCalledTimes(1);
  expect(Object.keys(f.io)).toEqual(['lstat', 'open']);
});

test.each([null, [], '../x.json', 'classifarr_config_../x.json', 'classifarr_config_x\\x.json', 'classifarr_config_..json', 'x.json'])('filename refuses %j before access', async value => {
  const f = fileFixture(); expect(isSelectedBackupName(value)).toBe(false);
  await expect(f.files.read(value)).rejects.toThrow('restore_backup_unavailable'); expect(f.io.open).not.toHaveBeenCalled();
});

test.each([{ nlink: 2 }, { uid: 70 }, { mode: 0o100666 }, { size: 64 * 1024 * 1024 }, { isFile: () => false }])('file boundary rejects %j', async change => {
  const f = fileFixture(change); await expect(f.files.read(filename)).rejects.toThrow('restore_backup_unavailable');
  expect(f.handle.read).not.toHaveBeenCalled(); expect(f.handle.close).toHaveBeenCalledTimes(1);
});

test('symlink ancestors and changing files are refused', async () => {
  const f = fileFixture(); f.io.lstat.mockResolvedValue({ isDirectory: () => false });
  await expect(f.files.read(filename)).rejects.toThrow('restore_backup_unavailable'); expect(f.io.open).not.toHaveBeenCalled();
  const changed = fileFixture(), original = await changed.handle.stat();
  changed.handle.stat.mockResolvedValueOnce(original).mockResolvedValue({ ...original, ctimeMs: 2 });
  await expect(changed.files.read(filename)).rejects.toThrow('restore_backup_unavailable');
});

test('catalog bounds enumeration, skips unsafe entries, and closes iteration on failure', async () => {
  for (const count of [2, 513]) {
    const f = fileFixture(); let closed = false;
    f.io.opendir = jest.fn(async () => ({ async *[Symbol.asyncIterator]() {
      try { for (let i = 0; i < count; i++) yield { name: filename, isFile: () => false }; }
      finally { closed = true; }
    } }));
    if (count === 2) expect(await f.files.list()).toEqual([]);
    else await expect(f.files.list()).rejects.toThrow('restore_backup_unavailable');
    expect(closed).toBe(true);
  }
});
