/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { runEmbeddedSupervisor } from '../bootstrap/embeddedSupervisor.mjs';
import { startEmbeddedApplication, waitForEmbeddedExit } from '../bootstrap/embeddedChildProcess.mjs';
import { assertEmbeddedSupervisorEnvironment } from '../scripts/runEmbeddedSupervisor.mjs';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => { setImmediate(resolve); });

function fixture() {
  const exit = deferred();
  const processRef = new EventEmitter();
  const events = [];
  const database = { adopt: jest.fn(async () => {}), check: jest.fn(async () => {}), stop: jest.fn(async () => { events.push('db_stop'); }) };
  const application = { done: exit.promise, signal: jest.fn(signal => {
    events.push(signal);
    exit.resolve({ code: 0, signal: null });
  }) };
  const options = { database, processRef, startApplication: jest.fn(() => application), report: (status, reason) => events.push([status, reason]) };
  return { exit, processRef, events, database, application, options };
}

test.each(['SIGTERM', 'SIGINT'])('drains once on %s and cleans listeners/timers', async signal => {
  const f = fixture();
  const run = runEmbeddedSupervisor(f.options);
  await tick();
  f.processRef.emit(signal);
  f.processRef.emit('SIGTERM');
  expect(await run).toBe(0);
  expect(f.application.signal).toHaveBeenCalledTimes(1);
  expect(f.events.indexOf('SIGTERM')).toBeLessThan(f.events.indexOf('db_stop'));
  expect(f.events).toContainEqual(['database_stopped', undefined]);
  expect(f.processRef.eventNames()).toEqual([]);
  expect(f.database.check).not.toHaveBeenCalled();
});

test('waits for actual Node exit before database stop', async () => {
  const f = fixture();
  f.application.signal.mockImplementation(() => {});
  const run = runEmbeddedSupervisor(f.options);
  await tick();
  f.processRef.emit('SIGTERM');
  await tick();
  expect(f.database.stop).not.toHaveBeenCalled();
  f.exit.resolve({ code: 0, signal: null });
  expect(await run).toBe(0);
});

test.each([{ code: 0, signal: null, expected: 0 }, { code: 9, signal: null, expected: 1 },
  { code: null, signal: 'SIGKILL', expected: 1 }])('handles application exit %j', async result => {
  const f = fixture();
  const run = runEmbeddedSupervisor(f.options);
  await tick();
  f.exit.resolve(result);
  expect(await run).toBe(result.expected);
  expect(f.database.stop).toHaveBeenCalledTimes(1);
});

test('signal during adoption never starts workers but stops adopted database', async () => {
  const f = fixture();
  const adoption = deferred();
  f.database.adopt.mockReturnValue(adoption.promise);
  const run = runEmbeddedSupervisor(f.options);
  f.processRef.emit('SIGTERM');
  adoption.resolve();
  expect(await run).toBe(0);
  expect(f.options.startApplication).not.toHaveBeenCalled();
  expect(f.database.stop).toHaveBeenCalledTimes(1);
});

test('failed adoption never signals an unverified database', async () => {
  const f = fixture();
  f.database.adopt.mockRejectedValue(new Error('unavailable'));
  expect(await runEmbeddedSupervisor(f.options)).toBe(1);
  expect(f.options.startApplication).not.toHaveBeenCalled();
  expect(f.database.stop).not.toHaveBeenCalled();
  expect(f.processRef.eventNames()).toEqual([]);
});

test('synchronous spawn failure still cleans adopted database', async () => {
  const f = fixture();
  f.options.startApplication.mockImplementation(() => { throw new Error('spawn'); });
  expect(await runEmbeddedSupervisor(f.options)).toBe(1);
  expect(f.database.stop).toHaveBeenCalledTimes(1);
});

test('serial status failure drains runtime and exits nonzero', async () => {
  const f = fixture();
  f.options.delay = jest.fn(async () => {});
  f.database.check.mockRejectedValue(new Error('lost'));
  expect(await runEmbeddedSupervisor(f.options)).toBe(1);
  expect(f.options.delay).toHaveBeenCalledTimes(1);
  expect(f.events).toContainEqual(['stopping', 'database_unavailable']);
});

test('slow status check cannot overlap and is joined before shutdown', async () => {
  const f = fixture();
  const status = deferred();
  f.options.delay = jest.fn(async () => {});
  f.database.check.mockReturnValue(status.promise);
  const run = runEmbeddedSupervisor(f.options);
  await tick();
  expect(f.database.check).toHaveBeenCalledTimes(1);
  f.processRef.emit('SIGTERM');
  await tick();
  expect(f.database.stop).not.toHaveBeenCalled();
  status.resolve();
  expect(await run).toBe(0);
  expect(f.database.check).toHaveBeenCalledTimes(1);
});

test.each([true, false])('forced exit joined=%s is failure, never graceful success', async joined => {
  const f = fixture();
  f.application.signal.mockImplementation(() => {});
  f.options.waitForExit = jest.fn().mockRejectedValueOnce(new Error('timeout'));
  if (joined) f.options.waitForExit.mockResolvedValueOnce({ code: null, signal: 'SIGKILL' });
  else f.options.waitForExit.mockRejectedValueOnce(new Error('still running'));
  const run = runEmbeddedSupervisor(f.options);
  await tick();
  f.processRef.emit('SIGTERM');
  expect(await run).toBe(1);
  expect(f.application.signal.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']]);
  expect(f.options.waitForExit.mock.calls.map(call => call[1])).toEqual([15_000, 2000]);
  expect(f.database.stop).toHaveBeenCalledTimes(joined ? 1 : 0);
});

test('database stop failure is never called clean', async () => {
  const f = fixture();
  f.database.stop.mockRejectedValue(new Error('permission'));
  const run = runEmbeddedSupervisor(f.options);
  await tick();
  f.processRef.emit('SIGTERM');
  expect(await run).toBe(1);
  expect(f.events).not.toContainEqual(['database_stopped', undefined]);
});

test('online maintenance and application drain start together; both must join before database stop', async () => {
  const f = fixture(), drained = deferred();
  const stop = jest.fn(() => drained.promise);
  f.options.attachRuntimeMaintenance = jest.fn(() => ({ stop }));
  const run = runEmbeddedSupervisor(f.options);
  await tick(); f.processRef.emit('SIGTERM'); await tick();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(f.application.signal).toHaveBeenCalledWith('SIGTERM');
  expect(f.database.stop).not.toHaveBeenCalled();
  drained.resolve(); expect(await run).toBe(0);
  expect(f.database.stop).toHaveBeenCalledTimes(1);
});

test('unconfirmed online maintenance exit fails the supervisor and forbids database stop', async () => {
  const f = fixture(); let fatal;
  f.options.attachRuntimeMaintenance = (_app, onFatal) => {
    fatal = onFatal;
    return { stop: async () => { throw new Error('unconfirmed'); } };
  };
  const run = runEmbeddedSupervisor(f.options);
  await tick(); fatal();
  expect(await run).toBe(1);
  expect(f.database.stop).not.toHaveBeenCalled();
  expect(f.events).toContainEqual(['maintenance_exit_unconfirmed', undefined]);
});

test('maintenance must exit successfully before any application starts', async () => {
  const f = fixture();
  const job = deferred();
  f.options.startMaintenance = jest.fn(() => ({ done: job.promise, signal: jest.fn() }));
  const run = runEmbeddedSupervisor(f.options);
  await tick();
  expect(f.options.startApplication).not.toHaveBeenCalled();
  job.resolve({ code: 0, signal: null });
  await tick();
  expect(f.options.startApplication).toHaveBeenCalledTimes(1);
  f.processRef.emit('SIGTERM');
  expect(await run).toBe(0);
  expect(f.events).toContainEqual(['maintenance_completed', undefined]);
});

test.each([1, 75])('maintenance exit %s forbids runtime launch and stops database', async code => {
  const f = fixture();
  f.options.startMaintenance = () => ({ done: Promise.resolve({ code, signal: null }), signal: jest.fn() });
  expect(await runEmbeddedSupervisor(f.options)).toBe(1);
  expect(f.options.startApplication).not.toHaveBeenCalled();
  expect(f.database.stop).toHaveBeenCalledTimes(1);
});

test('cancellation during maintenance waits for confirmed exit, never resumes runtime', async () => {
  const f = fixture();
  const job = deferred();
  const signal = jest.fn();
  f.options.startMaintenance = () => ({ done: job.promise, signal });
  const run = runEmbeddedSupervisor(f.options);
  await tick();
  f.processRef.emit('SIGTERM');
  await tick();
  expect(signal).toHaveBeenCalledWith('SIGTERM');
  expect(f.database.stop).not.toHaveBeenCalled();
  job.resolve({ code: null, signal: 'SIGTERM' });
  expect(await run).toBe(0);
  expect(f.options.startApplication).not.toHaveBeenCalled();
  expect(f.database.stop).toHaveBeenCalledTimes(1);
});

test.each([true, false])('maintenance timeout forces confirmed cleanup=%s', async joined => {
  const f = fixture();
  const signal = jest.fn();
  f.options.startMaintenance = () => ({ done: new Promise(() => {}), signal });
  f.options.waitForExit = jest.fn().mockRejectedValueOnce(new Error('deadline'))
    .mockRejectedValueOnce(new Error('drain'));
  if (joined) f.options.waitForExit.mockResolvedValueOnce({ code: null, signal: 'SIGKILL' });
  else f.options.waitForExit.mockRejectedValueOnce(new Error('not_joined'));
  expect(await runEmbeddedSupervisor(f.options)).toBe(1);
  expect(f.options.waitForExit.mock.calls.map(call => call[1])).toEqual([200_000, 2000, 2000]);
  expect(signal.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']]);
  expect(f.options.startApplication).not.toHaveBeenCalled();
  expect(f.database.stop).toHaveBeenCalledTimes(joined ? 1 : 0);
});

test('child error after spawn is not proof of exit; output and arguments are fixed', async () => {
  const child = Object.assign(new EventEmitter(), { pid: 55, kill: jest.fn() });
  const spawnFn = jest.fn(() => child);
  const runtime = startEmbeddedApplication({ spawnFn, environment: { TEST: 'value' } });
  expect(spawnFn).toHaveBeenCalledWith(process.execPath, ['/app/src/index.mjs'], expect.objectContaining({ shell: false, stdio: ['ignore', 'inherit', 'inherit'], env: { TEST: 'value' } }));
  child.emit('error', new Error('signal failed'));
  expect(runtime.hasExited()).toBe(false);
  runtime.signal('SIGTERM');
  child.emit('exit', 0, null);
  expect(await runtime.done).toEqual({ code: 1, signal: null });
  runtime.signal('SIGKILL');
  expect(child.kill).toHaveBeenCalledTimes(1);
});

test('failed spawn settles once, without unhandled rejection', async () => {
  const child = Object.assign(new EventEmitter(), { kill: jest.fn() });
  const runtime = startEmbeddedApplication({ spawnFn: () => child });
  child.emit('error', new Error('ENOENT'));
  expect(await runtime.done).toEqual({ code: 1, signal: null });
  expect(runtime.hasExited()).toBe(true);
});

test('exit deadline is bounded and cancelled after completion', async () => {
  jest.useFakeTimers();
  try {
    expect(await waitForEmbeddedExit(Promise.resolve({ code: 0 }), 50)).toEqual({ code: 0 });
    expect(jest.getTimerCount()).toBe(0);
    const waiting = expect(waitForEmbeddedExit(new Promise(() => {}), 50)).rejects.toThrow('application_exit_timeout');
    await jest.advanceTimersByTimeAsync(50);
    await waiting;
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

const environment = { POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432', POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr' };
const context = { uid: 1000, platform: 'linux', cwd: '/app', args: ['--run'] };
test('fixed embedded launch contract accepts custom non-root identity', () => {
  expect(() => assertEmbeddedSupervisorEnvironment(environment, { ...context, uid: 2345 })).not.toThrow();
});
test.each([{ uid: 0 }, { uid: undefined }, { platform: 'win32' }, { cwd: '/tmp' }, { args: [] }, { args: ['--run', '--force'] }])('rejects unsafe launch context %j', change => {
  expect(() => assertEmbeddedSupervisorEnvironment(environment, { ...context, ...change })).toThrow('environment_invalid');
});
test.each(['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'CLASSIFARR_SCHEMA_MAINTENANCE'])('rejects altered %s', key => {
  expect(() => assertEmbeddedSupervisorEnvironment({ ...environment, [key]: 'external' }, context)).toThrow('environment_invalid');
});
