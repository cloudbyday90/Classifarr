/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { startSelectedApplication, selectedApplicationEnvironment } from '../bootstrap/embeddedSelectedApplication.mjs';
import { selectedRuntimeComposition } from '../bootstrap/embeddedSelectedRuntimeComposition.mjs';
import { runSelectedApplication } from '../scripts/runSelectedApplication.mjs';
import { selectedApplicationConfiguration } from '../bootstrap/selectedApplicationConfiguration.mjs';

const identities = { application: { uid: 1000, gid: 1000 }, database: { uid: 70, gid: 70 } };
const accounts = { users: [{ name: 'postgres', ...identities.database }, { name: 'classifarr', ...identities.application }] };
const context = { platform: 'linux', cwd: '/app', uid: 1000, gid: 1000, args: ['--run'] };
function fixture() {
  const startApplication = jest.fn(async () => 'server');
  const loadDatabase = jest.fn(async () => ({ pool: 'database' }));
  const loadApplication = jest.fn(async () => ({ startApplication }));
  return { startApplication, loadDatabase, loadApplication, options: {
    environment: selectedApplicationEnvironment(), context, accounts: async () => accounts,
    assertNoEnvFile: jest.fn(), inspectConfiguration: jest.fn(async () => 'ab'.repeat(32)),
    onAdmissionLost: jest.fn(), loadDatabase, loadApplication,
  } };
}

test('constructs a fixed credential-free normal application launch without shell or maintenance timeout', async () => {
  const child = Object.assign(new EventEmitter(), { kill: jest.fn() });
  const spawnFn = jest.fn(() => child);
  const application = startSelectedApplication({ identity: identities.application, spawnFn, uid: 0, platform: 'linux' });
  expect(spawnFn).toHaveBeenCalledWith('/sbin/su-exec', ['1000:1000', '/usr/local/bin/node',
    '/app/src/scripts/runSelectedApplication.mjs', '--run'], {
    cwd: '/app', shell: false, stdio: ['ignore', 'inherit', 'inherit'], env: selectedApplicationEnvironment(),
  });
  application.signal('SIGTERM'); expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  expect(application.hasExited()).toBe(false);
  child.emit('exit', 0, null); expect(await application.done).toEqual({ code: 0, signal: null });
  expect(application.hasExited()).toBe(true);
});

test.each([{ uid: 1000 }, { platform: 'win32' }, { identity: { uid: 0, gid: 1 } },
  { identity: { uid: '1;id', gid: 1 } }, { identity: null }])('rejects unsafe launch %j', options => {
  const spawnFn = jest.fn();
  expect(() => startSelectedApplication({ uid: 0, platform: 'linux', identity: identities.application, ...options, spawnFn })).toThrow();
  expect(spawnFn).not.toHaveBeenCalled();
});

test.each([{ uid: 0 }, { uid: 70 }, { gid: 70 }, { platform: 'win32' }, { cwd: '/tmp' },
  { args: [] }, { args: ['--restore'] }, { args: ['--run', '--extra'] }])('rejects worker context %j before imports', async change => {
  const f = fixture();
  await expect(runSelectedApplication({ ...f.options, context: { ...context, ...change } })).rejects.toThrow();
  expect(f.loadDatabase).not.toHaveBeenCalled(); expect(f.loadApplication).not.toHaveBeenCalled();
});

test.each(['POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_DB', 'NODE_OPTIONS', 'CLASSIFARR_RUNTIME_MODE',
  'HOME', 'PORT', 'PGPASSWORD', 'RUNTIME_SETTINGS_FILE', 'API_KEY_ENCRYPTION_KEY', 'EXTRA'])('rejects altered/extra %s before imports', async key => {
  const f = fixture();
  await expect(runSelectedApplication({ ...f.options, environment: { ...f.options.environment, [key]: 'untrusted' } })).rejects.toThrow();
  expect(f.loadDatabase).not.toHaveBeenCalled();
});

test.each(['missing_env', 'identity_collision', 'dotenv', 'no_fail_stop', 'configuration'])('rejects %s before imports', async failure => {
  const f = fixture();
  if (failure === 'missing_env') delete f.options.environment.POSTGRES_DB;
  if (failure === 'identity_collision') f.options.accounts = async () => ({ users: [...accounts.users, { name: 'alias', uid: 1000, gid: 1000 }] });
  if (failure === 'dotenv') f.options.assertNoEnvFile.mockRejectedValue(new Error('present or inaccessible'));
  if (failure === 'no_fail_stop') f.options.onAdmissionLost = null;
  if (failure === 'configuration') f.options.inspectConfiguration.mockRejectedValue(new Error('unavailable'));
  await expect(runSelectedApplication(f.options)).rejects.toThrow();
  expect(f.loadDatabase).not.toHaveBeenCalled();
});

test('starts the real application contract only after guard checks, preserving fail-stop', async () => {
  const f = fixture();
  expect(await runSelectedApplication(f.options)).toBe('server');
  expect(f.options.environment.API_KEY_ENCRYPTION_KEY).toBe('ab'.repeat(32));
  expect(f.startApplication).toHaveBeenCalledWith({ database: { pool: 'database' }, environment: f.options.environment,
    onAdmissionLost: f.options.onAdmissionLost });
});

test.each(['normal', 'restore'])('dispatches %s to a closed operation vocabulary', mode => {
  const startMaintenance = jest.fn(), startApplication = jest.fn();
  const request = mode === 'restore' ? Buffer.from('{}') : null;
  const composition = selectedRuntimeComposition({ mode, identities, request, startMaintenance, startApplication });
  composition.startMaintenance();
  expect(startMaintenance).toHaveBeenCalledWith({ operation: mode === 'normal' ? 'schema' : 'restore',
    identity: identities.database, request, report: expect.any(Function) });
  if (mode === 'normal') { composition.startApplication(); expect(startApplication).toHaveBeenCalledWith({ identity: identities.application,
    configuration: selectedApplicationConfiguration() }); }
  else { expect(composition.startApplication).toBeNull(); expect(startApplication).not.toHaveBeenCalled(); }
  expect(composition.maintenanceOnly).toBe(mode === 'restore');
});

test.each([{ mode: 'unknown' }, { mode: 'normal', request: Buffer.from('{}') }, { mode: 'restore' },
  { mode: 'restore', request: '{}' }, { mode: 'restore', request: Buffer.alloc(0) },
  { mode: 'restore', request: Buffer.alloc(64 * 1024 * 1024 + 1) },
  { identities: null }, { identities: { application: identities.database, database: identities.database } },
  { configuration: { POSTGRES_USER: 'postgres' } },
  { mode: 'restore', request: Buffer.from('{}'), configuration: { LOG_LEVEL: 'error' } },
])('invalid dispatch fails before effects (%#)', change => {
  const startApplication = jest.fn(), startMaintenance = jest.fn();
  expect(() => selectedRuntimeComposition({ mode: 'normal', identities, startApplication, startMaintenance, ...change })).toThrow();
  expect(startApplication).not.toHaveBeenCalled(); expect(startMaintenance).not.toHaveBeenCalled();
});

test('copies reviewed configuration before composition and never forwards it to schema maintenance', () => {
  const configuration = { API_KEY_ENCRYPTION_KEY: 'cd'.repeat(32), RUNTIME_SETTINGS_FILE: '/config/runtime.json' };
  const startApplication = jest.fn(), startMaintenance = jest.fn();
  const composition = selectedRuntimeComposition({ mode: 'normal', identities, configuration, startApplication, startMaintenance });
  configuration.API_KEY_ENCRYPTION_KEY = 'changed';
  composition.startApplication(); composition.startMaintenance();
  expect(startApplication.mock.calls[0][0].configuration.API_KEY_ENCRYPTION_KEY).toBe('cd'.repeat(32));
  expect(startMaintenance.mock.calls[0][0]).not.toHaveProperty('configuration');
});
