/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { runSelectedDeploymentLifecycle } from '../bootstrap/selectedDeploymentLifecycle.mjs';

const tick = () => new Promise(resolve => { setImmediate(resolve); });
function fixture(mode = 'normal') {
  const events = [], binding = 'a'.repeat(64), processRef = new EventEmitter();
  let resolve;
  const application = { done: new Promise(done => { resolve = done; }), signal: jest.fn(() => { resolve({ code: 0, signal: null }); }) };
  const database = { adopt: jest.fn(async () => { events.push('database'); }), check: jest.fn(), stop: jest.fn(async () => { events.push('stop'); }) };
  const identities = { users: [{ name: 'classifarr', uid: 99, gid: 100 }, { name: 'postgres', uid: 70, gid: 70 }] };
  const options = {
    environment: { NODE_OPTIONS: '--max-old-space-size=1536', CLASSIFARR_RUNTIME_MODE: mode, PUID: '99', PGID: '100', UMASK: '002',
      PGVECTOR_RUNTIME_STAGING: 'disabled', CLASSIFARR_POSTGRES_STARTUP_TIMEOUT_SECONDS: '600' },
    journal: { read: jest.fn(async () => ({ version: 1, binding, completed: 5, pending: null })),
      selection: { read: async () => null, write: async value => { events.push(value.phase); } } }, binding, processRef,
    context: { platform: 'linux', uid: 0, umask: 0o002 }, accounts: jest.fn(async () => identities),
    verify: jest.fn(async () => { events.push('verify'); }),
    verifyVectorStaging: jest.fn(async () => { events.push('vector'); }),
    createDatabase: jest.fn(() => database),
    startMaintenance: jest.fn(() => { events.push('schema'); return { done: Promise.resolve({ code: 0, signal: null }), signal: jest.fn() }; }),
    startNormal: jest.fn(() => { events.push('normal'); return application; }),
    startRestore: jest.fn(() => { events.push('restore'); return application; }),
  };
  return { options, database, application, events, processRef };
}

test.each(['normal', 'restore'])('consumes saved settings and joins %s inside selection lifetime', async mode => {
  const f = fixture(mode), running = runSelectedDeploymentLifecycle(f.options);
  await tick();
  expect(f.events).toEqual(['verifying', 'verify', 'vector', 'selected', 'database', ...(mode === 'normal' ? ['schema', 'normal'] : ['restore'])]);
  expect(f.options.createDatabase).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 600000 }));
  expect(f.options.verifyVectorStaging).toHaveBeenCalledWith({ signal: expect.any(AbortSignal), mode: 'disabled' });
  const launched = mode === 'normal' ? f.options.startNormal : f.options.startRestore;
  expect(launched).toHaveBeenCalledWith(expect.objectContaining({ configuration: expect.objectContaining({
    NODE_OPTIONS: '--max-old-space-size=1536', POSTGRES_POOL_MAX: '15', POSTGRES_CONNECT_RETRIES: '2',
  }) }));
  if (mode === 'restore') {
    expect(f.options.startMaintenance).not.toHaveBeenCalled(); expect(f.options.startNormal).not.toHaveBeenCalled();
    expect(launched.mock.calls[0][0].onFatal).toEqual(expect.any(Function));
  } else expect(f.options.startRestore).not.toHaveBeenCalled();
  f.processRef.emit('SIGTERM'); expect(await running).toBe(0);
  expect(f.events.at(-1)).toBe('stop'); expect(f.processRef.eventNames()).toEqual([]);
});

test.each(['environment', 'uid', 'gid', 'mask', 'root', 'platform', 'vector_verifier', 'verifier'])('refuses %s before selection or database effects', async failure => {
  const f = fixture();
  if (failure === 'environment') f.options.environment.NODE_OPTIONS += ' --import=secret';
  if (failure === 'uid') f.options.environment.PUID = '1000';
  if (failure === 'gid') f.options.environment.PGID = '1000';
  if (failure === 'mask') f.options.context.umask = 0o022;
  if (failure === 'root') f.options.context.uid = 99;
  if (failure === 'platform') f.options.context.platform = 'win32';
  if (failure === 'vector_verifier') f.options.verifyVectorStaging = null;
  if (failure === 'verifier') f.options.verify = null;
  await expect(runSelectedDeploymentLifecycle(f.options)).rejects.toThrow();
  expect(f.options.createDatabase).not.toHaveBeenCalled(); expect(f.options.journal.read).not.toHaveBeenCalled();
});

test.each(['verify', 'verifyVectorStaging'])('failed %s prevents selection and startup', async verifier => {
  const f = fixture(); f.options[verifier].mockRejectedValue(new Error('private setting'));
  expect(await runSelectedDeploymentLifecycle(f.options)).toBe(1);
  expect(f.events).not.toContain('selected'); expect(f.database.adopt).not.toHaveBeenCalled();
  expect(f.options.startMaintenance).not.toHaveBeenCalled(); expect(f.options.startNormal).not.toHaveBeenCalled();
});

test('host cancellation during vector verification starts no process', async () => {
  const f = fixture();
  f.options.verifyVectorStaging.mockImplementation(async () => { f.processRef.emit('SIGTERM'); });
  expect(await runSelectedDeploymentLifecycle(f.options)).toBe(1);
  expect(f.database.adopt).not.toHaveBeenCalled(); expect(f.options.startNormal).not.toHaveBeenCalled();
});

test('restore fatal callback is failure, even after a host stop was requested', async () => {
  const f = fixture('restore');
  const running = runSelectedDeploymentLifecycle(f.options); await tick();
  f.processRef.emit('SIGTERM'); f.options.startRestore.mock.calls[0][0].onFatal();
  expect(await running).toBe(1); expect(f.database.stop).toHaveBeenCalledTimes(1);
});

test('unconfirmed restore completion drains without stopping PostgreSQL or restarting normal workers', async () => {
  const f = fixture('restore'); let reject;
  f.application.done = new Promise((_, failure) => { reject = failure; });
  const running = runSelectedDeploymentLifecycle(f.options); await tick(); reject(new Error('worker exit unconfirmed'));
  expect(await running).toBe(1);
  expect(f.application.signal.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']]);
  expect(f.database.stop).not.toHaveBeenCalled(); expect(f.options.startNormal).not.toHaveBeenCalled();
  expect(f.processRef.eventNames()).toEqual([]);
});

test('fatal uncertainty during application drain cannot be overwritten by the earlier clean host stop', async () => {
  const f = fixture('restore'); let resolve;
  f.application.done = new Promise(done => { resolve = done; });
  f.application.signal.mockImplementation(() => {
    f.options.startRestore.mock.calls[0][0].onFatal(); resolve({ code: 0, signal: null });
  });
  const running = runSelectedDeploymentLifecycle(f.options); await tick(); f.processRef.emit('SIGTERM');
  expect(await running).toBe(1);
});
