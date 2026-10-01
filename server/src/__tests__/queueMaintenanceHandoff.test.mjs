/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { createQueueMaintenanceHandoffClient, openQueueMaintenanceHandoff } from '../services/queueMaintenanceHandoffClient.mjs';
import { createEmbeddedQueueMaintenanceBroker } from '../bootstrap/embeddedQueueMaintenanceBroker.mjs';
import { queueMaintenanceResultByte } from '../utils/queueMaintenanceHandoffProtocol.mjs';

const channel = () => Object.assign(new EventEmitter(), { write: jest.fn(() => true), destroy: jest.fn(), unref: jest.fn() });
const tick = () => new Promise(resolve => { setImmediate(resolve); });
function broker(options = {}) {
  const stream = channel(), report = jest.fn(), onFatal = jest.fn();
  let resolve;
  const job = { done: new Promise(done => { resolve = done; }), signal: jest.fn() };
  const start = jest.fn(() => job);
  const value = createEmbeddedQueueMaintenanceBroker({ channel: stream, identity: { name: 'postgres', uid: 70, gid: 70 },
    databaseName: 'fixture', parentUid: 0, start, report, onFatal, ...options });
  return { stream, report, onFatal, job, start, resolve, value };
}

test.each([[0, null, 0x43], [75, null, 0x44], [1, null, 0x45], [0, 'SIGTERM', 0x45]])
  ('only confirmed code %s signal %s yields fixed result %s', (code, signal, byte) => {
    expect(queueMaintenanceResultByte({ code, signal })).toBe(byte);
  });
test.each([0x43, 0x44, 0x45])('client coalesces, accepts fixed result %s, and throttles subsequent requests', async byte => {
  const stream = channel(); let now = 0;
  const client = createQueueMaintenanceHandoffClient({ channel: stream, now: () => now });
  const first = client.request(); expect(client.request()).toBe(first);
  expect(stream.write.mock.calls[0][0]).toEqual(Buffer.from([0x51]));
  stream.emit('data', Buffer.from([byte]));
  expect((await first).status).toBe({ 0x43: 'complete', 0x44: 'deferred', 0x45: 'unavailable' }[byte]);
  expect((await client.request()).status).toBe('deferred');
  expect(stream.write).toHaveBeenCalledTimes(1);
  now = 300_000;
  const next = client.request(); client.close();
  expect((await next).status).toBe('unavailable');
  expect((await client.request()).status).toBe('unavailable');
  expect(stream.destroy).toHaveBeenCalledTimes(1);
});
test.each(['oversize', 'unknown', 'string', 'error', 'end', 'close', 'write-throw', 'backpressure', 'callback-error'])
  ('client %s fails closed without retries or raw error propagation', async scenario => {
    const stream = channel();
    if (scenario === 'write-throw') stream.write.mockImplementation(() => { throw new Error('secret'); });
    if (scenario === 'backpressure') stream.write.mockReturnValue(false);
    if (scenario === 'callback-error') stream.write.mockImplementation((_chunk, cb) => { cb(new Error('secret')); return true; });
    const client = createQueueMaintenanceHandoffClient({ channel: stream });
    const work = client.request();
    if (scenario === 'oversize') stream.emit('data', Buffer.from('CC'));
    if (scenario === 'unknown') stream.emit('data', Buffer.from('X'));
    if (scenario === 'string') stream.emit('data', 'C');
    if (['error', 'end', 'close'].includes(scenario)) stream.emit(scenario, new Error('secret'));
    expect(await work).toEqual({ status: 'unavailable', via: 'maintenance_handoff' });
    expect(stream.write).toHaveBeenCalledTimes(1);
  });
test('client deadline closes and clears its one timer', async () => {
  jest.useFakeTimers();
  try {
    const stream = channel(), client = createQueueMaintenanceHandoffClient({ channel: stream });
    const work = client.request();
    await jest.advanceTimersByTimeAsync(95_000);
    expect((await work).status).toBe('unavailable');
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
test('unsolicited response closes capability and optional open never escalates', async () => {
  const stream = channel(), client = createQueueMaintenanceHandoffClient({ channel: stream });
  stream.emit('data', Buffer.from('C'));
  expect((await client.request()).status).toBe('unavailable');
  const connect = jest.fn(() => stream);
  expect(openQueueMaintenanceHandoff({ environment: {}, connect })).toBeNull();
  expect(connect).not.toHaveBeenCalled();
  expect(await openQueueMaintenanceHandoff({ environment: { CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL: 'stdio-v1' }, platform: 'win32', connect }).request())
    .toMatchObject({ status: 'unavailable' });
  expect(connect).not.toHaveBeenCalled();
  const opened = openQueueMaintenanceHandoff({ environment: { CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL: 'stdio-v1' }, platform: 'linux', connect });
  opened.close();
  connect.mockImplementation(() => { throw new Error('bad fd'); });
  expect(await openQueueMaintenanceHandoff({ environment: { CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL: 'stdio-v1' }, platform: 'linux', connect }).request())
    .toMatchObject({ status: 'unavailable' });
});

test('broker starts no child until a fixed request and reports only observed exit', async () => {
  const f = broker();
  expect(f.start).not.toHaveBeenCalled();
  f.stream.emit('data', Buffer.from('Q')); await tick();
  expect(f.start).toHaveBeenCalledWith({ kind: 'queueRecovery', identity: { name: 'postgres', uid: 70, gid: 70 }, databaseName: 'fixture', parentUid: 0 });
  expect(f.stream.write).not.toHaveBeenCalled();
  f.resolve({ code: 0, signal: null }); await tick();
  expect(f.stream.write.mock.calls[0][0]).toEqual(Buffer.from('C'));
  await f.value.stop();
});
test.each([Buffer.from('schema'), Buffer.alloc(100_000), 'Q', Buffer.from('')])('invalid broker frame never spawns or buffers', async frame => {
  const f = broker(); f.stream.emit('data', frame); await tick();
  expect(f.start).not.toHaveBeenCalled(); expect(f.stream.destroy).toHaveBeenCalledTimes(1);
  await f.value.stop();
});
test('flood before launch closes capability without starting a job', async () => {
  const f = broker(); f.stream.emit('data', Buffer.from('Q')); f.stream.emit('data', Buffer.from('Q'));
  await f.value.stop(); expect(f.start).not.toHaveBeenCalled();
});
test('concurrent request cancels and joins only the active direct child', async () => {
  const f = broker(); f.job.signal.mockImplementation(() => f.resolve({ code: null, signal: 'SIGTERM' }));
  f.stream.emit('data', Buffer.from('Q')); await tick();
  f.stream.emit('data', Buffer.from('Q')); await f.value.stop();
  expect(f.job.signal).toHaveBeenCalledWith('SIGTERM'); expect(f.start).toHaveBeenCalledTimes(1);
  expect(f.stream.write).not.toHaveBeenCalled();
});
test('request floor survives a completed job; later requests cannot queue around it', async () => {
  const f = broker({ now: () => 0 }); f.resolve({ code: 75, signal: null });
  f.stream.emit('data', Buffer.from('Q')); await tick();
  expect(f.stream.write.mock.calls[0][0]).toEqual(Buffer.from('D'));
  f.stream.emit('data', Buffer.from('Q')); await f.value.stop();
  expect(f.start).toHaveBeenCalledTimes(1); expect(f.report).toHaveBeenCalledWith('request_rejected');
});
test.each(['deadline', 'unconfirmed', 'spawn', 'backpressure', 'write-throw', 'callback-error'])
  ('broker %s cannot report completion or leave an unjoined child as success', async scenario => {
    const wait = jest.fn(promise => promise);
    if (scenario === 'deadline') wait.mockRejectedValueOnce(new Error('deadline')).mockRejectedValueOnce(new Error('TERM')).mockResolvedValueOnce({ code: 1 });
    if (scenario === 'unconfirmed') wait.mockRejectedValue(new Error('not stopped'));
    const f = broker({ wait });
    if (scenario === 'spawn') f.start.mockImplementation(() => { throw new Error('secret'); });
    if (scenario === 'backpressure') f.stream.write.mockReturnValue(false);
    if (scenario === 'write-throw') f.stream.write.mockImplementation(() => { throw new Error('secret'); });
    if (scenario === 'callback-error') f.stream.write.mockImplementation((_chunk, cb) => { cb(new Error('secret')); return true; });
    if (!['deadline', 'unconfirmed'].includes(scenario)) f.resolve({ code: 1, signal: null });
    f.stream.emit('data', Buffer.from('Q')); await tick();
    if (scenario === 'unconfirmed') {
      await expect(f.value.stop()).rejects.toThrow('maintenance_exit_unconfirmed'); expect(f.onFatal).toHaveBeenCalledTimes(1);
    } else await f.value.stop();
    expect(JSON.stringify(f.report.mock.calls)).not.toContain('secret');
    expect(f.report).not.toHaveBeenCalledWith('completed');
  });
test('broker refuses untrusted composition', () => {
  expect(() => broker({ parentUid: 1000 })).toThrow('maintenance_broker_invalid');
  expect(() => broker({ channel: null })).toThrow();
  expect(() => broker({ identity: { name: 'root' } })).toThrow();
});
