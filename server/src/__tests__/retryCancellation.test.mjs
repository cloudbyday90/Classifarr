/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { getEventListeners } from 'node:events';
import { isRetryableError, withRetry } from '../utils/retryUtils.mjs';

const aborted = { name: 'AbortError', code: 'ABORT_ERR', message: 'Request cancelled' };

test.each([
  { name: 'AbortError', message: 'timeout', code: 'ETIMEDOUT' },
  { code: 'ABORT_ERR', response: { status: 503 } },
  { code: 'ERR_CANCELED', response: { status: 429 } },
])('explicit cancellation takes precedence over transient hints: %p', async error => {
  expect(isRetryableError(error)).toBe(false);
  const run = jest.fn().mockRejectedValue(error);
  const onRetry = jest.fn();
  await expect(withRetry(run, { onRetry })()).rejects.toBe(error);
  expect(run).toHaveBeenCalledTimes(1);
  expect(onRetry).not.toHaveBeenCalled();
});

test('a pre-aborted signal suppresses the first attempt and retry notification', async () => {
  const run = jest.fn();
  const onRetry = jest.fn();
  await expect(withRetry(run, { signal: AbortSignal.abort('private reason'), onRetry })())
    .rejects.toMatchObject(aborted);
  expect(run).not.toHaveBeenCalled();
  expect(onRetry).not.toHaveBeenCalled();
});

test('cancellation during a failed attempt prevents retry admission', async () => {
  const caller = new AbortController();
  const onRetry = jest.fn();
  const run = jest.fn(async () => {
    caller.abort({ secret: 'private reason' });
    throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
  });
  await expect(withRetry(run, { signal: caller.signal, onRetry })()).rejects.toMatchObject(aborted);
  expect(run).toHaveBeenCalledTimes(1);
  expect(onRetry).not.toHaveBeenCalled();
});

test.each([false, true])('cancels pending backoff promptly and removes timer listeners; Retry-After: %s', async retryAfter => {
  const caller = new AbortController();
  const error = Object.assign(new Error('transient failure'), {
    response: { status: 503, headers: retryAfter ? { 'retry-after': '60' } : {} },
  });
  const run = jest.fn().mockRejectedValue(error);
  const onRetry = jest.fn(() => { queueMicrotask(() => caller.abort('private reason')); });
  const result = withRetry(run, { signal: caller.signal, baseDelay: 60000, jitter: 0, onRetry })();
  await expect(result).rejects.toMatchObject(aborted);
  expect(run).toHaveBeenCalledTimes(1);
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(getEventListeners(caller.signal, 'abort')).toHaveLength(0);
  expect((await result.catch(value => value)).cause).toBeUndefined();
});

test('cancellation inside onRetry does not start a later attempt', async () => {
  const caller = new AbortController();
  const run = jest.fn().mockRejectedValue({ code: 'ETIMEDOUT' });
  await expect(withRetry(run, {
    signal: caller.signal, onRetry: () => caller.abort(), baseDelay: 60000,
  })()).rejects.toMatchObject(aborted);
  expect(run).toHaveBeenCalledTimes(1);
});

test('retains successful transient retries and cleans up listeners after delay completion', async () => {
  const caller = new AbortController();
  const run = jest.fn().mockRejectedValueOnce({ code: 'ETIMEDOUT' }).mockResolvedValue('success');
  await expect(withRetry(run, { signal: caller.signal, baseDelay: 1, jitter: 0 })()).resolves.toBe('success');
  expect(run).toHaveBeenCalledTimes(2);
  expect(getEventListeners(caller.signal, 'abort')).toHaveLength(0);
});
