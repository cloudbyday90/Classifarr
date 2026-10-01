/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { encodeImageIndexClaim, decodeImageIndexClaim } from '../utils/imageIndexHandoffProtocol.mjs';
import { openImageIndexHandoff } from '../services/imageIndexHandoffClient.mjs';
import { createCompatibleImageIndexBroker, startCompatibleImageIndex } from '../bootstrap/embeddedCompatibleImageIndex.mjs';
import { runCompatibleImageIndex, readImageIndexClaim } from '../scripts/runCompatibleImageIndex.mjs';
import { compatibleMaintenanceEnvironment } from '../bootstrap/embeddedCompatibleMaintenanceEnvironment.mjs';
import { rebuildImageIndexes } from '../services/queueTaskProcessorIndexing.mjs';
import { claimNotOwned } from '../services/queueClaimWriteGuard.mjs';
import { startEmbeddedApplication } from '../bootstrap/embeddedChildProcess.mjs';
import { embeddedRuntimeComposition, assertEmbeddedSupervisorEnvironment } from '../scripts/runEmbeddedSupervisor.mjs';

const task = { id: '123', claim_token: '11111111-1111-4111-8111-111111111111' };
const context = { uid: 99, gid: 100, platform: 'linux', cwd: '/app', args: ['--claim'] };
const environment = compatibleMaintenanceEnvironment();
const tick = () => new Promise(resolve => { setImmediate(resolve); });
const channel = () => Object.assign(new EventEmitter(), { write: jest.fn(() => true), destroy: jest.fn(), unref: jest.fn() });
const open = stream => openImageIndexHandoff({ environment: { CLASSIFARR_IMAGE_INDEX_CHANNEL: 'stdio-v1' }, platform: 'linux', connect: () => stream });

test('claim frame excludes all payload fields and supports fragmented stdin', async () => {
  const frame = encodeImageIndexClaim({ ...task, payload: { sql: 'DROP DATABASE secret' } });
  expect(frame.length).toBe(56);
  expect(decodeImageIndexClaim(frame)).toEqual(task);
  expect(await readImageIndexClaim(Readable.from([frame.subarray(0, 7), frame.subarray(7)]))).toEqual(task);
});
test.each([undefined, {}, { ...task, id: 0 }, { ...task, id: '01' }, { ...task, id: '9223372036854775808' },
  { ...task, id: 9007199254740992 }, { ...task, claim_token: 'arbitrary' }])('invalid claim %j is rejected', value => {
  expect(() => encodeImageIndexClaim(value)).toThrow('image_index_claim_invalid');
});
test.each([Buffer.alloc(0), Buffer.alloc(57), Buffer.from('I'.repeat(56)), 'secret'])('malformed input never decodes', async frame => {
  expect(() => decodeImageIndexClaim(frame)).toThrow();
  await expect(readImageIndexClaim(Readable.from([frame]))).rejects.toThrow();
});
test('high-bit alias and zero ID are refused', () => {
  const frame = encodeImageIndexClaim(task); frame[0] |= 0x80;
  expect(() => decodeImageIndexClaim(frame)).toThrow();
  expect(() => decodeImageIndexClaim(Buffer.from(`I${'0'.repeat(19)}${task.claim_token}`))).toThrow();
});
test('dedicated client never coalesces different claims or falls back on channel failure', async () => {
  const stream = channel(), client = open(stream);
  const pending = client.request(task);
  expect(await client.request({ ...task, id: '124' })).toMatchObject({ status: 'deferred' });
  expect(stream.write.mock.calls[0][0]).toEqual(encodeImageIndexClaim(task));
  stream.emit('data', Buffer.from('C'));
  expect(await pending).toMatchObject({ status: 'complete' });
  expect(await client.request(task)).toMatchObject({ status: 'deferred' });
  client.close();
  expect(await client.request(task)).toMatchObject({ status: 'unavailable' });
});
test('absent channel is standalone; configured unsupported or broken channel is unavailable', async () => {
  expect(openImageIndexHandoff({ environment: {} })).toBeNull();
  for (const marker of ['', 'stdio-v2']) {
    const client = openImageIndexHandoff({ environment: { CLASSIFARR_IMAGE_INDEX_CHANNEL: marker }, platform: 'linux' });
    expect(await client.request(task)).toMatchObject({ status: 'unavailable' });
  }
  for (const platform of ['win32', 'linux']) {
    const connect = jest.fn(() => { throw new Error('secret'); });
    const client = openImageIndexHandoff({ environment: { CLASSIFARR_IMAGE_INDEX_CHANNEL: 'stdio-v1' }, platform, connect });
    expect(await client.request(task)).toMatchObject({ status: 'unavailable' });
  }
});
test('image deadline closes the capability and does not leave a timer', async () => {
  jest.useFakeTimers();
  try {
    const client = open(channel()), pending = client.request(task);
    await jest.advanceTimersByTimeAsync(140_000);
    expect(await pending).toMatchObject({ status: 'unavailable' });
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
test('broker waits for a full fixed frame and starts one claimed worker', async () => {
  const stream = channel(), start = jest.fn(() => ({ done: Promise.resolve({ code: 0, signal: null }) }));
  const broker = createCompatibleImageIndexBroker({ channel: stream, start, ...context });
  const frame = encodeImageIndexClaim(task);
  stream.emit('data', frame.subarray(0, 4)); await tick(); expect(start).not.toHaveBeenCalled();
  stream.emit('data', frame.subarray(4)); await tick();
  expect(start).toHaveBeenCalledWith({ task, uid: 99, gid: 100, platform: 'linux' });
  expect(stream.write.mock.calls[0][0]).toEqual(Buffer.from('C'));
  await broker.stop();
});
test.each(['extra', 'unknown', 'concurrent'])('broker rejects %s frame without a second child', async scenario => {
  const stream = channel(); let resolve;
  const child = { done: new Promise(done => { resolve = done; }), signal: jest.fn(() => resolve({ code: null, signal: 'SIGTERM' })) };
  const start = jest.fn(() => child);
  const broker = createCompatibleImageIndexBroker({ channel: stream, start, ...context });
  if (scenario === 'extra') stream.emit('data', Buffer.concat([encodeImageIndexClaim(task), Buffer.from('x')]));
  if (scenario === 'unknown') stream.emit('data', Buffer.alloc(56));
  if (scenario === 'concurrent') {
    stream.emit('data', encodeImageIndexClaim(task)); await tick();
    stream.emit('data', encodeImageIndexClaim(task));
  }
  await broker.stop();
  expect(start).toHaveBeenCalledTimes(scenario === 'concurrent' ? 1 : 0);
  expect(stream.destroy).toHaveBeenCalledTimes(1);
});
test.each([[99, 100], [1000, 1000], [2345, 2345]])('launcher preserves %s:%s identity and fixed environment', async (uid, gid) => {
  const child = Object.assign(new EventEmitter(), { pid: 42, kill: jest.fn(), stdout: channel(), stderr: channel(),
    stdin: Object.assign(channel(), { end: jest.fn() }) });
  const spawnFn = jest.fn(() => child);
  const job = startCompatibleImageIndex({ task, spawnFn, ...context, uid, gid });
  expect(spawnFn).toHaveBeenCalledWith('/usr/local/bin/node', ['/app/src/scripts/runCompatibleImageIndex.mjs', '--claim'],
    { cwd: '/app', shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: environment });
  expect(child.stdin.end).toHaveBeenCalledWith(encodeImageIndexClaim(task));
  child.emit('exit', 0, null); child.emit('close');
  expect(await job.done).toEqual({ code: 0, signal: null });
});
test.each([{ uid: 0 }, { gid: 0 }, { platform: 'win32' }])('launcher/broker reject unsupported context %j', change => {
  const spawnFn = jest.fn();
  expect(() => startCompatibleImageIndex({ task, spawnFn, ...context, ...change })).toThrow();
  expect(() => createCompatibleImageIndexBroker({ channel: channel(), ...context, ...change })).toThrow();
  expect(spawnFn).not.toHaveBeenCalled();
});
function commandFixture() {
  const database = { pool: { end: jest.fn() } };
  return { database, environment, context, input: Readable.from([encodeImageIndexClaim(task)]),
    loadDatabase: jest.fn(async () => database), assertDatabase: jest.fn(),
    run: jest.fn(async () => ({ status: 'complete' })), output: jest.fn() };
}
test.each([['complete', 0], ['deferred', 75]])('command returns %s only after executor and pool cleanup', async (status, code) => {
  const f = commandFixture(); f.run.mockResolvedValue({ status });
  expect(await runCompatibleImageIndex(f)).toBe(code);
  expect(f.run).toHaveBeenCalledWith({ database: f.database, task });
  expect(f.database.pool.end).toHaveBeenCalledTimes(1);
});
test.each(['arguments', 'identity', 'input', 'marker'])('bad %s never opens the database', async scenario => {
  const f = commandFixture();
  if (scenario === 'arguments') f.context = { ...context, args: ['--claim', '--force'] };
  if (scenario === 'identity') f.context = { ...context, uid: 0 };
  if (scenario === 'input') f.input = Readable.from([Buffer.alloc(100)]);
  if (scenario === 'marker') f.environment = { ...environment, CLASSIFARR_IMAGE_INDEX_CHANNEL: 'stdio-v1' };
  expect(await runCompatibleImageIndex(f)).toBe(2); expect(f.loadDatabase).not.toHaveBeenCalled();
});
test.each(['loadDatabase', 'assertDatabase', 'run', 'cleanup', 'stale'])('%s failure is sanitized, never successful', async stage => {
  const f = commandFixture();
  if (stage === 'cleanup') f.database.pool.end.mockRejectedValue(new Error('secret'));
  else if (stage === 'stale') f.run.mockRejectedValue(claimNotOwned());
  else f[stage].mockRejectedValue(new Error('secret'));
  expect(await runCompatibleImageIndex(f)).toBe(stage === 'stale' ? 75 : 1);
  expect(JSON.stringify(f.output.mock.calls)).not.toContain('secret');
});
test.each(['complete', 'deferred', 'unavailable'])('queue adapter %s never invokes direct fallback or duplicates acknowledgement', async status => {
  const maintenance = jest.fn(), logger = { info: jest.fn(), debug: jest.fn() };
  const handoff = { request: jest.fn(async () => ({ status })) };
  const work = rebuildImageIndexes(task, { db: {}, maintenance, logger, handoff });
  if (status === 'unavailable') await expect(work).rejects.toThrow('image_index_handoff_unavailable');
  else await expect(work).resolves.toEqual({ status });
  expect(maintenance).not.toHaveBeenCalled(); expect(handoff.request).toHaveBeenCalledWith(task);
});
test('both brokers are drained even when one fails; partial attachment also drains', async () => {
  const queue = { stop: jest.fn(() => { throw new Error('unjoined'); }) }, indexes = { stop: jest.fn() };
  const attach = () => queue, onFatal = jest.fn();
  const composition = embeddedRuntimeComposition({ environment, attach, attachIndexes: () => indexes });
  await expect(composition.attachRuntimeMaintenance({}, onFatal).stop()).rejects.toThrow('maintenance_exit_unconfirmed');
  expect(indexes.stop).toHaveBeenCalledTimes(1);
  const partial = embeddedRuntimeComposition({ environment, attach, attachIndexes: () => { throw new Error('unavailable'); } });
  await expect(partial.attachRuntimeMaintenance({}, onFatal).stop()).rejects.toThrow();
  expect(onFatal).toHaveBeenCalledTimes(1);
});
test('FD4 is internal, paired with FD3 and excluded from restore composition', () => {
  const child = Object.assign(new EventEmitter(), { stdio: [null, null, null, channel(), channel()] });
  const spawnFn = jest.fn(() => child);
  const app = startEmbeddedApplication({ environment, spawnFn, queueMaintenance: true, imageIndexMaintenance: true });
  expect(app.imageIndexChannel).toBe(child.stdio[4]);
  expect(spawnFn.mock.calls[0][2].env.CLASSIFARR_IMAGE_INDEX_CHANNEL).toBe('stdio-v1');
  expect(environment.CLASSIFARR_IMAGE_INDEX_CHANNEL).toBeUndefined();
  expect(() => startEmbeddedApplication({ spawnFn, imageIndexMaintenance: true })).toThrow();
  expect(() => assertEmbeddedSupervisorEnvironment({ ...environment, CLASSIFARR_IMAGE_INDEX_CHANNEL: 'stdio-v1' },
    { ...context, args: ['--run'] })).toThrow();
  const start = jest.fn();
  const restore = embeddedRuntimeComposition({ environment: { ...environment, CLASSIFARR_RUNTIME_MODE: 'restore' }, start });
  restore.startApplication(); expect(start.mock.calls[0][0].imageIndexMaintenance).toBe(false);
  expect(restore.attachRuntimeMaintenance).toBeUndefined();
});
