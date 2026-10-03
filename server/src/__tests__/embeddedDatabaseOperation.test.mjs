/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { runEmbeddedDatabaseOperation } from '../bootstrap/embeddedDatabaseOperation.mjs';

afterEach(() => jest.useRealTimers());
test('returns completed work or preserves its error', async () => {
  expect(await runEmbeddedDatabaseOperation(async () => 7, { timeoutMs: 5000 })).toBe(7);
  const error = new Error('denied');
  await expect(runEmbeddedDatabaseOperation(async () => { throw error; }, { timeoutMs: 5000 })).rejects.toBe(error);
});
test.each([undefined, 0, -1, Infinity, 25001])('refuses unsafe budget %s before work', async timeoutMs => {
  const work = jest.fn();
  await expect(runEmbeddedDatabaseOperation(work, { timeoutMs })).rejects.toThrow('budget_invalid');
  expect(work).not.toHaveBeenCalled();
});
test('late success cannot beat an overdue timer', async () => {
  let time = 0;
  await expect(runEmbeddedDatabaseOperation(async () => { time = 5000; }, { timeoutMs: 5000, now: () => time }))
    .rejects.toThrow('operation_timeout');
});
test('cooperative timeout cancels and joins before returning', async () => {
  jest.useFakeTimers();
  let signal;
  const operation = runEmbeddedDatabaseOperation(cancellation => new Promise((resolve, reject) => {
    signal = cancellation;
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }), { timeoutMs: 5000 });
  const assertion = expect(operation).rejects.toThrow('operation_timeout');
  await jest.advanceTimersByTimeAsync(5000);
  await assertion;
  expect(signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
test('unjoinable work has only one additional second, not another full deadline', async () => {
  jest.useFakeTimers();
  const assertion = expect(runEmbeddedDatabaseOperation(() => new Promise(() => {}), { timeoutMs: 5000 }))
    .rejects.toThrow('operation_unjoined');
  await jest.advanceTimersByTimeAsync(6000);
  await assertion;
  expect(jest.getTimerCount()).toBe(0);
});
test('pre-cancellation never begins work', async () => {
  const abort = new AbortController(); abort.abort();
  const work = jest.fn();
  await expect(runEmbeddedDatabaseOperation(work, { signal: abort.signal, timeoutMs: 5000 })).rejects.toThrow('operation_cancelled');
  expect(work).not.toHaveBeenCalled();
});

test('host cancellation waits for cleanup, not the original operation deadline', async () => {
  jest.useFakeTimers();
  const host = new AbortController();
  let joined = false;
  const operation = runEmbeddedDatabaseOperation(signal => new Promise(resolve => {
    signal.addEventListener('abort', () => setTimeout(() => { joined = true; resolve('late'); }, 100), { once: true });
  }), { signal: host.signal, timeoutMs: 5000 });
  const assertion = expect(operation).rejects.toThrow('operation_cancelled');
  await jest.advanceTimersByTimeAsync(0);
  host.abort();
  expect(joined).toBe(false);
  await jest.advanceTimersByTimeAsync(100); await assertion;
  expect(joined).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
