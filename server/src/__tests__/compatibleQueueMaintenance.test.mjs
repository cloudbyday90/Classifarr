/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { startCompatibleQueueMaintenance, createCompatibleQueueMaintenanceBroker } from '../bootstrap/embeddedCompatibleQueueMaintenance.mjs';
import { startEmbeddedApplication } from '../bootstrap/embeddedChildProcess.mjs';
import { embeddedRuntimeComposition, assertEmbeddedSupervisorEnvironment } from '../scripts/runEmbeddedSupervisor.mjs';
import { assertCompatibleQueueDatabase, runCompatibleQueueRecovery } from '../scripts/runCompatibleQueueRecovery.mjs';

const tick = () => new Promise(resolve => { setImmediate(resolve); });
const context = { uid: 99, gid: 100, platform: 'linux', cwd: '/app', args: ['--assess'] };
const environment = { CLASSIFARR_RUNTIME_MODE: 'normal', CLASSIFARR_SCHEMA_MAINTENANCE: 'startup',
  POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432', POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr' };
const stream = () => Object.assign(new EventEmitter(), { write: jest.fn(() => true), destroy: jest.fn(), unref: jest.fn() });
function fixture() {
  const child = Object.assign(new EventEmitter(), { pid: 42, kill: jest.fn(), stdio: [null, null, null, stream()],
    stdout: new EventEmitter(), stderr: new EventEmitter(), stdin: Object.assign(new EventEmitter(), { end: jest.fn() }) });
  return { child, spawnFn: jest.fn(() => child) };
}

test.each([[99, 100], [1000, 1000], [2345, 2345]])('compatible UID %s GID %s gets only a fixed command and environment', async (uid, gid) => {
  const f = fixture();
  const job = startCompatibleQueueMaintenance({ ...f, uid, gid, platform: 'linux' });
  const [command, args, options] = f.spawnFn.mock.calls[0];
  expect(command).toBe('/usr/local/bin/node');
  expect(args).toEqual(['/app/src/scripts/runCompatibleQueueRecovery.mjs', '--assess']);
  expect(options).toMatchObject({ shell: false, cwd: '/app', stdio: ['pipe', 'pipe', 'pipe'] });
  expect(options.uid).toBeUndefined(); expect(options.gid).toBeUndefined();
  expect(options.env.NODE_OPTIONS).toBe('--max-old-space-size=512');
  expect(options.env.POSTGRES_POOL_MAX).toBe('2');
  expect(Object.keys(options.env).some(key => /SECRET|PASSWORD|TOKEN|PGOPTIONS|PGPASSFILE|CHANNEL/.test(key))).toBe(false);
  expect(f.child.stdin.end).toHaveBeenCalledWith(null);
  f.child.emit('exit', 75, null); f.child.emit('close', 75, null);
  expect(await job.done).toEqual({ code: 75, signal: null });
});
test.each([{ uid: 0 }, { gid: 0 }, { uid: -1 }, { gid: NaN }, { platform: 'win32' }])('rejects incompatible launch %j before spawning', change => {
  const f = fixture();
  expect(() => startCompatibleQueueMaintenance({ ...f, ...context, ...change })).toThrow();
  expect(f.spawnFn).not.toHaveBeenCalled();
});
test.each(['overflow', 'stderr-error', 'spawn-error'])('compatible %s cannot become a successful result', async scenario => {
  const f = fixture(), job = startCompatibleQueueMaintenance({ ...f, ...context });
  if (scenario === 'overflow') f.child.stderr.emit('data', Buffer.alloc(65537));
  if (scenario === 'stderr-error') f.child.stderr.emit('error', new Error('secret'));
  if (scenario === 'spawn-error') { f.child.pid = undefined; f.child.emit('error', new Error('secret')); }
  f.child.emit('exit', 0, null); f.child.emit('close', 0, null);
  expect((await job.done).code).toBe(1);
});
test.each([[0, 'C'], [75, 'D'], [1, 'E']])('compatible broker is idle until requested and maps %s to %s', async (code, response) => {
  const channel = stream(), report = jest.fn();
  const start = jest.fn(() => ({ done: Promise.resolve({ code, signal: null }), signal: jest.fn() }));
  const broker = createCompatibleQueueMaintenanceBroker({ channel, start, report, ...context });
  expect(start).not.toHaveBeenCalled();
  channel.emit('data', Buffer.from('Q')); await tick();
  expect(start).toHaveBeenCalledWith({ uid: 99, gid: 100, platform: 'linux' });
  expect(channel.write.mock.calls[0][0]).toEqual(Buffer.from(response));
  await broker.stop();
});
test('compatible broker rejects root before creating a capability', () => {
  expect(() => createCompatibleQueueMaintenanceBroker({ channel: stream(), ...context, uid: 0 })).toThrow();
});
test('normal composition attaches the direct child channel and labels shared authority', () => {
  const channel = stream(), start = jest.fn(() => ({ maintenanceChannel: channel }));
  const report = jest.fn(), attach = jest.fn(() => ({ stop: jest.fn() })), onFatal = jest.fn();
  const attachIndexes = jest.fn(() => ({ stop: jest.fn() }));
  const composition = embeddedRuntimeComposition({ environment, start, attach, attachIndexes, report });
  composition.attachRuntimeMaintenance(composition.startApplication(), onFatal);
  expect(start).toHaveBeenCalledWith({ environment, queueMaintenance: true, imageIndexMaintenance: true, schemaMaintenance: true });
  expect(attach).toHaveBeenCalledWith({ channel, onFatal, report: expect.any(Function) });
  expect(report).toHaveBeenCalledWith('available', 'shared_identity', 'queue_recovery');
  expect(report).toHaveBeenCalledWith('available', 'shared_identity', 'image_indexes');
  attach.mock.calls[0][0].report('deferred');
  expect(report).toHaveBeenCalledWith('deferred', 'shared_identity', 'queue_recovery');
});
test('restore composition never attaches a maintenance channel', () => {
  const start = jest.fn(), attach = jest.fn();
  const composition = embeddedRuntimeComposition({ environment: { ...environment, CLASSIFARR_RUNTIME_MODE: 'restore' }, start, attach });
  composition.startApplication();
  expect(start.mock.calls[0][0].queueMaintenance).toBe(false);
  expect(composition.attachRuntimeMaintenance).toBeUndefined(); expect(attach).not.toHaveBeenCalled();
});
test('application gets FD3 and marker together without mutating saved configuration', async () => {
  const f = fixture(), app = startEmbeddedApplication({ ...f, environment, queueMaintenance: true });
  expect(f.spawnFn.mock.calls[0][2].stdio).toEqual(['ignore', 'inherit', 'inherit', 'pipe']);
  expect(f.spawnFn.mock.calls[0][2].env.CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL).toBe('stdio-v1');
  expect(environment.CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL).toBeUndefined();
  expect(app.maintenanceChannel).toBe(f.child.stdio[3]);
  f.child.emit('exit', 0, null); await app.done;
  expect(() => startEmbeddedApplication({ ...f, queueMaintenance: 'yes' })).toThrow();
  expect(() => assertEmbeddedSupervisorEnvironment({ ...environment, CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL: 'stdio-v1' },
    { ...context, args: ['--run'] })).toThrow();
});
test.each([{ uid: 0 }, { gid: 0 }, { uid: undefined }, { platform: 'win32' }, { cwd: '/tmp' },
  { args: [] }, { args: ['--assess', '--force'] }])('worker rejects context %j before database authority', async change => {
  const run = jest.fn();
  expect(await runCompatibleQueueRecovery({ environment, context: { ...context, ...change }, run })).toBe(2);
  expect(run).not.toHaveBeenCalled();
});
test.each(['CLASSIFARR_RUNTIME_MODE', 'CLASSIFARR_SCHEMA_MAINTENANCE', 'POSTGRES_HOST', 'POSTGRES_PORT',
  'POSTGRES_DB', 'POSTGRES_USER', 'CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL'])('worker rejects invalid %s before connecting', async key => {
  const run = jest.fn();
  expect(await runCompatibleQueueRecovery({ environment: { ...environment, [key]: 'invalid' }, context, run })).toBe(2);
  expect(run).not.toHaveBeenCalled();
});
test('worker delegates to existing independent automatic admission with explicit shared-identity logs', async () => {
  const run = jest.fn(async () => 75);
  expect(await runCompatibleQueueRecovery({ environment, context, run })).toBe(75);
  expect(run).toHaveBeenCalledWith({ args: ['--assess'], assertBoundary: assertCompatibleQueueDatabase,
    startedMessage: expect.stringContaining('shared identity'), unavailableMessage: expect.stringContaining('Shared identity') });
});
test.each([true, false, undefined, 'query-error'])('fixed database assertion %s always discards the checked connection', async compatible => {
  const client = { query: jest.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [{ compatible }] }), release: jest.fn() };
  if (compatible === 'query-error') client.query.mockRejectedValue(new Error('offline'));
  const database = { pool: { connect: jest.fn(async () => client) } };
  if (compatible === true) await assertCompatibleQueueDatabase(database);
  else await expect(assertCompatibleQueueDatabase(database)).rejects.toThrow();
  expect(client.release).toHaveBeenCalledWith(true);
  expect(client.query).toHaveBeenNthCalledWith(1, "SET statement_timeout = '3s'");
});
