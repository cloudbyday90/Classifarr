/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { selectedRestoreHttpEnvironment, assertSelectedRestoreHttpBoundary, startSelectedRestoreHttp } from '../bootstrap/embeddedSelectedRestoreHttp.mjs';
import { runSelectedRestoreHttp } from '../scripts/runSelectedRestoreHttp.mjs';

const accounts = { users: [{ name: 'postgres', uid: 70, gid: 70 }, { name: 'classifarr', uid: 1000, gid: 1000 }] };
const context = { uid: 1000, gid: 1000, platform: 'linux', cwd: '/app', args: ['--run'] };

test('restore environment keeps restricted authority, reviewed configuration and no parent values', () => {
  const env = selectedRestoreHttpEnvironment({ PORT: '21325', NODE_OPTIONS: '--max-old-space-size=1536' });
  expect(env).toMatchObject({ POSTGRES_USER: 'cf_runtime', CLASSIFARR_SCHEMA_MAINTENANCE: 'external',
    CLASSIFARR_RUNTIME_MODE: 'restore', POSTGRES_POOL_MAX: '5', PORT: '21325', NODE_OPTIONS: '--max-old-space-size=1536' });
  expect(() => assertSelectedRestoreHttpBoundary(env, context, accounts)).not.toThrow();
});

test.each(['root', 'shared', 'owner', 'remote', 'normal', 'extra', 'args', 'platform'])('refuses boundary violation %s', failure => {
  const env = selectedRestoreHttpEnvironment(), ctx = { ...context }, actual = structuredClone(accounts);
  if (failure === 'root') ctx.uid = 0;
  if (failure === 'shared') actual.users[0].uid = 1000;
  if (failure === 'owner') env.POSTGRES_USER = 'classifarr';
  if (failure === 'remote') env.POSTGRES_HOST = 'remote.example';
  if (failure === 'normal') env.CLASSIFARR_RUNTIME_MODE = 'normal';
  if (failure === 'extra') env.NODE_EXTRA_CA_CERTS = '/tmp/injected';
  if (failure === 'args') ctx.args = ['--run', '--sql'];
  if (failure === 'platform') ctx.platform = 'win32';
  expect(() => assertSelectedRestoreHttpBoundary(env, ctx, actual)).toThrow();
});

test('entry refuses inherited authority before any configuration, channel or service import', async () => {
  const inspectConfiguration = jest.fn(), connect = jest.fn(), loadDatabase = jest.fn(), loadRuntime = jest.fn();
  await expect(runSelectedRestoreHttp({ environment: { ...selectedRestoreHttpEnvironment(), POSTGRES_USER: 'classifarr' },
    context, accounts: async () => accounts, inspectConfiguration, connect, loadDatabase, loadRuntime })).rejects.toThrow();
  for (const action of [inspectConfiguration, connect, loadDatabase, loadRuntime]) expect(action).not.toHaveBeenCalled();
});

test('dotenv and unreadable saved key refuse before a database import', async () => {
  for (const failure of ['dotenv', 'key']) {
    const loadDatabase = jest.fn(), connect = jest.fn();
    await expect(runSelectedRestoreHttp({ environment: selectedRestoreHttpEnvironment(), context,
      accounts: async () => accounts, loadDatabase, connect,
      assertNoEnvFile: async () => { if (failure === 'dotenv') throw new Error('fixture'); },
      inspectConfiguration: async () => { throw new Error('fixture'); },
    })).rejects.toThrow('fixture');
    expect(loadDatabase).not.toHaveBeenCalled(); expect(connect).not.toHaveBeenCalled();
  }
});

test('fixed launcher has one inherited descriptor and joins process closure', async () => {
  const channel = Object.assign(new EventEmitter(), { destroy: jest.fn() });
  const child = Object.assign(new EventEmitter(), { stdio: [null, null, null, channel], kill: jest.fn() });
  const spawnFn = jest.fn(() => child);
  const app = startSelectedRestoreHttp({ identities: { application: accounts.users[1], database: accounts.users[0] },
    uid: 0, platform: 'linux', spawnFn, onFatal: jest.fn() });
  expect(spawnFn.mock.calls[0]).toEqual(['/sbin/su-exec', ['1000:1000', '/usr/local/bin/node',
    '/app/src/scripts/runSelectedRestoreHttp.mjs', '--run'], { cwd: '/app', shell: false,
    stdio: ['ignore', 'inherit', 'inherit', 'pipe'], env: selectedRestoreHttpEnvironment() }]);
  app.signal('SIGTERM'); expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  child.emit('exit', 0, null); child.emit('close', 0, null);
  expect(await app.done).toEqual({ code: 0, signal: null }); expect(channel.destroy).toHaveBeenCalled();
});
