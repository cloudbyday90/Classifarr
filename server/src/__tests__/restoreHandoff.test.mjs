/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { createRestoreHandoffClient } from '../services/restoreHandoffClient.mjs';
import { createSelectedRestoreHandoff } from '../bootstrap/embeddedRestoreHandoff.mjs';

const turn = () => new Promise(resolve => { setImmediate(resolve); });
function channel() {
  return Object.assign(new EventEmitter(), { destroy: jest.fn(), write: jest.fn(() => false),
    end: jest.fn((_bytes, callback) => callback()) });
}
const frame = (size, body = Buffer.alloc(0)) => {
  const header = Buffer.alloc(4); header.writeUInt32BE(size); return Buffer.concat([header, body]);
};

test.each([[0x43, 'complete'], [0x44, 'deferred'], [0x52, 'rejected'], [0x45, 'unavailable']])('client joins reply EOF and accepts backpressure: %s', async (byte, status) => {
  const stream = channel(), client = createRestoreHandoffClient({ channel: stream });
  const input = Buffer.from('synthetic');
  let settled = false;
  const result = client.request(input).then(value => { settled = true; return value; });
  expect(stream.write).toHaveBeenCalledTimes(2);
  expect(stream.write.mock.calls[0][0].readUInt32BE()).toBe(input.length);
  stream.emit('data', Buffer.from([byte])); await turn(); expect(settled).toBe(false);
  stream.emit('end'); expect(await result).toEqual({ status });
  expect(await client.request(input)).toEqual({ status: 'unavailable' });
  expect(input.toString()).toBe('synthetic');
});

test.each(['extra', 'unknown', 'close', 'error', 'timeout', 'write'])('client fails closed without replay: %s', async failure => {
  const stream = channel(), client = createRestoreHandoffClient({ channel: stream, timeoutMs: 10 });
  if (failure === 'write') stream.write.mockImplementation(() => { throw new Error('private'); });
  const result = client.request(Buffer.from('x'));
  if (failure === 'extra') stream.emit('data', Buffer.from([0x43, 0x43]));
  if (failure === 'unknown') stream.emit('data', Buffer.from([0xff]));
  if (failure === 'close') stream.emit('close');
  if (failure === 'error') stream.emit('error', new Error('private'));
  expect(await result).toEqual({ status: 'unavailable' });
  expect(await client.request(Buffer.from('x'))).toEqual({ status: 'unavailable' });
});

test('invalid client input does not consume a capability', async () => {
  const stream = channel(), client = createRestoreHandoffClient({ channel: stream });
  for (const value of [null, 'x', Buffer.alloc(0), Buffer.alloc(64 * 1024 * 1024 + 1)]) {
    expect(await client.request(value)).toEqual({ status: 'rejected' });
  }
  expect(stream.write).not.toHaveBeenCalled(); client.close();
});

function broker(options = {}) {
  const stream = channel(), input = Buffer.from('synthetic');
  const start = jest.fn(() => ({ done: Promise.resolve({ code: 0, signal: null }), signal: jest.fn() }));
  const onFatal = jest.fn(), report = jest.fn();
  const value = createSelectedRestoreHandoff({ channel: stream, identity: { uid: 70, gid: 70 }, uid: 0,
    start, onFatal, report, ...options });
  return { stream, input, start, onFatal, report, value };
}

test.each([[0, 0x43], [75, 0x44], [2, 0x52], [1, 0x45]])('fixed worker completion %s maps to a fixed byte', async (code, byte) => {
  const f = broker(); f.start.mockReturnValue({ done: Promise.resolve({ code, signal: null }) });
  const bytes = frame(f.input.length, f.input);
  for (const part of [bytes.subarray(0, 1), bytes.subarray(1, 6), bytes.subarray(6)]) f.stream.emit('data', part);
  await turn(); await f.value.stop();
  expect(f.start).toHaveBeenCalledTimes(1);
  expect(f.start.mock.calls[0][0]).toMatchObject({ operation: 'restore', identity: { uid: 70, gid: 70 } });
  expect(f.start.mock.calls[0][0].request.every(byte => byte === 0)).toBe(true);
  expect(f.stream.end.mock.calls[0][0]).toEqual(Buffer.from([byte]));
});

test.each([0, 64 * 1024 * 1024 + 1])('rejects frame length %s before launch', async size => {
  const f = broker(); f.stream.emit('data', frame(size)); await f.value.stop();
  expect(f.start).not.toHaveBeenCalled(); expect(f.stream.destroy).toHaveBeenCalled();
});

test.each(['surplus', 'partial', 'disconnect'])('invalid transfer %s cannot launch', async kind => {
  const f = broker({ receiveTimeoutMs: 5 });
  f.stream.emit('data', kind === 'surplus' ? frame(1, Buffer.from('xx')) : Buffer.from([0]));
  if (kind === 'disconnect') f.stream.emit('end');
  if (kind === 'partial') await new Promise(resolve => { setTimeout(resolve, 10); });
  await f.value.stop(); expect(f.start).not.toHaveBeenCalled();
});

test('disconnect kills and joins the worker before clearing request memory', async () => {
  let resolve;
  const done = new Promise(r => { resolve = r; });
  const signal = jest.fn(() => resolve({ code: null, signal: 'SIGTERM' }));
  const f = broker(); f.start.mockReturnValue({ done, signal });
  f.stream.emit('data', frame(1, Buffer.from('x'))); await turn();
  f.stream.emit('close'); await f.value.stop();
  expect(signal).toHaveBeenCalledWith('SIGTERM');
  expect(f.start.mock.calls[0][0].request[0]).toBe(0);
  expect(f.stream.end).not.toHaveBeenCalled();
});

test('unconfirmed worker exit invokes fatal handler and rejects join', async () => {
  const wait = jest.fn().mockRejectedValue(new Error('private'));
  const f = broker({ wait }); f.start.mockReturnValue({ done: new Promise(() => {}), signal: jest.fn() });
  f.stream.emit('data', frame(1, Buffer.from('x'))); await turn();
  await expect(f.value.stop()).rejects.toThrow('restore_worker_exit_unconfirmed');
  expect(f.onFatal).toHaveBeenCalledTimes(1);
});

test('parent requires root and an explicit fail-stop handler', () => {
  expect(() => createSelectedRestoreHandoff({ channel: channel(), uid: 1000, onFatal() {} })).toThrow();
  expect(() => createSelectedRestoreHandoff({ channel: channel(), uid: 0 })).toThrow();
});
