/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
const refreshFromDatabase = jest.fn();
const createRestoreApp = jest.fn();
jest.unstable_mockModule('../config/runtimeSettings.mjs', () => ({ refreshFromDatabase }));
jest.unstable_mockModule('../bootstrap/createRestoreApp.mjs', () => ({ createRestoreApp }));
jest.unstable_mockModule('../routes/auth.mjs', () => ({ router: 'auth' }));
jest.unstable_mockModule('../routes/backup.mjs', () => ({ router: 'backup' }));
const { startRestoreServer } = await import('../bootstrap/restoreRuntime.mjs');

function setup() {
  const database = { query: jest.fn().mockResolvedValue({ rows: [{ gate_table: 'gate', has_admin: true }] }) };
  const server = Object.assign(new EventEmitter(), { close: jest.fn(callback => callback()) });
  const listen = jest.fn((_port, _host, callback) => { queueMicrotask(callback); return server; });
  createRestoreApp.mockReturnValue({ listen });
  const processRef = Object.assign(new EventEmitter(), { exit: jest.fn() });
  return { database, server, listen, processRef, start: () => startRestoreServer({ database, port: 0, processRef }) };
}
beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { jest.useRealTimers(); });

test.each(['SIGTERM', 'SIGINT'])('starts read-only preflight then isolated HTTP and shuts down on %s', async signal => {
  const { start, database, server, processRef, listen } = setup();
  await expect(start()).resolves.toBe(server);
  expect(database.query).toHaveBeenCalledTimes(1);
  expect(database.query.mock.calls[0][0]).toMatch(/^SELECT/);
  expect(refreshFromDatabase).toHaveBeenCalledTimes(1);
  expect(createRestoreApp).toHaveBeenCalledWith({ database, authRouter: 'auth', backupRouter: 'backup' });
  expect(listen).toHaveBeenCalledWith(0, '0.0.0.0', expect.any(Function));
  processRef.emit(signal);
  expect(server.close).toHaveBeenCalledTimes(1);
  expect(processRef.exit).toHaveBeenCalledWith(0);
});

test.each([{ rows: [] }, { rows: [{ gate_table: null, has_admin: true }] }, { rows: [{ gate_table: 'gate', has_admin: false }] }])('uninitialized preflight %j does not open HTTP', async ({ rows }) => {
  const { start, database, listen } = setup();
  database.query.mockResolvedValueOnce({ rows });
  await expect(start()).rejects.toThrow('initialized database');
  expect(listen).not.toHaveBeenCalled();
  expect(refreshFromDatabase).not.toHaveBeenCalled();
});

test('listen errors are returned for fatal entrypoint handling', async () => {
  const { start, listen, server } = setup();
  listen.mockImplementation(() => { queueMicrotask(() => server.emit('error', new Error('port unavailable'))); return server; });
  await expect(start()).rejects.toThrow('port unavailable');
});

test('shutdown force-exits when a request does not drain', async () => {
  const { start, server, processRef } = setup();
  await start();
  jest.useFakeTimers();
  server.close.mockImplementation(() => {});
  processRef.emit('SIGTERM');
  jest.advanceTimersByTime(10_000);
  expect(processRef.exit).toHaveBeenCalledWith(1);
});
