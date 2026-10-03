/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { probeEmbeddedDatabase } from '../bootstrap/embeddedDatabaseProbe.mjs';

afterEach(() => jest.useRealTimers());
test('success and unknown failure have explicit joined outcomes', async () => {
  expect(await probeEmbeddedDatabase(async () => {})).toEqual({ state: 'ok', joined: true });
  expect(await probeEmbeddedDatabase(async () => { throw new Error('private diagnostic'); })).toEqual({ state: 'failed', joined: true });
});
test.each(['database_probe_timeout', 'database_probe_resource_pressure'])('only recognized transient code %s can be retried', async code => {
  expect(await probeEmbeddedDatabase(async () => { throw { code }; })).toEqual({ state: 'transient', reason: code, joined: true });
});
test('timeout aborts and joins a cooperative operation', async () => {
  jest.useFakeTimers();
  let signal;
  const result = probeEmbeddedDatabase(options => new Promise((resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  await jest.advanceTimersByTimeAsync(3000);
  expect(await result).toEqual({ state: 'transient', reason: 'database_probe_timeout', joined: true });
  expect(signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
test('a stuck operation cannot be replaced by another probe', async () => {
  jest.useFakeTimers();
  const result = probeEmbeddedDatabase(() => new Promise(() => {}));
  await jest.advanceTimersByTimeAsync(4000);
  expect(await result).toEqual({ state: 'unjoined', joined: false });
  expect(jest.getTimerCount()).toBe(0);
});
test('late success is a timeout, never recovery', async () => {
  let time = 0;
  const result = await probeEmbeddedDatabase(async () => { time = 4000; }, { now: () => time });
  expect(result).toEqual({ state: 'transient', reason: 'database_probe_timeout', joined: true });
});
test('a concrete failure during cancellation wins over inferred timeout', async () => {
  jest.useFakeTimers();
  const result = probeEmbeddedDatabase(({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('database_identity_changed')), { once: true });
  }));
  await jest.advanceTimersByTimeAsync(3000);
  expect(await result).toEqual({ state: 'failed', joined: true });
});
test('host cancellation joins promptly and cancels deadline timers', async () => {
  const abort = new AbortController();
  expect(await probeEmbeddedDatabase(async () => { abort.abort(); }, { signal: abort.signal })).toEqual({ state: 'cancelled', joined: true });
  const check = jest.fn();
  expect(await probeEmbeddedDatabase(check, { signal: abort.signal })).toEqual({ state: 'cancelled', joined: true });
  expect(check).not.toHaveBeenCalled();
});
test.each([0, Infinity, -1, 3001])('rejects unsafe probe budget %s', async timeoutMs => {
  await expect(probeEmbeddedDatabase(jest.fn(), { timeoutMs })).rejects.toThrow('budget_invalid');
});
