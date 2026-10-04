/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { startCompatibleProfilingMaintenance } from '../bootstrap/embeddedCompatibleProfilingMaintenance.mjs';
import { runCompatibleProfilingMaintenance } from '../scripts/runCompatibleProfilingMaintenance.mjs';
import { compatibleMaintenanceEnvironment } from '../bootstrap/embeddedCompatibleMaintenanceEnvironment.mjs';
import { embeddedRuntimeComposition } from '../scripts/runEmbeddedSupervisor.mjs';

const context = { uid: 99, gid: 100, platform: 'linux', cwd: '/app', args: ['--assess'] };
const environment = compatibleMaintenanceEnvironment();
function fixture() {
  const child = Object.assign(new EventEmitter(), { pid: 42, kill: jest.fn(), stdout: new EventEmitter(),
    stderr: new EventEmitter(), stdin: Object.assign(new EventEmitter(), { end: jest.fn() }) });
  return { child, spawnFn: jest.fn(() => child), report: jest.fn() };
}
test.each([[0, 'already_active'], [10, 'installed'], [75, 'deferred'], [1, 'failed'], [2, 'failed']])('joins exit and streams before normalizing result %s', async (code, status) => {
  const f = fixture(), job = startCompatibleProfilingMaintenance({ ...f, ...context });
  const [command, args, options] = f.spawnFn.mock.calls[0];
  expect(command).toBe('/usr/local/bin/node');
  expect(args).toEqual(['/app/src/scripts/runCompatibleProfilingMaintenance.mjs', '--assess']);
  expect(options).toMatchObject({ shell: false, cwd: '/app', timeout: 20_000, killSignal: 'SIGKILL',
    env: { NODE_OPTIONS: '--max-old-space-size=128', POSTGRES_POOL_MAX: '1', POSTGRES_CONN_TIMEOUT_MS: '5000' } });
  expect(Object.keys(options.env).some(key => /SECRET|PASSWORD|TOKEN|PGOPTIONS|CHANNEL/.test(key))).toBe(false);
  f.child.emit('exit', code, null);
  await Promise.resolve(); expect(f.report).not.toHaveBeenCalled();
  f.child.emit('close', code, null);
  expect(await job.done).toEqual({ code: status === 'failed' ? code : 0, signal: null });
  expect(f.report).toHaveBeenCalledWith(status, 'shared_identity', 'query_profiling');
});
test.each(['output_overflow', 'spawn_error', 'signal', 'stream_error'])('never hides child lifecycle failure %s', async kind => {
  const f = fixture(), job = startCompatibleProfilingMaintenance({ ...f, ...context });
  if (kind === 'output_overflow') f.child.stderr.emit('data', Buffer.alloc(65537));
  if (kind === 'spawn_error') { f.child.pid = undefined; f.child.emit('error', new Error('secret')); }
  if (kind === 'stream_error') f.child.stdout.emit('error', new Error('secret'));
  const signal = kind === 'signal' ? 'SIGKILL' : null;
  f.child.emit('exit', 0, signal); f.child.emit('close', 0, signal);
  const result = await job.done;
  expect(result.code !== 0 || result.signal !== null).toBe(true);
  expect(f.report).toHaveBeenCalledWith('failed', 'shared_identity', 'query_profiling');
});
test.each([{ uid: 0 }, { gid: 0 }, { platform: 'win32' }])('rejects incompatible launcher %j', change => {
  const f = fixture();
  expect(() => startCompatibleProfilingMaintenance({ ...f, ...context, ...change })).toThrow();
  expect(f.spawnFn).not.toHaveBeenCalled();
});
test.each([['already_active', 0], ['installed', 10], ['deferred', 75], ['unknown', 1]])('CLI status %s and pool cleanup', async (status, code) => {
  const database = { pool: { end: jest.fn() } }, run = jest.fn(async () => ({ status }));
  expect(await runCompatibleProfilingMaintenance({ context, environment, run, loadDatabase: async () => database })).toBe(code);
  expect(run).toHaveBeenCalledWith({ database }); expect(database.pool.end).toHaveBeenCalledTimes(1);
});
test('CLI cleanup failure cannot report installation', async () => {
  const database = { pool: { end: jest.fn().mockRejectedValue(new Error('secret')) } };
  expect(await runCompatibleProfilingMaintenance({ context, environment,
    loadDatabase: async () => database, run: async () => ({ status: 'installed' }) })).toBe(1);
});
test.each([{ args: [] }, { args: ['--apply'] }, { uid: 0 }, { cwd: '/tmp' }])('CLI refuses %j without loading database', async change => {
  const loadDatabase = jest.fn();
  expect(await runCompatibleProfilingMaintenance({ context: { ...context, ...change }, environment, loadDatabase })).not.toBe(0);
  expect(loadDatabase).not.toHaveBeenCalled();
});
test('composition invokes a single fixed pre-runtime worker only in normal mode', () => {
  const startProfiling = jest.fn(), report = jest.fn();
  const normal = embeddedRuntimeComposition({ environment, startProfiling, report });
  expect(startProfiling).not.toHaveBeenCalled();
  normal.startMaintenance(); expect(startProfiling).toHaveBeenCalledWith({ report });
  const restore = embeddedRuntimeComposition({ environment: { ...environment, CLASSIFARR_RUNTIME_MODE: 'restore' }, startProfiling });
  expect(restore.startMaintenance).toBeUndefined();
  expect(startProfiling).toHaveBeenCalledTimes(1);
});
